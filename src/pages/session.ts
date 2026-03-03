import JSZip from "jszip";
import type { Expression, Participant, Turn } from "../data";
import { getCurrentSession } from "../store";

type AspectMode = "16:9" | "9:16";

export function renderSession(root: HTMLElement) {
  const session = getCurrentSession();
  if (!session) {
    root.innerHTML = `
      <div class="card">
        <div style="font-weight:700; font-size:18px;">Session</div>
        <div class="muted">생성된 토론이 없습니다. Home에서 책/챕터를 선택하고 토론을 시작하세요.</div>
      </div>
    `;
    return;
  }

  const sessionData = session;

  let aspect: AspectMode = "16:9";
  let idx = 0;
  let playing = false;
  let timer: number | null = null;

  root.innerHTML = `
    <div class="card">
      <div class="row">
        <div>
          <div style="font-weight:700; font-size:18px;">Session</div>
          <div class="muted">${sessionData.date} / ${sessionData.bookTitle} / Chapter ${sessionData.chapter}</div>
          <div class="muted">Participants: ${sessionData.participants.length} (max 4) · Turns: ${sessionData.turns.length}</div>
          <div class="muted">Members: ${sessionData.participants
            .map((p) => p.displayName || p.id.toUpperCase())
            .join(", ")}</div>
        </div>
        <div class="muted">Aspect: <span id="aspectLabel">16:9</span></div>
      </div>
    </div>

    <div class="bar">
      <div class="left">
        <button class="btn" id="prevBtn">Prev</button>
        <button class="btn primary" id="playBtn">Play</button>
        <button class="btn" id="nextBtn">Next</button>
      </div>
      <div class="right">
        <button class="btn" id="a169">16:9</button>
        <button class="btn" id="a916">9:16</button>
        <button class="btn" id="downloadBtn">Download PNG</button>
        <button class="btn primary" id="downloadAllBtn">Download ALL (ZIP)</button>
      </div>
    </div>

    <div class="stage">
      <canvas id="canvas"></canvas>
    </div>

    <div class="card">
      <div class="muted">
        ?꾨컮? 寃쎈줈: <span class="kbd">/avatars/{id}/{expression}.png</span>
        (?놁쑝硫?neutral濡??먮룞 ?泥?
      </div>
    </div>
  `;

  const canvas = root.querySelector("#canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const aspectLabel = root.querySelector("#aspectLabel") as HTMLSpanElement;

  const prevBtn = root.querySelector("#prevBtn") as HTMLButtonElement;
  const playBtn = root.querySelector("#playBtn") as HTMLButtonElement;
  const nextBtn = root.querySelector("#nextBtn") as HTMLButtonElement;
  const a169 = root.querySelector("#a169") as HTMLButtonElement;
  const a916 = root.querySelector("#a916") as HTMLButtonElement;
  const downloadBtn = root.querySelector("#downloadBtn") as HTMLButtonElement;
  const downloadAllBtn = root.querySelector(
    "#downloadAllBtn"
  ) as HTMLButtonElement;

  // ---- image cache ----
  const imgCache = new Map<string, Promise<HTMLImageElement>>();

  function loadImage(src: string): Promise<HTMLImageElement> {
    if (imgCache.has(src)) return imgCache.get(src)!;
    const p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Image load failed: ${src}`));
      img.src = src;
    });
    imgCache.set(src, p);
    return p;
  }

  function avatarSrc(p: Participant, expr: Expression): string {
    return `${p.spriteBase}/${expr}.png`;
  }

  async function getAvatarImage(
    p: Participant,
    expr: Expression
  ): Promise<HTMLImageElement | null> {
    // expr ?뚯씪???놁쓣 ???덉쑝??neutral濡??대갚
    try {
      return await loadImage(avatarSrc(p, expr));
    } catch {
      try {
        return await loadImage(avatarSrc(p, "neutral"));
      } catch {
        return null;
      }
    }
  }

  // ---- layout & draw helpers ----
  let ringPhase = 0; // 0..1
  let lastT = performance.now();

  function setCanvasSize(mode: AspectMode) {
    if (mode === "16:9") {
      canvas.width = 1280;
      canvas.height = 720;
    } else {
      canvas.width = 720;
      canvas.height = 1280;
    }
    aspectLabel.textContent = mode;
  }

  function clamp(n: number, a: number, b: number) {
    return Math.max(a, Math.min(b, n));
  }

  function roundRect(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    const rr = clamp(r, 0, Math.min(w, h) / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  function wrapText(
    c: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    maxLines: number
  ) {
    // ?쒓뎅?대뒗 怨듬갚???곸쓣 ???덉뼱 ?쒕떒??湲곕컲?앹씠 ?쏀븯?덇퉴,
    // 怨듬갚 ?곗꽑 + ?덈Т 湲몃㈃ 湲???⑥쐞濡쒕룄 以꾨컮轅?
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";

    const pushLine = (s: string) => {
      if (lines.length < maxLines) lines.push(s);
    };

    for (let i = 0; i < words.length; i++) {
      const test = line ? line + " " + words[i] : words[i];
      if (c.measureText(test).width > maxWidth && line) {
        pushLine(line);
        line = words[i];
        if (lines.length >= maxLines) break;
      } else {
        line = test;
      }
    }
    if (lines.length < maxLines && line) pushLine(line);

    // 怨듬갚??嫄곗쓽 ?녿뒗 湲??띿뒪???鍮?留덉?留?以꾩씠 ?덈Т 湲몃㈃ ?섎씪??
    if (lines.length === 1 && c.measureText(lines[0]).width > maxWidth) {
      const s = lines[0];
      lines.length = 0;
      let chunk = "";
      for (const ch of s) {
        const test = chunk + ch;
        if (c.measureText(test).width > maxWidth && chunk) {
          pushLine(chunk);
          chunk = ch;
          if (lines.length >= maxLines) break;
        } else {
          chunk = test;
        }
      }
      if (lines.length < maxLines && chunk) pushLine(chunk);
    }

    for (let i = 0; i < lines.length; i++) {
      c.fillText(lines[i], x, y + i * lineHeight);
    }
  }

  function drawBackground() {
    ctx.fillStyle = "#0b0b0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 誘몄꽭 ?몄씠利?遺꾩쐞湲?
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 800; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;

    ctx.globalAlpha = 0.92;
    ctx.fillStyle = "#dfe2ff";
    ctx.font = "600 18px system-ui";
    ctx.fillText("Lit Talk Radio 쨌 Session (Text Only)", 24, 34);
    ctx.globalAlpha = 1;

    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "#dfe2ff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, 52);
    ctx.lineTo(canvas.width - 24, 52);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  type AvatarSlot = {
    id: Participant["id"];
    x: number;
    y: number;
    r: number;
  };

  function computeAvatarSlots(participants: Participant[]): AvatarSlot[] {
    const W = canvas.width;
    const isPortrait = aspect === "9:16";

    const r = isPortrait ? 54 : 52;

    // 理쒕? 4紐? 16:9? ?곷떒 媛濡? 9:16? 2x2
    if (!isPortrait) {
      const y = 140;
      const n = participants.length;
      // 以묒븰 ?뺣젹 媛濡?諛곗튂
      const minX = W * 0.18;
      const maxX = W * 0.82;
      const slots: AvatarSlot[] = [];
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const x = minX + (maxX - minX) * t;
        slots.push({ id: participants[i].id, x, y, r });
      }
      return slots;
    } else {
      // 9:16 2x2
      const y1 = 180;
      const y2 = 360;
      const x1 = W * 0.3;
      const x2 = W * 0.7;

      const coords: { x: number; y: number }[] = [
        { x: x1, y: y1 },
        { x: x2, y: y1 },
        { x: x1, y: y2 },
        { x: x2, y: y2 },
      ];

      return participants.map((p, i) => ({
        id: p.id,
        x: coords[i]?.x ?? x1,
        y: coords[i]?.y ?? y2,
        r,
      }));
    }
  }

  function drawAvatarImageInCircle(
    img: HTMLImageElement,
    x: number,
    y: number,
    r: number
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  function drawAvatarFrame(x: number, y: number, r: number, speaking: boolean) {
    // 留??쇱????④낵)
    if (speaking) {
      const t = ringPhase;
      const ringR = r + 2 + t * 20;
      ctx.globalAlpha = 0.35 * (1 - t);
      ctx.strokeStyle = "#aab0ff";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(x, y, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // ?덉そ 留?
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = "#dfe2ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 湲곕낯 ?뚮몢由?
    ctx.fillStyle = "#17171c";
    ctx.strokeStyle = speaking ? "#aab0ff" : "#2a2a34";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function drawBubbleNearAvatar(slot: AvatarSlot, text: string) {
    const W = canvas.width;
    const H = canvas.height;
    const isPortrait = aspect === "9:16";

    // 留먰뭾??湲곕낯 ?ш린
    const maxW = isPortrait ? W - 80 : Math.min(760, W - 120);
    const padding = 18;
    const lineHeight = isPortrait ? 34 : 28;

    // ?꾨컮? ??湲곕낯 ?꾩튂(?ㅻⅨ履?
    let boxX = slot.x + slot.r + 18;
    let boxY = slot.y - slot.r;
    let boxW = maxW;
    let boxH = isPortrait ? 260 : 180;

    // ?붾㈃ 諛뽰쑝濡??섍?硫??쇱そ?쇰줈
    if (boxX + boxW > W - 24) {
      boxX = slot.x - slot.r - 18 - boxW;
    }
    // ?꾩そ ?섍?硫??대젮
    if (boxY < 70) boxY = 70;

    // 9:16? ?곷떒??蹂듭옟?섎땲源??덈Т 寃뱀튂硫??꾨옒濡?諛湲?
    if (isPortrait) {
      // 留먰뭾?좎씠 ?꾨컮? ?곸뿭??吏?섏튂寃???쑝硫??꾨옒濡?
      const overlapTop = boxY < slot.y + slot.r + 16;
      if (overlapTop) boxY = slot.y + slot.r + 20;
      // 洹몃옒???꾨옒濡??섏뼱媛硫??붾㈃ 以묎컙?쇰줈 議곗젙
      if (boxY + boxH > H - 24) boxY = H - 24 - boxH;
    }

    // 留먰뭾??諛뺤뒪
    ctx.fillStyle = "#17171c";
    ctx.strokeStyle = "#23232b";
    ctx.lineWidth = 2;
    roundRect(ctx, boxX, boxY, boxW, boxH, 18);
    ctx.fill();
    ctx.stroke();

    // 留먰뭾??瑗щ━(?쇨컖???먮굦)
    ctx.fillStyle = "#17171c";
    ctx.strokeStyle = "#23232b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const tailY = clamp(slot.y, 70, H - 24);
    const baseY = clamp(tailY, boxY + 20, boxY + boxH - 20);
    const dir = boxX > slot.x ? -1 : 1; // box媛 ?ㅻⅨ履쎌씠硫?瑗щ━???쇱そ ?ν븿
    ctx.moveTo(boxX + (dir === -1 ? 0 : boxW), baseY);
    ctx.lineTo(boxX + (dir === -1 ? 0 : boxW) + 18 * dir, baseY + 10);
    ctx.lineTo(boxX + (dir === -1 ? 0 : boxW) + 18 * dir, baseY - 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // ?띿뒪??
    ctx.fillStyle = "#eaeaf0";
    ctx.font = isPortrait ? "500 22px system-ui" : "500 18px system-ui";
    wrapText(
      ctx,
      text,
      boxX + padding,
      boxY + padding + 20,
      boxW - padding * 2,
      lineHeight,
      isPortrait ? 6 : 5
    );

    // ?섎떒 吏꾪뻾 ?쒖떆
    ctx.fillStyle = "#b7b7c6";
    ctx.font = "600 14px system-ui";
    ctx.fillText(
      `Turn ${idx + 1} / ${sessionData.turns.length}`,
      boxX + padding,
      boxY + boxH - 18
    );
  }

  async function drawAvatarsAndBubble(turn: Turn) {
    const slots = computeAvatarSlots(sessionData.participants);
    const slotById = new Map(slots.map((s) => [s.id, s]));
    const activeSlot = slotById.get(turn.speakerId) ?? slots[0];

    // ?꾨컮???洹몃━湲?
    for (const slot of slots) {
      const speaking = slot.id === turn.speakerId;
      drawAvatarFrame(slot.x, slot.y, slot.r, speaking);

      const p = sessionData.participants.find((pp) => pp.id === slot.id)!;
      // speaking???뚮뒗 ?대떦 turn???쒖젙, ?꾨땲硫?neutral
      const expr = speaking ? turn.expression : "neutral";
      const img = await getAvatarImage(p, expr);

      if (img) {
        drawAvatarImageInCircle(img, slot.x, slot.y, slot.r - 2);
      } else {
        // ?대?吏媛 ?놁쓣 ??fallback 湲??
        ctx.fillStyle = "#eaeaf0";
        ctx.font = "800 22px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.displayName || p.id.toUpperCase(), slot.x, slot.y);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }
    }

    // 留먰뭾???꾨컮? ??
    if (activeSlot) drawBubbleNearAvatar(activeSlot, turn.text);
  }

  async function renderFrame(dt: number, turn: Turn) {
    // 留??좊땲硫붿씠??
    const speed = 1 / 1.2;
    ringPhase = (ringPhase + dt * speed) % 1;

    drawBackground();
    await drawAvatarsAndBubble(turn);
  }

  async function loop(t: number) {
    const dt = (t - lastT) / 1000;
    lastT = t;

    const turn = sessionData.turns[idx] ?? sessionData.turns[0];
    await renderFrame(dt, turn);

    requestAnimationFrame(loop);
  }

  function next() {
    idx = (idx + 1) % sessionData.turns.length;
  }
  function prev() {
    idx = (idx - 1 + sessionData.turns.length) % sessionData.turns.length;
  }

  function setAspect(mode: AspectMode) {
    aspect = mode;
    setCanvasSize(mode);
  }

  function downloadPNG() {
    const a = document.createElement("a");
    a.download = `lit-talk-radio_${sessionData.id}_${aspect}_turn${String(
      idx + 1
    ).padStart(3, "0")}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }

  async function downloadAllZip() {
    // ?꾩옱 aspect 湲곗??쇰줈 "紐⑤뱺 ?????뚮뜑留곹빐??zip?쇰줈 臾띠쓬
    downloadAllBtn.disabled = true;
    downloadAllBtn.textContent = "Zipping...";

    try {
      const zip = new JSZip();
      const folder = zip.folder(`${sessionData.id}_${aspect}`)!;

      // ?좊땲硫붿씠???쒓컙? ?꾩슂 ?녾퀬 ?쒖젙???꾨젅?꾟앸쭔 戮묒쑝硫??섎땲源?
      // ringPhase瑜?怨좎젙媛믪쑝濡??먭퀬 ?뚮뜑
      const savedRing = ringPhase;
      ringPhase = 0.35;

      // ?꾩옱 canvas ?ъ씠利덈줈 怨좎젙
      setCanvasSize(aspect);

      for (let i = 0; i < sessionData.turns.length; i++) {
        // ?몃뜳??諛붽퓭??洹몃━湲?
        idx = i;
        drawBackground();
        await drawAvatarsAndBubble(sessionData.turns[i]);

        const dataUrl = canvas.toDataURL("image/png");
        const base64 = dataUrl.split(",")[1];
        folder.file(`turn_${String(i + 1).padStart(3, "0")}.png`, base64, {
          base64: true,
        });
      }

      ringPhase = savedRing;

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lit-talk-radio_${sessionData.id}_${aspect}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      downloadAllBtn.disabled = false;
      downloadAllBtn.textContent = "Download ALL (ZIP)";
    }
  }

  // controls
  prevBtn.onclick = prev;
  nextBtn.onclick = next;

  playBtn.onclick = () => {
    playing = !playing;
    playBtn.textContent = playing ? "Pause" : "Play";
    if (timer) window.clearInterval(timer);
    timer = null;
    if (playing) timer = window.setInterval(() => next(), 2300);
  };

  a169.onclick = () => setAspect("16:9");
  a916.onclick = () => setAspect("9:16");
  downloadBtn.onclick = downloadPNG;
  downloadAllBtn.onclick = downloadAllZip;

  // init
  setAspect("16:9");
  requestAnimationFrame((t) => loop(t));
}


