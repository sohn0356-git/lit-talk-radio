export type Line = {
  speaker: 0 | 1 | 2 | 3;
  text: string;
};

export type Session = {
  id: string; // 예: "2026-03-02"
  title: string; // 예: "정의는 무엇인가 / Ch1 (1/3)"
  lines: Line[];
};

export const SESSIONS: Session[] = [
  {
    id: "2026-03-02",
    title: "정의는 무엇인가 / Chapter 1 (1/3)",
    lines: [
      {
        speaker: 0,
        text: "A(옹호): 정의의 출발점은 ‘원칙’이야. 감정이 아니라 기준이 먼저다.",
      },
      {
        speaker: 1,
        text: "B(반박): 그런데 그 원칙이 결국 강자의 언어가 되면? 기준이 폭력이 될 수도 있어.",
      },
      {
        speaker: 2,
        text: "C(중재): 원칙을 세우되, 원칙이 사람을 다치게 할 때의 예외 기준도 함께 설계해야 해.",
      },
      {
        speaker: 3,
        text: "D(질문): 예외를 허용하는 순간, 원칙은 어떻게 흔들리지 않게 유지할까?",
      },
    ],
  },
  {
    id: "2026-03-03",
    title: "정의는 무엇인가 / Chapter 1 (2/3)",
    lines: [
      {
        speaker: 0,
        text: "A(옹호): 결과가 선하면 그 선택은 정당하다고 볼 수 있어.",
      },
      {
        speaker: 1,
        text: "B(반박): 결과가 선해도 과정이 비윤리적이면? ‘선’이 모든 걸 덮진 못해.",
      },
      {
        speaker: 2,
        text: "C(중재): 결과/과정 모두를 평가하는 최소 조건을 만들자.",
      },
      {
        speaker: 3,
        text: "D(질문): 우리는 어느 순간 ‘과정’보다 ‘결과’를 더 중요하게 여기게 될까?",
      },
    ],
  },
];
