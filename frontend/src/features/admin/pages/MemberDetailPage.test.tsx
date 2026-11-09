import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemberDetailPage } from "./MemberDetailPage";

const state = vi.hoisted(() => ({
  memberRole: "USER", selfId: 2, superAdministrator: false,
  profileUpdate: vi.fn().mockResolvedValue(undefined), managementUpdate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/admin/hooks/useAdminQueries", () => ({
  useAdminMemberQuery: () => ({ isPending: false, isError: false, data: {
    memberId: 1, loginId: "member1", email: "old@example.com", memberName: "기존 이름", memberRole: state.memberRole,
    gradeCode: "BRONZE", accountStatus: "ACTIVE", useYn: "Y", lastLoginAt: null,
    createdAt: "2026-01-01T00:00:00", updatedAt: "2026-01-01T00:00:00",
  } }),
  useUpdateMemberProfileMutation: () => ({ isPending: false, mutateAsync: state.profileUpdate }),
  useUpdateMemberMutation: () => ({ isPending: false, mutateAsync: state.managementUpdate }),
}));
vi.mock("@/features/auth/hooks/useAuthSession", () => ({
  useAuthSessionQuery: () => ({ data: { memberId: state.selfId, superAdministrator: state.superAdministrator } }),
}));
vi.mock("@/shared/notification/applicationNotification", () => ({
  applicationNotification: { success: vi.fn(), apiError: vi.fn() },
}));

const renderPage = () => render(<MemoryRouter initialEntries={["/admin/members/1"]}><Routes>
  <Route path="/admin/members/:memberId" element={<MemberDetailPage />} />
</Routes></MemoryRouter>);

describe("MemberDetailPage", () => {
  beforeEach(() => { state.memberRole = "USER"; state.selfId = 2; state.superAdministrator = false; state.profileUpdate.mockClear(); });

  it("ADMIN은 일반 회원의 기본 정보를 수정할 수 있다", async () => {
    renderPage();
    fireEvent.change(screen.getByRole("textbox", { name: "이름" }), { target: { value: "새 이름" } });
    fireEvent.click(screen.getByRole("button", { name: "정보 저장" }));
    await waitFor(() => expect(state.profileUpdate).toHaveBeenCalledWith({ memberId: 1, request: { memberName: "새 이름", email: "old@example.com" } }));
  });

  it("ADMIN은 다른 슈퍼관리자의 정보를 수정할 수 없다", () => {
    state.memberRole = "SUPER_ADMIN";
    renderPage();
    expect(screen.getByRole("textbox", { name: "이름" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "정보 저장" })).not.toBeInTheDocument();
  });

  it("SUPER_ADMIN은 권한과 상태 변경 입력도 볼 수 있다", () => {
    state.memberRole = "ADMIN";
    state.superAdministrator = true;
    renderPage();
    expect(screen.getByRole("combobox", { name: "역할" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "정보 저장" })).toBeInTheDocument();
  });
});
