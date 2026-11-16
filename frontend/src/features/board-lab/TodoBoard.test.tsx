import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { TodoBoard } from "./TodoBoard";
import type { Todo } from "./todoApi";

interface SessionStub { isPending: boolean; isError?: boolean; data?: { authenticated: boolean; memberId?: number; administrator?: boolean } }
const mocks = vi.hoisted(() => ({ owner: vi.fn(), list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), session: vi.fn<() => SessionStub>(), apiError: vi.fn() }));
vi.mock("@/features/auth/hooks/useAuthSession", () => ({ useAuthSessionQuery: mocks.session }));
vi.mock("@/shared/api/http/selectedHttpClient", () => ({ selectedHttpClient: {} }));
vi.mock("./todoApi", async (original) => ({ ...await original<typeof import("./todoApi")>(), todoApi: mocks }));
vi.mock("@/shared/notification/applicationNotification", () => ({ applicationNotification: { success: vi.fn(), apiError: mocks.apiError } }));
vi.mock("@/shared/ui/ModalDialog", () => ({ ModalDialog: ({ title, children }: { title: string; children: ReactNode }) => <div role="dialog" aria-label={title}>{children}</div> }));
vi.mock("@/shared/ui/ConfirmDialog", () => ({ ConfirmDialog: ({ isOpen, onConfirm, onCancel }: { isOpen: boolean; onConfirm: () => void; onCancel: () => void }) =>
  isOpen ? <div role="dialog" aria-label="할 일 삭제"><button onClick={onConfirm}>삭제하기</button><button onClick={onCancel}>취소</button></div> : null }));
const own: Todo = { todoId: 4, title: "나의 학습", content: "비공개 메모", completed: false, versionNumber: 3,
  createdAt: "2026-11-16T09:00:00", updatedAt: "2026-11-16T09:00:00", reminders: [] };
const page = (content: Todo[] = [own]) => ({ content, pageInformation: { pageNumber: 0, pageSize: 12, totalElements: content.length, totalPages: content.length ? 1 : 0, firstPage: true, lastPage: true } });
const session = (memberId = 2) => ({ isPending: false, isError: false, data: { authenticated: true, memberId, administrator: false } });
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = () => <QueryClientProvider client={client}><TodoBoard /></QueryClientProvider>;
  return { ...render(ui()), client, ui };
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.session.mockReturnValue(session()); mocks.list.mockResolvedValue(page());
  mocks.owner.mockImplementation(() => {
    const current = mocks.session();
    return Promise.resolve(current.data?.authenticated ? { mode: "MEMBER", cacheKey: `member:${current.data.memberId}` }
      : { mode: "GUEST", cacheKey: "guest:11111111-1111-4111-8111-111111111111" });
  });
  mocks.create.mockResolvedValue(own); mocks.update.mockResolvedValue({ ...own, completed: true, versionNumber: 4 }); mocks.delete.mockResolvedValue(undefined);
});

it("소유자 확인을 기다린 뒤 로그인 없이 브라우저 목록을 표시한다", async () => {
  mocks.session.mockReturnValue({ isPending: true });
  const view = setup();
  expect(screen.getByRole("status")).toHaveTextContent("내 할 일 연결");
  expect(mocks.list).not.toHaveBeenCalled();
  mocks.session.mockReturnValue({ isPending: false, isError: false, data: { authenticated: false } });
  view.rerender(view.ui());
  expect(await screen.findByText(/비회원 · 이 브라우저의 할 일/)).toBeVisible();
  expect(await screen.findByText(own.title)).toBeVisible();
  expect(screen.getByText(/쿠키를 지우거나 다른 브라우저/)).toBeVisible();
});

it("새 할 일 제목을 검증하고 제목·메모만 세션 API로 저장한다", async () => {
  setup(); await screen.findByText(own.title);
  fireEvent.click(screen.getByRole("button", { name: "할 일 추가" }));
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  expect(screen.getByLabelText("할 일 제목 *")).toHaveFocus();
  expect(mocks.create).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("할 일 제목 *"), { target: { value: " 새 할 일 " } });
  fireEvent.change(screen.getByLabelText("메모"), { target: { value: " 개인 메모 " } });
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ title: "새 할 일", content: "개인 메모", completed: false }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("여러 알림 시간을 추가·삭제하고 UTC 배열로 저장한다", async () => {
  setup(); await screen.findByText(own.title);
  fireEvent.click(screen.getByRole("button", { name: "할 일 추가" }));
  fireEvent.change(screen.getByLabelText("할 일 제목 *"), { target: { value: "여러 알림" } });
  const first = new Date(Date.now() + 86400000); first.setSeconds(0, 0);
  const local = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const second = new Date(first.getTime() + 3600000);
  fireEvent.click(screen.getByRole("button", { name: "알림 시간 추가" }));
  fireEvent.change(screen.getByLabelText("알림 시간 1"), { target: { value: local(first) } });
  fireEvent.click(screen.getByRole("button", { name: "알림 시간 추가" }));
  fireEvent.change(screen.getByLabelText("알림 시간 2"), { target: { value: local(second) } });
  fireEvent.click(screen.getByRole("button", { name: "알림 시간 추가" }));
  fireEvent.click(screen.getByRole("button", { name: "알림 시간 3 삭제" }));
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ title: "여러 알림", content: "", completed: false, reminderTimes: [first.toISOString(), second.toISOString()] }));
});

it("알림 시간을 비워 둔 채 저장하지 않으며 기존 알림의 전체 삭제를 전달한다", async () => {
  mocks.list.mockResolvedValue(page([{ ...own, reminders: [{ reminderId: 1, scheduledAt: "2020-01-01T00:00:00Z", status: "SENT" }] }]));
  setup(); await screen.findByText(own.title);
  expect(screen.getByText("푸시 서비스 접수")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: `${own.title} 수정` }));
  fireEvent.click(screen.getByRole("button", { name: "알림 시간 추가" }));
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  expect(screen.getByRole("alert")).toHaveTextContent("알림 시간을 모두 입력");
  expect(mocks.update).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "알림 시간 2 삭제" }));
  fireEvent.click(screen.getByRole("button", { name: "알림 시간 1 삭제" }));
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(4, { title: own.title, content: own.content, completed: false, versionNumber: 3, reminderTimes: [] }));
});

it("저장 중 반복 제출과 입력 변경을 막는다", async () => {
  let finish: (value: Todo) => void = () => { throw new Error("저장 요청이 없습니다."); };
  const saving = new Promise<Todo>((resolve) => { finish = resolve; });
  mocks.create.mockReturnValue(saving);
  setup(); await screen.findByText(own.title);
  fireEvent.click(screen.getByRole("button", { name: "할 일 추가" }));
  fireEvent.change(screen.getByLabelText("할 일 제목 *"), { target: { value: "저장 중" } });
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "저장 중..." })).toBeDisabled());
  const form = screen.getByLabelText("할 일 제목 *").closest("form");
  if (!form) throw new Error("TODO 작성 폼이 없습니다.");
  fireEvent.submit(form);
  expect(screen.getByLabelText("할 일 제목 *")).toBeDisabled();
  expect(mocks.create).toHaveBeenCalledTimes(1);
  await act(async () => { finish(own); await saving; });
});

it("완료 요청이 실패하면 기존 상태를 유지하고 오류와 새 목록을 확인한다", async () => {
  mocks.update.mockRejectedValue(new Error("충돌"));
  setup(); const checkbox = await screen.findByRole("checkbox", { name: `${own.title} 완료` });
  fireEvent.click(checkbox);
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(4, { title: own.title, content: own.content, completed: true, versionNumber: 3 }));
  await waitFor(() => expect(mocks.apiError).toHaveBeenCalled());
  expect(checkbox).not.toBeChecked();
  await waitFor(() => expect(mocks.list.mock.calls.length).toBeGreaterThan(1));
});

it("상태 필터와 제목·메모 검색을 서버로 보내고 수정에 현재 버전을 사용한다", async () => {
  setup(); await screen.findByText(own.title);
  fireEvent.change(screen.getByLabelText("할 일 상태"), { target: { value: "DONE" } });
  await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith("DONE", "", 0, expect.any(AbortSignal)));
  fireEvent.change(screen.getByLabelText("제목·메모 검색"), { target: { value: " 학습 " } });
  fireEvent.click(screen.getByRole("button", { name: "검색" }));
  await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith("DONE", "학습", 0, expect.any(AbortSignal)));
  fireEvent.click(await screen.findByRole("button", { name: `${own.title} 수정` }));
  expect(screen.getByLabelText("메모")).toHaveValue(own.content);
  fireEvent.change(screen.getByLabelText("할 일 제목 *"), { target: { value: "수정 제목" } });
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(4, { title: "수정 제목", content: own.content, completed: false, versionNumber: 3 }));
});

it("삭제 확인을 취소하면 보존하고 확인하면 버전과 함께 삭제한다", async () => {
  setup(); await screen.findByText(own.title);
  fireEvent.click(screen.getByRole("button", { name: `${own.title} 삭제` }));
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(mocks.delete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: `${own.title} 삭제` }));
  fireEvent.click(screen.getByRole("button", { name: "삭제하기" }));
  await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith(4, 3));
});

it("계정 전환 시 이전 글과 작성 중 메모를 제거하고 다음 계정 목록만 표시한다", async () => {
  const view = setup(); await screen.findByText(own.title);
  fireEvent.click(screen.getByRole("button", { name: `${own.title} 수정` }));
  fireEvent.change(screen.getByLabelText("메모"), { target: { value: "이전 계정의 작성 중 메모" } });
  mocks.session.mockReturnValue(session(3));
  mocks.list.mockResolvedValue(page([{ ...own, todoId: 5, title: "다음 계정 할 일", content: "다음 메모" }]));
  view.rerender(view.ui());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByText(own.title)).not.toBeInTheDocument();
  expect(await screen.findByText("다음 계정 할 일")).toBeVisible();
  mocks.session.mockReturnValue({ isPending: false, isError: false, data: { authenticated: false } });
  mocks.list.mockResolvedValue(page([]));
  view.rerender(view.ui());
  expect(screen.queryByText("다음 계정 할 일")).not.toBeInTheDocument();
  expect(await screen.findByText(/비회원 · 이 브라우저의 할 일/)).toBeVisible();
});

it("이전 계정의 늦은 응답이 다음 계정 목록에 섞이지 않는다", async () => {
  let finish: (value: ReturnType<typeof page>) => void = () => { throw new Error("이전 조회가 없습니다."); };
  const previous = new Promise<ReturnType<typeof page>>((resolve) => { finish = resolve; });
  mocks.list.mockReturnValueOnce(previous);
  const view = setup();
  await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(1));
  mocks.session.mockReturnValue(session(3)); mocks.list.mockResolvedValue(page([]));
  view.rerender(view.ui());
  await screen.findByText(/표시할 할 일이 없습니다/);
  await act(async () => { finish(page()); await previous; });
  expect(screen.queryByText(own.title)).not.toBeInTheDocument();
});

it("목록 오류에서 재시도해 빈 결과로 회복한다", async () => {
  mocks.list.mockRejectedValueOnce(new Error("연결 실패"));
  setup(); await screen.findByRole("alert");
  mocks.list.mockResolvedValue(page([]));
  fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  expect(await screen.findByText(/표시할 할 일이 없습니다/)).toBeVisible();
});

it("브라우저 연결이 실패하면 목록·저장을 시작하지 않고 재연결한다", async () => {
  mocks.owner.mockRejectedValueOnce(new Error("연결 실패"));
  setup(); await screen.findByRole("alert");
  expect(mocks.list).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  expect(await screen.findByText(own.title)).toBeVisible();
});

it("쿠키가 사라지면 이전 목록을 숨기고 저장을 막으며 새 브라우저 목록으로 연결한다", async () => {
  mocks.session.mockReturnValue({ isPending: false, data: { authenticated: false } });
  setup(); await screen.findByText(own.title);
  mocks.list.mockRejectedValue({ status: 400, errorCode: "TODO_GUEST_COOKIE_REQUIRED", detail: "쿠키를 허용해 주세요.", fieldErrors: [] });
  fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
  expect(await screen.findByText(/비회원 TODO를 이용하려면 이 사이트의 쿠키/)).toBeVisible();
  expect(screen.queryByText(own.title)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "할 일 추가" })).toBeDisabled();
  mocks.owner.mockResolvedValueOnce({ mode: "GUEST", cacheKey: "guest:22222222-2222-4222-8222-222222222222" });
  mocks.list.mockResolvedValue(page([]));
  fireEvent.click(screen.getByRole("button", { name: "브라우저 연결 다시 확인" }));
  expect(await screen.findByText(/표시할 할 일이 없습니다/)).toBeVisible();
});

it("비회원에서 로그인했다가 로그아웃하면 원래 브라우저 목록으로 돌아간다", async () => {
  const guestSession = { isPending: false, data: { authenticated: false } };
  mocks.session.mockReturnValue(guestSession);
  mocks.list.mockImplementation(() => Promise.resolve(mocks.session().data?.authenticated
    ? page([{ ...own, title: "계정 목록" }]) : page([{ ...own, title: "브라우저 목록" }])));
  const view = setup(); await screen.findByText("브라우저 목록");
  mocks.session.mockReturnValue(session(2)); view.rerender(view.ui());
  expect(await screen.findByText("계정 목록")).toBeVisible();
  expect(screen.queryByText("브라우저 목록")).not.toBeInTheDocument();
  mocks.session.mockReturnValue(guestSession); view.rerender(view.ui());
  expect(await screen.findByText("브라우저 목록")).toBeVisible();
  expect(screen.queryByText("계정 목록")).not.toBeInTheDocument();
});
