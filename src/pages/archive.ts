import { SESSIONS } from "../data";
import { setSelectedSessionId } from "../store";
import { navigate } from "../main";

export function renderArchive(root: HTMLElement) {
  root.innerHTML = `
    <div class="card">
      <div style="font-weight:700; font-size:18px;">Archive</div>
      <div class="muted">날짜를 클릭하면 해당 세션으로 이동.</div>
    </div>
    <div class="list" id="list"></div>
  `;

  const list = root.querySelector("#list") as HTMLDivElement;

  for (const s of SESSIONS) {
    const row = document.createElement("div");
    row.className = "card";
    row.style.cursor = "pointer";
    row.innerHTML = `
      <div class="row">
        <div>
          <div style="font-weight:650;">${s.id}</div>
          <div class="muted">${s.title}</div>
        </div>
        <div class="muted">열기</div>
      </div>
    `;
    row.onclick = () => {
      setSelectedSessionId(s.id);
      navigate("/session");
    };
    list.appendChild(row);
  }
}
