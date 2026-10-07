import type { ApiWorkspaceMethod, ApiWorkspaceRequest } from "@/features/utility/types/apiWorkspaceTypes";

/**
 * OpenAPI(Swagger) 문서를 읽어 화면에 보여 주기 쉽게 요약한 타입(OpenAPI Studio 도구용).
 * 각 API(operation)는 바로 실행해 볼 수 있도록 API 작업 공간 요청(request) 모양으로도 변환해 둔다.
 */
export interface OpenApiParameterSummary {
  name: string;
  location: "path" | "query" | "header" | "cookie";
  required: boolean;
  description: string;
  example?: unknown;
}

export interface OpenApiOperationSummary {
  id: string;
  method: ApiWorkspaceMethod;
  path: string;
  operationId: string;
  summary: string;
  description: string;
  tags: string[];
  parameters: OpenApiParameterSummary[];
  requestExample?: unknown;
  requestContentType?: string;
  responseStatuses: string[];
  deprecated: boolean;
  request: ApiWorkspaceRequest;
}

export interface OpenApiDocumentSummary {
  openApiVersion: string;
  title: string;
  apiVersion: string;
  description: string;
  serverUrl: string;
  operations: OpenApiOperationSummary[];
  schemaNames: string[];
  warnings: string[];
  source: Record<string, unknown>;
}
