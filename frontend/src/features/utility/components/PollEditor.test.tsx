import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PollEditor } from "@/features/utility/components/PollEditor";

describe("PollEditor", () => {
  it("두 문항에서 시작하고 복수 선택을 켜면 현재 문항 수를 최대값으로 사용한다", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<PollEditor pending={false} onCancel={() => undefined} onSubmit={submit} />);

    expect(screen.getByLabelText("문항 1")).toBeInTheDocument();
    expect(screen.getByLabelText("문항 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ 문항 추가" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /중복 투표 허용/ }));

    expect(screen.getByRole("spinbutton", { name: /최대 선택 수/ })).toHaveValue(3);

    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "점심 메뉴" } });
    fireEvent.change(screen.getByLabelText("문항 1"), { target: { value: "짜장면" } });
    fireEvent.change(screen.getByLabelText("문항 2"), { target: { value: "짬뽕" } });
    fireEvent.change(screen.getByLabelText("문항 3"), { target: { value: "울면" } });
    fireEvent.click(screen.getByRole("button", { name: "투표 만들기" }));

    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      question: "점심 메뉴",
      options: ["짜장면", "짬뽕", "울면"],
      allowMultiple: true,
      maxSelections: 3,
    })));
  });
});
