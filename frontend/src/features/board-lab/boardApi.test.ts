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

it("여섯 게시판이 같은 API 계약을 사용하고 에디터 본문 세 형태를 전송한다", async () => {
  const input: BoardPostInput = {
    title: "질문", contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "본문" }] }] },
    contentHtml: "<p>본문</p>", contentText: "본문", imageFileId: null, pinned: false, eventDate: null,
  };
  for (const type of ["GENERAL", "NOTICE", "QNA", "GALLERY", "GRID", "CALENDAR"] as const) {
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
