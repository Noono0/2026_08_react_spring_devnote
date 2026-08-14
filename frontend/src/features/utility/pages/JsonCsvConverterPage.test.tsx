import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JsonCsvConverterPage } from "@/features/utility/pages/JsonCsvConverterPage";

describe("JsonCsvConverterPage", () => {
  it("기본 JSON 예제를 CSV로 변환하고 표 미리보기를 표시한다", () => {
    render(<JsonCsvConverterPage />);

    fireEvent.click(screen.getByRole("button", { name: /^CSV로 변환/ }));

    expect(screen.getByLabelText<HTMLTextAreaElement>("CSV 결과").value).toContain(
      '2,김개발,"Backend, API",false',
    );
    expect(screen.getByText("4열 · 3행")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "name" })).toBeInTheDocument();
  });

  it("CSV의 중복 Header를 사용자가 수정할 수 있는 오류로 안내한다", () => {
    render(<JsonCsvConverterPage />);

    fireEvent.click(screen.getByRole("tab", { name: "CSV → JSON" }));
    fireEvent.change(screen.getByLabelText("CSV 입력"), {
      target: { value: "id,id\r\n1,2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^JSON으로 변환/ }));

    expect(screen.getByRole("alert")).toHaveTextContent("CSV Header 이름은 중복될 수 없습니다.");
  });
});
