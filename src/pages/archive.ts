import { navigate } from "../main";
import { getRecentDebateSessions } from "../services/debateRepository";
import { setCurrentSession } from "../store";

export function renderArchive(root: HTMLElement) {
  root.innerHTML = `
    <div class="card">
      <div style="font-weight:700; font-size:18px;">Archive</div>
      <div class="muted">Firebase에 저장된 토론 세션 (최신순)</div>
    </div>
    <div class="list" id="list"></div>
  `;

  const list = root.querySelector("#list") as HTMLDivElement;
  list.innerHTML = `<div class="card muted">불러오는 중...</div>`;

  void (async () => {
    try {
      const sessions = await getRecentDebateSessions(40);
      list.innerHTML = "";

      if (sessions.length === 0) {
        list.innerHTML = `<div class="card muted">저장된 토론이 없습니다.</div>`;
        return;
      }

      for (const s of sessions) {
        const row = document.createElement("div");
        row.className = "card";
        row.style.cursor = "pointer";
        row.innerHTML = `
          <div class="row">
            <div>
              <div style="font-weight:650;">${s.date} / ${s.bookTitle} / Chapter ${s.chapter}</div>
              <div class="muted">${s.title} · Turns: ${s.turns.length}</div>
            </div>
            <div class="muted">열기</div>
          </div>
        `;

        row.onclick = () => {
          setCurrentSession(s);
          navigate("/session");
        };

        list.appendChild(row);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      list.innerHTML = `<div class="card muted">불러오기 실패: ${message}</div>`;
    }
  })();
}
