import { fireEvent, render, screen } from "@testing-library/react";
import { FeatureHelpButton } from "@/features/help/FeatureHelpButton";

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) { this.open = true; },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) { this.open = false; },
  });
});

describe("FeatureHelpButton", () => {
  it("크롤러 사용 설명을 ? 버튼으로 열어 녹화와 결과 검색의 차이를 보여 준다", () => {
    render(<FeatureHelpButton topic="crawler" />);

    fireEvent.click(screen.getByRole("button", { name: "웹 크롤링 도구 사용 설명 열기" }));

    expect(screen.getByRole("dialog", { name: "웹 크롤링 도구 사용 설명" })).toBeInTheDocument();
    expect(screen.getByText(/목록에서 읽을 열은 별도로 확인합니다/)).toBeInTheDocument();
    expect(screen.getByText(/계정정보 저장을 켜면 현재 브라우저에 평문으로 남습니다/)).toBeInTheDocument();
  });

  it("권한관리의 표시용 설정 한계를 명확히 안내한다", () => {
    render(<FeatureHelpButton topic="permissions" />);

    fireEvent.click(screen.getByRole("button", { name: "권한관리 사용 설명 열기" }));

    expect(screen.getByText(/실제 API 권한은 바뀌지 않습니다/)).toBeInTheDocument();
  });
});
