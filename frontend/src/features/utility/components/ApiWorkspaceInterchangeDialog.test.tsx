import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiWorkspaceInterchangeDialog } from "@/features/utility/components/ApiWorkspaceInterchangeDialog";
import type { ApiWorkspaceCollection, ApiWorkspaceSavedRequest } from "@/features/utility/types/apiWorkspaceTypes";
import { createEmptyApiRequest } from "@/features/utility/utils/apiWorkspaceUtils";
import type { ImportedPostmanCollection } from "@/features/utility/utils/apiWorkspaceInterchange";
import * as browserFileUtils from "@/features/utility/utils/browserFileUtils";
import { applicationNotification } from "@/shared/notification/applicationNotification";

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.open = false; } });
});

beforeEach(() => {
  vi.spyOn(browserFileUtils, "downloadText").mockImplementation(() => undefined);
  vi.spyOn(applicationNotification, "success").mockImplementation(() => undefined);
  vi.spyOn(applicationNotification, "warning").mockImplementation(() => undefined);
});

const collection: ApiWorkspaceCollection = { id: "collection-1", name: "회원 API", description: "", createdAt: "2026-08-14T00:00:00.000Z" };
const savedRequest: ApiWorkspaceSavedRequest = {
  id: "request-1",
  collectionId: collection.id,
  name: "회원 조회",
  description: "",
  favorite: false,
  request: { ...createEmptyApiRequest(), name: "회원 조회", url: "https://api.example.com/members" },
  createdAt: "2026-08-14T00:00:00.000Z",
  updatedAt: "2026-08-14T00:00:00.000Z",
};

describe("ApiWorkspaceInterchangeDialog", () => {
  it("선택한 Collection을 Postman 파일로 내보낸다", async () => {
    render(<ApiWorkspaceInterchangeDialog isOpen authenticated collections={[collection]} folders={[]} savedRequests={[savedRequest]} environments={[]} onRequestClose={vi.fn()} onCollectionImport={vi.fn()} onEnvironmentImport={vi.fn()} onCurlShareOpen={vi.fn()} />);

    const exportButton = screen.getByRole("button", { name: "Postman Collection 내보내기" });
    await waitFor(() => expect(exportButton).toBeEnabled());
    fireEvent.click(exportButton);

    expect(browserFileUtils.downloadText).toHaveBeenCalledWith("회원-API.postman_collection.json", expect.stringContaining("collection/v2.1.0"), "application/json;charset=utf-8");
  });

  it("Postman Collection 파일을 읽어 가져오기 결과를 전달한다", async () => {
    const onCollectionImport = vi.fn<(result: ImportedPostmanCollection) => void>();
    render(<ApiWorkspaceInterchangeDialog isOpen authenticated collections={[]} folders={[]} savedRequests={[]} environments={[]} onRequestClose={vi.fn()} onCollectionImport={onCollectionImport} onEnvironmentImport={vi.fn()} onCurlShareOpen={vi.fn()} />);
    const source = JSON.stringify({ info: { name: "외부 Collection", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" }, item: [{ name: "상태 확인", request: { method: "GET", url: "https://api.example.com/health" } }] });
    const file = new File([source], "external.postman_collection.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: () => Promise.resolve(source) });

    fireEvent.change(screen.getByLabelText("Postman Collection 파일 가져오기"), { target: { files: [file] } });

    await waitFor(() => expect(onCollectionImport).toHaveBeenCalledOnce());
    const imported = onCollectionImport.mock.calls[0]?.[0];
    expect(imported?.collection.name).toBe("외부 Collection");
    expect(imported?.savedRequests[0]?.name).toBe("상태 확인");
  });

  it("비회원은 저장 데이터 공유가 비활성화되고 cURL은 열 수 있다", () => {
    const onCurlShareOpen = vi.fn();
    render(<ApiWorkspaceInterchangeDialog isOpen authenticated={false} collections={[]} folders={[]} savedRequests={[]} environments={[]} onRequestClose={vi.fn()} onCollectionImport={vi.fn()} onEnvironmentImport={vi.fn()} onCurlShareOpen={onCurlShareOpen} />);

    expect(screen.getByText("로그인이 필요합니다.")).toBeInTheDocument();
    expect(screen.getByLabelText("Postman Collection 파일 가져오기")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "cURL · 코드 생성 열기" }));
    expect(onCurlShareOpen).toHaveBeenCalledOnce();
  });
});
