import { delay, http, HttpResponse } from "msw";
import type { DocumentAttachment } from "@/features/file/types/fileTypes";
import { createMockDocumentDetail, createMockThumbnailDataUrl, mockDocuments } from "./documentMockData";

interface MockUploadedFile extends DocumentAttachment {
  contentUrl?: string;
  fileExtension: string;
  fileStatus: string;
}

let nextMockFileId = 10_000;
const mockUploadedFileById = new Map<number, MockUploadedFile>();

const getScenario = (): string =>
  localStorage.getItem("mockScenario") ?? import.meta.env.VITE_MOCK_SCENARIO;

const applyScenario = async (): Promise<Response | undefined> => {
  const scenario = getScenario();
  if (scenario === "slow-response") {
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

const getMockThumbnailImageUrl = (requestBody: Record<string, unknown>): string | undefined => {
  const thumbnailFileId = requestBody.thumbnailFileId;
  return typeof thumbnailFileId === "number"
    ? mockUploadedFileById.get(thumbnailFileId)?.contentUrl
    : undefined;
};

export const requestHandlers = [
  http.get("/api/v1/documents", async ({ request }) => {
    const scenarioResponse = await applyScenario();
    if (scenarioResponse) return scenarioResponse;

    const requestUrl = new URL(request.url);
    const searchKeyword = requestUrl.searchParams.get("searchKeyword")?.toLowerCase() ?? "";
    const pageNumber = Number(requestUrl.searchParams.get("pageNumber") ?? 0);
    const pageSize = Number(requestUrl.searchParams.get("pageSize") ?? 10);
    const scenario = getScenario();
    const filteredDocuments = scenario === "empty-data"
      ? []
      : mockDocuments.filter((document) => document.documentTitle.toLowerCase().includes(searchKeyword));
    const content = filteredDocuments.slice(pageNumber * pageSize, pageNumber * pageSize + pageSize);
    const totalPages = filteredDocuments.length === 0 ? 0 : Math.ceil(filteredDocuments.length / pageSize);

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
    const documentId = Number(params.documentId);
    const documentExists = mockDocuments.some((document) => document.documentId === documentId);
    if (!documentExists) {
      return HttpResponse.json(
        {
          status: 404,
          errorCode: "DOCUMENT_NOT_FOUND",
          detail: "더미 문서를 찾을 수 없습니다.",
          fieldErrors: [],
          traceId: "mock-document-not-found",
        },
        { status: 404 },
      );
    }
    return HttpResponse.json({
      success: true,
      code: "SUCCESS",
      message: "더미 문서 조회 성공",
      traceId: "mock-detail-trace",
      data: createMockDocumentDetail(documentId),
    });
  }),
  http.post("/api/v1/documents", async ({ request }) => {
    const scenarioResponse = await applyScenario();
    if (scenarioResponse) return scenarioResponse;
    const requestBody = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        success: true,
        code: "CREATED",
        message: "더미 문서 생성 성공",
        traceId: "mock-create-trace",
        data: {
          ...createMockDocumentDetail(1),
          ...requestBody,
          documentId: 999,
          attachmentFiles: getMockAttachmentFiles(requestBody),
          thumbnailImageUrl: getMockThumbnailImageUrl(requestBody),
        },
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
    const requestBody = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      code: "SUCCESS",
      message: "더미 문서 수정 성공",
      traceId: "mock-update-trace",
      data: {
        ...createMockDocumentDetail(Number(params.documentId)),
        ...requestBody,
        attachmentFiles: getMockAttachmentFiles(requestBody),
        thumbnailImageUrl: getMockThumbnailImageUrl(requestBody),
        versionNumber: Number(requestBody.versionNumber ?? 1) + 1,
      },
    });
  }),
  http.delete("/api/v1/documents/:documentId", async () => {
    const scenarioResponse = await applyScenario();
    return scenarioResponse ?? new HttpResponse(null, { status: 204 });
  }),
  http.post("/api/v1/files/:fileType", async ({ request, params }) => {
    const scenarioResponse = await applyScenario();
    if (scenarioResponse) return scenarioResponse;

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
