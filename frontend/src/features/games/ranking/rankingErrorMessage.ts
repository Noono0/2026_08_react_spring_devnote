import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { apiErrorMessageMap } from "@/shared/api/error/apiErrorMessageMap";

/** API 오류를 화면 문구로. 아는 오류 코드면 미리 정한 문구, 모르면 서버가 보낸 설명, 그것도 없으면 기본 문구 */
export const rankingErrorMessage = (error: unknown): string => {
  const problemDetails = convertRequestErrorToProblemDetails(error);
  return apiErrorMessageMap[problemDetails.errorCode] ?? problemDetails.detail ?? "잠시 후 다시 시도해 주세요.";
};
