import { applicationEnvironment } from "@/shared/config/applicationEnvironment";

export const createRequestId = (): string => crypto.randomUUID().replaceAll("-", "");

export const createCommonRequestHeaders = (
  additionalHeaders?: Record<string, string>,
): Record<string, string> => ({
  "X-Request-Id": createRequestId(),
  "X-Member-Id": localStorage.getItem("developmentMemberId") ??
    applicationEnvironment.VITE_DEVELOPMENT_MEMBER_ID,
  ...additionalHeaders,
});

export const appendQueryParameters = (
  requestUrl: string,
  queryParameters?: object,
): string => {
  const requestUrlObject = new URL(requestUrl, window.location.origin);
  if (queryParameters) {
    Object.entries(queryParameters).forEach(([parameterName, parameterValue]) => {
      if (parameterValue === undefined || parameterValue === null || parameterValue === "") {
        return;
      }
      requestUrlObject.searchParams.append(parameterName, String(parameterValue));
    });
  }
  return requestUrlObject.toString();
};
