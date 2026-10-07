// regexApi.ts — Java 정규식 실행 API. 브라우저(JavaScript) 결과와 비교하려고 같은 패턴을 서버 Java로 실행해 본다.

import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";
import type { RegexExecutionResult, RegexMode } from "@/features/utility/utils/regexTester";

export interface JavaRegexRequest {
  pattern: string;
  flags: string;
  input: string;
  mode: RegexMode;
  replacement: string;
}

export const executeJavaRegex = async (request: JavaRegexRequest): Promise<RegexExecutionResult> =>
  (await selectedHttpClient.post<JavaRegexRequest, ApiResponse<RegexExecutionResult>>("/utilities/regex/java", request)).data;

