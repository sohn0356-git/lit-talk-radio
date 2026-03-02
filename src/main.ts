import { renderHome } from "./pages/home";
import { renderSession } from "./pages/session";
import { renderTranscript } from "./pages/transcript";
import { renderArchive } from "./pages/archive";

export type Route = "/" | "/session" | "/transcript" | "/archive";

export function getRoute(): Route {
  const hash = location.hash.replace("#", "") || "/";
  const allowed: Route[] = ["/", "/session", "/transcript", "/archive"];
  return allowed.includes(hash as Route) ? (hash as Route) : "/";
}

export function navigate(to: Route) {
  location.hash = to;
}

export function mount() {
  const app = document.getElementById("app")!;
  const route = getRoute();
  app.innerHTML = "";

  // 상단 네비(공통)
  const bar = document.createElement("div");
  bar.className = "bar";

  const left = document.createElement("div");
  left.className = "left";
  left.innerHTML = `<div class="pill"><b>Radio Timeline</b> <span class="muted">GitHub Pages</span></div>`;

  const tabs = document.createElement("div");
  tabs.className = "tabs";

  const items: { to: Route; label: string }[] = [
    { to: "/", label: "Home" },
    { to: "/session", label: "Session" },
    { to: "/transcript", label: "Transcript" },
    { to: "/archive", label: "Archive" },
  ];

  items.forEach((it) => {
    const t = document.createElement("div");
    t.className = "tab" + (it.to === route ? " active" : "");
    t.textContent = it.label;
    t.onclick = () => navigate(it.to);
    tabs.appendChild(t);
  });

  bar.appendChild(left);
  bar.appendChild(tabs);
  app.appendChild(bar);

  // 페이지 렌더
  const body = document.createElement("div");
  app.appendChild(body);

  if (route === "/") renderHome(body);
  if (route === "/session") renderSession(body);
  if (route === "/transcript") renderTranscript(body);
  if (route === "/archive") renderArchive(body);

  // 하단 힌트
  const hint = document.createElement("div");
  hint.className = "hint";
  hint.innerHTML = `GitHub Pages용 정적 사이트(서버 필요 없음). <span class="kbd">#/session</span> 화면에서 16:9/9:16 전환 및 PNG 다운로드 가능.`;
  app.appendChild(hint);
}

window.addEventListener("hashchange", mount);
mount();
