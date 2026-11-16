import { beforeEach, expect, it, vi } from "vitest";
import { todoApi } from "./todoApi";

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("@/shared/api/http/selectedHttpClient", () => ({ selectedHttpClient: client }));
const todo = { todoId: 1, title: "학습하기", content: "개인 메모", completed: false, versionNumber: 2,
  createdAt: "2026-11-16T09:00:00", updatedAt: "2026-11-16T09:00:00", reminders: [] };
const page = { content: [todo], pageInformation: { pageNumber: 0, pageSize: 12, totalElements: 1, totalPages: 1, firstPage: true, lastPage: true } };
beforeEach(() => { vi.clearAllMocks(); client.get.mockResolvedValue({ data: page }); client.post.mockResolvedValue({ data: todo }); client.put.mockResolvedValue({ data: todo }); });

it("서버 쿠키로 소유자를 확인하고 공개 캐시 키를 검증한다", async () => {
  const controller = new AbortController();
  const owner = { mode: "GUEST", cacheKey: "guest:11111111-1111-4111-8111-111111111111" };
  client.get.mockResolvedValue({ data: owner });
  expect(await todoApi.owner(controller.signal)).toEqual(owner);
  expect(client.get).toHaveBeenCalledWith("/board-todos/owner", { abortSignal: controller.signal });
  client.get.mockResolvedValue({ data: { mode: "GUEST", cacheKey: "member:2" } });
  await expect(todoApi.owner()).rejects.toThrow();
});

it("비회원 병합 건수를 확인하고 확인창의 계정·브라우저 키를 전달한다", async () => {
  const guestKey = "guest:11111111-1111-4111-8111-111111111111";
  client.get.mockResolvedValue({ data: { count: 2, guestKey, throughTodoId: 20 } });
  expect(await todoApi.mergePreview()).toEqual({ count: 2, guestKey, throughTodoId: 20 });
  client.post.mockResolvedValue({ data: { mergedCount: 2 } });
  expect(await todoApi.mergeGuest({ expectedMemberId: 2, guestKey, throughTodoId: 20 })).toEqual({ mergedCount: 2 });
  expect(client.post).toHaveBeenCalledWith("/board-todos/guest-merge", { expectedMemberId: 2, guestKey, throughTodoId: 20 });
  client.get.mockResolvedValue({ data: { count: 2, guestKey: null, throughTodoId: 20 } });
  await expect(todoApi.mergePreview()).rejects.toThrow();
});

it("세션 인증 API로 상태·검색·페이지와 취소 신호만 전송한다", async () => {
  const controller = new AbortController();
  expect((await todoApi.list("DONE", "학습", 2, controller.signal)).content).toEqual([todo]);
  expect(client.get).toHaveBeenCalledWith("/board-todos", { queryParameters: { status: "DONE", keyword: "학습", pageNumber: 2, pageSize: 12 }, abortSignal: controller.signal });
});

it("작성·완료 수정·삭제에 버전을 보내고 서버 응답을 검증한다", async () => {
  const input = { title: "학습하기", content: "개인 메모", completed: false };
  expect(await todoApi.create(input)).toEqual(todo);
  await todoApi.update(1, { ...input, completed: true, versionNumber: 2 });
  await todoApi.delete(1, 2);
  expect(client.post).toHaveBeenCalledWith("/board-todos", input);
  expect(client.put).toHaveBeenCalledWith("/board-todos/1", { ...input, completed: true, versionNumber: 2 });
  expect(client.delete).toHaveBeenCalledWith("/board-todos/1", { queryParameters: { versionNumber: 2 } });
});

it("올바르지 않은 저장 응답과 목록 자료를 거절한다", async () => {
  client.get.mockResolvedValue({ data: { ...page, content: [{ ...todo, completed: "Y" }] } });
  await expect(todoApi.list("ALL", "", 0)).rejects.toThrow();
  client.post.mockResolvedValue({ data: { ...todo, todoId: "1" } });
  await expect(todoApi.create({ title: "제목", content: "", completed: false })).rejects.toThrow();
});
