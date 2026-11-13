import { beforeEach, expect, it, vi } from "vitest";
import { boardApi, type BoardPostInput } from "./boardApi";

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("@/shared/api/http/selectedHttpClient", () => ({ selectedHttpClient: client }));

beforeEach(() => {
  vi.clearAllMocks();
  client.get.mockResolvedValue({ data: {} });
  client.post.mockResolvedValue({ data: {} });
  client.put.mockResolvedValue({ data: {} });
  client.delete.mockResolvedValue(undefined);
});

it("게시판이 같은 API 계약을 사용하고 에디터 본문 세 형태를 전송한다", async () => {
  const input: BoardPostInput = {
    title: "질문", contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "본문" }] }] },
    contentHtml: "<p>본문</p>", contentText: "본문", imageFileId: null, pinned: false, eventDate: null, eventEndDate: null,
  };
  for (const type of ["GENERAL", "NOTICE", "QNA", "GALLERY", "GRID", "CALENDAR", "POPUP"] as const) {
    await boardApi.create(type, input);
    expect(client.post).toHaveBeenCalledWith(`/boards/${type}/posts`, input);
  }
  await boardApi.update("QNA", 7, { ...input, versionNumber: 2 });
  await boardApi.answer(7, input);
  expect(client.put).toHaveBeenCalledWith("/boards/QNA/posts/7", { ...input, versionNumber: 2 });
  expect(client.post).toHaveBeenCalledWith("/boards/QNA/posts/7/answer", input);
  await boardApi.calendarMonth("2026-11", "회의");
  expect(client.get).toHaveBeenCalledWith("/boards/CALENDAR/posts/calendar", expect.objectContaining({
    queryParameters: { month: "2026-11", keyword: "회의" },
  }));
});

it("통합 목록 분류와 공개 팝업 경로를 서버로 보내고 공개 응답을 검증한다", async () => {
  await boardApi.communityList("QNA", "질문", 2);
  expect(client.get).toHaveBeenCalledWith("/boards/COMMUNITY/posts", expect.objectContaining({
    queryParameters: { category: "QNA", keyword: "질문", pageNumber: 2, pageSize: 12 },
  }));
  client.get.mockResolvedValue({ data: [{ postId: 1, title: "안내", contentHtml: "<p>안내</p>", versionNumber: 1, endDate: "2026-11-15" }] });
  expect(await boardApi.activePopups("/react")).toHaveLength(1);
  expect(client.get).toHaveBeenCalledWith("/boards/POPUP/posts/active", expect.objectContaining({ queryParameters: { path: "/react" } }));
  client.get.mockResolvedValue({ data: [{ postId: "잘못된 번호", endDate: "2026-02-30" }] });
  await expect(boardApi.activePopups("/react")).rejects.toThrow();
});

it("달력의 시작일과 종료일을 등록·수정 요청에 함께 전송한다", async () => {
  const input: BoardPostInput = {
    title: "행사", contentJson: { type: "doc" }, contentHtml: "<p>행사</p>", contentText: "행사",
    imageFileId: null, pinned: false, eventDate: "2026-11-30", eventEndDate: "2026-12-02",
  };
  await boardApi.create("CALENDAR", input);
  expect(client.post).toHaveBeenCalledWith("/boards/CALENDAR/posts", input);
  await boardApi.update("CALENDAR", 7, { ...input, versionNumber: 2 });
  expect(client.put).toHaveBeenCalledWith("/boards/CALENDAR/posts/7", { ...input, versionNumber: 2 });
});
