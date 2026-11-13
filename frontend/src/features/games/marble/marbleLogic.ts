import { stepSeededRandom } from "@/features/games/shared/random";

type TileKind = "CITY" | "START" | "ISLAND" | "BONUS" | "TAX" | "CHANCE";
export interface MarbleTile { name: string; kind: TileKind; price: number; rent: number }
const city = (name: string, price: number, rent: number): MarbleTile => ({ name, kind: "CITY", price, rent });
const special = (name: string, kind: TileKind): MarbleTile => ({ name, kind, price: 0, rent: 0 });
export const marbleTiles: readonly MarbleTile[] = [
  special("출발", "START"), city("제주", 16, 5), city("부산", 20, 6), special("행운 카드", "CHANCE"), city("도쿄", 24, 8),
  special("무인도", "ISLAND"), city("방콕", 22, 7), city("시드니", 28, 9), special("행운 카드", "CHANCE"), city("싱가포르", 30, 10),
  special("휴양지", "BONUS"), city("로마", 32, 11), city("파리", 34, 12), special("행운 카드", "CHANCE"), city("런던", 36, 13),
  special("세금", "TAX"), city("뉴욕", 38, 14), city("서울", 40, 16), special("행운 카드", "CHANCE"), city("두바이", 36, 13),
];
export interface MarblePlayer { name: string; computer: boolean; cash: number; position: number; skip: boolean; bankrupt: boolean }
export interface MarbleProperty { owner: number | null; level: number }
export interface MarbleState {
  players: MarblePlayer[];
  properties: MarbleProperty[];
  turn: number;
  turnsPlayed: number;
  phase: "ROLL" | "DECIDE" | "END" | "OVER";
  dice: [number, number] | null;
  randomState: number;
  winners: number[];
  log: string[];
}
export type MarbleAction = { type: "ROLL" | "BUY" | "UPGRADE" | "END"; seat: number } | { type: "SELL"; seat: number; tile: number };
export const MARBLE_SALARY = 30;
export const MARBLE_ROUNDS = 20;
export const propertyValue = (index: number, level: number) => (marbleTiles[index]?.price ?? 0) + Math.floor((marbleTiles[index]?.price ?? 0) / 2) * level;
export const propertyRent = (index: number, level: number) => (marbleTiles[index]?.rent ?? 0) * (level + 1);
export const marbleAssets = (state: Pick<MarbleState, "players" | "properties">, seat: number) => (state.players[seat]?.cash ?? 0)
  + state.properties.reduce((total, property, index) => total + (property.owner === seat ? propertyValue(index, property.level) : 0), 0);

export function createMarbleGame(computers: number, seed: number): MarbleState {
  if (!Number.isInteger(computers) || computers < 1 || computers > 3) throw new Error("컴퓨터는 1~3명으로 선택해 주세요.");
  return { players: Array.from({ length: computers + 1 }, (_, index) => ({ name: index === 0 ? "나" : `컴퓨터 ${index}`, computer: index !== 0,
    cash: 150, position: 0, skip: false, bankrupt: false })), properties: marbleTiles.map(() => ({ owner: null, level: 0 })), turn: 0, turnsPlayed: 0,
  phase: "ROLL", dice: null, randomState: seed >>> 0, winners: [], log: ["각자 150만원으로 출발합니다. 출발을 지나면 30만원을 받습니다."] };
}

const message = (state: MarbleState, text: string) => { state.log = [...state.log.slice(-6), text]; };
const draw = (state: MarbleState, max: number) => {
  const result = stepSeededRandom(state.randomState); state.randomState = result.nextState; return Math.floor(result.value * max);
};

/** 규칙 함수 안에서 만든 복사본만 바꾼다. 납부금 부족 시 땅을 반값에 자동 매각한 뒤 지급한다. */
function pay(state: MarbleState, seat: number, amount: number, receiver: number | null) {
  const player = state.players[seat];
  if (!player) return;
  for (let index = 0; index < state.properties.length && player.cash < amount; index += 1) {
    const property = state.properties[index];
    if (property?.owner !== seat) continue;
    player.cash += Math.floor(propertyValue(index, property.level) / 2);
    state.properties[index] = { owner: null, level: 0 };
    message(state, `${player.name}: ${marbleTiles[index]?.name}을 반값에 자동 매각했습니다.`);
  }
  const paid = Math.min(amount, player.cash);
  player.cash -= paid;
  const recipient = receiver === null ? undefined : state.players[receiver];
  if (recipient) recipient.cash += paid;
  if (paid < amount) { player.bankrupt = true; message(state, `${player.name}: 납부금이 부족해 파산했습니다.`); }
}

function endTurn(state: MarbleState) {
  state.turnsPlayed += 1;
  const alive = state.players.flatMap((player, seat) => player.bankrupt ? [] : [seat]);
  if (alive.length <= 1 || state.turnsPlayed >= MARBLE_ROUNDS * state.players.length) {
    const best = Math.max(...alive.map((seat) => marbleAssets(state, seat)));
    state.winners = alive.filter((seat) => marbleAssets(state, seat) === best);
    state.phase = "OVER";
    message(state, `게임 종료! ${state.winners.map((seat) => state.players[seat]?.name).join(", ")} 승리`);
    return;
  }
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const seat = (state.turn + offset) % state.players.length;
    if (state.players[seat]?.bankrupt) continue;
    state.turn = seat; state.phase = "ROLL"; state.dice = null; return;
  }
}

export function marbleReducer(previous: MarbleState, action: MarbleAction): MarbleState {
  const current = previous.players[previous.turn];
  if (previous.phase === "OVER" || action.seat !== previous.turn || !current) return previous;
  if (action.type === "ROLL" && previous.phase !== "ROLL") return previous;
  if ((action.type === "BUY" || action.type === "UPGRADE") && previous.phase !== "DECIDE") return previous;
  if (action.type === "END" && previous.phase !== "DECIDE" && previous.phase !== "END") return previous;
  if (action.type === "SELL" && (previous.phase === "DECIDE" || current.bankrupt || !Number.isInteger(action.tile)
    || previous.properties[action.tile]?.owner !== action.seat)) return previous;
  const state: MarbleState = { ...previous, players: previous.players.map((player) => ({ ...player })),
    properties: previous.properties.map((property) => ({ ...property })), log: [...previous.log] };
  const player = state.players[state.turn];
  if (!player) return previous;
  const tile = marbleTiles[player.position];
  const property = state.properties[player.position];
  if (action.type === "END") { endTurn(state); return state; }
  if (action.type === "SELL") {
    const value = state.properties[action.tile];
    if (!value) return previous;
    player.cash += Math.floor(propertyValue(action.tile, value.level) / 2);
    state.properties[action.tile] = { owner: null, level: 0 };
    message(state, `${player.name}: ${marbleTiles[action.tile]?.name}을 매각했습니다.`);
    return state;
  }
  if (action.type === "BUY") {
    if (!tile || !property || tile.kind !== "CITY" || property.owner !== null || player.cash < tile.price) return previous;
    player.cash -= tile.price; property.owner = state.turn; state.phase = "END";
    message(state, `${player.name}: ${tile.name}을 ${tile.price}만원에 샀습니다.`); return state;
  }
  if (action.type === "UPGRADE") {
    if (!tile || !property || property.owner !== state.turn || property.level >= 3 || player.cash < Math.floor(tile.price / 2)) return previous;
    player.cash -= Math.floor(tile.price / 2); property.level += 1; state.phase = "END";
    message(state, `${player.name}: ${tile.name}을 ${property.level}단계로 개발했습니다.`); return state;
  }
  if (player.skip) { player.skip = false; state.phase = "END"; message(state, `${player.name}: 무인도에서 한 차례 쉽니다.`); return state; }
  state.dice = [draw(state, 6) + 1, draw(state, 6) + 1];
  const distance = state.dice[0] + state.dice[1];
  if (player.position + distance >= marbleTiles.length) { player.cash += MARBLE_SALARY; message(state, `${player.name}: 출발 통과! ${MARBLE_SALARY}만원을 받았습니다.`); }
  player.position = (player.position + distance) % marbleTiles.length;
  const landed = marbleTiles[player.position];
  const owned = state.properties[player.position];
  state.phase = "END";
  message(state, `${player.name}: 주사위 ${state.dice.join(" + ")} → ${landed?.name}`);
  if (!landed || !owned) return state;
  if (landed.kind === "CITY") {
    if (owned.owner === null || (owned.owner === state.turn && owned.level < 3)) state.phase = "DECIDE";
    else if (owned.owner !== state.turn) {
      const rent = propertyRent(player.position, owned.level);
      message(state, `${player.name}: 통행료 ${rent}만원이 청구되었습니다.`);
      pay(state, state.turn, rent, owned.owner);
    }
  } else if (landed.kind === "ISLAND") { player.skip = true; message(state, `${player.name}: 무인도 도착. 다음 차례에 한 번 쉽니다.`); }
  else if (landed.kind === "BONUS") { player.cash += 20; message(state, `${player.name}: 휴양지 보너스 20만원!`); }
  else if (landed.kind === "TAX") { pay(state, state.turn, 20, null); message(state, `${player.name}: 세금 20만원을 납부했습니다.`); }
  else if (landed.kind === "CHANCE") {
    const bonus = draw(state, 2) === 0;
    if (bonus) player.cash += 20; else pay(state, state.turn, 15, null);
    message(state, bonus ? `${player.name}: 행운의 보너스 20만원!` : `${player.name}: 수리비 15만원을 납부합니다.`);
  }
  return state;
}

export function marbleComputerAction(state: MarbleState): MarbleAction {
  const player = state.players[state.turn];
  if (state.phase === "ROLL") return { type: "ROLL", seat: state.turn };
  const tile = marbleTiles[player?.position ?? 0];
  const property = state.properties[player?.position ?? 0];
  if (state.phase === "DECIDE" && player && tile && property) {
    if (property.owner === null && player.cash >= tile.price + 25) return { type: "BUY", seat: state.turn };
    if (property.owner === state.turn && property.level < 3 && player.cash >= Math.floor(tile.price / 2) + 40) return { type: "UPGRADE", seat: state.turn };
  }
  return { type: "END", seat: state.turn };
}
