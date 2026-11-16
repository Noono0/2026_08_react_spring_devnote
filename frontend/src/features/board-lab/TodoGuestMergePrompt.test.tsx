import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import type { AuthSession } from "@/features/auth/types/authTypes";
import { TodoGuestMergePrompt } from "./TodoGuestMergePrompt";

const mocks = vi.hoisted(() => ({ preview: vi.fn(), merge: vi.fn(), session: vi.fn<() => { data: AuthSession }>(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/features/auth/hooks/useAuthSession", () => ({ authSessionQueryKey: ["auth", "session"], useAuthSessionQuery: mocks.session }));
vi.mock("@/shared/api/http/selectedHttpClient", () => ({ selectedHttpClient: {} }));
vi.mock("./todoApi", async (original) => ({ ...await original<typeof import("./todoApi")>(), todoApi: { mergePreview: mocks.preview, mergeGuest: mocks.merge } }));
vi.mock("@/shared/notification/applicationNotification", () => ({ applicationNotification: { success: mocks.success, apiError: mocks.error } }));
vi.mock("@/shared/ui/ConfirmDialog", () => ({ ConfirmDialog: ({ title, description, confirmButtonLabel, cancelButtonLabel, isConfirming, onConfirm, onCancel }: {
  title: string; description: string; confirmButtonLabel: string; cancelButtonLabel: string; isConfirming: boolean; onConfirm: () => void; onCancel: () => void;
}) => <div role="dialog" aria-label={title}><p>{description}</p><button disabled={isConfirming} onClick={onCancel}>{cancelButtonLabel}</button>
  <button disabled={isConfirming} onClick={onConfirm}>{isConfirming ? "처리 중..." : confirmButtonLabel}</button></div> }));
const signedIn: AuthSession = { authenticated: true, memberId: 2, memberName: "학습 회원", administrator: false, superAdministrator: false };
const guestKey = "guest:11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks(); mocks.session.mockReturnValue({ data: signedIn });
  mocks.preview.mockResolvedValue({ count: 3, guestKey, throughTodoId: 20 }); mocks.merge.mockResolvedValue({ mergedCount: 3 });
});
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["auth", "session"], signedIn);
  const close = vi.fn();
  const invalidate = vi.spyOn(client, "invalidateQueries"), remove = vi.spyOn(client, "removeQueries");
  function Host() {
    const [open, setOpen] = useState(true);
    return open ? <TodoGuestMergePrompt memberId={2} onClose={() => { close(); setOpen(false); }} /> : null;
  }
  const ui = () => <QueryClientProvider client={client}><Host /></QueryClientProvider>;
  return { ...render(ui()), client, close, invalidate, remove, ui };
}

it("가져올 할 일이 없으면 확인창을 열지 않는다", async () => {
  mocks.preview.mockResolvedValue({ count: 0, guestKey: null, throughTodoId: 0 });
  const view = setup(); await waitFor(() => expect(view.close).toHaveBeenCalled());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(mocks.merge).not.toHaveBeenCalled();
});

it("계정·건수를 확인하고 아니요를 선택하면 비회원 자료를 변경하지 않는다", async () => {
  const view = setup(); await screen.findByRole("dialog");
  expect(screen.getByText(/할 일 3개를 학습 회원 계정/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "아니요, 유지" }));
  expect(view.close).toHaveBeenCalled(); expect(mocks.merge).not.toHaveBeenCalled();
});

it("예를 선택하면 확인한 계정·브라우저 키로 병합하고 계정 목록을 갱신한다", async () => {
  const view = setup(); await screen.findByRole("dialog");
  fireEvent.click(screen.getByRole("button", { name: "예, 가져오기" }));
  await waitFor(() => expect(mocks.merge).toHaveBeenCalledWith({ expectedMemberId: 2, guestKey, throughTodoId: 20 }));
  await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("할 일 3개를 계정으로 가져왔습니다."));
  expect(view.remove).toHaveBeenCalledWith({ queryKey: ["board-todos", "items", guestKey] });
  expect(view.invalidate).toHaveBeenCalledWith({ queryKey: ["board-todos", "items", "member:2"] });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("처리 중에는 반복 확인과 취소를 막는다", async () => {
  let finish: (value: { mergedCount: number }) => void = () => { throw new Error("가져오기 요청이 없습니다."); };
  const request = new Promise<{ mergedCount: number }>((resolve) => { finish = resolve; }); mocks.merge.mockReturnValue(request);
  setup(); await screen.findByRole("dialog"); fireEvent.click(screen.getByRole("button", { name: "예, 가져오기" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "처리 중..." })).toBeDisabled());
  fireEvent.click(screen.getByRole("button", { name: "처리 중..." }));
  expect(screen.getByRole("button", { name: "아니요, 유지" })).toBeDisabled(); expect(mocks.merge).toHaveBeenCalledTimes(1);
  await act(async () => { finish({ mergedCount: 3 }); await request; });
});

it("네트워크 실패 후 재시도해도 이미 병합된 항목을 복제하지 않는다", async () => {
  mocks.merge.mockRejectedValueOnce(new Error("응답 연결 실패"));
  setup(); await screen.findByRole("dialog"); fireEvent.click(screen.getByRole("button", { name: "예, 가져오기" }));
  await waitFor(() => expect(mocks.error).toHaveBeenCalled());
  mocks.merge.mockResolvedValue({ mergedCount: 0 });
  fireEvent.click(await screen.findByRole("button", { name: "예, 가져오기" }));
  await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("이미 가져왔거나 가져올 할 일이 없습니다."));
});

it("확인 도중 계정이 바뀌면 닫고 가져오기를 전송하지 않는다", async () => {
  const view = setup(); await screen.findByRole("dialog");
  const next = { ...signedIn, memberId: 3 }; mocks.session.mockReturnValue({ data: next });
  view.client.setQueryData(["auth", "session"], next); view.rerender(view.ui());
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument()); expect(mocks.merge).not.toHaveBeenCalled();
});

it("서버가 계정·쿠키 변경을 거절하면 현재 로그인 상태를 다시 확인한다", async () => {
  mocks.merge.mockRejectedValue({ status: 409, errorCode: "TODO_MERGE_CONTEXT_CHANGED", detail: "계정 변경", fieldErrors: [] });
  const view = setup(); await screen.findByRole("dialog"); fireEvent.click(screen.getByRole("button", { name: "예, 가져오기" }));
  await waitFor(() => expect(view.invalidate).toHaveBeenCalledWith({ queryKey: ["auth", "session"] }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("건수 조회 오류는 다시 확인하거나 나중으로 넘길 수 있다", async () => {
  mocks.preview.mockRejectedValueOnce(new Error("조회 실패"));
  setup(); await screen.findByRole("dialog", { name: "비회원 TODO 확인" });
  fireEvent.click(screen.getByRole("button", { name: "다시 확인" }));
  expect(await screen.findByRole("dialog", { name: "비회원 TODO 가져오기" })).toBeVisible();
  expect(mocks.merge).not.toHaveBeenCalled();
});

it("이전 계정의 늦은 완료 알림을 새 계정에 표시하지 않는다", async () => {
  let finish: (value: { mergedCount: number }) => void = () => { throw new Error("요청 없음"); };
  const request = new Promise<{ mergedCount: number }>((resolve) => { finish = resolve; }); mocks.merge.mockReturnValue(request);
  const view = setup(); await screen.findByRole("dialog"); fireEvent.click(screen.getByRole("button", { name: "예, 가져오기" }));
  await waitFor(() => expect(mocks.merge).toHaveBeenCalledTimes(1));
  const next = { ...signedIn, memberId: 3 }; mocks.session.mockReturnValue({ data: next }); view.client.setQueryData(["auth", "session"], next);
  view.rerender(view.ui());
  await act(async () => { finish({ mergedCount: 3 }); await request; });
  expect(mocks.success).not.toHaveBeenCalled();
});
