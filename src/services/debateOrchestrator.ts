import type { Book, DebateSession } from "../data";
import { PARTICIPANTS } from "../data";
import { generateDebateTurns } from "./gemini";
import { saveDebateSession } from "./debateRepository";

function formatDate(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatSessionId(now: Date): string {
  const day = formatDate(now);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${day}_${hh}${mm}${ss}`;
}

export async function createDebateSession(
  book: Book,
  chapter: number
): Promise<DebateSession> {
  const targetCharCount = 5000;
  const turns = await generateDebateTurns({
    bookTitle: book.title,
    chapter,
    targetCharCount,
    personas: PARTICIPANTS.map((p) => ({ id: p.id, persona: p.persona })),
  });

  const now = new Date();
  const session: DebateSession = {
    id: formatSessionId(now),
    date: formatDate(now),
    title: `${book.title} / Chapter ${chapter}`,
    bookId: book.id,
    bookTitle: book.title,
    chapter,
    participants: PARTICIPANTS,
    turns,
    targetCharCount,
    createdAtMs: now.getTime(),
  };

  await saveDebateSession(session);
  return session;
}
