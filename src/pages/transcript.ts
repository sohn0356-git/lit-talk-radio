import { getSelectedSession } from "../store";

export function renderTranscript(root: HTMLElement) {
  const session = getSelectedSession();
  const text = session.lines
    .map((l) => {
      const who = ["A", "B", "C", "D"][l.speaker];
      return `${who}: ${l.text}`;
    })
    .join("\n\n");

  root.innerHTML = `
    <div class="card">
      <div style="font-weight:700; font-size:18px;">Transcript</div>
      <div class="muted">${session.id} · ${session.title}</div>
    </div>

    <div class="card">
      <textarea readonly>${text}</textarea>
      <div class="muted" style="margin-top:8px;">(여기 텍스트는 나중에 Firebase로 교체 가능)</div>
    </div>
  `;
}
