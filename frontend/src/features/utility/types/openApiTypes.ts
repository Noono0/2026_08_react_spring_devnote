import type { ApiWorkspaceMethod, ApiWorkspaceRequest } from "@/features/utility/types/apiWorkspaceTypes";

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
