import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { UrlStatePracticePage } from "./UrlStatePracticePage";

const LocationProbe = () => <output aria-label="현재 위치">{useLocation().search}</output>;

const renderAt = (search: string) => render(
  <MemoryRouter initialEntries={[`/react/url-state${search}`]}>
    <UrlStatePracticePage />
    <LocationProbe />
  </MemoryRouter>,
);

describe("UrlStatePracticePage", () => {
  it("주소의 조건으로 화면을 복원한다", () => {
    renderAt("?category=백엔드&sort=price&page=2");

    expect(screen.getByRole("combobox", { name: "분류" })).toHaveValue("백엔드");
    expect(screen.getByRole("combobox", { name: "정렬" })).toHaveValue("price");
    expect(screen.getByText(/^2 \/ \d+$/)).toBeInTheDocument();
    const items = within(screen.getByRole("list", { name: "책 목록" })).getAllByRole("listitem");
    expect(items.every((item) => item.textContent?.includes("백엔드"))).toBe(true);
  });

  it("잘못된 주소 값은 기본값으로 바꿔 보여 준다", () => {
    renderAt("?category=해킹&sort=hack&page=바나나");

    expect(screen.getByRole("combobox", { name: "분류" })).toHaveValue("전체");
    expect(screen.getByRole("combobox", { name: "정렬" })).toHaveValue("newest");
    expect(screen.getByText(/^1 \/ \d+$/)).toBeInTheDocument();
  });

  it("조건을 바꾸면 주소가 바뀌고 페이지는 처음으로 돌아간다", () => {
    renderAt("?page=3");
    fireEvent.change(screen.getByRole("combobox", { name: "분류" }), { target: { value: "데브옵스" } });

    expect(screen.getByLabelText("현재 위치")).toHaveTextContent(`?category=${encodeURIComponent("데브옵스")}`);
    expect(screen.getByLabelText("현재 위치")).not.toHaveTextContent("page=");

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByLabelText("현재 위치")).toHaveTextContent("page=2");
  });
});
