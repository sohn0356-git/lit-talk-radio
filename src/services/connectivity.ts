import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { assertFirebaseReady, db } from "../firebase";

export type ConnectionCheckResult = {
  ok: boolean;
  message: string;
};

const CHECK_TIMEOUT_MS = 8000;

function debugValue(raw: string | undefined): string {
  if (!raw) return "<empty>";
  if (raw.length <= 8) return `${raw} (len:${raw.length})`;
  return `${raw.slice(0, 4)}...${raw.slice(-4)} (len:${raw.length})`;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} 타임아웃 (${ms}ms)`));
    }, ms);

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

export async function checkGeminiConnection(): Promise<ConnectionCheckResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const apiKeyDebug = debugValue(apiKey);
  if (!apiKey) {
    return {
      ok: false,
      message: `VITE_GEMINI_API_KEY 누락 (key: ${apiKeyDebug})`,
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: "Reply with: ok" }],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 8,
          },
        }),
        signal: controller.signal,
      }
    );
    window.clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      return {
        ok: false,
        message: `Gemini API 실패 (${response.status}): ${errText} (key: ${apiKeyDebug})`,
      };
    }

    return { ok: true, message: "Gemini 연결 정상" };
  } catch (error) {
    return {
      ok: false,
      message: `Gemini 네트워크 오류: ${
        error instanceof Error ? error.message : String(error)
      } (key: ${apiKeyDebug})`,
    };
  }
}

export async function checkFirebaseConnection(): Promise<ConnectionCheckResult> {
  const firebaseDebug = [
    `apiKey=${debugValue(import.meta.env.VITE_FIREBASE_API_KEY)}`,
    `projectId=${debugValue(import.meta.env.VITE_FIREBASE_PROJECT_ID)}`,
    `authDomain=${debugValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN)}`,
  ].join(", ");

  try {
    assertFirebaseReady();
  } catch (error) {
    return {
      ok: false,
      message: `${
        error instanceof Error ? error.message : String(error)
      } (${firebaseDebug})`,
    };
  }

  const pingRef = doc(
    db!,
    "healthchecks",
    `client-ping-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );

  try {
    await withTimeout(
      setDoc(pingRef, {
        createdAt: serverTimestamp(),
        source: "web-client",
      }),
      CHECK_TIMEOUT_MS,
      "Firebase setDoc"
    );
    await withTimeout(deleteDoc(pingRef), CHECK_TIMEOUT_MS, "Firebase deleteDoc");
    return { ok: true, message: "Firebase 쓰기/삭제 정상" };
  } catch (error) {
    return {
      ok: false,
      message: `Firebase 접근 실패: ${
        error instanceof Error ? error.message : String(error)
      } (${firebaseDebug})`,
    };
  }
}
