import JSZip from "jszip";
import type { Expression, Participant, Turn } from "../data";
import { getSelectedSession } from "../store";

type AspectMode = "16:9" | "9:16";

export function renderSession(root: HTMLElement) {
  const session = getSelectedSession();

  let aspect: AspectMode = "16:9";
  let idx = 0;
  let playing = false;
  let timer: number | null = null;

  root.innerHTML = `
    <div class="card">
      <div class="row">
        <div>
          <div style="font-weight:700; font-size:18px;">Session</div>
          <div class="muted">${session.id} · ${session.title}</div>
          <div class="muted">Participants: ${session.participants.length} (max 4) · Turns: ${session.turns.length}</div>
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
        아바타 경로: <span class="kbd">/avatars/{id}/{expression}.png</span>
        (없으면 neutral로 자동 대체)
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
    // expr 파일이 없을 수 있으니 neutral로 폴백
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
    // 한국어는 공백이 적을 수 있어 “단어 기반”이 약하니까,
    // 공백 우선 + 너무 길면 글자 단위로도 줄바꿈
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

    // 공백이 거의 없는 긴 텍스트 대비(마지막 줄이 너무 길면 잘라냄)
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

    // 미세 노이즈(분위기)
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
    ctx.fillText("Lit Talk Radio · Session (Text Only)", 24, 34);
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

    // 최대 4명: 16:9은 상단 가로, 9:16은 2x2
    if (!isPortrait) {
      const y = 140;
      const n = participants.length;
      // 중앙 정렬 가로 배치
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
    // 링(퍼지는 효과)
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

      // 안쪽 링
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = "#dfe2ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 기본 테두리
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

    // 말풍선 기본 크기
    const maxW = isPortrait ? W - 80 : Math.min(760, W - 120);
    const padding = 18;
    const lineHeight = isPortrait ? 34 : 28;

    // 아바타 옆 기본 위치(오른쪽)
    let boxX = slot.x + slot.r + 18;
    let boxY = slot.y - slot.r;
    let boxW = maxW;
    let boxH = isPortrait ? 260 : 180;

    // 화면 밖으로 나가면 왼쪽으로
    if (boxX + boxW > W - 24) {
      boxX = slot.x - slot.r - 18 - boxW;
    }
    // 위쪽 나가면 내려
    if (boxY < 70) boxY = 70;

    // 9:16은 상단이 복잡하니까 너무 겹치면 아래로 밀기
    if (isPortrait) {
      // 말풍선이 아바타 영역을 지나치게 덮으면 아래로
      const overlapTop = boxY < slot.y + slot.r + 16;
      if (overlapTop) boxY = slot.y + slot.r + 20;
      // 그래도 아래로 넘어가면 화면 중간으로 조정
      if (boxY + boxH > H - 24) boxY = H - 24 - boxH;
    }

    // 말풍선 박스
    ctx.fillStyle = "#17171c";
    ctx.strokeStyle = "#23232b";
    ctx.lineWidth = 2;
    roundRect(ctx, boxX, boxY, boxW, boxH, 18);
    ctx.fill();
    ctx.stroke();

    // 말풍선 꼬리(삼각형 느낌)
    ctx.fillStyle = "#17171c";
    ctx.strokeStyle = "#23232b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const tailX = clamp(
      slot.x + (boxX > slot.x ? slot.r : -slot.r),
      24,
      W - 24
    );
    const tailY = clamp(slot.y, 70, H - 24);
    const baseY = clamp(tailY, boxY + 20, boxY + boxH - 20);
    const dir = boxX > slot.x ? -1 : 1; // box가 오른쪽이면 꼬리는 왼쪽 향함
    ctx.moveTo(boxX + (dir === -1 ? 0 : boxW), baseY);
    ctx.lineTo(boxX + (dir === -1 ? 0 : boxW) + 18 * dir, baseY + 10);
    ctx.lineTo(boxX + (dir === -1 ? 0 : boxW) + 18 * dir, baseY - 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 텍스트
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

    // 하단 진행 표시
    ctx.fillStyle = "#b7b7c6";
    ctx.font = "600 14px system-ui";
    ctx.fillText(
      `Turn ${idx + 1} / ${session.turns.length}`,
      boxX + padding,
      boxY + boxH - 18
    );
  }

  async function drawAvatarsAndBubble(turn: Turn) {
    const slots = computeAvatarSlots(session.participants);
    const slotById = new Map(slots.map((s) => [s.id, s]));
    const activeSlot = slotById.get(turn.speakerId) ?? slots[0];

    // 아바타들 그리기
    for (const slot of slots) {
      const speaking = slot.id === turn.speakerId;
      drawAvatarFrame(slot.x, slot.y, slot.r, speaking);

      const p = session.participants.find((pp) => pp.id === slot.id)!;
      // speaking일 때는 해당 turn의 표정, 아니면 neutral
      const expr = speaking ? turn.expression : "neutral";
      const img = await getAvatarImage(p, expr);

      if (img) {
        drawAvatarImageInCircle(img, slot.x, slot.y, slot.r - 2);
      } else {
        // 이미지가 없을 때 fallback 글자
        ctx.fillStyle = "#eaeaf0";
        ctx.font = "800 22px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(slot.id.toUpperCase(), slot.x, slot.y);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }
    }

    // 말풍선(아바타 옆)
    if (activeSlot) drawBubbleNearAvatar(activeSlot, turn.text);
  }

  async function renderFrame(dt: number, turn: Turn) {
    // 링 애니메이션
    const speed = 1 / 1.2;
    ringPhase = (ringPhase + dt * speed) % 1;

    drawBackground();
    await drawAvatarsAndBubble(turn);
  }

  async function loop(t: number) {
    const dt = (t - lastT) / 1000;
    lastT = t;

    const turn = session.turns[idx] ?? session.turns[0];
    await renderFrame(dt, turn);

    requestAnimationFrame(loop);
  }

  function next() {
    idx = (idx + 1) % session.turns.length;
  }
  function prev() {
    idx = (idx - 1 + session.turns.length) % session.turns.length;
  }

  function setAspect(mode: AspectMode) {
    aspect = mode;
    setCanvasSize(mode);
  }

  function downloadPNG() {
    const a = document.createElement("a");
    a.download = `lit-talk-radio_${session.id}_${aspect}_turn${String(
      idx + 1
    ).padStart(3, "0")}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }

  async function downloadAllZip() {
    // 현재 aspect 기준으로 "모든 턴"을 렌더링해서 zip으로 묶음
    downloadAllBtn.disabled = true;
    downloadAllBtn.textContent = "Zipping...";

    try {
      const zip = new JSZip();
      const folder = zip.folder(`${session.id}_${aspect}`)!;

      // 애니메이션 시간은 필요 없고 “정적 프레임”만 뽑으면 되니까
      // ringPhase를 고정값으로 두고 렌더
      const savedRing = ringPhase;
      ringPhase = 0.35;

      // 현재 canvas 사이즈로 고정
      setCanvasSize(aspect);

      for (let i = 0; i < session.turns.length; i++) {
        // 인덱스 바꿔서 그리기
        idx = i;
        drawBackground();
        await drawAvatarsAndBubble(session.turns[i]);

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
      a.download = `lit-talk-radio_${session.id}_${aspect}.zip`;
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
