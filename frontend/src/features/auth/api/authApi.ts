import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";
import type { AuthSession, LoginRequest, RegisterRequest } from "@/features/auth/types/authTypes";

export const getAuthSession = async (): Promise<AuthSession> => (await selectedHttpClient.get<ApiResponse<AuthSession>>("/auth/session")).data;
export const login = async (request: LoginRequest): Promise<AuthSession> => (await selectedHttpClient.post<LoginRequest, ApiResponse<AuthSession>>("/auth/login", request)).data;
export const register = async (request: RegisterRequest): Promise<AuthSession> => (await selectedHttpClient.post<RegisterRequest, ApiResponse<AuthSession>>("/auth/register", request)).data;
export const logout = async (): Promise<AuthSession> => (await selectedHttpClient.delete<ApiResponse<AuthSession>>("/auth/session")).data;
