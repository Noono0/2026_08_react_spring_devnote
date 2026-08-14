export interface HttpRequestOptions {
  queryParameters?: object;
  requestHeaders?: Record<string, string>;
  abortSignal?: AbortSignal;
}

export interface FileUploadOptions {
  requestHeaders?: Record<string, string>;
  abortSignal?: AbortSignal;
  handleUploadProgressChange?: (uploadProgressPercentage: number) => void;
}

export interface HttpClient {
  get<ResponseData>(requestUrl: string, requestOptions?: HttpRequestOptions): Promise<ResponseData>;
  post<RequestData, ResponseData>(
    requestUrl: string,
    requestData?: RequestData,
    requestOptions?: HttpRequestOptions,
  ): Promise<ResponseData>;
  put<RequestData, ResponseData>(
    requestUrl: string,
    requestData?: RequestData,
    requestOptions?: HttpRequestOptions,
  ): Promise<ResponseData>;
  delete<ResponseData>(
    requestUrl: string,
    requestOptions?: HttpRequestOptions,
  ): Promise<ResponseData>;
  upload<ResponseData>(
    requestUrl: string,
    formData: FormData,
    uploadOptions?: FileUploadOptions,
  ): Promise<ResponseData>;
}
