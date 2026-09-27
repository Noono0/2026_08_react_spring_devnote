import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CrawlerStepEditor } from "@/features/crawler/components/CrawlerStepEditor";
import { createStep, toRequestSteps } from "@/features/crawler/utils/crawlerSteps";

vi.mock("@/features/crawler/hooks/useWebCrawler", () => ({
  useCrawlerLiveView: () => ({ data: undefined }),
  useCrawlerManualAction: () => ({ mutate: vi.fn() }),
  useCrawlerRecording: () => ({ start: { mutate: vi.fn() }, stop: { mutate: vi.fn() } }),
}));

const Harness = () => {
  const [steps, setSteps] = useState(() => [createStep("GOTO", { value: "https://example.com" }), createStep("COLLECT", {
    targetMode: "SELECTOR", target: ".product", fields: [
      { name: "상품명", selector: ".title", valueSource: "TEXT", attributeName: "" },
      { name: "가격", selector: ".price", valueSource: "TEXT", attributeName: "" },
    ],
  })]);
  return <><CrawlerStepEditor steps={steps} onChange={setSteps} onLoadExample={setSteps} startUrl="https://example.com" browserWindow="WEB" username="" password="" onUsernameChange={() => {}} onPasswordChange={() => {}} disabled={false} onRun={() => {}} onBeforeAddAction={() => true} commonFields={[]} commonItemSelector="" /><output data-testid="steps">{JSON.stringify(toRequestSteps(steps))}</output></>;
};

describe("작업 단계 편집", () => {
  it("묶음 순서를 바꾸고 복사·삭제할 때 하위 추출을 함께 처리한다", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /목록 반복 묶음/ }));
    fireEvent.click(screen.getByRole("button", { name: "위로" }));
    const table = screen.getByRole("table", { name: "실행 순서와 목록 반복 하위 추출 단계" });
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("목록 반복");
    fireEvent.click(screen.getByRole("button", { name: "복사" }));
    expect(within(table).getAllByRole("button", { name: /상품명 추출/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(within(table).getAllByRole("button", { name: /상품명 추출/ })).toHaveLength(1);
  });

  it("하위 항목만 이동하고 선택 항목을 수정·복사·삭제한다", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /가격 추출/ }));
    fireEvent.click(screen.getByRole("button", { name: "위로" }));
    fireEvent.change(screen.getByLabelText("추출 이름"), { target: { value: "판매가" } });
    fireEvent.click(screen.getByRole("button", { name: "복사" }));
    expect(screen.getByRole("button", { name: /판매가 복사 추출/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(screen.queryByRole("button", { name: /판매가 복사 추출/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("steps").textContent).toContain('"fields":[{"name":"판매가"');
  });
});
