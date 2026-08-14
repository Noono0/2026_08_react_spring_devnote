import { render, screen } from "@testing-library/react";
import { DocumentPagination } from "./DocumentPagination";

it("현재 페이지 버튼에 aria-current를 표시한다", () => {
  render(
    <DocumentPagination
      pageInformation={{
        pageNumber: 1,
        pageSize: 10,
        totalElements: 30,
        totalPages: 3,
        firstPage: false,
        lastPage: false,
      }}
      handlePageChange={() => undefined}
    />,
  );
  expect(screen.getByRole("button", { name: "2" })).toHaveAttribute("aria-current", "page");
});

it("화면 성격에 맞는 페이지 이동 이름을 지정할 수 있다", () => {
  render(
    <DocumentPagination
      ariaLabel="투표 목록 페이지 이동"
      pageInformation={{
        pageNumber: 0,
        pageSize: 10,
        totalElements: 11,
        totalPages: 2,
        firstPage: true,
        lastPage: false,
      }}
      handlePageChange={() => undefined}
    />,
  );
  expect(screen.getByRole("navigation", { name: "투표 목록 페이지 이동" })).toBeInTheDocument();
});
