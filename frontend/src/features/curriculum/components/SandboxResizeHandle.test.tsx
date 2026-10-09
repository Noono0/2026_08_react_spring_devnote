import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clampSandboxSize, SANDBOX_EDITOR_WIDTH_RANGE, SANDBOX_LAYOUT_HEIGHT_RANGE, useStageSandboxStore } from "@/features/curriculum/state/stageSandboxStore";
import { SandboxResizeHandle } from "./SandboxResizeHandle";

describe("사이트 안 편집기 크기 조절 손잡이", () => {
  it("세로 막대는 ←/→, 가로 막대는 ↑/↓에만 반응하고 Shift는 크게 조절한다", () => {
    const onStep = vi.fn();
    const { rerender } = render(<SandboxResizeHandle orientation="vertical" label="편집기 너비 조절" onDrag={vi.fn()} onStep={onStep} onReset={vi.fn()} />);
    const verticalHandle = screen.getByRole("button", { name: "편집기 너비 조절" });

    fireEvent.keyDown(verticalHandle, { key: "ArrowRight" });
    fireEvent.keyDown(verticalHandle, { key: "ArrowLeft", shiftKey: true });
    fireEvent.keyDown(verticalHandle, { key: "ArrowUp" }); // 세로 막대에서는 무시
    expect(onStep.mock.calls).toEqual([[1, false], [-1, true]]);

    onStep.mockClear();
    rerender(<SandboxResizeHandle orientation="horizontal" label="편집기 높이 조절" onDrag={vi.fn()} onStep={onStep} onReset={vi.fn()} />);
    const horizontalHandle = screen.getByRole("button", { name: "편집기 높이 조절" });
    fireEvent.keyDown(horizontalHandle, { key: "ArrowDown" });
    fireEvent.keyDown(horizontalHandle, { key: "ArrowRight" }); // 가로 막대에서는 무시
    expect(onStep.mock.calls).toEqual([[1, false]]);
  });

  it("더블클릭하면 기본 크기로 되돌린다", () => {
    const onReset = vi.fn();
    render(<SandboxResizeHandle orientation="vertical" label="편집기 너비 조절" onDrag={vi.fn()} onStep={vi.fn()} onReset={onReset} />);
    fireEvent.doubleClick(screen.getByRole("button", { name: "편집기 너비 조절" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe("편집기 크기 저장소", () => {
  beforeEach(() => {
    localStorage.clear();
    useStageSandboxStore.setState({ editorWidthPercent: SANDBOX_EDITOR_WIDTH_RANGE.initial, layoutHeight: SANDBOX_LAYOUT_HEIGHT_RANGE.initial });
  });

  it("범위를 벗어난 값은 최소·최대로 맞추고 정수로 만든다", () => {
    expect(clampSandboxSize(5, SANDBOX_EDITOR_WIDTH_RANGE)).toBe(20);
    expect(clampSandboxSize(95, SANDBOX_EDITOR_WIDTH_RANGE)).toBe(80);
    expect(clampSandboxSize(612.6, SANDBOX_LAYOUT_HEIGHT_RANGE)).toBe(613);
  });

  it("바꾼 크기를 범위 안으로 맞춰 저장한다", () => {
    useStageSandboxStore.getState().setEditorWidthPercent(120);
    useStageSandboxStore.getState().setLayoutHeight(100);
    expect(useStageSandboxStore.getState().editorWidthPercent).toBe(80);
    expect(useStageSandboxStore.getState().layoutHeight).toBe(320);
    expect(localStorage.getItem("stageSandboxEditorWidth")).toBe("80");
    expect(localStorage.getItem("stageSandboxLayoutHeight")).toBe("320");
  });
});
