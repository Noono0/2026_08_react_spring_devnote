import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
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
    expect(result()).toHaveValue("SELECT a,\n       b\nFROM   t");

    fireEvent.click(optionButton("키워드", "소문자"));
    expect(result()).toHaveValue("select a,\n       b\nfrom   t");
    expect(optionButton("키워드", "소문자")).toHaveAttribute("aria-pressed", "true");
    expect(optionButton("키워드", "대문자")).toHaveAttribute("aria-pressed", "false");

    // 켜고 끄는 옵션: "한 줄에 하나"를 끄면 목록이 한 줄로 모인다
    const stackButton = optionButton("목록·조건", "한 줄에 하나");
    expect(stackButton).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(stackButton);
    expect(stackButton).toHaveAttribute("aria-pressed", "false");
    expect(result()).toHaveValue("select a, b\nfrom   t");

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
    expect(result()).toHaveValue("SELECT m.member_id /* 회원아이디 */\nFROM   members m   /* 회원테이블 */");
    expect(screen.getByText(/코멘트 주석 2개/)).toBeInTheDocument();

    fireEvent.click(optionButton("출력 형식", "Java StringBuilder"));
    expect(result()).toHaveDisplayValue(/^StringBuilder sql = new StringBuilder\(\);\nsql\.append\("SELECT m\.member_id/);
  });

  it("결과를 입력으로 옮기면 입력이 결과로 바뀐다", () => {
    renderPage();
    typeSql("select a from t");
    fireEvent.click(screen.getByRole("button", { name: "결과를 입력으로" }));
    expect(screen.getByRole("textbox", { name: "정리할 SQL 입력" })).toHaveValue("SELECT a\nFROM   t");
  });
});
