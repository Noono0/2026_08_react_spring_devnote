import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  ContextAuthHomePage,
  ContextAuthLoginPage,
  ContextAuthMyPage,
  ContextAuthPracticeLayout,
  RequirePracticeLogin,
} from "./ContextAuthPracticePages";
import { usePracticeAuth } from "@/features/practice/17-context-auth/state/practiceAuthContext";

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/react/context-auth" element={<ContextAuthPracticeLayout />}>
        <Route index element={<ContextAuthHomePage />} />
        <Route path="login" element={<ContextAuthLoginPage />} />
        <Route path="mypage" element={<RequirePracticeLogin><ContextAuthMyPage /></RequirePracticeLogin>} />
      </Route>
    </Routes>
  </MemoryRouter>,
);

const login = (loginId: string, password: string) => {
  fireEvent.change(screen.getByLabelText("아이디"), { target: { value: loginId } });
  fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
};

describe("Context 로그인과 보호 라우트", () => {
  it("로그인하지 않고 보호 화면에 가면 로그인 후 원래 화면으로 돌아온다", () => {
    renderAt("/react/context-auth/mypage");
    expect(screen.getByRole("heading", { name: "실습 로그인" })).toBeInTheDocument();

    login("devnote", "wrong");
    expect(screen.getByRole("alert")).toHaveTextContent("실습용 비밀번호");

    login("devnote", "react1234");
    expect(screen.getByRole("heading", { name: "마이페이지" })).toBeInTheDocument();
    // 상태 표시줄도 props 없이 같은 Context 값을 읽는다.
    expect(screen.getByRole("status")).toHaveTextContent("devnote 님 로그인 중");
  });

  it("로그아웃하면 보호 화면에서 로그인 화면으로 돌아간다", () => {
    renderAt("/react/context-auth/login");
    login("devnote", "react1234");
    fireEvent.click(within(screen.getByRole("navigation", { name: "Context 실습 메뉴" })).getByRole("button", { name: "로그아웃" }));

    expect(screen.getByRole("heading", { name: "실습 로그인" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("로그인하지 않음");
  });

  it("Provider 밖에서 훅을 쓰면 원인을 알려 주는 오류를 던진다", () => {
    const OutsideProvider = () => {
      usePracticeAuth();
      return null;
    };
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<OutsideProvider />)).toThrow("PracticeAuthProvider 안에서만");
    vi.restoreAllMocks();
  });
});
