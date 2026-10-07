import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HistoryTagFilter, HistoryTagList } from "@/features/history/components/HistoryTags";

describe("HistoryTags", () => {
  it("태그 링크는 주소에 넣기 전에 인코딩한다", () => {
    render(<MemoryRouter><HistoryTagList tags={["C# & .NET"]} basePath="/history" /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "#C# & .NET" })).toHaveAttribute("href", "/history?tag=C%23%20%26%20.NET");
  });

  it("선택한 태그를 다시 누르면 필터를 해제한다", () => {
    const onSelect = vi.fn();
    render(<HistoryTagFilter tags={[{ tagName: "배포", documentCount: 3 }]} selectedTag="배포" onSelect={onSelect} />);

    expect(screen.getByRole("button", { name: /#배포/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "전체" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: /#배포/ }));
    expect(onSelect).toHaveBeenCalledWith(undefined);
  });
});
