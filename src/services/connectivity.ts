import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { assertFirebaseReady, db } from "../firebase";
import { buildGeminiGenerateUrl, GEMINI_MODEL } from "./geminiConfig";

export type ConnectionCheckResult = {
  ok: boolean;
  message: string;
  debug?: string;
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
      reject(new Error(`${label} timeout (${ms}ms)`));
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
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  const apiKeyDebug = debugValue(apiKey);

  if (!apiKey) {
    return {
      ok: false,
      message: "VITE_GEMINI_API_KEY is missing",
      debug: `VITE_GEMINI_MODEL=${GEMINI_MODEL}, VITE_GEMINI_API_KEY=${apiKeyDebug}`,
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

    const response = await fetch(buildGeminiGenerateUrl(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            // Minimal API test prompt
            parts: [{ text: "Return exactly one token: OK" }],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 8,
        },
      }),
      signal: controller.signal,
    });

    window.clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      return {
        ok: false,
        message: `Gemini API failed (${GEMINI_MODEL}, ${response.status}): ${errText}`,
        debug: `VITE_GEMINI_MODEL=${GEMINI_MODEL}, VITE_GEMINI_API_KEY=${apiKeyDebug}`,
      };
    }

    return {
      ok: true,
      message: `Gemini connected (${GEMINI_MODEL})`,
    };
  } catch (error) {
    return {
      ok: false,
      message: `Gemini network error (${GEMINI_MODEL}): ${
        error instanceof Error ? error.message : String(error)
      }`,
      debug: `VITE_GEMINI_MODEL=${GEMINI_MODEL}, VITE_GEMINI_API_KEY=${apiKeyDebug}`,
    };
  }
}

export async function checkFirebaseConnection(): Promise<ConnectionCheckResult> {
  const firebaseDebug = [
    `apiKey=${debugValue(import.meta.env.VITE_FIREBASE_API_KEY as string | undefined)}`,
    `projectId=${debugValue(import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined)}`,
    `authDomain=${debugValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined)}`,
  ].join(", ");

  try {
    assertFirebaseReady();
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      debug: firebaseDebug,
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
    return { ok: true, message: "Firebase write/delete succeeded" };
  } catch (error) {
    return {
      ok: false,
      message: `Firebase access failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      debug: firebaseDebug,
    };
  }
}
