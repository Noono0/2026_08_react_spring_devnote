import { fireEvent, render, screen } from "@testing-library/react";
import { ApiWorkspaceResponseViewer } from "@/features/utility/components/ApiWorkspaceResponseViewer";
import type { ApiWorkspaceActualRequest } from "@/features/utility/types/apiWorkspaceTypes";

const actualRequest: ApiWorkspaceActualRequest = {
  method: "POST",
  url: "https://api.example.com/members?page=1",
  headers: [
    { id: "content-type", key: "Content-Type", value: "application/json", enabled: true },
    { id: "authorization", key: "Authorization", value: "••••••••", enabled: true, secret: true },
  ],
  body: '{"name":"DevNote"}',
  bodyType: "JSON",
  preparedAt: "2026-08-14T00:00:00.000Z",
};

describe("ApiWorkspaceResponseViewer", () => {
  it("응답이 실패해도 Actual Request에서 실제 전송 구성을 확인한다", () => {
    render(<ApiWorkspaceResponseViewer actualRequest={actualRequest} errorMessage="CORS 오류" isSending={false} activeSection="ACTUAL_REQUEST" bodyView="PRETTY" onSectionChange={vi.fn()} onBodyViewChange={vi.fn()} onCopy={vi.fn()} onDownload={vi.fn()} />);

    expect(screen.getByText("https://api.example.com/members?page=1")).toBeInTheDocument();
    expect(screen.getByText("••••••••")).toBeInTheDocument();
    expect(screen.queryByText("CORS 오류")).not.toBeInTheDocument();
    expect(screen.getByText('{"name":"DevNote"}')).toBeInTheDocument();
  });

  it("Actual Request 탭 선택을 부모 상태로 전달한다", () => {
    const onSectionChange = vi.fn();
    render(<ApiWorkspaceResponseViewer isSending={false} activeSection="BODY" bodyView="PRETTY" onSectionChange={onSectionChange} onBodyViewChange={vi.fn()} onCopy={vi.fn()} onDownload={vi.fn()} />);

    fireEvent.click(screen.getByRole("tab", { name: "Actual Request" }));

    expect(onSectionChange).toHaveBeenCalledWith("ACTUAL_REQUEST");
  });
});
