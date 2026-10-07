import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { clearNoticePromiseCache } from "@/features/practice/24-use-suspense/api/localNoticeApi";
import { UseSuspensePracticePage } from "./UseSuspensePracticePage";

// ★ React 19: 렌더링 중 Suspense로 멈추는 컴포넌트는 await act() 안에서 그려야 Promise가 끝난 뒤 화면이 이어서 갱신된다.
// callback을 실행하고 Promise를 돌려주면 act가 "비동기 act"로 동작해, 멈췄던 Suspense가 풀릴 때까지 기다린다.
const actAsync = (callback: () => void) => act(() => { callback(); return Promise.resolve(); });
const renderPage = () => actAsync(() => { render(<MemoryRouter><UseSuspensePracticePage /></MemoryRouter>); });
// 가짜 네트워크 지연(0.6초)과 React의 Suspense 화면 전환 간격을 넉넉히 기다린다.
const waitOptions = { timeout: 3000 };

describe("UseSuspensePracticePage", () => {
  beforeEach(() => {
    clearNoticePromiseCache();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Promise가 끝나면 Suspense가 목록으로 바꿔 보여 준다", async () => {
    await renderPage();

    expect(await screen.findByRole("list", { name: "공지 목록" }, waitOptions)).toBeInTheDocument();
  });

  it("실패하면 Error Boundary가 받고, 다시 시도하면 새 요청으로 회복한다", async () => {
    // React가 잡은 오류를 콘솔에 출력하므로 테스트 출력이 지저분해지지 않게 막는다.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await renderPage();
    await screen.findByRole("list", { name: "공지 목록" }, waitOptions);

    await actAsync(() => { fireEvent.click(screen.getByRole("checkbox", { name: "실패 연습" })); });
    expect(await screen.findByRole("alert", {}, waitOptions)).toHaveTextContent("연습용 실패");

    await actAsync(() => { fireEvent.click(screen.getByRole("button", { name: "다시 시도" })); });
    expect(await screen.findByRole("list", { name: "공지 목록" }, waitOptions)).toBeInTheDocument();
    expect(screen.getByText(/요청 번호 2/)).toBeInTheDocument();
  });
});
