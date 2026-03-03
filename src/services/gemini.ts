import type { Expression, SpeakerId, Turn } from "../data";
import { buildGeminiGenerateUrl, GEMINI_MODEL } from "./geminiConfig";

const ALLOWED_SPEAKER_IDS: SpeakerId[] = ["a", "b", "c", "d"];
const ALLOWED_EXPRESSIONS: Expression[] = [
  "neutral",
  "smile",
  "serious",
  "angry",
  "surprised",
];

function pickExpression(index: number): Expression {
  return ALLOWED_EXPRESSIONS[index % ALLOWED_EXPRESSIONS.length];
}

function safeParseJsonArray(text: string): unknown[] {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const fenced = text.match(/```json\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        const parsed = JSON.parse(fenced[1]);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }
}

function sanitizeTurns(raw: unknown[]): Turn[] {
  const result: Turn[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as Partial<Turn> | null;
    if (!item || typeof item !== "object") continue;

    const speakerId =
      typeof item.speakerId === "string" &&
      ALLOWED_SPEAKER_IDS.includes(item.speakerId as SpeakerId)
        ? (item.speakerId as SpeakerId)
        : ALLOWED_SPEAKER_IDS[i % ALLOWED_SPEAKER_IDS.length];

    const expression =
      typeof item.expression === "string" &&
      ALLOWED_EXPRESSIONS.includes(item.expression as Expression)
        ? (item.expression as Expression)
        : pickExpression(i);

    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (!text) continue;

    result.push({ speakerId, expression, text });
  }

  return result;
}

export async function generateDebateTurns(input: {
  bookTitle: string;
  chapter: number;
  personas: Array<{ id: SpeakerId; displayName: string; persona: string }>;
  targetCharCount: number;
}): Promise<Turn[]> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key. Add VITE_GEMINI_API_KEY to your .env file."
    );
  }

  const personaText = input.personas
    .map((p) => `${p.id}(${p.displayName}): ${p.persona}`)
    .join("\n");

  const prompt = [
    "Generate only a JSON array for a Korean discussion script.",
    "",
    `Book: ${input.bookTitle}`,
    `Chapter: ${input.chapter}`,
    `Target total characters: about ${input.targetCharCount}`,
    "",
    "Participants and accumulated personas:",
    personaText,
    "",
    "Rules:",
    "1) Output only a JSON array.",
    '2) Each item format: {"speakerId":"a|b|c|d","expression":"neutral|smile|serious|angry|surprised","text":"..."}',
    "3) Total turns: 18 to 24.",
    "4) Each text length: 170 to 340 Korean characters.",
    "5) The text must sound like close friends talking naturally in Korean.",
    "6) Avoid lecture tone; use casual but clear spoken style.",
    "7) Keep each speaker personality consistent with accumulated persona.",
    "8) Stay centered on the selected book chapter, but choose only interesting angles.",
    "9) Include practical examples, disagreements, and playful reactions.",
    "10) End with both consensus points and unresolved questions.",
    "11) The text field must be in Korean.",
    "12) Do not prefix lines with names or IDs in text field.",
  ].join("\n");

  const response = await fetch(
    buildGeminiGenerateUrl(apiKey),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.8,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Gemini request failed (${GEMINI_MODEL}): ${response.status} ${errText}`
    );
  }

  const data = await response.json();
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((part: { text?: string }) => part.text || "")
    .join("\n");

  const turns = sanitizeTurns(safeParseJsonArray(text));
  if (turns.length < 8) {
    throw new Error("Gemini response parse failed: not enough turns.");
  }

  return turns;
}
