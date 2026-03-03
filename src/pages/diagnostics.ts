import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { assertFirebaseReady, db } from "../firebase";
import { buildGeminiGenerateUrl, GEMINI_MODEL } from "../services/geminiConfig";

const TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timeout (${TIMEOUT_MS}ms)`));
    }, TIMEOUT_MS);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

function mask(value: string | undefined): string {
  if (!value) return "<empty>";
  if (value.length <= 8) return `${value} (len:${value.length})`;
  return `${value.slice(0, 4)}...${value.slice(-4)} (len:${value.length})`;
}

function nowStamp(): string {
  return new Date().toLocaleString();
}

export function renderDiagnostics(root: HTMLElement) {
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  const geminiModel = GEMINI_MODEL;
  const firebaseApiKey = import.meta.env.VITE_FIREBASE_API_KEY as
    | string
    | undefined;
  const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as
    | string
    | undefined;
  const firebaseAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as
    | string
    | undefined;

  root.innerHTML = `
    <div class="card">
      <div style="font-weight:700; font-size:18px;">Diagnostics</div>
      <div class="muted">Gemini/Firebase 연결을 개별 테스트합니다.</div>
    </div>

    <div class="card" style="text-align:left;">
      <div style="font-weight:700; margin-bottom:8px;">ENV Snapshot (masked)</div>
      <div class="muted">VITE_GEMINI_API_KEY: ${mask(geminiKey)}</div>
      <div class="muted">VITE_GEMINI_MODEL: ${geminiModel}</div>
      <div class="muted">VITE_FIREBASE_API_KEY: ${mask(firebaseApiKey)}</div>
      <div class="muted">VITE_FIREBASE_PROJECT_ID: ${mask(firebaseProjectId)}</div>
      <div class="muted">VITE_FIREBASE_AUTH_DOMAIN: ${mask(firebaseAuthDomain)}</div>
    </div>

    <div class="card" style="text-align:left;">
      <div class="row">
        <div>
          <button class="btn" id="runAllBtn">Run All</button>
          <button class="btn" id="geminiModelsBtn">Gemini: List Models</button>
          <button class="btn" id="geminiGenerateBtn">Gemini: Generate</button>
          <button class="btn" id="firebaseReadBtn">Firebase: Read</button>
          <button class="btn" id="firebaseWriteBtn">Firebase: Write/Delete</button>
        </div>
      </div>
      <pre id="diagLog" style="margin-top:14px; white-space:pre-wrap; word-break:break-word; background:#111; color:#ddd; padding:12px; border-radius:8px; min-height:220px;"></pre>
    </div>
  `;

  const logEl = root.querySelector("#diagLog") as HTMLPreElement;
  const runAllBtn = root.querySelector("#runAllBtn") as HTMLButtonElement;
  const geminiModelsBtn = root.querySelector(
    "#geminiModelsBtn"
  ) as HTMLButtonElement;
  const geminiGenerateBtn = root.querySelector(
    "#geminiGenerateBtn"
  ) as HTMLButtonElement;
  const firebaseReadBtn = root.querySelector(
    "#firebaseReadBtn"
  ) as HTMLButtonElement;
  const firebaseWriteBtn = root.querySelector(
    "#firebaseWriteBtn"
  ) as HTMLButtonElement;

  const allButtons = [
    runAllBtn,
    geminiModelsBtn,
    geminiGenerateBtn,
    firebaseReadBtn,
    firebaseWriteBtn,
  ];

  function appendLog(line: string) {
    logEl.textContent = `${logEl.textContent}${line}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setBusy(busy: boolean) {
    allButtons.forEach((btn) => {
      btn.disabled = busy;
    });
  }

  async function testGeminiListModels() {
    appendLog(`[${nowStamp()}] Gemini list-models started`);
    if (!geminiKey) {
      appendLog("  FAIL: missing VITE_GEMINI_API_KEY");
      return;
    }

    try {
      const response = await withTimeout(
        fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`
        ),
        "Gemini list-models"
      );
      const text = await response.text();
      if (!response.ok) {
        appendLog(`  FAIL: ${response.status} ${text}`);
        return;
      }
      const data = JSON.parse(text) as { models?: Array<{ name?: string }> };
      const names = (data.models || [])
        .slice(0, 8)
        .map((m) => m.name || "<unknown>")
        .join(", ");
      appendLog(`  OK: models count=${data.models?.length || 0}`);
      appendLog(`  sample: ${names}`);
    } catch (error) {
      appendLog(
        `  FAIL: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async function testGeminiGenerate() {
    appendLog(`[${nowStamp()}] Gemini generate started`);
    if (!geminiKey) {
      appendLog("  FAIL: missing VITE_GEMINI_API_KEY");
      return;
    }

    try {
      const response = await withTimeout(
        fetch(buildGeminiGenerateUrl(geminiKey), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: "Return exactly one token: OK" }],
              },
            ],
            generationConfig: { temperature: 0, maxOutputTokens: 8 },
          }),
        }),
        "Gemini generate"
      );
      const text = await response.text();
      if (!response.ok) {
        appendLog(`  FAIL: ${response.status} ${text}`);
        return;
      }
      appendLog(`  OK: generateContent succeeded (${geminiModel})`);
      appendLog(`  body: ${text}`);
    } catch (error) {
      appendLog(
        `  FAIL: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async function testFirebaseRead() {
    appendLog(`[${nowStamp()}] Firebase read started`);
    try {
      assertFirebaseReady();
      const q = query(collection(db!, "healthchecks"), limit(1));
      const snap = await withTimeout(getDocs(q), "Firestore read");
      appendLog(`  OK: read docs=${snap.size}`);
    } catch (error) {
      appendLog(
        `  FAIL: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async function testFirebaseWriteDelete() {
    appendLog(`[${nowStamp()}] Firebase write/delete started`);
    try {
      assertFirebaseReady();
      const id = `diag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const ref = doc(db!, "healthchecks", id);
      await withTimeout(
        setDoc(ref, { createdAt: serverTimestamp(), source: "diagnostics" }),
        "Firestore setDoc"
      );
      await withTimeout(deleteDoc(ref), "Firestore deleteDoc");
      appendLog("  OK: write and delete succeeded");
    } catch (error) {
      appendLog(
        `  FAIL: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  runAllBtn.onclick = async () => {
    setBusy(true);
    appendLog(`\n[${nowStamp()}] Run All`);
    await testGeminiListModels();
    await testGeminiGenerate();
    await testFirebaseRead();
    await testFirebaseWriteDelete();
    setBusy(false);
  };

  geminiModelsBtn.onclick = async () => {
    setBusy(true);
    await testGeminiListModels();
    setBusy(false);
  };

  geminiGenerateBtn.onclick = async () => {
    setBusy(true);
    await testGeminiGenerate();
    setBusy(false);
  };

  firebaseReadBtn.onclick = async () => {
    setBusy(true);
    await testFirebaseRead();
    setBusy(false);
  };

  firebaseWriteBtn.onclick = async () => {
    setBusy(true);
    await testFirebaseWriteDelete();
    setBusy(false);
  };

  appendLog(`[${nowStamp()}] Diagnostics ready`);
}
