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
