import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OwnAccountPage } from "./OwnAccountPage";

const state = vi.hoisted(() => ({
  update: vi.fn().mockResolvedValue(undefined), password: vi.fn().mockResolvedValue(undefined), error: vi.fn(),
}));
vi.mock("@/features/auth/hooks/useAccountQueries", () => ({
  useOwnAccountQuery: () => ({ isPending: false, isError: false, data: {
    memberId: 1, loginId: "myid", email: "me@example.com", memberName: "내 이름", memberRole: "USER",
    gradeCode: "BRONZE", accountStatus: "ACTIVE", useYn: "Y", lastLoginAt: null,
    createdAt: "2026-01-01T00:00:00", updatedAt: "2026-01-01T00:00:00",
  } }),
  useUpdateOwnAccountMutation: () => ({ isPending: false, mutateAsync: state.update }),
  useChangeOwnPasswordMutation: () => ({ isPending: false, mutateAsync: state.password }),
}));
vi.mock("@/shared/notification/applicationNotification", () => ({
  applicationNotification: { success: vi.fn(), error: state.error, apiError: vi.fn() },
}));

describe("OwnAccountPage", () => {
  beforeEach(() => { state.update.mockClear(); state.password.mockClear(); state.error.mockClear(); });

  it("일반 회원이 자기 이름과 이메일을 저장할 수 있다", async () => {
    render(<OwnAccountPage />);
    fireEvent.change(screen.getByRole("textbox", { name: "이름" }), { target: { value: "바뀐 이름" } });
    fireEvent.click(screen.getByRole("button", { name: "정보 저장" }));
    await waitFor(() => expect(state.update).toHaveBeenCalledWith({ memberName: "바뀐 이름", email: "me@example.com" }));
  });

  it("새 비밀번호 확인이 다르면 요청을 보내지 않는다", () => {
    render(<OwnAccountPage />);
    fireEvent.change(screen.getByLabelText("현재 비밀번호"), { target: { value: "current-password" } });
    fireEvent.change(screen.getByLabelText("새 비밀번호", { exact: true }), { target: { value: "new-password" } });
    fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), { target: { value: "different-password" } });
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 변경" }));
    expect(state.password).not.toHaveBeenCalled();
    expect(state.error).toHaveBeenCalled();
  });

  it("현재 비밀번호와 확인된 새 비밀번호를 서버로 보내고 입력값을 비운다", async () => {
    render(<OwnAccountPage />);
    fireEvent.change(screen.getByLabelText("현재 비밀번호"), { target: { value: "current-password" } });
    fireEvent.change(screen.getByLabelText("새 비밀번호", { exact: true }), { target: { value: "new-password" } });
    fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), { target: { value: "new-password" } });
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 변경" }));
    await waitFor(() => expect(state.password).toHaveBeenCalledWith({ currentPassword: "current-password", newPassword: "new-password" }));
    await waitFor(() => expect(screen.getByLabelText("현재 비밀번호")).toHaveValue(""));
  });
});
