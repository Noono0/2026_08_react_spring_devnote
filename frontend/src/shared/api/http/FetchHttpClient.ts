import type { FileUploadOptions, HttpClient, HttpRequestOptions } from "./HttpClient";
import { appendQueryParameters, createCommonRequestHeaders } from "./requestHelpers";
import { applicationEnvironment } from "@/shared/config/applicationEnvironment";
import { applicationLogger } from "@/shared/logging/applicationLogger";

export class FetchHttpClient implements HttpClient {
  async get<ResponseData>(
    requestUrl: string,
    requestOptions?: HttpRequestOptions,
  ): Promise<ResponseData> {
    return this.sendRequest<ResponseData>(
      appendQueryParameters(
        `${applicationEnvironment.VITE_API_BASE_URL}${requestUrl}`,
        requestOptions?.queryParameters,
      ),
      {
        method: "GET",
        headers: createCommonRequestHeaders(requestOptions?.requestHeaders),
        signal: requestOptions?.abortSignal,
      },
    );
  }

  async post<RequestData, ResponseData>(
    requestUrl: string,
    requestData?: RequestData,
    requestOptions?: HttpRequestOptions,
  ): Promise<ResponseData> {
    return this.sendRequest<ResponseData>(
      `${applicationEnvironment.VITE_API_BASE_URL}${requestUrl}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...createCommonRequestHeaders(requestOptions?.requestHeaders),
        },
        body: requestData === undefined ? undefined : JSON.stringify(requestData),
        signal: requestOptions?.abortSignal,
      },
    );
  }

  async put<RequestData, ResponseData>(
    requestUrl: string,
    requestData?: RequestData,
    requestOptions?: HttpRequestOptions,
  ): Promise<ResponseData> {
    return this.sendRequest<ResponseData>(
      `${applicationEnvironment.VITE_API_BASE_URL}${requestUrl}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...createCommonRequestHeaders(requestOptions?.requestHeaders),
        },
        body: requestData === undefined ? undefined : JSON.stringify(requestData),
        signal: requestOptions?.abortSignal,
      },
    );
  }

  async delete<ResponseData>(
    requestUrl: string,
    requestOptions?: HttpRequestOptions,
  ): Promise<ResponseData> {
    return this.sendRequest<ResponseData>(
      appendQueryParameters(
        `${applicationEnvironment.VITE_API_BASE_URL}${requestUrl}`,
        requestOptions?.queryParameters,
      ),
      {
        method: "DELETE",
        headers: createCommonRequestHeaders(requestOptions?.requestHeaders),
        signal: requestOptions?.abortSignal,
      },
    );
  }

  async upload<ResponseData>(
    requestUrl: string,
    formData: FormData,
    uploadOptions?: FileUploadOptions,
  ): Promise<ResponseData> {
    /*
     * fetch는 브라우저 표준 API만으로 업로드 진행률을 제공하지 않습니다.
     * Axios와 차이를 확인하기 위해 완료 시 100%만 전달합니다.
     */
    const response = await this.sendRequest<ResponseData>(
      `${applicationEnvironment.VITE_API_BASE_URL}${requestUrl}`,
      {
        method: "POST",
        headers: createCommonRequestHeaders(uploadOptions?.requestHeaders),
        body: formData,
        signal: uploadOptions?.abortSignal,
      },
    );
    uploadOptions?.handleUploadProgressChange?.(100);
    return response;
  }

  private async sendRequest<ResponseData>(
    completeRequestUrl: string,
    requestConfiguration: RequestInit,
  ): Promise<ResponseData> {
    const requestWithCredentials: RequestInit = {
      ...requestConfiguration,
      credentials: "include",
    };
    const requestStartedAt = performance.now();
    applicationLogger.info("[FetchHttpClient] 요청 시작", {
      completeRequestUrl,
      requestMethod: requestWithCredentials.method,
    });

    const response = await fetch(completeRequestUrl, requestWithCredentials);
    const responseData = await this.parseResponse<ResponseData>(response);
    const elapsedMilliseconds = performance.now() - requestStartedAt;

    if (!response.ok) {
      applicationLogger.error("[FetchHttpClient] HTTP 오류", {
        responseStatus: response.status,
        responseData,
      });
      throw new Error("API 요청이 실패했습니다.", { cause: responseData });
    }

    applicationLogger.info("[FetchHttpClient] 응답 성공", {
      responseStatus: response.status,
      elapsedMilliseconds: elapsedMilliseconds.toFixed(2),
      traceId: response.headers.get("X-Request-Id"),
    });
    return responseData;
  }

  private async parseResponse<ResponseData>(response: Response): Promise<ResponseData> {
    if (response.status === 204) {
      return undefined as ResponseData;
    }
    const contentType = response.headers.get("content-type");
    return contentType?.includes("application/json")
      ? ((await response.json()) as ResponseData)
      : ((await response.text()) as ResponseData);
  }
}

export const fetchHttpClient = new FetchHttpClient();
