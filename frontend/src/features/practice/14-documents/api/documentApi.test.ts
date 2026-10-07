import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDocument, deleteDocument, getDocumentDetail, getDocumentList, updateDocument } from "./documentApi";
import type { DocumentSaveRequest, DocumentSearchCondition } from "../types/documentTypes";

// 실제 네트워크 대신 가짜 HttpClient를 넣어 "어느 주소로 요청했는지"만 확인한다.
// vi.mock은 파일 맨 위로 끌어올려 실행되므로, 거기서 쓸 가짜 함수도 vi.hoisted로 함께 끌어올린다.
const mockedHttpClient = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));

vi.mock("@/shared/api/http/selectedHttpClient", () => ({ selectedHttpClient: mockedHttpClient }));

const searchCondition: DocumentSearchCondition = {
  searchKeyword: "",
  searchType: "TITLE_CONTENT",
  pageNumber: 0,
  pageSize: 10,
  sortProperty: "UPDATED_AT",
  sortDirection: "DESC",
};

const saveRequest: DocumentSaveRequest = {
  documentTitle: "연습 문서",
  contentJson: { type: "doc", content: [{ type: "paragraph" }] },
  contentHtml: "<p></p>",
  contentText: "",
  documentStatus: "DRAFT",
  attachmentFileIds: [],
  tags: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  // 봉투({ data })만 맞춰 주면 API 함수가 알맹이를 꺼내 돌려준다.
  mockedHttpClient.get.mockResolvedValue({ data: {} });
  mockedHttpClient.post.mockResolvedValue({ data: {} });
  mockedHttpClient.put.mockResolvedValue({ data: {} });
  mockedHttpClient.delete.mockResolvedValue(undefined);
});

describe("14단계 documentApi", () => {
  it("모든 요청을 학습용 /documents 주소로만 보낸다 (업무 History 주소를 쓰지 않는다)", async () => {
    await getDocumentList(searchCondition);
    await getDocumentDetail(3);
    await createDocument(saveRequest);
    await updateDocument(3, saveRequest);
    await deleteDocument(3);

    expect(mockedHttpClient.get).toHaveBeenNthCalledWith(1, "/documents", { queryParameters: searchCondition, abortSignal: undefined });
    expect(mockedHttpClient.get).toHaveBeenNthCalledWith(2, "/documents/3", { abortSignal: undefined });
    expect(mockedHttpClient.post).toHaveBeenCalledWith("/documents", saveRequest);
    expect(mockedHttpClient.put).toHaveBeenCalledWith("/documents/3", saveRequest);
    expect(mockedHttpClient.delete).toHaveBeenCalledWith("/documents/3");
  });
});
