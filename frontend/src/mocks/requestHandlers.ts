/**
 * ============================================================================
 * requestHandlers.ts — 가짜 서버가 돌려줄 응답 정의 (MSW 핸들러)
 * ============================================================================
 *
 * startMockServerWhenEnabled.ts가 켜는 가짜 서버의 "내용물"이 여기 있다.
 * "이 주소로 이런 요청이 오면 이런 답을 줘라"를 하나씩 적어 둔 파일이다.
 *
 * [핸들러의 기본 모양]
 *   http.get("/api/v1/documents", async () => {
 *     return HttpResponse.json({ ... });   // 이 답을 돌려준다
 *   })
 *
 *   http.get / post / put / delete 로 HTTP 메서드를 고르고,
 *   첫 인자에 가로챌 주소, 둘째 인자에 "무엇을 돌려줄지"를 적는다.
 *
 *   ★ 주소가 "/api/v1/..."인 이유
 *     .env의 VITE_API_BASE_URL이 "/api/v1"이라, 앱이 실제로 보내는 요청 주소가
 *     "/api/v1/documents" 형태다. 그 주소와 정확히 같게 적어야 가로챌 수 있다.
 *     여기가 어긋나면 요청이 MSW를 그냥 지나쳐 진짜 서버로 나가 버리는데,
 *     onUnhandledRequest가 "bypass"라 경고도 안 떠서 원인을 찾기 어렵다.
 *
 * [이 파일에서 배울 것]
 *   1. 시나리오로 실패 상황 재현하기 (느린 응답, 500, 네트워크 끊김, 401)
 *   2. 가짜 서버도 "상태"를 갖는다 — 업로드한 파일을 Map에 기억해 둔다
 *   3. 응답을 진짜 백엔드와 똑같은 모양(ApiResponse 봉투)으로 맞추기
 *
 * ★★ 가짜 서버를 만들 때 가장 중요한 원칙:
 *   "진짜 서버와 똑같은 모양으로 응답해야 한다."
 *   모양이 다르면 가짜로 개발할 땐 잘 되다가 진짜 서버에 붙이는 순간 전부 깨진다.
 *   그래서 여기서도 성공은 { success, code, message, data } 봉투로,
 *   실패는 { status, errorCode, detail, fieldErrors } 형태로 맞춰 돌려준다.
 */

import { delay, http, HttpResponse } from "msw";
import type { JSONContent } from "@tiptap/core";
import type { DocumentAttachment } from "@/features/file/types/fileTypes";
import type { DocumentDetail, DocumentListItem, DocumentStatus } from "@/features/practice/14-documents/types/documentTypes";
import { createMockDocumentDetail, createMockThumbnailDataUrl, mockDocuments } from "./documentMockData";

interface MockUploadedFile extends DocumentAttachment {
  contentUrl?: string;
  fileExtension: string;
  fileStatus: string;
}

// ★ 가짜 서버도 "상태"를 갖는다.
//   파일을 업로드하면 그 정보를 아래 Map에 기억해 뒀다가,
//   나중에 문서를 저장할 때 attachmentFileIds로 다시 꺼내 쓴다.
//   진짜 서버라면 DB가 할 일을 여기서는 메모리 변수가 대신하는 것이다.
//
//   ★ 단, 새로고침하면 전부 사라진다. 메모리에만 있기 때문이다.
//     가짜 서버는 "화면 흐름을 확인하는 용도"이지 데이터 보관용이 아니다.
//
//   Map: 키-값 쌍을 저장하는 자료구조. 객체와 비슷하지만
//   숫자 키를 그대로 쓸 수 있고 .get()/.set()/.has()가 명확해서 이런 용도에 좋다.
let nextMockFileId = 10_000;
const mockUploadedFileById = new Map<number, MockUploadedFile>();

// ★ 문서도 같은 방식으로 메모리에 기억한다. 이 배열이 가짜 서버의 "문서 테이블"이다.
//   예전에는 생성 응답이 매번 documentId 999를 지어내서 돌려주기만 하고 아무것도 저장하지 않았다.
//   그래서 등록 직후 상세 화면(GET /documents/999)이 "없는 문서"로 404가 되었다.
//   ❌ 응답만 그럴듯하게 꾸미기 → 다음 요청과 이야기가 맞지 않는다
//   ✓ 저장한 것을 조회가 그대로 보게 하기 → 진짜 서버처럼 흐름이 이어진다
//
//   처음 57건은 documentMockData.ts의 더미 문서로 채운다.
//   새 문서는 맨 앞에 넣어 목록 첫 페이지에서 바로 보이게 한다(최신 글이 위에 오는 게시판처럼).
const mockDocumentStore: DocumentDetail[] = mockDocuments.map((document) => createMockDocumentDetail(document.documentId));
// 진짜 DB의 AUTO_INCREMENT 역할. 지운 번호는 다시 쓰지 않는다.
let nextMockDocumentId = mockDocuments.length + 1;

const getScenario = (): string =>
  localStorage.getItem("mockScenario") ?? import.meta.env.VITE_MOCK_SCENARIO;

/**
 * ★★ 시나리오에 따라 "실패 응답"을 만들어 돌려준다. 이 파일의 핵심 장치다.
 *
 * [왜 이런 게 필요한가?]
 *   화면에 로딩 표시, 오류 안내, 재시도 버튼을 만들어 놓고도
 *   실패를 재현할 방법이 없으면 제대로 동작하는지 확인할 수 없다.
 *   진짜 서버를 일부러 끄거나 인터넷을 뽑는 것보다 이 방법이 훨씬 간편하다.
 *
 * [쓰는 법]
 *   개발자도구 콘솔에서 아래처럼 바꾸고 새로고침하면 된다.
 *     localStorage.setItem("mockScenario", "server-error")
 *     localStorage.setItem("mockScenario", "slow-response")
 *     localStorage.removeItem("mockScenario")   // 정상으로 되돌리기
 *
 * [반환값의 의미가 중요하다]
 *   Response를 돌려주면 → 각 핸들러가 그걸 그대로 실패 응답으로 내보낸다
 *   undefined를 돌려주면 → "특별한 일 없음", 핸들러가 정상 응답을 만든다
 *   그래서 모든 핸들러 첫 줄이 "이 함수를 먼저 불러 보고, 값이 있으면 그걸 반환"하는
 *   형태로 되어 있다. 실패 처리를 한 곳에 모으는 방법이다.
 */
const applyScenario = async (): Promise<Response | undefined> => {
  const scenario = getScenario();
  if (scenario === "slow-response") {
    // 5초를 강제로 기다린다. 로딩 스피너·스켈레톤이 제대로 뜨는지 확인할 때 쓴다.
    // 개발용 컴퓨터는 빨라서 로딩 화면이 스쳐 지나가 버리기 때문이다.
    await delay(5_000);
  }
  if (scenario === "server-error") {
    return HttpResponse.json(
      {
        status: 500,
        errorCode: "COMMON_INTERNAL_SERVER_ERROR",
        detail: "더미 서버 오류입니다.",
        fieldErrors: [],
        traceId: "mock-server-error",
      },
      { status: 500 },
    );
  }
  // ★ HttpResponse.error()는 위의 500 오류와 완전히 다른 상황을 흉내 낸다.
  //   500 → 서버까지는 갔는데 서버가 오류를 답한 것 (응답이 있다)
  //   error() → 서버에 아예 닿지 못한 것 (응답 자체가 없다. 인터넷 끊김 같은 상황)
  //   apiErrorHelpers.ts가 이 둘을 어떻게 다르게 판정하는지 비교해 보면 좋다.
  if (scenario === "network-error") {
    return HttpResponse.error();
  }
  if (scenario === "unauthorized") {
    return HttpResponse.json(
      {
        status: 401,
        errorCode: "AUTHENTICATION_REQUIRED",
        detail: "로그인이 필요합니다.",
        fieldErrors: [],
        traceId: "mock-unauthorized",
      },
      { status: 401 },
    );
  }
  return undefined;
};

const getMockAttachmentFiles = (requestBody: Record<string, unknown>): DocumentAttachment[] => {
  const attachmentFileIds = Array.isArray(requestBody.attachmentFileIds)
    ? requestBody.attachmentFileIds.filter((fileId): fileId is number => typeof fileId === "number")
    : [];
  return attachmentFileIds.flatMap((fileId) => {
    const uploadedFile = mockUploadedFileById.get(fileId);
    return uploadedFile ? [uploadedFile] : [];
  });
};

/**
 * 대표 이미지 정보를 정한다.
 * ★ 대표 이미지를 바꾸지 않고 저장하면 요청에는 기존 번호가 그대로 온다.
 *   더미 문서의 이미지(501번 등)는 업로드 Map에 없으므로,
 *   번호가 같으면 기존 주소를 유지해야 수정 후에도 썸네일이 사라지지 않는다.
 */
const getMockThumbnail = (
  requestBody: Record<string, unknown>,
  previousDocument: Pick<DocumentDetail, "thumbnailFileId" | "thumbnailImageUrl">,
): Pick<DocumentDetail, "thumbnailFileId" | "thumbnailImageUrl"> => {
  const thumbnailFileId = typeof requestBody.thumbnailFileId === "number" ? requestBody.thumbnailFileId : undefined;
  if (thumbnailFileId === undefined) {
    return { thumbnailFileId: undefined, thumbnailImageUrl: undefined };
  }
  if (thumbnailFileId === previousDocument.thumbnailFileId) {
    return { thumbnailFileId, thumbnailImageUrl: previousDocument.thumbnailImageUrl };
  }
  return { thumbnailFileId, thumbnailImageUrl: mockUploadedFileById.get(thumbnailFileId)?.contentUrl };
};

// ── 요청 본문 읽기 도우미 ─────────────────────────────────────────
// ★ request.json()의 결과는 "무엇이든 될 수 있는 값"이다. 가짜 서버라도 그대로 믿지 않는다.
//   타입이 맞을 때만 쓰고, 아니면 기존 값(fallback)을 유지한다.
const documentStatusValues: DocumentStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const isDocumentStatus = (value: unknown): value is DocumentStatus =>
  documentStatusValues.some((documentStatus) => documentStatus === value);
const isJsonContent = (value: unknown): value is JSONContent =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const readString = (value: unknown, fallback: string): string => (typeof value === "string" ? value : fallback);
const readTags = (value: unknown, fallback: string[]): string[] =>
  Array.isArray(value) ? value.filter((tagName): tagName is string => typeof tagName === "string") : fallback;

/**
 * 저장 요청(생성·수정 공통)을 기존 문서 위에 덮어써 새 문서 객체를 만든다.
 * 원본 객체는 바꾸지 않고 새 객체를 돌려준다. (React 상태 갱신과 같은 불변 업데이트 습관)
 */
const applyDocumentSaveRequest = (previousDocument: DocumentDetail, requestBody: Record<string, unknown>): DocumentDetail => ({
  ...previousDocument,
  documentTitle: readString(requestBody.documentTitle, previousDocument.documentTitle),
  contentJson: isJsonContent(requestBody.contentJson) ? requestBody.contentJson : previousDocument.contentJson,
  contentHtml: readString(requestBody.contentHtml, previousDocument.contentHtml),
  contentText: readString(requestBody.contentText, previousDocument.contentText),
  documentStatus: isDocumentStatus(requestBody.documentStatus) ? requestBody.documentStatus : previousDocument.documentStatus,
  tags: readTags(requestBody.tags, previousDocument.tags),
  attachmentFiles: getMockAttachmentFiles(requestBody),
  ...getMockThumbnail(requestBody, previousDocument),
  updatedAt: new Date().toISOString(),
});

/**
 * 상세 정보에서 목록에 필요한 칸만 골라 낸다.
 * ★ 진짜 서버도 목록 SQL에서는 본문(content_html 등)을 SELECT하지 않는다.
 *   본문까지 보내면 목록 응답이 쓸데없이 무거워진다.
 */
const toDocumentListItem = (document: DocumentDetail): DocumentListItem => ({
  documentId: document.documentId,
  documentTitle: document.documentTitle,
  documentStatus: document.documentStatus,
  thumbnailFileId: document.thumbnailFileId,
  thumbnailImageUrl: document.thumbnailImageUrl,
  versionNumber: document.versionNumber,
  viewCount: document.viewCount,
  authorId: document.authorId,
  authorName: document.authorName,
  createdAt: document.createdAt,
  updatedAt: document.updatedAt,
  tags: document.tags,
});

const findMockDocumentIndex = (documentIdParameter: unknown): number =>
  mockDocumentStore.findIndex((document) => document.documentId === Number(documentIdParameter));

// 없는 문서 응답. 상세 조회·수정·삭제가 모두 같은 모양으로 돌려준다(백엔드 DOCUMENT_NOT_FOUND와 같은 형태).
const createDocumentNotFoundResponse = (): Response =>
  HttpResponse.json(
    {
      status: 404,
      errorCode: "DOCUMENT_NOT_FOUND",
      detail: "더미 문서를 찾을 수 없습니다.",
      fieldErrors: [],
      traceId: "mock-document-not-found",
    },
    { status: 404 },
  );

/**
 * 실제로 가로챌 요청 목록. startMockServerWhenEnabled가 이 배열을 받아 간다.
 * 배열 순서대로 검사하다가 처음 맞는 핸들러가 응답을 만든다.
 */
export const requestHandlers = [
  http.get("/api/v1/documents", async ({ request }) => {
    // ★ 모든 핸들러가 이 두 줄로 시작한다.
    //   시나리오가 실패 상황이면 여기서 바로 그 응답을 내보내고 끝낸다.
    //   실패 처리를 한 곳(applyScenario)에 모아 둔 덕분에
    //   각 핸들러는 "정상일 때 무엇을 줄지"만 신경 쓰면 된다.
    const scenarioResponse = await applyScenario();
    if (scenarioResponse) return scenarioResponse;

    // ★ 여기서부터가 "가짜 서버가 백엔드 흉내를 내는" 부분이다.
    //   진짜 서버라면 SQL의 WHERE / LIMIT / OFFSET이 할 일을
    //   자바스크립트의 filter와 slice로 대신한다.
    //
    //   요청에서 검색어와 페이지 정보를 꺼낸다.
    //   DocumentListPage가 URL에 넣어 보낸 값이 그대로 여기 도착한다.
    const requestUrl = new URL(request.url);
    const searchKeyword = requestUrl.searchParams.get("searchKeyword")?.toLowerCase() ?? "";
    // 태그 필터: 서버의 EXISTS (document_tags) 조건을 흉내 낸다.
    const tag = requestUrl.searchParams.get("tag") ?? "";
    const pageNumber = Number(requestUrl.searchParams.get("pageNumber") ?? 0);
    const pageSize = Number(requestUrl.searchParams.get("pageSize") ?? 10);
    const scenario = getScenario();
    const filteredDocuments = scenario === "empty-data"
      ? []
      : mockDocumentStore.filter((document) => document.documentTitle.toLowerCase().includes(searchKeyword)
        && (!tag || document.tags.includes(tag)));
    // ★ slice로 "이번 페이지 몫"만 잘라 낸다. 서버 페이징의 핵심이다.
    //   0페이지·10개면 slice(0,10), 1페이지면 slice(10,20).
    //   프론트가 전체를 받아 자르는 게 아니라 서버가 잘라서 보내야
    //   문서가 10만 건이어도 응답이 가볍다.
    const content = filteredDocuments.slice(pageNumber * pageSize, pageNumber * pageSize + pageSize).map(toDocumentListItem);
    const totalPages = filteredDocuments.length === 0 ? 0 : Math.ceil(filteredDocuments.length / pageSize);

    // ★ 응답 모양을 진짜 백엔드와 똑같이 맞춘다.
    //   바깥은 { success, code, message, traceId, data } 봉투,
    //   data 안은 { content, pageInformation } 구조다.
    //   여기가 한 글자라도 다르면, 가짜로 개발할 땐 잘 되다가
    //   진짜 서버에 붙이는 순간 화면이 통째로 깨진다.
    return HttpResponse.json({
      success: true,
      code: "SUCCESS",
      message: "더미 문서 목록 조회 성공",
      traceId: "mock-list-trace",
      data: {
        content,
        pageInformation: {
          pageNumber,
          pageSize,
          totalElements: filteredDocuments.length,
          totalPages,
          firstPage: pageNumber === 0,
          lastPage: totalPages === 0 || pageNumber >= totalPages - 1,
        },
      },
    });
  }),
  http.get("/api/v1/documents/:documentId", async ({ params }) => {
    const scenarioResponse = await applyScenario();
    if (scenarioResponse) return scenarioResponse;
    const document = mockDocumentStore[findMockDocumentIndex(params.documentId)];
    if (!document) return createDocumentNotFoundResponse();
    return HttpResponse.json({
      success: true,
      code: "SUCCESS",
      message: "더미 문서 조회 성공",
      traceId: "mock-detail-trace",
      data: document,
    });
  }),
  http.post("/api/v1/documents", async ({ request }) => {
    const scenarioResponse = await applyScenario();
    if (scenarioResponse) return scenarioResponse;
    const requestBody = (await request.json()) as Record<string, unknown>;
    const createdAt = new Date().toISOString();
    // 빈 문서를 하나 만들고, 그 위에 요청 내용을 덮어쓴다. 번호·작성자·버전은 서버가 정한다.
    const emptyDocument: DocumentDetail = {
      documentId: nextMockDocumentId++,
      authorId: 1,
      authorName: "사용자 1",
      documentTitle: "",
      contentJson: { type: "doc", content: [] },
      contentHtml: "",
      contentText: "",
      attachmentFiles: [],
      tags: [],
      documentStatus: "DRAFT",
      versionNumber: 1,
      viewCount: 0,
      createdAt,
      updatedAt: createdAt,
    };
    const createdDocument = applyDocumentSaveRequest(emptyDocument, requestBody);
    // ★ 저장! 이 한 줄이 있어야 바로 다음 상세 조회·목록 조회에서 이 문서가 보인다.
    mockDocumentStore.unshift(createdDocument);
    return HttpResponse.json(
      {
        success: true,
        code: "CREATED",
        message: "더미 문서 생성 성공",
        traceId: "mock-create-trace",
        data: createdDocument,
      },
      { status: 201 },
    );
  }),
  http.put("/api/v1/documents/:documentId", async ({ params, request }) => {
    const scenarioResponse = await applyScenario();
    if (scenarioResponse) return scenarioResponse;
    if (getScenario() === "version-conflict") {
      return HttpResponse.json(
        {
          status: 409,
          errorCode: "DOCUMENT_VERSION_CONFLICT",
          detail: "다른 사용자가 먼저 수정했습니다.",
          fieldErrors: [],
          traceId: "mock-version-conflict",
        },
        { status: 409 },
      );
    }
    const documentIndex = findMockDocumentIndex(params.documentId);
    const previousDocument = mockDocumentStore[documentIndex];
    if (!previousDocument) return createDocumentNotFoundResponse();
    const requestBody = (await request.json()) as Record<string, unknown>;
    // 버전은 요청 값이 아니라 저장된 값에서 1 올린다. 버전을 정하는 것은 서버의 일이다.
    const updatedDocument: DocumentDetail = {
      ...applyDocumentSaveRequest(previousDocument, requestBody),
      versionNumber: previousDocument.versionNumber + 1,
    };
    mockDocumentStore[documentIndex] = updatedDocument;
    return HttpResponse.json({
      success: true,
      code: "SUCCESS",
      message: "더미 문서 수정 성공",
      traceId: "mock-update-trace",
      data: updatedDocument,
    });
  }),
  http.delete("/api/v1/documents/:documentId", async ({ params }) => {
    const scenarioResponse = await applyScenario();
    if (scenarioResponse) return scenarioResponse;
    const documentIndex = findMockDocumentIndex(params.documentId);
    if (documentIndex < 0) return createDocumentNotFoundResponse();
    // splice(위치, 1) = 그 자리의 한 건을 지운다. 가짜 서버의 "DB"라 직접 바꿔도 된다(React 상태가 아니다).
    mockDocumentStore.splice(documentIndex, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  /**
   * 【파일 업로드】 fileApi.ts의 uploadAttachmentFile / uploadEditorImage가 여기로 온다.
   *
   * ★ 주소의 `:fileType`은 "값이 바뀌는 자리"다. (react-router의 :documentId와 같은 문법)
   *   /files/attachments  → params.fileType === "attachments"
   *   /files/editor-images → params.fileType === "editor-images"
   *   핸들러 하나로 두 종류를 다 처리한다.
   */
  http.post("/api/v1/files/:fileType", async ({ request, params }) => {
    const scenarioResponse = await applyScenario();
    if (scenarioResponse) return scenarioResponse;

    // ★ JSON이 아니라 FormData로 온다. 파일 전송이기 때문이다. (fileApi.ts 참고)
    //   꺼낼 때 쓰는 이름("attachmentFile"/"imageFile")이
    //   보내는 쪽 formData.append()의 이름과 정확히 같아야 한다.
    const formData = await request.formData();
    const isAttachment = params.fileType === "attachments";
    const uploadedValue = formData.get(isAttachment ? "attachmentFile" : "imageFile");
    const uploadedFile = uploadedValue instanceof File ? uploadedValue : undefined;
    const fileId = nextMockFileId++;
    const fileExtension = uploadedFile?.name.split(".").pop()?.toLowerCase() ?? "bin";
    const contentUrl = isAttachment ? undefined : createMockThumbnailDataUrl(fileId);
    const mockUploadedFile: MockUploadedFile = {
      fileId,
      originalFileName: uploadedFile?.name ?? (isAttachment ? "mock-attachment.txt" : "mock-upload.png"),
      fileExtension,
      mimeType: uploadedFile?.type || "application/octet-stream",
      fileSize: uploadedFile?.size ?? 1024,
      fileStatus: "TEMP",
      downloadUrl: contentUrl ?? `data:text/plain;charset=UTF-8,${encodeURIComponent("MSW 첨부파일 다운로드 연습")}`,
      contentUrl,
    };
    // ★ 업로드한 파일을 Map에 기억해 둔다. 이게 이 가짜 서버의 "DB"다.
    //   나중에 문서 저장 요청이 attachmentFileIds로 번호만 보내면
    //   getMockAttachmentFiles가 이 Map에서 원래 정보를 되찾아 온다.
    //   진짜 서버에서 파일 테이블을 조회하는 것과 같은 흐름이다.
    mockUploadedFileById.set(fileId, mockUploadedFile);

    return HttpResponse.json(
      {
        success: true,
        code: "CREATED",
        message: "더미 파일 업로드 성공",
        traceId: "mock-file-trace",
        data: mockUploadedFile,
      },
      { status: 201 },
    );
  }),
];
