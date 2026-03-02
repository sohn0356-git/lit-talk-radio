import type { Book, DebateSession } from "./data";
import { BOOKS } from "./data";

const KEY_BOOK = "radioTimeline.selectedBookId";
const KEY_CHAPTER = "radioTimeline.selectedChapter";
const KEY_CURRENT_SESSION = "radioTimeline.currentSession";

export function getSelectedBookId(): string {
  return localStorage.getItem(KEY_BOOK) || BOOKS[0].id;
}

export function setSelectedBookId(id: string) {
  localStorage.setItem(KEY_BOOK, id);
}

export function getSelectedBook(): Book {
  const id = getSelectedBookId();
  return BOOKS.find((book) => book.id === id) || BOOKS[0];
}

export function getSelectedChapter(): number {
  const value = Number(localStorage.getItem(KEY_CHAPTER) || "1");
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

export function setSelectedChapter(chapter: number) {
  localStorage.setItem(KEY_CHAPTER, String(chapter));
}

export function getCurrentSession(): DebateSession | null {
  const raw = localStorage.getItem(KEY_CURRENT_SESSION);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as DebateSession;
  } catch {
    return null;
  }
}

export function setCurrentSession(session: DebateSession | null) {
  if (!session) {
    localStorage.removeItem(KEY_CURRENT_SESSION);
    return;
  }

  localStorage.setItem(KEY_CURRENT_SESSION, JSON.stringify(session));
}
