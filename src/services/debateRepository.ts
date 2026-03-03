import {
  get,
  limitToLast,
  orderByChild,
  query,
  ref,
  set,
} from "firebase/database";
import type {
  DebateSession,
  Expression,
  PersonaProfile,
  SpeakerId,
} from "../data";
import { assertFirebaseReady, rtdb } from "../firebase";

type SessionIndexItem = {
  createdAtMs: number;
  session: DebateSession;
};

function expressionLabel(expression: Expression): string {
  if (expression === "smile") return "밝고 긍정적인 톤";
  if (expression === "serious") return "진지하고 차분한 톤";
  if (expression === "angry") return "직설적이고 강한 톤";
  if (expression === "surprised") return "호기심 많은 반응형 톤";
  return "균형 잡힌 기본 톤";
}

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

export async function getPersonaProfiles(): Promise<
  Partial<Record<SpeakerId, PersonaProfile>>
> {
  assertFirebaseReady();
  const snapshot = await get(ref(rtdb!, "persona_profiles"));
  if (!snapshot.exists()) return {};
  return snapshot.val() as Partial<Record<SpeakerId, PersonaProfile>>;
}

function buildDeltaPersonaText(session: DebateSession, speakerId: SpeakerId): string {
  const turns = session.turns.filter((t) => t.speakerId === speakerId);
  if (turns.length === 0) return "최근 발화 없음.";

  const avgLen = Math.round(
    turns.reduce((acc, t) => acc + t.text.length, 0) / turns.length
  );
  const questionCount = turns.reduce(
    (acc, t) => acc + (t.text.includes("?") || t.text.includes("？") ? 1 : 0),
    0
  );

  const countByExpr = turns.reduce<Record<Expression, number>>(
    (acc, t) => {
      acc[t.expression] += 1;
      return acc;
    },
    {
      neutral: 0,
      smile: 0,
      serious: 0,
      angry: 0,
      surprised: 0,
    }
  );

  const topExpression = (Object.entries(countByExpr).sort(
    (a, b) => b[1] - a[1]
  )[0]?.[0] || "neutral") as Expression;

  const questionStyle =
    questionCount >= Math.ceil(turns.length / 2)
      ? "질문을 자주 던짐"
      : "설명과 의견 제시 비중이 높음";

  return [
    `최근 ${turns.length}턴 참여`,
    `평균 ${avgLen}자`,
    questionStyle,
    expressionLabel(topExpression),
  ].join(", ");
}

function mergePersonaText(base: string, delta: string): string {
  if (!base) return delta;
  if (base.includes(delta)) return base;
  const merged = `${base} | ${delta}`;
  return merged.length > 420 ? merged.slice(merged.length - 420) : merged;
}

export async function updatePersonaProfilesFromSession(
  session: DebateSession
): Promise<void> {
  assertFirebaseReady();

  const current = await getPersonaProfiles();

  const writes = session.participants.map((p) => {
    const oldProfile = current[p.id];
    const delta = buildDeltaPersonaText(session, p.id);

    const nextProfile: PersonaProfile = {
      id: p.id,
      displayName: p.displayName,
      accumulatedPersona: mergePersonaText(
        oldProfile?.accumulatedPersona || p.persona,
        delta
      ),
      totalSessions: (oldProfile?.totalSessions || 0) + 1,
      totalTurns:
        (oldProfile?.totalTurns || 0) +
        session.turns.filter((t) => t.speakerId === p.id).length,
      updatedAtMs: Date.now(),
    };

    return set(ref(rtdb!, `persona_profiles/${p.id}`), nextProfile);
  });

  await Promise.all(writes);
}
