import type { Line } from "../data";
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
      </div>
    </div>

    <div class="stage">
      <canvas id="canvas"></canvas>
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

  // 애니메이션
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
    const words = text.split(" ");
    let line = "";
    const lines: string[] = [];

    for (let i = 0; i < words.length; i++) {
      const test = line ? line + " " + words[i] : words[i];
      const w = c.measureText(test).width;
      if (w > maxWidth && line) {
        lines.push(line);
        line = words[i];
        if (lines.length >= maxLines) break;
      } else {
        line = test;
      }
    }
    if (lines.length < maxLines && line) lines.push(line);

    for (let i = 0; i < lines.length; i++) {
      c.fillText(lines[i], x, y + i * lineHeight);
    }
  }

  function drawBackground() {
    ctx.fillStyle = "#0b0b0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 아주 약한 노이즈(고정감성)
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;

    ctx.globalAlpha = 0.92;
    ctx.fillStyle = "#dfe2ff";
    ctx.font = "600 18px system-ui";
    ctx.fillText("Radio Session (Text Only)", 24, 34);
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

  function drawAvatars(activeSpeaker: number) {
    const W = canvas.width;
    const H = canvas.height;

    const isPortrait = aspect === "9:16";
    const avatarR = isPortrait ? 54 : 48;
    const topY = isPortrait ? 150 : 120;

    const positions: { x: number; y: number; label: string }[] = isPortrait
      ? [
          { x: W * 0.3, y: topY, label: "A" },
          { x: W * 0.7, y: topY, label: "B" },
          { x: W * 0.3, y: topY + 160, label: "C" },
          { x: W * 0.7, y: topY + 160, label: "D" },
        ]
      : [
          { x: W * 0.2, y: topY, label: "A" },
          { x: W * 0.4, y: topY, label: "B" },
          { x: W * 0.6, y: topY, label: "C" },
          { x: W * 0.8, y: topY, label: "D" },
        ];

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      const speaking = i === activeSpeaker;

      if (speaking) {
        const t = ringPhase;
        const ringR = avatarR + 2 + t * 20;
        ctx.globalAlpha = 0.35 * (1 - t);
        ctx.strokeStyle = "#aab0ff";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = "#dfe2ff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, avatarR + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = "#17171c";
      ctx.strokeStyle = speaking ? "#aab0ff" : "#2a2a34";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, avatarR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#eaeaf0";
      ctx.font = "700 22px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.label, p.x, p.y);

      const role = ["옹호", "반박", "중재", "질문"][i];
      ctx.fillStyle = "#b7b7c6";
      ctx.font = "600 14px system-ui";
      ctx.fillText(role, p.x, p.y + avatarR + 22);
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function drawCaption(line: Line) {
    const W = canvas.width;
    const H = canvas.height;
    const isPortrait = aspect === "9:16";

    const boxW = W - 48;
    const boxH = isPortrait ? 280 : 180;
    const boxX = 24;
    const boxY = isPortrait ? H * 0.62 : H * 0.62;

    ctx.fillStyle = "#17171c";
    ctx.strokeStyle = "#23232b";
    ctx.lineWidth = 2;
    roundRect(ctx, boxX, boxY, boxW, boxH, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#eaeaf0";
    ctx.font = isPortrait ? "600 22px system-ui" : "600 20px system-ui";
    ctx.textAlign = "left";

    const header = ["A", "B", "C", "D"][line.speaker];
    ctx.globalAlpha = 0.9;
    ctx.fillText(`${header} says`, boxX + 18, boxY + 18 + 22);
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#eaeaf0";
    ctx.font = isPortrait ? "500 22px system-ui" : "500 18px system-ui";

    wrapText(
      ctx,
      line.text,
      boxX + 18,
      boxY + 18 + 60,
      boxW - 36,
      isPortrait ? 34 : 28,
      isPortrait ? 7 : 5
    );

    ctx.fillStyle = "#b7b7c6";
    ctx.font = "600 14px system-ui";
    ctx.fillText(
      `Line ${idx + 1} / ${session.lines.length}`,
      boxX + 18,
      boxY + boxH - 18
    );
  }

  function renderFrame(dt: number) {
    const speed = 1 / 1.2;
    ringPhase = (ringPhase + dt * speed) % 1;

    drawBackground();
    drawAvatars(session.lines[idx].speaker);
    drawCaption(session.lines[idx]);
  }

  function loop(t: number) {
    const dt = (t - lastT) / 1000;
    lastT = t;
    renderFrame(dt);
    requestAnimationFrame(loop);
  }

  function next() {
    idx = (idx + 1) % session.lines.length;
  }
  function prev() {
    idx = (idx - 1 + session.lines.length) % session.lines.length;
  }

  function setAspect(mode: AspectMode) {
    aspect = mode;
    setCanvasSize(mode);
  }

  function downloadPNG() {
    const a = document.createElement("a");
    const date = session.id;
    a.download = `radio-${aspect}-${date}-line${idx + 1}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }

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

  // init
  setAspect("16:9");
  requestAnimationFrame(loop);
}
