import { describe, expect, it } from "vitest";
import { canPlaceCue, nearestBallAngle, positionAt, previewAim, toMilliDegrees } from "@/features/games/online/games/billiards/billiardsAim";

const table = { length: 2844, width: 1422, radius: 30.75 };
const ball = (id: number, x: number, y: number, pocketed = false) => ({ id, x, y, pocketed });

describe("당구 조준 계산", () => {
  it("각도를 서버 값(1/1000도)으로 바꾼다", () => {
    expect(toMilliDegrees(90)).toBe(90_000);
    expect(toMilliDegrees(-0.5)).toBe(359_500);
    expect(toMilliDegrees(360)).toBe(0);
  });

  it("정면으로 공을 겨누면 고스트 볼은 두 지름 앞이고, 수구가 갈라질 방향은 없다", () => {
    const preview = previewAim(table, [ball(0, 500, 711), ball(2, 1500, 711)], 0, 0);
    expect(preview?.kind).toBe("BALL");
    if (preview?.kind !== "BALL") return;
    expect(preview.ghost.x).toBeCloseTo(1500 - 61.5);
    expect(preview.targetId).toBe(2);
    expect(preview.objectDirection.x).toBeCloseTo(1);
    expect(preview.cueDirection).toBeNull();
  });

  it("얇게 맞히면 맞은 공과 수구가 90°로 갈라진다", () => {
    const preview = previewAim(table, [ball(0, 500, 711), ball(2, 1500, 760)], 0, 0);
    if (preview?.kind !== "BALL") throw new Error("공에 닿아야 합니다");
    const { objectDirection, cueDirection } = preview;
    expect(cueDirection).not.toBeNull();
    expect(objectDirection.x * (cueDirection?.x ?? 0) + objectDirection.y * (cueDirection?.y ?? 0)).toBeCloseTo(0);
  });

  it("공이 없으면 쿠션에서 거울처럼 튕긴 경로를 그린다", () => {
    const preview = previewAim(table, [ball(0, 1422, 711)], 0, 45);
    expect(preview?.kind).toBe("CUSHION");
    const [, first, second] = preview?.path ?? [];
    expect(first?.y).toBeCloseTo(1422 - 30.75); // 위 레일(공 중심 기준)
    expect((second?.x ?? 0) > (first?.x ?? 0)).toBe(true);
  });

  it("가장 가까운 목표 공 쪽으로 처음 조준한다", () => {
    const balls = [ball(0, 500, 500), ball(1, 600, 500), ball(2, 500, 900)];
    expect(nearestBallAngle(balls, 0)).toBeCloseTo(0);
    expect(nearestBallAngle(balls, 0, [2])).toBeCloseTo(90);
  });

  it("수구는 테이블 안, 다른 공과 겹치지 않는 곳에만 놓는다", () => {
    const balls = [ball(0, 0, 0, true), ball(1, 1000, 500)];
    expect(canPlaceCue(table, balls, { x: 1030, y: 500 })).toBe(false);
    expect(canPlaceCue(table, balls, { x: 10, y: 500 })).toBe(false);
    expect(canPlaceCue(table, balls, { x: 600, y: 500 })).toBe(true);
  });

  it("궤적 프레임 사이를 이어 그리고, 들어간 공은 없앤다", () => {
    const frames = [[0, 0, 100, 100], [30, 60, -1, -1]];
    expect(positionAt(frames, 0, 50, 100)).toEqual({ x: 15, y: 30 });
    expect(positionAt(frames, 1, 50, 100)).toEqual({ x: 100, y: 100 });
    expect(positionAt(frames, 1, 150, 100)).toBeNull();
  });
});
