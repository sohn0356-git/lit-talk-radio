import { BOOKS } from "../data";
import { navigate } from "../main";
import {
  getSelectedBook,
  getSelectedBookId,
  getSelectedChapter,
  setCurrentSession,
  setSelectedBookId,
  setSelectedChapter,
} from "../store";
import { createDebateSession } from "../services/debateOrchestrator";
import {
  checkFirebaseConnection,
  checkGeminiConnection,
} from "../services/connectivity";

export function renderHome(root: HTMLElement) {
  const selectedBookId = getSelectedBookId();
  const selectedBook = getSelectedBook();
  const selectedChapter = Math.min(getSelectedChapter(), selectedBook.totalChapters);
  setSelectedChapter(selectedChapter);

  root.innerHTML = `
    <div class="card">
      <div class="row">
        <div>
          <div style="font-weight:700; font-size:18px;">토론 설정</div>
          <div class="muted">책과 챕터를 선택하고 Gemini 토론을 생성합니다.</div>
        </div>
        <button class="btn" id="goArchive">Archive</button>
      </div>
    </div>

    <div class="card">
      <div class="row">
        <div>
          <div style="font-weight:700; margin-bottom:8px;">연결 상태</div>
          <div class="muted" id="geminiConnText">Gemini: 확인 중...</div>
          <div class="muted" id="firebaseConnText">Firebase: 확인 중...</div>
        </div>
        <button class="btn" id="retryConnBtn">다시 확인</button>
      </div>
    </div>

    <div class="card">
      <div style="font-weight:700; margin-bottom:10px;">1) 책 선택</div>
      <select id="bookSelect"></select>
    </div>

    <div class="card">
      <div style="font-weight:700; margin-bottom:10px;">2) 챕터 선택</div>
      <div class="muted" style="margin-bottom:12px;">총 ${selectedBook.totalChapters}개 챕터 중 선택</div>
      <select id="chapterSelect"></select>
    </div>

    <div class="card">
      <div class="row">
        <div>
          <div style="font-weight:700;">${selectedBook.title} / Chapter ${selectedChapter}</div>
          <div class="muted">A/B/C/D 성격 기반, 약 5,000자 토론 생성</div>
        </div>
        <button class="btn primary" id="startDebateBtn">토론 시작</button>
      </div>
      <div class="muted" id="statusText" style="margin-top:10px;"></div>
    </div>
  `;

  (root.querySelector("#goArchive") as HTMLButtonElement).onclick = () => {
    navigate("/archive");
  };
  const retryConnBtn = root.querySelector("#retryConnBtn") as HTMLButtonElement;
  const geminiConnText = root.querySelector("#geminiConnText") as HTMLDivElement;
  const firebaseConnText = root.querySelector(
    "#firebaseConnText"
  ) as HTMLDivElement;

  async function runConnectionChecks() {
    retryConnBtn.disabled = true;
    retryConnBtn.textContent = "확인 중...";
    geminiConnText.textContent = "Gemini: 확인 중...";
    firebaseConnText.textContent = "Firebase: 확인 중...";

    const [gemini, firebase] = await Promise.all([
      checkGeminiConnection(),
      checkFirebaseConnection(),
    ]);

    geminiConnText.textContent = `Gemini: ${
      gemini.ok ? "연결됨" : "실패"
    } (${gemini.message})`;
    firebaseConnText.textContent = `Firebase: ${
      firebase.ok ? "연결됨" : "실패"
    } (${firebase.message})`;

    retryConnBtn.disabled = false;
    retryConnBtn.textContent = "다시 확인";
  }

  retryConnBtn.onclick = () => {
    void runConnectionChecks();
  };
  void runConnectionChecks();

  const bookSelect = root.querySelector("#bookSelect") as HTMLSelectElement;
  bookSelect.innerHTML = "";

  for (const book of BOOKS) {
    const option = document.createElement("option");
    option.value = book.id;
    option.textContent = book.title;
    option.selected = book.id === selectedBookId;
    bookSelect.appendChild(option);
  }

  bookSelect.onchange = () => {
    setSelectedBookId(bookSelect.value);
    setSelectedChapter(1);
    renderHome(root);
  };

  const chapterSelect = root.querySelector(
    "#chapterSelect"
  ) as HTMLSelectElement;
  chapterSelect.innerHTML = "";

  for (let chapter = 1; chapter <= selectedBook.totalChapters; chapter++) {
    const option = document.createElement("option");
    option.value = String(chapter);
    option.textContent = `Chapter ${chapter}`;
    option.selected = chapter === selectedChapter;
    chapterSelect.appendChild(option);
  }

  chapterSelect.onchange = () => {
    setSelectedChapter(Number(chapterSelect.value));
    renderHome(root);
  };

  const startDebateBtn = root.querySelector("#startDebateBtn") as HTMLButtonElement;
  const statusText = root.querySelector("#statusText") as HTMLDivElement;

  startDebateBtn.onclick = async () => {
    const book = getSelectedBook();
    const chapter = Math.min(getSelectedChapter(), book.totalChapters);

    startDebateBtn.disabled = true;
    startDebateBtn.textContent = "생성 중...";
    statusText.textContent = "Gemini 토론 생성 후 Firebase에 저장하는 중입니다.";

    try {
      const session = await createDebateSession(book, chapter);
      setCurrentSession(session);
      statusText.textContent = "생성 완료. Session 화면으로 이동합니다.";
      navigate("/session");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      statusText.textContent = `실패: ${message}`;
      startDebateBtn.disabled = false;
      startDebateBtn.textContent = "토론 시작";
    }
  };
}
