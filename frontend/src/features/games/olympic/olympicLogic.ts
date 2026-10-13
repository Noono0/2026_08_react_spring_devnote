/**
 * olympicLogic.ts — 올림픽 6종목의 움직임 계산(화면 없이 테스트할 수 있는 순수 로직)
 *
 * [왜 객체를 직접 바꾸나?]
 *   이 상태는 React State가 아니라 requestAnimationFrame 게임 루프가 ref에 들고 있는 "시뮬레이션 객체"다.
 *   1초에 60번 바뀌므로 매번 새 객체를 만들지 않고 직접 고친다. 화면 글자(HUD)는 이 객체를 가끔 읽어 React State로 옮긴다.
 *
 * [입력] LEFT·RIGHT = 번갈아 눌러 달리기(같은 발을 연달아 누르면 비틀거려 느려진다), ACTION_DOWN·ACTION_UP = 점프·던지기(누른 채 각도).
 * [시간] stepEvent(state, dt)로 dt초만큼 진행한다. 출발 신호 시각만 난수(random)로 정한다.
 * [결과] 종목이 끝나면 phase = DONE, mark = 기록(밀리초 또는 센티미터, 기록 없으면 null).
 */
import type { OlympicEventId } from "@/features/games/olympic/olympicEvents";

export type OlympicInput = "LEFT" | "RIGHT" | "ACTION_DOWN" | "ACTION_UP";

export type EventPhase =
  | "READY" // 출발 신호 기다림(달리기) 또는 시도 준비
  | "RUN" // 달리는 중(해머는 회전 중)
  | "AIM" // 스페이스를 누른 채 각도를 올리는 중
  | "FLIGHT" // 점프·던진 물체가 날아가는 중
  | "ATTEMPT_RESULT" // 한 시도의 결과를 잠깐 보여 줌
  | "DONE";

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface EventState {
  event: OlympicEventId;
  phase: EventPhase;
  /** 이 단계에 들어온 뒤 지난 시간(초) */
  phaseTime: number;
  /** 달리기 종목: 출발 신호 뒤 지난 시간(초) = 기록 */
  raceTime: number;
  /** 출발 신호까지의 시간(초) */
  goDelay: number;
  falseStarts: number;
  x: number;
  speed: number;
  lastFoot: "LEFT" | "RIGHT" | null;
  /** 점프 높이(m, 허들·멀리뛰기·높이뛰기 선수) */
  height: number;
  verticalSpeed: number;
  /** 허들: 넘어진 허들 */
  hurdlesHit: boolean[];
  /** 각도(도) */
  angle: number;
  /** 발을 구른(던진) 자리 */
  takeoffX: number;
  /** 던진 창·해머(해머는 위에서 본 x·y + 높이 z를 y에) */
  projectile: Projectile | null;
  /** 해머: 회전 각도(라디안)·각속도(rad/s)·놓은 방향(도) */
  hammerAngle: number;
  omega: number;
  releaseDirection: number;
  attempt: number;
  /** 시도별 기록(cm). 파울·실패는 null */
  attemptMarks: (number | null)[];
  /** 높이뛰기 */
  barHeight: number;
  barFails: number;
  bestHeight: number | null;
  /** 높이뛰기: 이번 점프의 최고 높이(m)와 성공 여부 */
  jumpPeak: number;
  cleared: boolean | null;
  message: string;
  mark: number | null;
}

// ── 상수 ──────────────────────────────────────────────────────
export const G = 9.81;
const VMAX = 12;
const TAP_GAIN = 0.62;
const STUMBLE = 0.35;
export const SPRINT_DISTANCE = 100;
export const HURDLES_DISTANCE = 110;
/** 110m 허들: 첫 허들 13.72m, 간격 9.14m, 10개 */
export const HURDLE_POSITIONS = Array.from({ length: 10 }, (_, index) => 13.72 + index * 9.14);
const HURDLE_AIR_TIME = 0.6;
export const LONG_JUMP_BOARD = 40;
export const JAVELIN_LINE = 30;
export const HIGH_JUMP_BAR_X = 16;
export const HIGH_JUMP_ZONE: readonly [number, number] = [11, 14.5];
const HIGH_JUMP_MAX_SPEED = 8;
const HAMMER_LIMIT_SECONDS = 10;
/** 해머 던지기 부채꼴 반각(도). 실제 경기는 34.92°의 절반 */
export const HAMMER_SECTOR = 17.46;
const RESULT_PAUSE = 1.6;
const MAX_AIM_SECONDS = 0.9;

const isRaceEvent = (event: OlympicEventId) => event === "SPRINT_100" || event === "HURDLES_110";

export const createEventState = (event: OlympicEventId, random: () => number = Math.random): EventState => ({
  event,
  phase: "READY",
  phaseTime: 0,
  raceTime: 0,
  goDelay: isRaceEvent(event) ? 1.8 + random() * 1.2 : 0.8,
  falseStarts: 0,
  x: 0,
  speed: 0,
  lastFoot: null,
  height: 0,
  verticalSpeed: 0,
  hurdlesHit: HURDLE_POSITIONS.map(() => false),
  angle: 0,
  takeoffX: 0,
  projectile: null,
  hammerAngle: 0,
  omega: 0,
  releaseDirection: 0,
  attempt: 0,
  attemptMarks: [],
  barHeight: 170,
  barFails: 0,
  bestHeight: null,
  jumpPeak: 0,
  cleared: null,
  message: isRaceEvent(event) ? "제자리에…" : "준비",
  mark: null,
});

const setPhase = (state: EventState, phase: EventPhase, message?: string) => {
  state.phase = phase;
  state.phaseTime = 0;
  if (message !== undefined) state.message = message;
};

/** 번갈아 누르면 빨라진다(최고 속도에 가까울수록 덜 빨라짐). 같은 발 연타는 비틀거림 */
const tap = (state: EventState, foot: "LEFT" | "RIGHT", maxSpeed = VMAX) => {
  if (state.lastFoot === foot) {
    state.speed = Math.max(0, state.speed - STUMBLE);
  } else {
    state.speed = Math.min(maxSpeed, state.speed + TAP_GAIN * (1 - state.speed / maxSpeed) * (maxSpeed / VMAX) + 0.05);
  }
  state.lastFoot = foot;
};

/** 가만히 있으면 속도가 줄어든다 */
const decay = (state: EventState, dt: number) => {
  state.speed = Math.max(0, state.speed - (0.8 + 0.07 * state.speed) * dt);
};

// ── 입력 ──────────────────────────────────────────────────────

export const applyInput = (state: EventState, input: OlympicInput) => {
  if (state.phase === "DONE" || state.phase === "ATTEMPT_RESULT" || state.phase === "FLIGHT") return;
  const foot = input === "LEFT" || input === "RIGHT" ? input : null;
  switch (state.event) {
    case "SPRINT_100":
    case "HURDLES_110":
      if (state.phase === "READY") {
        if (foot) falseStart(state);
        return;
      }
      if (foot && state.height <= 0) tap(state, foot);
      if (input === "ACTION_DOWN" && state.event === "HURDLES_110" && state.height <= 0) {
        state.verticalSpeed = (G * HURDLE_AIR_TIME) / 2;
        state.height = 0.0001;
        state.speed *= 0.97;
      }
      return;
    case "HAMMER":
      if (state.phase !== "RUN") return;
      if (foot) {
        // 번갈아 누를수록 회전이 빨라진다(최고 16 rad/s)
        if (state.lastFoot === foot) state.omega = Math.max(0, state.omega - 0.6);
        else state.omega = Math.min(16, state.omega + 0.55 * (1 - state.omega / 16) + 0.05);
        state.lastFoot = foot;
      }
      if (input === "ACTION_DOWN") releaseHammer(state);
      return;
    default: {
      // 멀리뛰기·창던지기·높이뛰기: 달리다 스페이스를 누르면 각도, 떼면 점프·던지기
      if (state.phase === "RUN") {
        if (foot) tap(state, foot, state.event === "HIGH_JUMP" ? HIGH_JUMP_MAX_SPEED : VMAX);
        if (input === "ACTION_DOWN") startAim(state);
      } else if (state.phase === "AIM" && input === "ACTION_UP") {
        launch(state);
      }
    }
  }
};

const falseStart = (state: EventState) => {
  state.falseStarts++;
  if (state.falseStarts >= 2) {
    finish(state, null, "부정 출발 두 번 — 실격");
    return;
  }
  state.phaseTime = 0;
  state.message = "부정 출발! 한 번 더 하면 실격입니다";
};

const startAim = (state: EventState) => {
  if (state.event === "HIGH_JUMP" && state.x < HIGH_JUMP_ZONE[0]) {
    state.message = "너무 일찍 눌렀습니다 — 노란 칸에서 누르세요";
    return;
  }
  state.takeoffX = state.x;
  state.angle = state.event === "HIGH_JUMP" ? 30 : 0;
  setPhase(state, "AIM", "각도를 올리는 중… 떼면 점프!");
};

/** 각도를 정해 뛰거나 던진다 */
const launch = (state: EventState) => {
  const radians = (state.angle * Math.PI) / 180;
  if (state.event === "LONG_JUMP") {
    // 발로 차오르는 힘에는 한계가 있어(수직 속도 최대 3.4m/s) 각도를 너무 세우면 오히려 짧아진다
    state.verticalSpeed = Math.min(state.speed * Math.sin(radians), 3.4);
    state.projectile = { x: state.takeoffX, y: 0, vx: state.speed * Math.cos(radians), vy: state.verticalSpeed };
    setPhase(state, "FLIGHT", `${state.angle.toFixed(0)}°로 점프!`);
  } else if (state.event === "JAVELIN") {
    // 창은 달리는 힘 + 팔 힘. 40°보다 세우면 공기 저항으로 앞으로 덜 간다
    const release = Math.min(29.5, 2.4 * state.speed + 4.5);
    const aero = state.angle > 40 ? Math.max(0.3, 1 - (state.angle - 40) / 70) : 1;
    state.projectile = { x: state.takeoffX, y: 1.8, vx: release * Math.cos(radians) * aero, vy: release * Math.sin(radians) };
    setPhase(state, "FLIGHT", `${state.angle.toFixed(0)}°로 던짐!`);
  } else if (state.event === "HIGH_JUMP") {
    const vertical = 0.62 * state.speed * Math.sin(radians) + 0.9;
    const horizontal = state.speed * Math.cos(radians);
    // 너무 수직으로 뛰면 앞으로 넘어가지 못해 몸이 바에 걸린다
    const penalty = horizontal < 2.5 ? (2.5 - horizontal) * 0.35 : 0;
    state.jumpPeak = 0.95 + (0.9 * vertical * vertical) / (2 * G) + 0.1 - penalty;
    state.cleared = state.jumpPeak * 100 >= state.barHeight;
    state.verticalSpeed = vertical;
    state.projectile = { x: state.takeoffX, y: 0, vx: Math.max(1.2, horizontal), vy: vertical };
    setPhase(state, "FLIGHT", `${state.angle.toFixed(0)}°로 점프!`);
  }
};

const releaseHammer = (state: EventState) => {
  // 회전 각 0 = 앞쪽. -180~180도로 바꿔 부채꼴 안인지 본다
  const degrees = (((state.hammerAngle * 180) / Math.PI) % 360 + 540) % 360 - 180;
  state.releaseDirection = degrees;
  // 놓는 속도 = 회전 속도 × 회전 반지름(1.75m). 최고 회전이면 약 28m/s → 80m 안팎
  const speed = state.omega * 1.75;
  const launchAngle = (42 * Math.PI) / 180;
  state.projectile = { x: 0, y: 0, vx: speed * Math.cos(launchAngle), vy: speed * Math.sin(launchAngle) };
  setPhase(state, "FLIGHT", Math.abs(degrees) <= HAMMER_SECTOR ? "놓았다!" : "방향이 빗나갔다!");
};

// ── 시간 진행 ────────────────────────────────────────────────

export const stepEvent = (state: EventState, dt: number) => {
  if (state.phase === "DONE") return;
  state.phaseTime += dt;
  switch (state.event) {
    case "SPRINT_100":
    case "HURDLES_110":
      stepRace(state, dt);
      return;
    case "HAMMER":
      stepHammer(state, dt);
      return;
    default:
      stepField(state, dt);
  }
};

const stepRace = (state: EventState, dt: number) => {
  if (state.phase === "READY") {
    if (state.phaseTime >= state.goDelay - 1) state.message = "차렷…";
    if (state.phaseTime >= state.goDelay) setPhase(state, "RUN", "출발!");
    return;
  }
  state.raceTime += dt;
  const previousX = state.x;
  if (state.height > 0) {
    state.verticalSpeed -= G * dt;
    state.height = Math.max(0, state.height + state.verticalSpeed * dt);
  } else {
    decay(state, dt);
  }
  state.x += state.speed * dt;
  if (state.event === "HURDLES_110") {
    HURDLE_POSITIONS.forEach((position, index) => {
      // 허들을 지나는 순간 몸(무게중심)이 0.35m 넘게 떠 있지 않으면 걸린다
      if (previousX < position && state.x >= position && state.height < 0.35 && !state.hurdlesHit[index]) {
        state.hurdlesHit[index] = true;
        state.speed *= 0.55;
        state.message = "허들에 걸렸다!";
      }
    });
  }
  const distance = state.event === "SPRINT_100" ? SPRINT_DISTANCE : HURDLES_DISTANCE;
  if (state.x >= distance) {
    // 결승선을 넘은 정확한 시각(마지막 걸음 안에서 비례로)
    const overshoot = state.speed > 0 ? (state.x - distance) / state.speed : 0;
    const time = state.raceTime - overshoot;
    finish(state, Math.round(time * 1000), "골인!");
  } else if (state.raceTime > 60) {
    finish(state, null, "시간 초과");
  }
};

const stepField = (state: EventState, dt: number) => {
  if (state.phase === "READY") {
    if (state.phaseTime >= state.goDelay) setPhase(state, "RUN", "달려라!");
    return;
  }
  if (state.phase === "RUN") {
    decay(state, dt);
    state.x += state.speed * dt;
    const limit = state.event === "LONG_JUMP" ? LONG_JUMP_BOARD + 1 : state.event === "JAVELIN" ? JAVELIN_LINE + 1 : HIGH_JUMP_ZONE[1];
    if (state.x > limit) {
      if (state.event === "HIGH_JUMP") endHighJump(state, false, "발 구름 구역을 지나쳤다");
      else endAttempt(state, null, "선을 넘었다 — 파울");
    }
    else if (state.phaseTime > 20) endAttempt(state, null, "시간 초과 — 파울");
    return;
  }
  if (state.phase === "AIM") {
    state.angle = Math.min(state.event === "HIGH_JUMP" ? 88 : 75, state.angle + 90 * dt);
    if (state.phaseTime >= MAX_AIM_SECONDS) launch(state);
    return;
  }
  if (state.phase === "FLIGHT" && state.projectile) {
    const projectile = state.projectile;
    projectile.vy -= G * dt;
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    if (state.event !== "JAVELIN") state.x = projectile.x;
    state.height = Math.max(0, projectile.y);
    if (state.event === "HIGH_JUMP") {
      if (projectile.y <= 0 && projectile.vy < 0) {
        endHighJump(state, state.cleared === true);
      }
      return;
    }
    if (projectile.y <= 0 && projectile.vy < 0) {
      // 땅에 닿은 정확한 x(마지막 걸음 안에서 비례)
      const back = projectile.vy !== 0 ? projectile.y / projectile.vy : 0;
      const landX = projectile.x - projectile.vx * back;
      const line = state.event === "LONG_JUMP" ? LONG_JUMP_BOARD : JAVELIN_LINE;
      // 멀리뛰기는 몸이 앞으로 뻗어 착지(0.6m)
      const distance = landX - line + (state.event === "LONG_JUMP" ? 0.6 : 0);
      const takeoffFoul = state.takeoffX > line;
      if (takeoffFoul) endAttempt(state, null, "발판을 밟고 넘었다 — 파울");
      else endAttempt(state, distance > 0 ? Math.round(distance * 100) : null, distance > 0 ? `${distance.toFixed(2)}m!` : "선보다 너무 앞에서 뛰었다 — 기록 없음");
    }
    return;
  }
  if (state.phase === "ATTEMPT_RESULT" && state.phaseTime >= RESULT_PAUSE) nextAttempt(state);
};

const stepHammer = (state: EventState, dt: number) => {
  if (state.phase === "READY") {
    if (state.phaseTime >= state.goDelay) setPhase(state, "RUN", "돌려라!");
    return;
  }
  if (state.phase === "RUN") {
    state.omega = Math.max(0, state.omega - 0.6 * dt);
    state.hammerAngle += state.omega * dt;
    if (state.phaseTime > HAMMER_LIMIT_SECONDS) endAttempt(state, null, "10초가 지났다 — 파울");
    return;
  }
  if (state.phase === "FLIGHT" && state.projectile) {
    const projectile = state.projectile;
    projectile.vy -= G * dt;
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    if (projectile.y <= 0 && projectile.vy < 0) {
      const back = projectile.y / projectile.vy;
      const distance = projectile.x - projectile.vx * back;
      if (Math.abs(state.releaseDirection) > HAMMER_SECTOR) endAttempt(state, null, "부채꼴 밖 — 파울");
      else endAttempt(state, Math.round(distance * 100), `${distance.toFixed(2)}m!`);
    }
    return;
  }
  if (state.phase === "ATTEMPT_RESULT" && state.phaseTime >= RESULT_PAUSE) nextAttempt(state);
};

const endAttempt = (state: EventState, mark: number | null, message: string) => {
  state.attemptMarks = [...state.attemptMarks, mark];
  setPhase(state, "ATTEMPT_RESULT", message);
};

const endHighJump = (state: EventState, cleared: boolean, reason = "바에 걸렸다") => {
  if (cleared) {
    state.bestHeight = state.barHeight;
    state.barFails = 0;
    state.attemptMarks = [...state.attemptMarks, state.barHeight];
    setPhase(state, "ATTEMPT_RESULT", `${(state.barHeight / 100).toFixed(2)}m 성공!`);
    state.barHeight += 5;
  } else {
    state.barFails++;
    state.attemptMarks = [...state.attemptMarks, null];
    setPhase(state, "ATTEMPT_RESULT", `${reason} — 실패 (${state.barFails}/3)`);
  }
};

const bestOf = (marks: (number | null)[]): number | null =>
  marks.reduce<number | null>((best, mark) => (mark !== null && (best === null || mark > best) ? mark : best), null);

const nextAttempt = (state: EventState) => {
  if (state.event === "HIGH_JUMP") {
    if (state.barFails >= 3 || state.barHeight > 260) {
      finish(state, state.bestHeight, state.bestHeight === null ? "기록 없음" : `최고 ${(state.bestHeight / 100).toFixed(2)}m`);
      return;
    }
  } else if (state.attemptMarks.length >= 3) {
    const best = bestOf(state.attemptMarks);
    finish(state, best, best === null ? "세 번 모두 파울" : `최고 ${(best / 100).toFixed(2)}m`);
    return;
  }
  // 다음 시도: 처음 자리로
  state.attempt = state.attemptMarks.length;
  state.x = 0;
  state.speed = 0;
  state.lastFoot = null;
  state.height = 0;
  state.projectile = null;
  state.hammerAngle = 0;
  state.omega = 0;
  state.angle = 0;
  state.cleared = null;
  setPhase(state, "READY", state.event === "HIGH_JUMP" ? `바 높이 ${(state.barHeight / 100).toFixed(2)}m` : `${state.attempt + 1}번째 시도`);
};

const finish = (state: EventState, mark: number | null, message: string) => {
  state.mark = mark;
  setPhase(state, "DONE", message);
};

/** 다른 선수에게 보여 줄 진행(달리기 종목: 달린 거리 cm). 그 밖의 종목은 null */
export const raceProgress = (state: EventState): number | null =>
  isRaceEvent(state.event) && state.phase !== "READY" ? Math.round(Math.min(state.x, state.event === "SPRINT_100" ? SPRINT_DISTANCE : HURDLES_DISTANCE) * 100) : null;
