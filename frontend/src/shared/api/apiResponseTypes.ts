export interface ApiResponse<ResponseData> {
  success: boolean;
  code: string;
  message: string;
  data: ResponseData;
  traceId?: string;
}
