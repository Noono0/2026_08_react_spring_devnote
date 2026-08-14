import type { ApiWorkspaceMethod } from "@/features/utility/types/apiWorkspaceTypes";

export type MockApiResponseMode = "FIXED" | "SEQUENCE" | "RANDOM";

export interface MockApiResponseStep {
  id: string;
  name: string;
  status: number;
  delayMilliseconds: number;
  contentType: string;
  body: string;
  headers: Record<string, string>;
  bodyIncludes: string;
}

export interface MockApiScenario {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  method: ApiWorkspaceMethod;
  path: string;
  mode: MockApiResponseMode;
  repeatSequence: boolean;
  steps: MockApiResponseStep[];
  createdAt: string;
  updatedAt: string;
}
