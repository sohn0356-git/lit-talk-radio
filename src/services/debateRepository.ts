import {
  get,
  limitToLast,
  orderByChild,
  query,
  ref,
  set,
} from "firebase/database";
import type { DebateSession } from "../data";
import { assertFirebaseReady, rtdb } from "../firebase";

type SessionIndexItem = {
  createdAtMs: number;
  session: DebateSession;
};

function sortDescByCreatedAt(items: DebateSession[]): DebateSession[] {
  return items.sort((a, b) => b.createdAtMs - a.createdAtMs);
}

export async function saveDebateSession(session: DebateSession): Promise<void> {
  assertFirebaseReady();

  const chapterDocId = `chapter-${session.chapter}`;
  const sessionPath = `books/${session.bookId}/chapters/${chapterDocId}/sessions/${session.id}`;
  const indexPath = `session_index/${session.id}`;

  await Promise.all([
    set(ref(rtdb!, sessionPath), session),
    set(ref(rtdb!, indexPath), {
      createdAtMs: session.createdAtMs,
      session,
    } satisfies SessionIndexItem),
  ]);
}

export async function getRecentDebateSessions(
  maxCount = 30
): Promise<DebateSession[]> {
  assertFirebaseReady();

  const indexQuery = query(
    ref(rtdb!, "session_index"),
    orderByChild("createdAtMs"),
    limitToLast(maxCount)
  );

  const snapshot = await get(indexQuery);
  if (!snapshot.exists()) return [];

  const raw = snapshot.val() as Record<string, SessionIndexItem | DebateSession>;
  const sessions: DebateSession[] = Object.values(raw)
    .map((item) => {
      if ((item as SessionIndexItem).session) {
        return (item as SessionIndexItem).session;
      }
      return item as DebateSession;
    })
    .filter(Boolean);

  return sortDescByCreatedAt(sessions);
}

export async function getSessionsByBookChapter(
  bookId: string,
  chapter: number
): Promise<DebateSession[]> {
  assertFirebaseReady();

  const chapterDocId = `chapter-${chapter}`;
  const snapshot = await get(
    ref(rtdb!, `books/${bookId}/chapters/${chapterDocId}/sessions`)
  );

  if (!snapshot.exists()) return [];

  const raw = snapshot.val() as Record<string, DebateSession>;
  return sortDescByCreatedAt(Object.values(raw));
}
