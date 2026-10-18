import { countAlive, createPracticeStones, simulateFlick, type PhysicsStone } from "@/features/games/alkkagi/alkkagiPhysics";

// 서버 AlkkagiGameTest와 같은 상황으로 같은 결과가 나오는지 확인한다(규칙이 두 곳에 있으므로)
describe("alkkagiPhysics", () => {
  it("정면으로 세게 맞히면 상대 알이 떨어지고 쏜 알은 거의 멈춘다", () => {
    const stones: PhysicsStone[] = [{ side: 0, x: 500, y: 600, alive: true }, { side: 1, x: 500, y: 400, alive: true }];
    const result = simulateFlick(stones, 0, 90, 100);
    expect(result.stones[1]?.alive).toBe(false);
    expect(result.stones[0]?.alive).toBe(true);
    expect(stones[1]?.alive).toBe(true); // 입력 배열은 바뀌지 않는다
  });

  it("약하게 튕기면 약 200 이동하고, 첫 프레임은 처음 위치·마지막 프레임은 끝 위치다", () => {
    const stones: PhysicsStone[] = [{ side: 0, x: 500, y: 600, alive: true }, { side: 1, x: 500, y: 200, alive: true }];
    const result = simulateFlick(stones, 0, 0, 30);
    const moved = result.stones[0]!;
    expect(moved.x).toBeGreaterThan(650);
    expect(moved.x).toBeLessThan(750);
    expect(result.frames[0]).toEqual([500, 600, 500, 200]);
    expect(result.frames.at(-1)).toEqual([Math.round(moved.x), Math.round(moved.y), 500, 200]);
  });

  it("판 끝에서 밖으로 튕기면 내 알이 떨어진다", () => {
    const result = simulateFlick([{ side: 0, x: 960, y: 500, alive: true }], 0, 0, 60);
    expect(result.stones[0]?.alive).toBe(false);
    expect(result.frames.at(-1)).toEqual([-1, -1]);
  });

  it("연습 판은 흑 4개와 맞힐 백 6개로 시작한다", () => {
    const stones = createPracticeStones();
    expect(countAlive(stones, 0)).toBe(4);
    expect(countAlive(stones, 1)).toBe(6);
  });
});
