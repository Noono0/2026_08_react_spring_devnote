import { aimFromPull, aimLineEnd, framePositions, toBoardPoint } from "@/features/games/online/games/alkkagiRules";

describe("alkkagiRules", () => {
  const stone = { x: 500, y: 500 };

  it("아래로 당기면 위쪽(90도)으로, 왼쪽으로 당기면 오른쪽(0도)으로 날아간다", () => {
    expect(aimFromPull(stone, { x: 500, y: 650 })).toEqual({ angle: 90, power: 50 });
    expect(aimFromPull(stone, { x: 350, y: 500 })).toEqual({ angle: 0, power: 50 });
    expect(aimFromPull(stone, { x: 500, y: 350 }).angle).toBe(270);
  });

  it("힘은 5~100 사이로 맞춘다", () => {
    expect(aimFromPull(stone, { x: 500, y: 501 }).power).toBe(5);
    expect(aimFromPull(stone, { x: 500, y: 1500 }).power).toBe(100);
  });

  it("조준선은 각도 방향으로 힘에 비례해 뻗는다", () => {
    const end = aimLineEnd(stone, 90, 100);
    expect(end.x).toBeCloseTo(500);
    expect(end.y).toBeCloseTo(200);
  });

  it("화면 좌표를 판 좌표로 바꾸고, 프레임의 -1은 떨어진 알로 읽는다", () => {
    expect(toBoardPoint(150, 100, { left: 50, top: 0, width: 200, height: 200 })).toEqual({ x: 500, y: 500 });
    expect(framePositions([10, 20, -1, -1])).toEqual([{ x: 10, y: 20 }, null]);
  });
});
