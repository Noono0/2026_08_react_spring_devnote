import {
  BOX_HEIGHT, BOX_WIDTH, createWorld, dropFruit, FRUITS, MERGE_SCORES, randomLevel, stepWorld, updateDanger, type Fruit, type SuikaWorld,
} from "@/features/games/suika/suikaLogic";

/** 1/120초씩 seconds초 동안 흘린다 */
const run = (world: SuikaWorld, seconds: number) => {
  let next = world;
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) next = stepWorld(next, 1 / 60);
  return next;
};

describe("suikaLogic", () => {
  it("떨어뜨린 과일은 바닥에 닿아 멈추고 상자 밖으로 나가지 않는다", () => {
    const world = run(dropFruit(createWorld(), 2, 5), 3);
    const fruit = world.fruits[0]!;
    const radius = FRUITS[2]!.radius;
    expect(fruit.x).toBeCloseTo(radius, 0); // 벽 안쪽으로 맞춰짐
    expect(fruit.y).toBeCloseTo(BOX_HEIGHT - radius, 0);
    expect(world.over).toBe(false);
  });

  it("같은 과일 두 개가 닿으면 한 단계 큰 과일 하나가 되고 점수를 얻는다", () => {
    let world = dropFruit(createWorld(), 0, 200);
    world = run(world, 1);
    world = dropFruit(world, 0, 205);
    world = run(world, 2);
    expect(world.fruits).toHaveLength(1);
    expect(world.fruits[0]?.level).toBe(1);
    expect(world.score).toBe(MERGE_SCORES[1]);
  });

  it("다른 과일은 합쳐지지 않고 서로 밀어낸다", () => {
    let world = run(dropFruit(createWorld(), 0, 200), 1);
    world = run(dropFruit(world, 1, 200), 2);
    expect(world.fruits).toHaveLength(2);
    const [a, b] = world.fruits;
    const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
    expect(distance).toBeGreaterThan(FRUITS[0]!.radius + FRUITS[1]!.radius - 2);
  });

  it("같은 x에 떨어뜨려도 위에 탑처럼 서 있지 않고 옆으로 굴러떨어진다", () => {
    let world = run(dropFruit(createWorld(), 2, 200), 1);
    world = run(dropFruit(world, 1, 200), 4);
    const [bottom, top] = world.fruits;
    // 둘 다 바닥 근처까지 내려와 나란히 놓인다(위에 얹혀 있으면 y 차이가 반지름 합만큼 난다)
    expect(Math.abs(bottom!.y - top!.y)).toBeLessThan(FRUITS[2]!.radius);
  });

  it("받은 world는 바꾸지 않는다", () => {
    const world = dropFruit(createWorld(), 3, 100);
    const before = JSON.stringify(world);
    stepWorld(world, 1 / 60);
    expect(JSON.stringify(world)).toBe(before);
  });

  it("떨어뜨린 지 조금 지난 과일이 위험선 위에 1.5초 넘게 있으면 끝난다", () => {
    const stuck: Fruit = { id: 1, level: 3, x: 200, y: 60, vx: 0, vy: 0, ageMs: 5_000, overLineMs: 0 };
    let state = updateDanger([stuck], 1_000);
    expect(state.over).toBe(false);
    expect(state.fruits[0]?.overLineMs).toBe(1_000);
    state = updateDanger(state.fruits, 600);
    expect(state.over).toBe(true);

    // 방금 떨어뜨린 과일(1.2초 이내)은 선 위에 있어도 세지 않는다
    const justDropped: Fruit = { ...stuck, ageMs: 100 };
    expect(updateDanger([justDropped], 5_000).over).toBe(false);
    // 선 아래로 내려오면 시간이 0으로 돌아간다
    expect(updateDanger([{ ...stuck, y: 400, overLineMs: 1_400 }], 100).fruits[0]?.overLineMs).toBe(0);
  });

  it("떨어뜨릴 과일은 체리~감(0~4단계)이다", () => {
    expect(randomLevel(() => 0)).toBe(0);
    expect(randomLevel(() => 0.999)).toBe(4);
    expect(BOX_WIDTH).toBeGreaterThan(FRUITS[10]!.radius * 2);
  });
});
