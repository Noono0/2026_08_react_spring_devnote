import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { logout } from "@/features/auth/api/authApi";
import type { AuthSession } from "@/features/auth/types/authTypes";
import { useLogoutMutation } from "./useAuthSession";

vi.mock("@/features/auth/api/authApi", () => ({
  getAuthSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
}));

const signedOutSession: AuthSession = {
  authenticated: false,
  memberName: "",
  administrator: false,
  superAdministrator: false,
};

describe("useLogoutMutation", () => {
  it("로그아웃하면 권한별 캐시를 무효화하고 이전 계정 상세 캐시를 제거한다", async () => {
    vi.mocked(logout).mockResolvedValue(signedOutSession);
    const queryClient = new QueryClient();
    queryClient.setQueryData(["account"], { memberId: 1, email: "previous@example.com" });
    queryClient.setQueryData(["board-lab", "detail", "POPUP", 9, 1, true], { title: "예약된 관리자 안내" });
    queryClient.setQueryData(["board-lab", "list", "POPUP", "", 0, 1, true], { content: ["예약된 관리자 안내"] });
    const cancelQueries = vi.spyOn(queryClient, "cancelQueries");
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

    const { result } = renderHook(() => useLogoutMutation(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync();
    });

    // 업무 History는 슈퍼관리자에게만 임시저장 글이 보이므로, 로그아웃 뒤 남아 있으면 정보 노출이 된다.
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["history"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["documents"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["board-lab"] });
    expect(queryClient.getQueryData(["account"])).toBeUndefined();
    expect(cancelQueries).toHaveBeenCalledWith({ queryKey: ["board-lab", "detail", "POPUP"] });
    expect(queryClient.getQueriesData({ queryKey: ["board-lab", "detail", "POPUP"] })).toEqual([]);
    expect(queryClient.getQueriesData({ queryKey: ["board-lab", "list", "POPUP"] })).toEqual([]);
  });
});
