import { isFarEnough, toCanvasPoint, toDrawNumbers, wordHint } from "@/features/games/online/games/catchMindRules";
import { secondsLeft } from "@/features/games/online/games/deadline";

describe("catchMindRules", () => {
  // 화면에 500×375로 줄여 보이는 그림판(왼쪽 위 = 100, 50)
  const box = { left: 100, top: 50, width: 500, height: 375 };

  it("화면 좌표를 1000×750 그림판 좌표로 바꾼다", () => {
    expect(toCanvasPoint(100, 50, box)).toEqual({ x: 0, y: 0 });
    expect(toCanvasPoint(350, 237.5, box)).toEqual({ x: 500, y: 375 });
    expect(toCanvasPoint(600, 425, box)).toEqual({ x: 1000, y: 750 });
  });

  it("그림판 밖으로 나간 점은 가장자리 값으로 맞춘다", () => {
    expect(toCanvasPoint(0, 1000, box)).toEqual({ x: 0, y: 750 });
    expect(toCanvasPoint(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
  });

  it("DRAW 메시지 숫자는 [색, 굵기, x1, y1, ...] 순서다", () => {
    expect(toDrawNumbers(2, 8, [{ x: 1, y: 2 }, { x: 3, y: 4 }])).toEqual([2, 8, 1, 2, 3, 4]);
  });

  it("너무 가까운 점은 버린다", () => {
    expect(isFarEnough(undefined, { x: 0, y: 0 })).toBe(true);
    expect(isFarEnough({ x: 0, y: 0 }, { x: 2, y: 2 })).toBe(false);
    expect(isFarEnough({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(true);
  });

  it("마감 시각까지 남은 초를 올림으로 세고, 지나면 0이다", () => {
    expect(secondsLeft(10_000, 0)).toBe(10);
    expect(secondsLeft(10_000, 9_001)).toBe(1);
    expect(secondsLeft(10_000, 12_000)).toBe(0);
    expect(secondsLeft(null, 0)).toBeNull();
  });

  it("제시어 글자 수 힌트를 만든다", () => {
    expect(wordHint(3)).toBe("○○○ (3글자)");
  });
});
