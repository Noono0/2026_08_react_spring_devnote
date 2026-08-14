export interface ApiFieldError {
  fieldName: string;
  rejectedValue?: unknown;
  message: string;
}

export interface ApiProblemDetails {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  instance?: string;
  errorCode: string;
  traceId?: string;
  timestamp?: string;
  fieldErrors: ApiFieldError[];
}
