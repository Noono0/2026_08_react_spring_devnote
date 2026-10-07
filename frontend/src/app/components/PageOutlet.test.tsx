import { fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { PageOutlet } from "@/app/components/PageOutlet";
import { isChunkLoadError } from "@/app/components/PageErrorBoundary";

const BrokenPage = (): never => {
  throw new Error("렌더링 실패");
};

const renderWithLayout = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<><nav><Link to="/ok">정상 메뉴</Link></nav><PageOutlet /></>}>
          <Route path="broken" element={<BrokenPage />} />
          <Route path="ok" element={<p>정상 화면</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

describe("PageOutlet 오류 경계", () => {
  // React가 잡은 렌더링 오류를 콘솔에 출력하므로 테스트 출력이 지저분해지지 않게 막는다.
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => undefined));
  afterEach(() => vi.restoreAllMocks());

  it("페이지가 렌더링 중 실패해도 메뉴는 남기고 오류 안내를 보여 준다", () => {
    renderWithLayout("/broken");

    expect(screen.getByRole("alert")).toHaveTextContent("화면을 표시하지 못했습니다");
    expect(screen.getByRole("link", { name: "정상 메뉴" })).toBeInTheDocument();
  });

  it("다른 메뉴로 이동하면 오류 상태를 지우고 새 화면을 그린다", () => {
    renderWithLayout("/broken");

    fireEvent.click(screen.getByRole("link", { name: "정상 메뉴" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("정상 화면")).toBeInTheDocument();
  });

  it("배포 후 사라진 페이지 파일 오류를 브라우저별 문구로 구분한다", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: /assets/Page-abc.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new TypeError("error loading dynamically imported module"))).toBe(true);
    expect(isChunkLoadError(new Error("렌더링 실패"))).toBe(false);
  });
});
