import { SESSIONS } from "./data";

const KEY = "radioTimeline.selectedSessionId";

export function getSelectedSessionId(): string {
  return localStorage.getItem(KEY) || SESSIONS[0].id;
}

export function setSelectedSessionId(id: string) {
  localStorage.setItem(KEY, id);
}

export function getSelectedSession() {
  const id = getSelectedSessionId();
  return SESSIONS.find((s) => s.id === id) || SESSIONS[0];
}
