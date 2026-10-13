import { describe, expect, it } from "vitest";
import { formatMark, isBetterMark } from "@/features/games/olympic/olympicEvents";
import {
  applyInput,
  createEventState,
  HAMMER_SECTOR,
  HIGH_JUMP_ZONE,
  HURDLE_POSITIONS,
  LONG_JUMP_BOARD,
  raceProgress,
  stepEvent,
  type EventState,
} from "@/features/games/olympic/olympicLogic";

const DT = 1 / 60;
/** 출발 신호를 고정(2초)해 테스트가 늘 같게 */
const fixedRandom = () => 0.17;

/** seconds초 동안 초당 taps번 번갈아 누르며 진행. until이 참이 되면 멈춘다 */
const run = (state: EventState, seconds: number, taps: number, until: (state: EventState) => boolean = () => false) => {
  let tapClock = 0;
  for (let time = 0; time < seconds && !until(state); time += DT) {
    tapClock += DT;
    if (taps > 0 && tapClock >= 1 / taps && state.phase === "RUN") {
      tapClock = 0;
      applyInput(state, state.lastFoot === "LEFT" ? "RIGHT" : "LEFT");
    }
    stepEvent(state, DT);
  }
};

const waitFor = (state: EventState, phase: EventState["phase"]) => run(state, 30, 0, (current) => current.phase === phase);

/** 각도를 degrees만큼 올리고 뗀다(90°/초) */
const aim = (state: EventState, degrees: number) => {
  applyInput(state, "ACTION_DOWN");
  const start = state.angle;
  run(state, 2, 0, (current) => current.angle >= start + degrees || current.phase !== "AIM");
  applyInput(state, "ACTION_UP");
};

describe("올림픽 종목 계산", () => {
  it("기록 표시와 비교", () => {
    expect(formatMark("SPRINT_100", 10530)).toBe("10.53초");
    expect(formatMark("LONG_JUMP", 745)).toBe("7.45m");
    expect(formatMark("JAVELIN", null)).toBe("기록 없음");
    expect(isBetterMark("SPRINT_100", 10000, 11000)).toBe(true);
    expect(isBetterMark("HAMMER", 7000, 6000)).toBe(true);
    expect(isBetterMark("HAMMER", null, 10)).toBe(false);
  });

  it("100m: 신호 전에 두 번 누르면 실격", () => {
    const state = createEventState("SPRINT_100", fixedRandom);
    applyInput(state, "LEFT");
    expect(state.message).toContain("부정 출발");
    applyInput(state, "RIGHT");
    expect(state.phase).toBe("DONE");
    expect(state.mark).toBeNull();
  });

  it("100m: 빠르게 번갈아 누를수록 기록이 좋아지고, 같은 발 연타는 느리다", () => {
    const fast = createEventState("SPRINT_100", fixedRandom);
    waitFor(fast, "RUN");
    expect(raceProgress(fast)).toBe(0);
    run(fast, 40, 12, (state) => state.phase === "DONE");
    const slow = createEventState("SPRINT_100", fixedRandom);
    waitFor(slow, "RUN");
    run(slow, 40, 6, (state) => state.phase === "DONE");
    expect(fast.mark).not.toBeNull();
    expect(fast.mark ?? 0).toBeGreaterThan(9000);
    expect(fast.mark ?? 0).toBeLessThan(slow.mark ?? 0);

    const sameFoot = createEventState("SPRINT_100", fixedRandom);
    waitFor(sameFoot, "RUN");
    for (let index = 0; index < 10; index++) applyInput(sameFoot, "LEFT");
    expect(sameFoot.speed).toBeLessThan(1);
  });

  it("110m 허들: 뛰지 않으면 모두 걸리고, 제때 뛰면 넘는다", () => {
    const clumsy = createEventState("HURDLES_110", fixedRandom);
    waitFor(clumsy, "RUN");
    run(clumsy, 60, 12, (state) => state.phase === "DONE");
    expect(clumsy.hurdlesHit.every(Boolean)).toBe(true);

    const skilled = createEventState("HURDLES_110", fixedRandom);
    waitFor(skilled, "RUN");
    let tapClock = 0;
    for (let time = 0; time < 60 && skilled.phase !== "DONE"; time += DT) {
      tapClock += DT;
      if (tapClock >= 1 / 12) {
        tapClock = 0;
        applyInput(skilled, skilled.lastFoot === "LEFT" ? "RIGHT" : "LEFT");
      }
      // 허들 2m 앞에서 점프
      const next = HURDLE_POSITIONS.find((position) => position > skilled.x);
      if (next !== undefined && next - skilled.x < 2.2 && next - skilled.x > 1.6 && skilled.height <= 0) applyInput(skilled, "ACTION_DOWN");
      stepEvent(skilled, DT);
    }
    expect(skilled.hurdlesHit.filter(Boolean).length).toBeLessThanOrEqual(1);
    expect(skilled.mark ?? Infinity).toBeLessThan(clumsy.mark ?? 0);
  });

  it("멀리뛰기: 발판 앞에서 약 20°로 뛰면 좋은 기록, 발판을 넘으면 파울, 세 번 뒤 최고 기록", () => {
    const state = createEventState("LONG_JUMP", fixedRandom);
    waitFor(state, "RUN");
    run(state, 20, 12, (current) => current.x >= LONG_JUMP_BOARD - 0.5);
    aim(state, 20);
    waitFor(state, "ATTEMPT_RESULT");
    const first = state.attemptMarks[0] ?? 0;
    expect(first).toBeGreaterThan(550);
    expect(first).toBeLessThan(950);

    waitFor(state, "RUN");
    run(state, 20, 12, (current) => current.phase !== "RUN"); // 누르지 않고 지나침
    expect(state.attemptMarks[1]).toBeNull();

    waitFor(state, "RUN");
    run(state, 20, 12, (current) => current.x >= LONG_JUMP_BOARD - 0.5);
    aim(state, 60); // 너무 세우면 짧다
    waitFor(state, "ATTEMPT_RESULT");
    expect(state.attemptMarks[2] ?? 0).toBeLessThan(first);
    waitFor(state, "DONE");
    expect(state.mark).toBe(first);
  });

  it("창던지기: 40° 근처가 60°보다 멀리 간다", () => {
    const throwAt = (degrees: number) => {
      const state = createEventState("JAVELIN", fixedRandom);
      waitFor(state, "RUN");
      run(state, 20, 12, (current) => current.x >= 28);
      aim(state, degrees);
      waitFor(state, "ATTEMPT_RESULT");
      return state.attemptMarks[0] ?? 0;
    };
    const good = throwAt(40);
    expect(good).toBeGreaterThan(5000);
    expect(good).toBeGreaterThan(throwAt(65));
  });

  it("해머던지기: 앞을 향할 때 놓으면 기록, 옆으로 놓으면 파울", () => {
    const spinAndRelease = (inside: boolean) => {
      const state = createEventState("HAMMER", fixedRandom);
      waitFor(state, "RUN");
      run(state, 3, 12);
      // 원하는 방향이 될 때까지 계속 돌린다
      run(state, 5, 12, (current) => {
        const degrees = (((current.hammerAngle * 180) / Math.PI) % 360 + 540) % 360 - 180;
        return inside ? Math.abs(degrees) < HAMMER_SECTOR / 2 : Math.abs(degrees) > 90;
      });
      applyInput(state, "ACTION_DOWN");
      waitFor(state, "ATTEMPT_RESULT");
      return state.attemptMarks[0];
    };
    expect(spinAndRelease(true) ?? 0).toBeGreaterThan(3000);
    expect(spinAndRelease(false)).toBeNull();
  });

  it("높이뛰기: 구역에서 70° 전후로 뛰면 1.70m를 넘고 바가 5cm 올라간다", () => {
    const state = createEventState("HIGH_JUMP", fixedRandom);
    waitFor(state, "RUN");
    run(state, 20, 12, (current) => current.x >= HIGH_JUMP_ZONE[0] + 1.5);
    aim(state, 40); // 30°에서 시작 → 70°
    waitFor(state, "ATTEMPT_RESULT");
    expect(state.cleared).toBe(true);
    expect(state.bestHeight).toBe(170);
    expect(state.barHeight).toBe(175);
  });

  it("높이뛰기: 세 번 실패하면 끝나고 최고 기록을 남긴다", () => {
    const state = createEventState("HIGH_JUMP", fixedRandom);
    for (let attempt = 0; attempt < 3; attempt++) {
      waitFor(state, "RUN");
      run(state, 20, 12, (current) => current.phase !== "RUN"); // 지나쳐서 실패
      waitFor(state, attempt < 2 ? "READY" : "DONE");
    }
    expect(state.phase).toBe("DONE");
    expect(state.mark).toBeNull();
  });
});
