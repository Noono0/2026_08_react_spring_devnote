import axios, { type AxiosInstance } from "axios";
import type { FileUploadOptions, HttpClient, HttpRequestOptions } from "./HttpClient";
import { createCommonRequestHeaders } from "./requestHelpers";
import { applicationEnvironment } from "@/shared/config/applicationEnvironment";
import { applicationLogger } from "@/shared/logging/applicationLogger";

const REQUEST_TIMEOUT_MILLISECONDS = 10_000;

export class AxiosHttpClient implements HttpClient {
  private readonly axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: applicationEnvironment.VITE_API_BASE_URL,
      timeout: REQUEST_TIMEOUT_MILLISECONDS,
      withCredentials: true,
    });

    this.axiosInstance.interceptors.request.use((requestConfiguration) => {
      const commonRequestHeaders = createCommonRequestHeaders();
      Object.entries(commonRequestHeaders).forEach(([headerName, headerValue]) => {
        requestConfiguration.headers.set(headerName, headerValue);
      });
      applicationLogger.info("[AxiosHttpClient] 요청 시작", {
        requestMethod: requestConfiguration.method?.toUpperCase(),
        requestUrl: requestConfiguration.url,
      });
      return requestConfiguration;
    });

    this.axiosInstance.interceptors.response.use(
      (response) => {
        applicationLogger.info("[AxiosHttpClient] 응답 성공", {
          requestUrl: response.config.url,
          responseStatus: response.status,
        });
        return response;
      },
      (requestError: unknown) => {
        applicationLogger.error("[AxiosHttpClient] 응답 실패", requestError);
        return Promise.reject(
          requestError instanceof Error
            ? requestError
            : new Error("HTTP 요청 처리에 실패했습니다.", { cause: requestError }),
        );
      },
    );
  }

  async get<ResponseData>(
    requestUrl: string,
    requestOptions?: HttpRequestOptions,
  ): Promise<ResponseData> {
    const response = await this.axiosInstance.get<ResponseData>(requestUrl, {
      params: requestOptions?.queryParameters,
      headers: requestOptions?.requestHeaders,
      signal: requestOptions?.abortSignal,
    });
    return response.data;
  }

  async post<RequestData, ResponseData>(
    requestUrl: string,
    requestData?: RequestData,
    requestOptions?: HttpRequestOptions,
  ): Promise<ResponseData> {
    const response = await this.axiosInstance.post<ResponseData>(requestUrl, requestData, {
      headers: requestOptions?.requestHeaders,
      signal: requestOptions?.abortSignal,
    });
    return response.data;
  }

  async put<RequestData, ResponseData>(
    requestUrl: string,
    requestData?: RequestData,
    requestOptions?: HttpRequestOptions,
  ): Promise<ResponseData> {
    const response = await this.axiosInstance.put<ResponseData>(requestUrl, requestData, {
      headers: requestOptions?.requestHeaders,
      signal: requestOptions?.abortSignal,
    });
    return response.data;
  }

  async delete<ResponseData>(
    requestUrl: string,
    requestOptions?: HttpRequestOptions,
  ): Promise<ResponseData> {
    const response = await this.axiosInstance.delete<ResponseData>(requestUrl, {
      params: requestOptions?.queryParameters,
      headers: requestOptions?.requestHeaders,
      signal: requestOptions?.abortSignal,
    });
    return response.data;
  }

  async upload<ResponseData>(
    requestUrl: string,
    formData: FormData,
    uploadOptions?: FileUploadOptions,
  ): Promise<ResponseData> {
    const response = await this.axiosInstance.post<ResponseData>(requestUrl, formData, {
      headers: uploadOptions?.requestHeaders,
      signal: uploadOptions?.abortSignal,
      onUploadProgress: (uploadProgressEvent) => {
        if (!uploadProgressEvent.total || !uploadOptions?.handleUploadProgressChange) {
          return;
        }
        const percentage = Math.round(
          (uploadProgressEvent.loaded * 100) / uploadProgressEvent.total,
        );
        uploadOptions.handleUploadProgressChange(percentage);
      },
    });
    return response.data;
  }
}

export const axiosHttpClient = new AxiosHttpClient();
