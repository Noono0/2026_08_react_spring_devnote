import type { ApiWorkspaceMethod } from "@/features/utility/types/apiWorkspaceTypes";

/**
 * 가짜 API 시나리오 타입(브라우저 안에서만 동작하는 "목 서버" 연습 도구).
 * 응답 방식: FIXED(항상 첫 응답) / SEQUENCE(호출할 때마다 다음 응답, repeatSequence면 처음부터 반복) / RANDOM(무작위)
 */
export type MockApiResponseMode = "FIXED" | "SEQUENCE" | "RANDOM";

/** 응답 하나: 상태 코드·지연 시간·본문·헤더. bodyIncludes를 적으면 요청 본문에 그 글자가 있을 때만 이 응답을 고른다. */
export interface MockApiResponseStep {
  id: string;
  name: string;
  status: number;
  delayMilliseconds: number;
  contentType: string;
  body: string;
  headers: Record<string, string>;
  bodyIncludes: string;
}

export interface MockApiScenario {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  method: ApiWorkspaceMethod;
  path: string;
  mode: MockApiResponseMode;
  repeatSequence: boolean;
  steps: MockApiResponseStep[];
  createdAt: string;
  updatedAt: string;
}
