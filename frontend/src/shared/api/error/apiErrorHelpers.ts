import axios from "axios";
import type { ApiProblemDetails } from "./apiErrorTypes";

const defaultProblemDetails: ApiProblemDetails = {
  status: 0,
  errorCode: "UNKNOWN_CLIENT_ERROR",
  detail: "알 수 없는 오류가 발생했습니다.",
  fieldErrors: [],
};

export const convertRequestErrorToProblemDetails = (requestError: unknown): ApiProblemDetails => {
  if (axios.isCancel(requestError)) {
    return {
      status: 0,
      errorCode: "REQUEST_CANCELLED",
      detail: "이전 요청이 취소되었습니다.",
      fieldErrors: [],
    };
  }

  if (axios.isAxiosError<ApiProblemDetails>(requestError)) {
    if (requestError.response?.data) {
      return requestError.response.data;
    }
    return {
      status: 0,
      errorCode: "NETWORK_CONNECTION_FAILED",
      detail: "백엔드 서버에 연결할 수 없습니다.",
      fieldErrors: [],
    };
  }

  if (requestError instanceof DOMException && requestError.name === "AbortError") {
    return {
      status: 0,
      errorCode: "REQUEST_CANCELLED",
      detail: "이전 요청이 취소되었습니다.",
      fieldErrors: [],
    };
  }

  if (requestError instanceof TypeError) {
    return {
      status: 0,
      errorCode: "NETWORK_CONNECTION_FAILED",
      detail: "백엔드 서버에 연결할 수 없습니다.",
      fieldErrors: [],
    };
  }

  if (requestError instanceof Error && isApiProblemDetails(requestError.cause)) {
    return requestError.cause;
  }

  if (isApiProblemDetails(requestError)) {
    return requestError;
  }
  return defaultProblemDetails;
};

export const isApiErrorRetryable = (requestError: unknown): boolean => {
  const problemDetails = convertRequestErrorToProblemDetails(requestError);
  if (problemDetails.errorCode === "REQUEST_CANCELLED") {
    return false;
  }
  return problemDetails.status === 0 || [502, 503, 504].includes(problemDetails.status);
};

const isApiProblemDetails = (value: unknown): value is ApiProblemDetails => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<ApiProblemDetails>;
  return typeof candidate.errorCode === "string" && typeof candidate.status === "number";
};
