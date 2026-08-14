import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiCollectionRunnerDialog } from "@/features/utility/components/ApiCollectionRunnerDialog";
import type { ApiWorkspaceCollection, ApiWorkspaceResponse, ApiWorkspaceSavedRequest } from "@/features/utility/types/apiWorkspaceTypes";
import { createEmptyApiRequest } from "@/features/utility/utils/apiWorkspaceUtils";
import type { executeApiWorkspaceRequest } from "@/features/utility/utils/apiWorkspaceExecutor";
import { applicationNotification } from "@/shared/notification/applicationNotification";

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.open = false; } });
});

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(applicationNotification, "success").mockImplementation(() => undefined);
  vi.spyOn(applicationNotification, "warning").mockImplementation(() => undefined);
});

const collection: ApiWorkspaceCollection = {
  id: "collection-1",
  name: "상태 점검",
  description: "",
  createdAt: "2026-08-14T00:00:00.000Z",
};
const savedRequest: ApiWorkspaceSavedRequest = {
  id: "request-1",
  collectionId: collection.id,
  name: "세션 확인",
  description: "",
  favorite: false,
  request: { ...createEmptyApiRequest(), name: "세션 확인" },
  createdAt: "2026-08-14T00:00:00.000Z",
  updatedAt: "2026-08-14T00:00:00.000Z",
};
const successfulResponse: ApiWorkspaceResponse = {
  status: 200,
  statusText: "OK",
  elapsedMilliseconds: 12,
  sizeBytes: 2,
  headers: [],
  body: "{}",
  contentType: "application/json",
  truncated: false,
  receivedAt: "2026-08-14T00:00:00.000Z",
};

const renderRunner = (
  executeRequest: typeof executeApiWorkspaceRequest,
  options: {
    collections?: ApiWorkspaceCollection[];
    savedRequests?: ApiWorkspaceSavedRequest[];
    defaultCollectionId?: string;
  } = {},
) => render(
  <ApiCollectionRunnerDialog
    isOpen
    authenticated
    storagePrefix="devnote-api-workspace:member-1"
    collections={options.collections ?? [collection]}
    savedRequests={options.savedRequests ?? [savedRequest]}
    defaultCollectionId={options.defaultCollectionId}
    environments={[]}
    onRequestClose={vi.fn()}
    executeRequest={executeRequest}
  />,
);

describe("ApiCollectionRunnerDialog", () => {
  it("Collection에서 Runner를 열면 해당 Collection과 요청을 기본 선택한다", async () => {
    const secondCollection: ApiWorkspaceCollection = {
      ...collection,
      id: "collection-2",
      name: "회원 API",
    };
    const secondRequest: ApiWorkspaceSavedRequest = {
      ...savedRequest,
      id: "request-2",
      collectionId: secondCollection.id,
      name: "회원 목록",
    };
    renderRunner(vi.fn<typeof executeApiWorkspaceRequest>().mockResolvedValue(successfulResponse), {
      collections: [collection, secondCollection],
      savedRequests: [savedRequest, secondRequest],
      defaultCollectionId: secondCollection.id,
    });

    await waitFor(() => expect(screen.getByLabelText("Collection")).toHaveValue(secondCollection.id));
    expect(screen.getByRole("checkbox", { name: /회원 목록/ })).toBeChecked();
    expect(screen.queryByRole("checkbox", { name: /세션 확인/ })).not.toBeInTheDocument();
  });

  it("선택한 Collection 요청을 순서대로 즉시 실행하고 결과를 표시한다", async () => {
    const executeRequest = vi.fn<typeof executeApiWorkspaceRequest>().mockResolvedValue(successfulResponse);
    renderRunner(executeRequest);

    const runButton = screen.getByRole("button", { name: "Collection 실행" });
    await waitFor(() => expect(runButton).toBeEnabled());
    fireEvent.click(runButton);

    await waitFor(() => expect(executeRequest).toHaveBeenCalledOnce());
    expect(await screen.findByText("성공 1 · 실패 0")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("매일 예약 실행을 등록하고 회원별 저장소에 보관한다", async () => {
    const executeRequest = vi.fn<typeof executeApiWorkspaceRequest>().mockResolvedValue(successfulResponse);
    renderRunner(executeRequest);

    fireEvent.click(screen.getByRole("tab", { name: /예약 실행/ }));
    fireEvent.change(screen.getByLabelText("예약 이름"), { target: { value: "매일 새벽 점검" } });
    fireEvent.change(screen.getByLabelText("매일 실행 시각"), { target: { value: "23:59" } });
    const saveButton = screen.getByRole("button", { name: "예약 등록" });
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);

    expect(await screen.findByText("매일 새벽 점검")).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem("devnote-api-workspace:member-1:runner-schedules")).toContain("매일 새벽 점검"));
    expect(screen.getByText("매일 23:59")).toBeInTheDocument();
  });

  it("페이지를 다시 열었을 때 놓친 예약을 한 번 실행하고 다음 시각으로 갱신한다", async () => {
    localStorage.setItem("devnote-api-workspace:member-1:runner-schedules", JSON.stringify([{
      id: "schedule-overdue",
      name: "놓친 상태 점검",
      collectionId: collection.id,
      selectedRequestIds: [savedRequest.id],
      localTime: "23:59",
      iterationCount: 1,
      delayMilliseconds: 0,
      enabled: true,
      createdAt: "2026-08-13T00:00:00.000Z",
      updatedAt: "2026-08-13T00:00:00.000Z",
      nextRunAt: "2000-01-01T00:00:00.000Z",
    }]));
    const executeRequest = vi.fn<typeof executeApiWorkspaceRequest>().mockResolvedValue(successfulResponse);
    renderRunner(executeRequest);

    await waitFor(() => expect(executeRequest).toHaveBeenCalledOnce());
    await waitFor(() => {
      const storedSchedules = localStorage.getItem("devnote-api-workspace:member-1:runner-schedules") ?? "";
      expect(storedSchedules).toContain('"lastRunSuccessful":true');
      expect(storedSchedules).not.toContain('"nextRunAt":"2000-01-01T00:00:00.000Z"');
    });
  });
});
