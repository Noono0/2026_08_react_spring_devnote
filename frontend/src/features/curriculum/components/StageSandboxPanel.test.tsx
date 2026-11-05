/**
 * 사이트 안 편집기의 "미리보기에 적용" 버튼 테스트.
 * Sandpack은 CodeSandbox 서버로 번들링하므로, 부품을 가짜로 바꿔 "무엇을 부르고 무엇을 보여 주는지"만 확인한다.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applicationLogger } from "@/shared/logging/applicationLogger";
import StageSandboxPanel from "./StageSandboxPanel";

type Listener = (message: { type: string }) => void;

const sandpackMock = vi.hoisted(() => {
  const listeners = new Set<(message: { type: string }) => void>();
  const runSandpack = vi.fn<() => Promise<void>>();
  return {
    listeners,
    runSandpack,
    previewProps: vi.fn<(props: Record<string, unknown>) => void>(),
    sandpack: { runSandpack, resetAllFiles: vi.fn(), updateFile: vi.fn(), files: {} },
    listen: (listener: (message: { type: string }) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
});

vi.mock("@codesandbox/sandpack-react", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    SandpackProvider: Pass,
    SandpackLayout: Pass,
    SandpackCodeEditor: () => <div />,
    SandpackConsole: () => <div />,
    SandpackPreview: (props: Record<string, unknown>) => {
      sandpackMock.previewProps(props);
      return <div />;
    },
    useSandpack: () => ({ sandpack: sandpackMock.sandpack, listen: sandpackMock.listen }),
  };
});

const sendFromBundler = (type: string) => {
  act(() => {
    sandpackMock.listeners.forEach((listener: Listener) => listener({ type }));
  });
};

afterEach(() => {
  sandpackMock.runSandpack.mockReset();
  sandpackMock.previewProps.mockClear();
  sandpackMock.listeners.clear();
  vi.restoreAllMocks();
});

describe("사이트 안 편집기 — 미리보기에 적용", () => {
  it("미리보기 구석의 작은 새로고침 아이콘은 숨기고, 툴바에 큰 적용 버튼을 둔다", () => {
    render(<StageSandboxPanel sandboxId="memory-shuffle" />);
    expect(sandpackMock.previewProps).toHaveBeenLastCalledWith(expect.objectContaining({ showRefreshButton: false }));
    expect(screen.getByRole("button", { name: "미리보기에 적용" })).toBeEnabled();
  });

  it("누르면 지금 코드로 다시 실행하고, 번들러가 done을 보낼 때까지 적용하는 중으로 바뀐다", () => {
    sandpackMock.runSandpack.mockResolvedValue(undefined);
    render(<StageSandboxPanel sandboxId="memory-shuffle" />);

    fireEvent.click(screen.getByRole("button", { name: "미리보기에 적용" }));
    expect(sandpackMock.runSandpack).toHaveBeenCalledTimes(1);
    const pendingButton = screen.getByRole("button", { name: "적용하는 중…" });
    expect(pendingButton).toBeDisabled();
    expect(pendingButton).toHaveAttribute("aria-busy", "true");

    sendFromBundler("start");
    expect(screen.getByRole("button", { name: "적용하는 중…" })).toBeDisabled();
    sendFromBundler("done");
    expect(screen.getByRole("button", { name: "미리보기에 적용" })).toBeEnabled();
  });

  it("다시 실행하지 못하면 오류를 남기고 버튼을 되돌린다", async () => {
    const logError = vi.spyOn(applicationLogger, "error").mockImplementation(() => undefined);
    const failure = new Error("bundler unavailable");
    sandpackMock.runSandpack.mockRejectedValue(failure);
    render(<StageSandboxPanel sandboxId="memory-shuffle" />);

    fireEvent.click(screen.getByRole("button", { name: "미리보기에 적용" }));
    expect(await screen.findByRole("button", { name: "미리보기에 적용" })).toBeEnabled();
    expect(logError).toHaveBeenCalledWith("[StageSandboxPanel] 미리보기를 다시 실행하지 못했습니다.", { error: failure });
  });
});
