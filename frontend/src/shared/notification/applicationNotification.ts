import { toast } from "sonner";
import type { ApiProblemDetails } from "@/shared/api/error/apiErrorTypes";
import { apiErrorMessageMap } from "@/shared/api/error/apiErrorMessageMap";

export const applicationNotification = {
  success(title: string, description?: string): void {
    toast.success(title, { description });
  },
  error(title: string, description?: string): void {
    toast.error(title, { description });
  },
  warning(title: string, description?: string): void {
    toast.warning(title, { description });
  },
  apiError(problemDetails: ApiProblemDetails): void {
    const message =
      apiErrorMessageMap[problemDetails.errorCode] ??
      problemDetails.detail ??
      "요청을 처리하지 못했습니다.";
    toast.error(message, {
      description: problemDetails.traceId ? `문의 코드: ${problemDetails.traceId}` : undefined,
    });
  },
};
