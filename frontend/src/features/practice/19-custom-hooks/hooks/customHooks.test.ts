import { act, renderHook } from "@testing-library/react";
import { z } from "zod";
import { useDebouncedValue } from "@/features/practice/19-custom-hooks/hooks/useDebouncedValue";
import { useLocalStorageState } from "@/features/practice/19-custom-hooks/hooks/useLocalStorageState";
import { useOnlineStatus } from "@/features/practice/19-custom-hooks/hooks/useOnlineStatus";

const countSchema = z.number().int();

describe("useLocalStorageState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("값을 바꾸면 저장하고 다음에 다시 읽어 온다", () => {
    const { result, unmount } = renderHook(() => useLocalStorageState("practiceCount", 0, countSchema));
    act(() => result.current[1]((count) => count + 2));
    expect(localStorage.getItem("practiceCount")).toBe("2");
    unmount();

    const { result: reloaded } = renderHook(() => useLocalStorageState("practiceCount", 0, countSchema));
    expect(reloaded.current[0]).toBe(2);
  });

  it("저장된 값이 깨졌거나 모양이 다르면 초기값을 쓴다", () => {
    localStorage.setItem("practiceCount", "{broken");
    expect(renderHook(() => useLocalStorageState("practiceCount", 5, countSchema)).result.current[0]).toBe(5);
    localStorage.setItem("practiceCount", JSON.stringify("문자열"));
    expect(renderHook(() => useLocalStorageState("practiceCount", 5, countSchema)).result.current[0]).toBe(5);
  });
});

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("입력이 멈춘 뒤에만 새 값을 돌려준다", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), { initialProps: { value: "r" } });
    rerender({ value: "re" });
    act(() => { vi.advanceTimersByTime(200); });
    rerender({ value: "rea" });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe("r");

    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe("rea");
  });
});

describe("useOnlineStatus", () => {
  it("브라우저 online/offline 이벤트를 따라 바뀐다", () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    onLine.mockReturnValue(false);
    act(() => { window.dispatchEvent(new Event("offline")); });
    expect(result.current).toBe(false);
  });
});
