import { getCurrentSession } from "../store";

export function renderTranscript(root: HTMLElement) {
  const session = getCurrentSession();

  if (!session) {
    root.innerHTML = `
      <div class="card">
        <div style="font-weight:700; font-size:18px;">Transcript</div>
        <div class="muted">생성된 토론이 없습니다. Home에서 책/챕터를 선택 후 토론을 생성하세요.</div>
      </div>
    `;
    return;
  }

  const text = session.turns
    .map((t, i) => {
      const who = t.speakerId.toUpperCase();
      return `${String(i + 1).padStart(2, "0")} ${who}(${t.expression}): ${t.text}`;
    })
    .join("\n\n");

  const charCount = session.turns.reduce((acc, t) => acc + t.text.length, 0);

  root.innerHTML = `
    <div class="card">
      <div style="font-weight:700; font-size:18px;">Transcript</div>
      <div class="muted">${session.date} / ${session.bookTitle} / Chapter ${session.chapter}</div>
      <div class="muted">Chars: ${charCount.toLocaleString()} / Target: ${session.targetCharCount.toLocaleString()}</div>
    </div>

    <div class="card">
      <textarea readonly>${text}</textarea>
    </div>
  `;
}
