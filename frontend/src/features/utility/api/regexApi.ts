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

