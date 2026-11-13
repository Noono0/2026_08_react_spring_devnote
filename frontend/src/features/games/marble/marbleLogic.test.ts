import { expect, it } from "vitest";
import { createMarbleGame, marbleAssets, marbleComputerAction, marbleReducer, MARBLE_ROUNDS, propertyRent, type MarbleState } from "./marbleLogic";

it("차례·단계를 검사하고 주사위 결과가 같은 시드에서 재현된다", () => {
  const state = createMarbleGame(2, 42);
  const original = structuredClone(state);
  expect(marbleReducer(state, { type: "ROLL", seat: 1 })).toBe(state);
  expect(marbleReducer(state, { type: "BUY", seat: 0 })).toBe(state);
  expect(marbleReducer(state, { type: "END", seat: 0 })).toBe(state);
  const rolled = marbleReducer(state, { type: "ROLL", seat: 0 });
  expect(rolled.dice).toEqual(marbleReducer(state, { type: "ROLL", seat: 0 }).dice);
  expect(rolled.dice?.every((value) => value >= 1 && value <= 6)).toBe(true);
  expect(marbleReducer(rolled, { type: "ROLL", seat: 0 })).toBe(rolled);
  expect(state).toEqual(original);
});

it("매입·개발·매각은 현금과 소유권을 함께 갱신하고 개발을 3단계로 제한한다", () => {
  const state = createMarbleGame(1, 1);
  state.players[0]!.position = 1; state.phase = "DECIDE";
  const bought = marbleReducer(state, { type: "BUY", seat: 0 });
  expect(bought.players[0]?.cash).toBe(134);
  expect(bought.properties[1]).toEqual({ owner: 0, level: 0 });
  expect(state.properties[1]?.owner).toBeNull();
  const developed = marbleReducer({ ...bought, phase: "DECIDE" }, { type: "UPGRADE", seat: 0 });
  expect(developed.players[0]?.cash).toBe(126);
  expect(developed.properties[1]?.level).toBe(1);
  expect(propertyRent(1, 1)).toBe(10);
  const maximum = { ...developed, phase: "DECIDE" as const, properties: developed.properties.map((property, index) => index === 1 ? { ...property, level: 3 } : property) };
  expect(marbleReducer(maximum, { type: "UPGRADE", seat: 0 })).toBe(maximum);
  const sold = marbleReducer(developed, { type: "SELL", seat: 0, tile: 1 });
  expect(sold.players[0]?.cash).toBe(138);
  expect(sold.properties[1]).toEqual({ owner: null, level: 0 });
  expect(marbleReducer(sold, { type: "SELL", seat: 0, tile: 1 })).toBe(sold);
});

it("자금이 없는 매입과 다른 사람의 땅 매각을 거부한다", () => {
  const state = createMarbleGame(1, 1);
  state.players[0]!.position = 1; state.players[0]!.cash = 0; state.phase = "DECIDE";
  expect(marbleReducer(state, { type: "BUY", seat: 0 })).toBe(state);
  state.phase = "ROLL"; state.properties[1]!.owner = 1;
  expect(marbleReducer(state, { type: "SELL", seat: 0, tile: 1 })).toBe(state);
});

it("출발 통과 보너스와 무인도 휴식을 처리한다", () => {
  const state = createMarbleGame(1, 42); state.players[0]!.position = 19;
  const result = marbleReducer(state, { type: "ROLL", seat: 0 });
  expect(result.players[0]?.cash).toBeGreaterThanOrEqual(160); // 행운 카드 지출까지 포함해도 출발 보너스가 남는다.
  const island = createMarbleGame(1, 42); island.players[0]!.skip = true;
  const rested = marbleReducer(island, { type: "ROLL", seat: 0 });
  expect(rested.players[0]?.position).toBe(0);
  expect(rested.players[0]?.skip).toBe(false);
  expect(rested.phase).toBe("END"); expect(rested.dice).toBeNull();
});

it("통행료 부족은 자동 매각 후 지급하고 자산도 부족하면 파산한다", () => {
  const first = createMarbleGame(1, 42);
  const landing = marbleReducer(first, { type: "ROLL", seat: 0 }).players[0]!.position;
  // 도착 칸이 도시인 시드를 골라 다른 플레이어의 땅으로 지정한다.
  let state: MarbleState | undefined;
  for (let seed = 0; seed < 100; seed += 1) {
    const candidate = createMarbleGame(1, seed);
    const rolled = marbleReducer(candidate, { type: "ROLL", seat: 0 });
    if (rolled.phase !== "DECIDE") continue;
    const position = rolled.players[0]!.position;
    candidate.properties[position] = { owner: 1, level: 3 };
    candidate.players[0]!.cash = 1;
    state = candidate; break;
  }
  expect(landing).toBeGreaterThan(0);
  expect(state).toBeDefined();
  if (!state) throw new Error("도시 도착 시드가 없습니다.");
  const out = marbleReducer(state, { type: "ROLL", seat: 0 });
  expect(out.players[0]?.cash).toBe(0); expect(out.players[0]?.bankrupt).toBe(true);
  expect(out.players[1]?.cash).toBe(151);
  const finished = marbleReducer(out, { type: "END", seat: 0 });
  expect(finished.phase).toBe("OVER"); expect(finished.winners).toEqual([1]);
  const withProperty = structuredClone(state); withProperty.properties[17] = { owner: 0, level: 3 };
  const paid = marbleReducer(withProperty, { type: "ROLL", seat: 0 });
  expect(paid.players[0]?.bankrupt).toBe(false);
  expect(paid.properties[17]?.owner).toBeNull();
  expect(paid.players[1]!.cash).toBeGreaterThan(150);
});

it("제한 라운드에서 총자산으로 승자를 결정하고 이후 입력을 무시한다", () => {
  const state = createMarbleGame(1, 1); state.phase = "END"; state.turnsPlayed = MARBLE_ROUNDS * 2 - 1;
  state.properties[1]!.owner = 1;
  const finished = marbleReducer(state, { type: "END", seat: 0 });
  expect(finished.winners).toEqual([1]); expect(marbleAssets(finished, 1)).toBe(166);
  expect(marbleReducer(finished, { type: "ROLL", seat: 0 })).toBe(finished);
});

it("여러 시드의 컴퓨터 게임이 종료하며 현금·소유권·원본의 불변성을 지킨다", () => {
  for (let seed = 0; seed < 30; seed += 1) {
    let state = createMarbleGame(3, seed);
    for (let action = 0; action < 600 && state.phase !== "OVER"; action += 1) {
      const original = structuredClone(state);
      const next = marbleReducer(state, marbleComputerAction(state));
      expect(state).toEqual(original); expect(next).not.toBe(state);
      expect(next.players.every((player) => player.cash >= 0)).toBe(true);
      expect(next.properties.every((property) => property.owner === null || !next.players[property.owner]?.bankrupt)).toBe(true);
      state = next;
    }
    expect(state.phase).toBe("OVER"); expect(state.winners.length).toBeGreaterThan(0);
  }
});
