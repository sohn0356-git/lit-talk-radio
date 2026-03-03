export type Expression =
  | "neutral"
  | "smile"
  | "serious"
  | "angry"
  | "surprised";

export type SpeakerId = "a" | "b" | "c" | "d";

export type Participant = {
  id: SpeakerId;
  displayName: string;
  spriteBase: string;
  persona: string;
};

export type Turn = {
  speakerId: SpeakerId;
  expression: Expression;
  text: string;
};

export type DebateSession = {
  id: string;
  date: string;
  title: string;
  bookId: string;
  bookTitle: string;
  chapter: number;
  participants: Participant[];
  turns: Turn[];
  targetCharCount: number;
  createdAtMs: number;
};

export type PersonaProfile = {
  id: SpeakerId;
  displayName: string;
  accumulatedPersona: string;
  totalSessions: number;
  totalTurns: number;
  updatedAtMs: number;
};

export type Book = {
  id: string;
  title: string;
  totalChapters: number;
};

export const BOOKS: Book[] = [
  {
    id: "justice-what-is-the-right-thing-to-do",
    title: "정의란 무엇인가",
    totalChapters: 10,
  },
  {
    id: "mere-christianity",
    title: "순전한 기독교",
    totalChapters: 4,
  },
];

export const PARTICIPANTS: Participant[] = [
  {
    id: "a",
    displayName: "민준",
    spriteBase: "/avatars/a",
    persona:
      "논리파. 말은 편하게 하지만 핵심 개념과 전제를 끝까지 확인한다.",
  },
  {
    id: "b",
    displayName: "서윤",
    spriteBase: "/avatars/b",
    persona:
      "현실파. 실제 사례, 뉴스, 정책, 돈과 시간 같은 현실 조건을 자주 꺼낸다.",
  },
  {
    id: "c",
    displayName: "지아",
    spriteBase: "/avatars/c",
    persona:
      "공감파. 사람의 감정, 관계, 상처, 공동체 분위기를 세심하게 본다.",
  },
  {
    id: "d",
    displayName: "현우",
    spriteBase: "/avatars/d",
    persona:
      "반론러. 분위기에 휩쓸리지 않고 허점을 찌르는 질문으로 판을 흔든다.",
  },
];
