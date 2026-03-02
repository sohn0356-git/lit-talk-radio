export type Expression =
  | "neutral"
  | "smile"
  | "serious"
  | "angry"
  | "surprised";

export type SpeakerId = "a" | "b" | "c" | "d";

export type Participant = {
  id: SpeakerId;
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
    spriteBase: "/avatars/a",
    persona: "논리 중심. 개념을 정확히 정의하고 논증 구조를 점검한다.",
  },
  {
    id: "b",
    spriteBase: "/avatars/b",
    persona: "현실 사례 중심. 사회 정책, 제도, 비용과 효과를 따진다.",
  },
  {
    id: "c",
    spriteBase: "/avatars/c",
    persona: "공감 중심. 약자, 관계, 공동체의 감정과 맥락을 강조한다.",
  },
  {
    id: "d",
    spriteBase: "/avatars/d",
    persona: "반론 담당. 허점을 찾아 질문하고 직관을 뒤흔든다.",
  },
];
