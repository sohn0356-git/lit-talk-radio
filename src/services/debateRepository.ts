import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { DebateSession } from "../data";
import { assertFirebaseReady, db } from "../firebase";

export async function saveDebateSession(session: DebateSession): Promise<void> {
  assertFirebaseReady();

  const chapterDocId = `chapter-${session.chapter}`;
  const sessionRef = doc(
    db!,
    "books",
    session.bookId,
    "chapters",
    chapterDocId,
    "sessions",
    session.id
  );

  await setDoc(sessionRef, {
    ...session,
    chapterDocId,
    createdAt: serverTimestamp(),
  });
}

export async function getRecentDebateSessions(
  maxCount = 30
): Promise<DebateSession[]> {
  assertFirebaseReady();

  const q = query(
    collectionGroup(db!, "sessions"),
    orderBy("createdAtMs", "desc"),
    limit(maxCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as DebateSession);
}

export async function getSessionsByBookChapter(
  bookId: string,
  chapter: number
): Promise<DebateSession[]> {
  assertFirebaseReady();

  const chapterDocId = `chapter-${chapter}`;
  const q = query(
    collection(db!, "books", bookId, "chapters", chapterDocId, "sessions"),
    orderBy("createdAtMs", "desc")
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as DebateSession);
}
