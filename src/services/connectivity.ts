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

export async function checkGeminiConnection(): Promise<ConnectionCheckResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      message: "VITE_GEMINI_API_KEY 누락",
    };
  }

  try {
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
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return {
        ok: false,
        message: `Gemini API 실패 (${response.status}): ${errText}`,
      };
    }

    return { ok: true, message: "Gemini 연결 정상" };
  } catch (error) {
    return {
      ok: false,
      message: `Gemini 네트워크 오류: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

export async function checkFirebaseConnection(): Promise<ConnectionCheckResult> {
  try {
    assertFirebaseReady();
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const pingRef = doc(
    db!,
    "healthchecks",
    `client-ping-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );

  try {
    await setDoc(pingRef, {
      createdAt: serverTimestamp(),
      source: "web-client",
    });
    await deleteDoc(pingRef);
    return { ok: true, message: "Firebase 쓰기/삭제 정상" };
  } catch (error) {
    return {
      ok: false,
      message: `Firebase 접근 실패: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}
