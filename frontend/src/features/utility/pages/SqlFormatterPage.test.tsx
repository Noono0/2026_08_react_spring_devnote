import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SqlFormatterPage } from "./SqlFormatterPage";

const renderPage = () => render(<MemoryRouter><SqlFormatterPage /></MemoryRouter>);
const typeSql = (sql: string) => fireEvent.change(screen.getByRole("textbox", { name: "정리할 SQL 입력" }), { target: { value: sql } });
const result = () => screen.getByRole("textbox", { name: "정리 결과" });
/** 옵션 버튼 묶음(group) 안의 버튼 */
const optionButton = (groupName: string, buttonName: string) => within(screen.getByRole("group", { name: groupName })).getByRole("button", { name: buttonName });

describe("SQL Formatter 화면", () => {
  it("입력하면 버튼 없이 바로 정리되고, 옵션 버튼을 누르면 바로 다시 정리되며 고른 버튼만 눌림 상태가 된다", () => {
    renderPage();
    typeSql("select a, b from t");
    expect(result()).toHaveValue("SELECT A,\n       B\nFROM   T"); // 기본값: 테이블·칼럼 이름도 대문자
    expect(optionButton("함수", "대문자")).toHaveAttribute("aria-pressed", "true");
    expect(optionButton("테이블·칼럼 이름", "대문자")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(optionButton("키워드", "소문자"));
    expect(result()).toHaveValue("select A,\n       B\nfrom   T");
    expect(optionButton("키워드", "소문자")).toHaveAttribute("aria-pressed", "true");
    expect(optionButton("키워드", "대문자")).toHaveAttribute("aria-pressed", "false");

    // 켜고 끄는 옵션: "한 줄에 하나"를 끄면 목록이 한 줄로 모인다
    const stackButton = optionButton("목록·조건", "한 줄에 하나");
    expect(stackButton).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(stackButton);
    expect(stackButton).toHaveAttribute("aria-pressed", "false");
    expect(result()).toHaveValue("select A, B\nfrom   T");

    typeSql("select 1"); // 입력을 고치면 결과도 바로 바뀐다
    expect(result()).toHaveValue("select 1");
    typeSql("");
    expect(result()).toHaveValue("");
  });

  it("결과 방식을 '한 줄로 압축'으로 바꾸면 압축 결과가 바로 나온다", () => {
    renderPage();
    typeSql("select a,\n  b\nfrom t");
    fireEvent.click(optionButton("결과 방식", "한 줄로 압축"));
    expect(result()).toHaveValue("select a,b from t");
    expect(optionButton("결과 방식", "한 줄로 압축")).toHaveAttribute("aria-pressed", "true");
  });

  it("들여쓰기 방식에서는 −/+로 1~10칸을 고르고 끝에서는 버튼을 막는다", () => {
    renderPage();
    fireEvent.click(optionButton("정렬 방식", "들여쓰기"));
    const increase = screen.getByRole("button", { name: "들여쓰기 한 칸 늘리기" });
    for (let count = 0; count < 12; count += 1) fireEvent.click(increase);
    expect(screen.getByRole("group", { name: "SQL 들여쓰기 칸 수" })).toHaveTextContent("10칸");
    expect(increase).toBeDisabled();
    const decrease = screen.getByRole("button", { name: "들여쓰기 한 칸 줄이기" });
    for (let count = 0; count < 12; count += 1) fireEvent.click(decrease);
    expect(screen.getByRole("group", { name: "SQL 들여쓰기 칸 수" })).toHaveTextContent("1칸");
    expect(decrease).toBeDisabled();
  });

  it("코멘트를 넣고 MyBatis 형식을 고르면 /* */ 주석이 바로 붙고, Java 출력으로도 바꿀 수 있다", () => {
    renderPage();
    typeSql("select m.member_id from members m");
    fireEvent.change(screen.getByRole("textbox", { name: "테이블·칼럼 코멘트 입력" }), { target: { value: "members 회원테이블\nmembers.member_id 회원아이디" } });
    expect(screen.getByText(/인식한 코멘트 2개/)).toBeInTheDocument();
    fireEvent.click(optionButton("주석 형식", "MyBatis /* */"));
    expect(result()).toHaveValue("SELECT M.MEMBER_ID /* 회원아이디 */\nFROM   MEMBERS M   /* 회원테이블 */"); // 이름을 대문자로 바꿔도 코멘트는 찾는다
    expect(screen.getByText(/코멘트 주석 2개/)).toBeInTheDocument();

    fireEvent.click(optionButton("출력 형식", "Java StringBuilder"));
    expect(result()).toHaveDisplayValue(/^StringBuilder sql = new StringBuilder\(\);\nsql\.append\("SELECT M\.MEMBER_ID/);
  });

  it("복잡한 예제를 누르면 DDL 코멘트를 읽어 CTE·서브쿼리·UPDATE까지 주석을 붙인다", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "복잡한 예제" }));
    expect(screen.getByText(/인식한 코멘트 31개/)).toBeInTheDocument();
    expect(screen.getByText(/코멘트 주석 20개/)).toBeInTheDocument();
    expect(result()).toHaveDisplayValue(/^WITH RECENT_ORDERS AS \(SELECT O\.MEMBER_ID,\s+-- 주문회원$/m);
    expect(result()).toHaveDisplayValue(/^SET {4}GRADE_ID = #\{gradeId\},\s+-- 등급아이디$/m);
  });

  it("결과를 입력으로 옮기면 입력이 결과로 바뀐다", () => {
    renderPage();
    typeSql("select a from t");
    fireEvent.click(screen.getByRole("button", { name: "결과를 입력으로" }));
    expect(screen.getByRole("textbox", { name: "정리할 SQL 입력" })).toHaveValue("SELECT A\nFROM   T");
  });

  it("결과 복사는 결과 칸의 글자를 클립보드에 넣고, 결과가 없으면 누를 수 없다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderPage();
    typeSql("select a from t");
    fireEvent.click(screen.getByRole("button", { name: "결과 복사" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("SELECT A\nFROM   T"));

    typeSql("");
    expect(screen.getByRole("button", { name: "결과 복사" })).toBeDisabled();
  });
});
