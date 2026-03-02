import { SESSIONS } from "../data";
import { getSelectedSessionId, setSelectedSessionId } from "../store";
import { navigate } from "../main";

export function renderHome(root: HTMLElement) {
  const selected = getSelectedSessionId();

  root.innerHTML = `
    <div class="card">
      <div class="row">
        <div>
          <div style="font-weight:700; font-size:18px;">오늘의 토론</div>
          <div class="muted">세션을 고르고 Session 화면에서 라디오처럼 재생해.</div>
        </div>
        <button class="btn primary" id="goSession">Session로 이동</button>
      </div>
    </div>

    <div class="card">
      <div style="font-weight:700; margin-bottom:10px;">세션 선택</div>
      <div class="list" id="list"></div>
    </div>
  `;

  (root.querySelector("#goSession") as HTMLButtonElement).onclick = () =>
    navigate("/session");

  const list = root.querySelector("#list") as HTMLDivElement;
  list.innerHTML = "";

  for (const s of SESSIONS) {
    const div = document.createElement("div");
    div.className = "card";
    div.style.cursor = "pointer";
    div.style.padding = "12px";
    div.style.background = s.id === selected ? "#1b1b28" : "#17171c";
    div.innerHTML = `
      <div class="row">
        <div>
          <div style="font-weight:650;">${s.title}</div>
          <div class="muted">${s.id}</div>
        </div>
        <div class="muted">선택</div>
      </div>
    `;
    div.onclick = () => {
      setSelectedSessionId(s.id);
      // 선택 피드백 위해 다시 렌더
      renderHome(root);
    };
    list.appendChild(div);
  }
}
