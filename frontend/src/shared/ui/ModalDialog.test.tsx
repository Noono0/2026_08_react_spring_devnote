import { fireEvent, render, screen } from "@testing-library/react";
import { ModalDialog } from "@/shared/ui/ModalDialog";

beforeAll(() => {
  class TestPointerEvent extends MouseEvent {
    readonly pointerId: number;

    constructor(type: string, eventInit: PointerEventInit = {}) {
      super(type, eventInit);
      this.pointerId = eventInit.pointerId ?? 0;
    }
  }

  Object.defineProperty(window, "PointerEvent", { configurable: true, value: TestPointerEvent });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) { this.open = true; },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) { this.open = false; },
  });
  Object.defineProperty(HTMLButtonElement.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLButtonElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: () => false,
  });
});

beforeEach(() => localStorage.clear());

describe("ModalDialog 크기 조절", () => {
  it("resizable 옵션이 있으면 핸들과 키보드 크기 조절을 제공하고 크기를 저장한다", () => {
    render(
      <ModalDialog
        isOpen
        title="크기 조절 예제"
        resizable
        resizeStorageKey="test-dialog"
        onRequestClose={vi.fn()}
      >
        <p>내용</p>
      </ModalDialog>,
    );

    const dialog = screen.getByRole("dialog");
    const resizeHandle = screen.getByRole("button", { name: "크기 조절 예제 모달 크기 조절" });
    expect(dialog).toHaveClass("modal-dialog-resizable");

    fireEvent.keyDown(resizeHandle, { key: "ArrowRight" });
    fireEvent.keyDown(resizeHandle, { key: "ArrowDown" });

    expect(dialog).toHaveStyle({ width: "636px", height: "696px" });
    expect(localStorage.getItem("devnote:modal-size:test-dialog")).toBe(JSON.stringify({ width: 636, height: 696 }));
  });

  it("저장된 크기를 다시 열 때 복원하고 핸들 더블클릭으로 초기화한다", () => {
    localStorage.setItem("devnote:modal-size:restore-dialog", JSON.stringify({ width: 740, height: 520 }));

    render(
      <ModalDialog
        isOpen
        title="크기 복원 예제"
        resizable
        resizeStorageKey="restore-dialog"
        onRequestClose={vi.fn()}
      >
        <p>내용</p>
      </ModalDialog>,
    );

    const dialog = screen.getByRole("dialog");
    const resizeHandle = screen.getByRole("button", { name: "크기 복원 예제 모달 크기 조절" });
    expect(dialog).toHaveStyle({ width: "740px", height: "520px" });

    fireEvent.doubleClick(resizeHandle);

    expect(dialog.style.width).toBe("");
    expect(dialog.style.height).toBe("");
    expect(localStorage.getItem("devnote:modal-size:restore-dialog")).toBeNull();
  });

  it("핸들을 드래그하면 포인터 이동 거리만큼 가로와 세로 크기가 바뀐다", () => {
    render(
      <ModalDialog isOpen title="드래그 예제" resizable onRequestClose={vi.fn()}>
        <p>내용</p>
      </ModalDialog>,
    );

    const dialog = screen.getByRole("dialog");
    const resizeHandle = screen.getByRole("button", { name: "드래그 예제 모달 크기 조절" });
    fireEvent.pointerDown(resizeHandle, { pointerId: 7, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(resizeHandle, { pointerId: 7, clientX: 140, clientY: 130 });
    fireEvent.pointerUp(resizeHandle, { pointerId: 7, clientX: 140, clientY: 130 });

    expect(dialog).toHaveStyle({ width: "660px", height: "710px" });
  });

  it("옵션을 사용하지 않는 확인용 모달에는 크기 조절 핸들을 만들지 않는다", () => {
    render(
      <ModalDialog isOpen title="일반 모달" onRequestClose={vi.fn()}>
        <p>내용</p>
      </ModalDialog>,
    );

    expect(screen.getByRole("dialog")).not.toHaveClass("modal-dialog-resizable");
    expect(screen.queryByRole("button", { name: "일반 모달 모달 크기 조절" })).not.toBeInTheDocument();
  });
});
