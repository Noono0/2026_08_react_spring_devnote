import { fireEvent, render, screen } from "@testing-library/react";
import { ApiWorkspaceToolbar } from "@/features/utility/components/ApiWorkspaceToolbar";

const environment = { id: "environment-1", name: "Local", variables: [] };

describe("ApiWorkspaceToolbar", () => {
  it("상단에서 Environment를 바꾸고 좌우 분할을 선택한다", () => {
    const onEnvironmentSelect = vi.fn();
    const onSplitViewChange = vi.fn();
    render(<ApiWorkspaceToolbar environments={[environment]} splitView="STACKED" onEnvironmentSelect={onEnvironmentSelect} onSplitViewChange={onSplitViewChange} onNewRequest={vi.fn()} onInterchangeOpen={vi.fn()} onCollectionRunnerOpen={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("상단 Environment 선택"), { target: { value: environment.id } });
    fireEvent.click(screen.getByRole("button", { name: "요청과 응답 좌우 배치" }));

    expect(onEnvironmentSelect).toHaveBeenCalledWith(environment.id);
    expect(onSplitViewChange).toHaveBeenCalledWith("SIDE_BY_SIDE");
  });

  it("새 요청과 테스트 시나리오 작업을 실행한다", () => {
    const onNewRequest = vi.fn();
    const onCollectionRunnerOpen = vi.fn();
    render(<ApiWorkspaceToolbar environments={[]} splitView="STACKED" onEnvironmentSelect={vi.fn()} onSplitViewChange={vi.fn()} onNewRequest={onNewRequest} onInterchangeOpen={vi.fn()} onCollectionRunnerOpen={onCollectionRunnerOpen} />);

    fireEvent.click(screen.getByRole("button", { name: "+ 새 요청" }));
    fireEvent.click(screen.getByRole("button", { name: "테스트 시나리오" }));

    expect(onNewRequest).toHaveBeenCalledOnce();
    expect(onCollectionRunnerOpen).toHaveBeenCalledOnce();
  });
});
