import { z } from "zod";

const applicationEnvironmentSchema = z.object({
  VITE_API_BASE_URL: z.string().min(1),
  VITE_HTTP_CLIENT: z.enum(["axios", "fetch"]),
  VITE_DATA_SOURCE: z.enum(["backend", "mock"]),
  VITE_MOCK_SCENARIO: z.string().min(1),
  VITE_DEVELOPMENT_MEMBER_ID: z.string().regex(/^\d+$/),
  VITE_ENABLE_DEVELOPMENT_MENU: z.enum(["true", "false"]),
});

export const applicationEnvironment = applicationEnvironmentSchema.parse(import.meta.env);
