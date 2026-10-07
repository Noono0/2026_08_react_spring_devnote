/**
 * pollTypes.ts — 토픽 투표 타입(서버 poll/dto의 record와 같은 모양)
 * 상태: OPEN(진행 중) → CLOSED(마감, 시간이 지나면 자동) → RESULTS_PUBLISHED(결과 공개)
 */
export type PollStatus = "OPEN" | "CLOSED" | "RESULTS_PUBLISHED";

export interface PollOption {
  optionId: number;
  label: string;
  /** 결과 비공개 상태에서는 서버도 득표수를 null로 내려줍니다. */
  votes: number | null;
}

export interface PollDefinitionRequest {
  question: string;
  options: string[];
  allowMultiple: boolean;
  maxSelections: number;
  realtimeResults: boolean;
  /** 입력하지 않으면 서버가 생성 시점부터 60분으로 설정합니다. */
  endsAt?: string;
}

export interface PollSearchCondition {
  pageNumber: number;
  pageSize: number;
  status: "ALL" | PollStatus;
}

export interface PollPageInformation {
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  firstPage: boolean;
  lastPage: boolean;
}

export interface PollPageResponse {
  content: Poll[];
  pageInformation: PollPageInformation;
}

/**
 * 투표 한 건. 서버가 "지금 사용자 기준"으로 계산한 값을 함께 준다.
 *   participated·selectedOptionIds: 내가 투표했는지·무엇을 골랐는지 / resultsVisible: 결과를 보여도 되는지
 *   manageableByCurrentUser·deletableByCurrentUser: 수정·마감·삭제 버튼 표시 여부(최종 권한 검사는 서버)
 */
export interface Poll {
  pollId: number;
  question: string;
  status: PollStatus;
  options: PollOption[];
  totalSelections: number | null;
  participantCount: number;
  participated: boolean;
  selectedOptionIds: number[];
  allowMultiple: boolean;
  maxSelections: number;
  realtimeResults: boolean;
  resultsVisible: boolean;
  manageableByCurrentUser: boolean;
  deletableByCurrentUser: boolean;
  createdBy: number;
  creatorName: string;
  endsAt: string;
  resultPublishedAt?: string;
  createdAt: string;
}
