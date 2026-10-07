import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHistory, deleteHistory, getHistoryDetail, getHistoryList, getHistoryTags, updateHistory } from "./historyApi";
import type { HistorySaveRequest, HistorySearchCondition } from "../types/historyTypes";

// 실제 네트워크 대신 가짜 HttpClient를 넣어 "어느 주소로 요청했는지"만 확인한다.
// vi.mock은 파일 맨 위로 끌어올려 실행되므로, 거기서 쓸 가짜 함수도 vi.hoisted로 함께 끌어올린다.
const mockedHttpClient = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));

vi.mock("@/shared/api/http/selectedHttpClient", () => ({ selectedHttpClient: mockedHttpClient }));

const searchCondition: HistorySearchCondition = {
  searchKeyword: "",
  searchType: "TITLE_CONTENT",
  documentStatus: "PUBLISHED",
  pageNumber: 0,
  pageSize: 10,
  sortProperty: "UPDATED_AT",
  sortDirection: "DESC",
};

const saveRequest: HistorySaveRequest = {
  documentTitle: "배포 트러블슈팅",
  contentJson: { type: "doc", content: [{ type: "paragraph" }] },
  contentHtml: "<p></p>",
  contentText: "",
  documentStatus: "PUBLISHED",
  attachmentFileIds: [],
  tags: ["배포"],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedHttpClient.get.mockResolvedValue({ data: {} });
  mockedHttpClient.post.mockResolvedValue({ data: {} });
  mockedHttpClient.put.mockResolvedValue({ data: {} });
  mockedHttpClient.delete.mockResolvedValue(undefined);
});

describe("historyApi", () => {
  it("모든 요청을 업무 History /history 주소로만 보낸다 (학습용 /documents를 쓰지 않는다)", async () => {
    await getHistoryList(searchCondition);
    await getHistoryDetail(7);
    await getHistoryTags();
    await createHistory(saveRequest);
    await updateHistory(7, saveRequest);
    await deleteHistory(7);

    expect(mockedHttpClient.get).toHaveBeenNthCalledWith(1, "/history", { queryParameters: searchCondition, abortSignal: undefined });
    expect(mockedHttpClient.get).toHaveBeenNthCalledWith(2, "/history/7", { abortSignal: undefined });
    expect(mockedHttpClient.get).toHaveBeenNthCalledWith(3, "/history/tags", { abortSignal: undefined });
    expect(mockedHttpClient.post).toHaveBeenCalledWith("/history", saveRequest);
    expect(mockedHttpClient.put).toHaveBeenCalledWith("/history/7", saveRequest);
    expect(mockedHttpClient.delete).toHaveBeenCalledWith("/history/7");
  });
});
