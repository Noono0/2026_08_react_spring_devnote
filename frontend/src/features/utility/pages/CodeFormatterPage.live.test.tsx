import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CodeFormatterPage } from "./CodeFormatterPage";

const typeSource = (source: string) => fireEvent.change(screen.getByRole("textbox", { name: "포맷할 소스 입력" }), { target: { value: source } });
const result = () => screen.getByRole("textbox", { name: "포맷 결과" });

describe("Code Formatter 바로 정리", () => {
  it("입력하면 버튼 없이 바로 정리되고, 문법이 틀리면 결과 대신 오류를 보여 준다", () => {
    render(<MemoryRouter><CodeFormatterPage /></MemoryRouter>);
    expect(result()).toHaveValue('{\n  "name": "DevNote",\n  "features": [\n    "portfolio",\n    "react",\n    "utilities"\n  ]\n}'); // 처음 예제도 바로 정리

    typeSource('{"a":1}');
    expect(result()).toHaveValue('{\n  "a": 1\n}');

    typeSource('{"a":');
    expect(result()).toHaveValue("");
    expect(screen.getByText(/문법 오류/)).toBeInTheDocument();

    typeSource('{"a": 1, "b": [true]}');
    fireEvent.click(within(screen.getByRole("group", { name: "결과 방식" })).getByRole("button", { name: "압축(Minify)" }));
    expect(result()).toHaveValue('{"a":1,"b":[true]}');
    expect(screen.queryByText(/문법 오류/)).not.toBeInTheDocument();
  });
});
