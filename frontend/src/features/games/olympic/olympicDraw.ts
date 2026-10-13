/**
 * olympicDraw.ts — 올림픽 경기장 그리기(Canvas 2D)
 *
 * 화면 좌표는 논리 크기 800×320으로 그린다(캔버스 실제 크기에 맞춰 OlympicEventPlay가 배율을 정한다).
 * 옆에서 본 경기장: 관중석·트랙·거리 표시를 그리고, 카메라는 선수(또는 날아가는 창)를 따라간다.
 * 해머던지기만 위에서 본 경기장(던지는 원·부채꼴·거리 원호)으로 그린다.
 */
import {
  HAMMER_SECTOR,
  HIGH_JUMP_BAR_X,
  HIGH_JUMP_ZONE,
  HURDLE_POSITIONS,
  HURDLES_DISTANCE,
  JAVELIN_LINE,
  LONG_JUMP_BOARD,
  SPRINT_DISTANCE,
  type EventState,
} from "@/features/games/olympic/olympicLogic";

export const VIEW_WIDTH = 800;
export const VIEW_HEIGHT = 320;
const PPM = 34; // 옆 화면: 1m = 34px
const GROUND = 286;
const LANE_GAP = 26;

export interface RivalLane {
  name: string;
  color: string;
  /** 달린 거리(m) */
  x: number;
  finished: boolean;
}

export interface DrawOptions {
  color: string;
  rivals: RivalLane[];
}

/** 관중: 같은 자리에는 늘 같은 색이 나오도록 위치로 만든 의사 난수 */
const crowdColor = (column: number, row: number) => {
  const value = Math.abs(Math.sin(column * 12.9898 + row * 78.233) * 43758.5453) % 1;
  const colors = ["#f8f9fa", "#ffd43b", "#ff8787", "#74c0fc", "#8ce99a", "#e599f7", "#ffa94d", "#adb5bd"];
  return colors[Math.floor(value * colors.length)] ?? "#adb5bd";
};

const drawBackground = (context: CanvasRenderingContext2D, cameraX: number) => {
  const sky = context.createLinearGradient(0, 0, 0, 120);
  sky.addColorStop(0, "#4dabf7");
  sky.addColorStop(1, "#d0ebff");
  context.fillStyle = sky;
  context.fillRect(0, 0, VIEW_WIDTH, 120);
  // 관중석(멀리 있어 천천히 지나감)
  context.fillStyle = "#495057";
  context.fillRect(0, 60, VIEW_WIDTH, 110);
  const parallax = cameraX * PPM * 0.3;
  const start = Math.floor(parallax / 10);
  for (let column = start; column < start + VIEW_WIDTH / 10 + 2; column++) {
    for (let row = 0; row < 9; row++) {
      context.fillStyle = crowdColor(column, row);
      context.fillRect(column * 10 - parallax + (row % 2) * 5, 66 + row * 11, 6, 7);
    }
  }
  context.fillStyle = "#2b8a3e";
  context.fillRect(0, 170, VIEW_WIDTH, 30);
  // 트랙
  context.fillStyle = "#c2552d";
  context.fillRect(0, 200, VIEW_WIDTH, VIEW_HEIGHT - 200);
  context.strokeStyle = "rgba(255, 255, 255, 0.55)";
  context.lineWidth = 1.5;
  for (let lane = 0; lane < 5; lane++) {
    const y = GROUND + 6 - lane * LANE_GAP;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(VIEW_WIDTH, y);
    context.stroke();
  }
};

const toScreen = (x: number, cameraX: number) => (x - cameraX) * PPM;

const drawDistanceMarks = (context: CanvasRenderingContext2D, cameraX: number, from: number, to: number, step: number, origin = 0) => {
  context.fillStyle = "#fff";
  context.font = "bold 12px sans-serif";
  context.textAlign = "center";
  for (let mark = from; mark <= to; mark += step) {
    const x = toScreen(origin + mark, cameraX);
    if (x < -40 || x > VIEW_WIDTH + 40) continue;
    context.fillRect(x - 1, GROUND + 8, 2, 10);
    context.fillText(`${mark}m`, x, GROUND + 30);
  }
};

/** 막대 인형 선수. phase로 달리기·웅크림·공중 자세를 바꾼다 */
const drawAthlete = (context: CanvasRenderingContext2D, x: number, groundY: number, height: number, stride: number, color: string, pose: "RUN" | "AIM" | "AIR" | "STAND", scale = 1, carrying: "JAVELIN" | null = null) => {
  const baseY = groundY - height * PPM;
  const s = scale;
  const swing = pose === "RUN" ? Math.sin(stride) : 0;
  context.save();
  context.translate(x, baseY);
  context.lineCap = "round";
  context.strokeStyle = "#212529";
  context.lineWidth = 4 * s;
  const hip = { x: 0, y: -26 * s };
  const lean = pose === "RUN" ? 6 * s : pose === "AIM" ? 2 * s : 0;
  const neck = { x: lean, y: -50 * s };
  // 다리
  const legs = pose === "AIR" ? [[-12, -8], [14, -14]] : pose === "AIM" ? [[-8, 0], [10, -4]] : [[swing * 14, 0], [-swing * 14, 0]];
  for (const [footX, footY] of legs) {
    context.beginPath();
    context.moveTo(hip.x, hip.y);
    context.lineTo((footX ?? 0) * s * 0.5, hip.y + 14 * s);
    context.lineTo((footX ?? 0) * s, (footY ?? 0) * s);
    context.stroke();
  }
  // 몸통(유니폼 색)
  context.strokeStyle = color;
  context.lineWidth = 8 * s;
  context.beginPath();
  context.moveTo(hip.x, hip.y);
  context.lineTo(neck.x, neck.y);
  context.stroke();
  // 팔
  context.strokeStyle = "#212529";
  context.lineWidth = 3.5 * s;
  const armSwing = pose === "RUN" ? -swing * 12 : pose === "AIR" ? -14 : pose === "AIM" ? 10 : 0;
  for (const direction of [1, -1]) {
    context.beginPath();
    context.moveTo(neck.x, neck.y + 4 * s);
    context.lineTo(neck.x + armSwing * direction * s, neck.y + 22 * s - (pose === "AIR" ? 26 * s : 0));
    context.stroke();
  }
  // 머리
  context.fillStyle = "#f1c27d";
  context.beginPath();
  context.arc(neck.x + 2 * s, neck.y - 9 * s, 8 * s, 0, Math.PI * 2);
  context.fill();
  if (carrying === "JAVELIN") {
    context.strokeStyle = "#868e96";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(neck.x - 30 * s, neck.y + 4 * s);
    context.lineTo(neck.x + 40 * s, neck.y - 12 * s);
    context.stroke();
  }
  context.restore();
};

const drawHurdle = (context: CanvasRenderingContext2D, x: number, groundY: number, knocked: boolean, scale = 1) => {
  context.strokeStyle = "#f8f9fa";
  context.lineWidth = 2.5 * scale;
  const top = groundY - 36 * scale;
  if (knocked) {
    context.beginPath();
    context.moveTo(x - 4 * scale, groundY);
    context.lineTo(x + 24 * scale, groundY - 6 * scale);
    context.stroke();
    return;
  }
  context.beginPath();
  context.moveTo(x, groundY);
  context.lineTo(x, top);
  context.stroke();
  context.fillStyle = "#212529";
  context.fillRect(x - 3 * scale, top - 4 * scale, 6 * scale, 4 * scale);
  context.fillStyle = "#fa5252";
  context.fillRect(x - 3 * scale, top - 4 * scale, 6 * scale, 2 * scale);
};

const finishLine = (context: CanvasRenderingContext2D, x: number) => {
  for (let row = 0; row < 12; row++) {
    for (let column = 0; column < 2; column++) {
      context.fillStyle = (row + column) % 2 === 0 ? "#fff" : "#212529";
      context.fillRect(x + column * 5, 200 + row * 8 + 4, 5, 8);
    }
  }
};

const drawRace = (context: CanvasRenderingContext2D, state: EventState, options: DrawOptions) => {
  const cameraX = Math.max(-4, state.x - 6);
  drawBackground(context, cameraX);
  const distance = state.event === "SPRINT_100" ? SPRINT_DISTANCE : HURDLES_DISTANCE;
  drawDistanceMarks(context, cameraX, 10, distance - 10, 10);
  context.fillStyle = "#fff";
  context.fillRect(toScreen(0, cameraX) - 2, 204, 4, 110);
  finishLine(context, toScreen(distance, cameraX));
  // 다른 선수: 위쪽 레인(조금 작게)
  options.rivals.forEach((rival, index) => {
    const groundY = GROUND - (index + 1) * LANE_GAP;
    if (state.event === "HURDLES_110") {
      // 다른 선수가 넘어뜨린 허들은 알 수 없으므로(거리만 받음) 늘 세워 둔다
      for (const position of HURDLE_POSITIONS) drawHurdle(context, toScreen(position, cameraX) + 6, groundY, false, 0.75);
    }
    drawAthlete(context, toScreen(rival.x, cameraX), groundY, 0, rival.x * 1.6, rival.color, rival.finished ? "STAND" : "RUN", 0.75);
    context.fillStyle = "#fff";
    context.font = "11px sans-serif";
    context.textAlign = "left";
    context.fillText(rival.name, toScreen(rival.x, cameraX) + 12, groundY - 40);
  });
  if (state.event === "HURDLES_110") {
    HURDLE_POSITIONS.forEach((position, index) => drawHurdle(context, toScreen(position, cameraX) + 8, GROUND, state.hurdlesHit[index] === true));
  }
  const pose = state.height > 0 ? "AIR" : state.phase === "READY" ? "STAND" : state.phase === "DONE" ? "STAND" : "RUN";
  drawAthlete(context, toScreen(state.x, cameraX), GROUND, state.height, state.x * 1.6, options.color, pose);
};

const drawField = (context: CanvasRenderingContext2D, state: EventState, options: DrawOptions) => {
  const projectile = state.projectile;
  const followX = state.event === "JAVELIN" && projectile ? Math.max(state.takeoffX, projectile.x) : state.x;
  const cameraX = Math.max(-4, followX - (state.event === "JAVELIN" && projectile ? 12 : 6));
  drawBackground(context, cameraX);
  if (state.event === "LONG_JUMP") {
    context.fillStyle = "#e9d8a6";
    context.fillRect(toScreen(LONG_JUMP_BOARD + 0.5, cameraX), GROUND - 2, 9 * PPM, 22);
    context.fillStyle = "#fff";
    context.fillRect(toScreen(LONG_JUMP_BOARD, cameraX) - 6, GROUND - 2, 8, 10);
    context.fillStyle = "#fa5252";
    context.fillRect(toScreen(LONG_JUMP_BOARD, cameraX) + 2, GROUND - 2, 3, 10);
    drawDistanceMarks(context, cameraX, 5, 9, 1, LONG_JUMP_BOARD);
  } else if (state.event === "JAVELIN") {
    context.fillStyle = "#2f9e44";
    context.fillRect(toScreen(JAVELIN_LINE, cameraX), 200, VIEW_WIDTH * 4, 120);
    context.fillStyle = "#fff";
    context.fillRect(toScreen(JAVELIN_LINE, cameraX) - 3, 200, 6, 120);
    drawDistanceMarks(context, cameraX, 10, 100, 10, JAVELIN_LINE);
  } else {
    // 높이뛰기: 발 구름 구역, 바, 매트
    context.fillStyle = "rgba(255, 212, 59, 0.45)";
    context.fillRect(toScreen(HIGH_JUMP_ZONE[0], cameraX), GROUND - 6, (HIGH_JUMP_ZONE[1] - HIGH_JUMP_ZONE[0]) * PPM, 20);
    context.fillStyle = "#1c7ed6";
    context.fillRect(toScreen(HIGH_JUMP_BAR_X + 0.2, cameraX), GROUND - 34, 3 * PPM, 34);
    const barX = toScreen(HIGH_JUMP_BAR_X, cameraX);
    const barY = GROUND - (state.barHeight / 100) * PPM;
    context.strokeStyle = "#ced4da";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(barX, GROUND);
    context.lineTo(barX, barY - 12);
    context.stroke();
    const fallen = state.phase === "ATTEMPT_RESULT" && state.cleared === false && state.projectile !== null;
    context.strokeStyle = "#fab005";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(barX - 8, fallen ? GROUND - 4 : barY);
    context.lineTo(barX + 26, fallen ? GROUND - 2 : barY);
    context.stroke();
    context.fillStyle = "#fff";
    context.font = "bold 13px sans-serif";
    context.textAlign = "left";
    context.fillText(`바 ${(state.barHeight / 100).toFixed(2)}m`, barX + 30, barY - 4);
  }
  // 지난 시도 자국(멀리뛰기·창던지기)
  const line = state.event === "LONG_JUMP" ? LONG_JUMP_BOARD - 0.6 : JAVELIN_LINE;
  if (state.event !== "HIGH_JUMP") {
    state.attemptMarks.forEach((mark) => {
      if (mark === null) return;
      const x = toScreen(line + mark / 100, cameraX);
      context.fillStyle = "#fff";
      context.beginPath();
      context.moveTo(x, GROUND - 12);
      context.lineTo(x - 5, GROUND - 2);
      context.lineTo(x + 5, GROUND - 2);
      context.fill();
    });
  }
  const pose = state.phase === "FLIGHT" && state.event !== "JAVELIN" ? "AIR" : state.phase === "AIM" ? "AIM" : state.phase === "RUN" ? "RUN" : "STAND";
  const athleteX = state.event === "JAVELIN" && state.phase !== "RUN" && state.phase !== "READY" ? state.takeoffX : state.x;
  drawAthlete(context, toScreen(athleteX, cameraX), GROUND, state.event === "JAVELIN" ? 0 : state.height, state.x * 1.6, options.color, pose, 1,
    state.event === "JAVELIN" && (state.phase === "RUN" || state.phase === "AIM" || state.phase === "READY") ? "JAVELIN" : null);
  if (state.event === "JAVELIN" && projectile) {
    const x = toScreen(projectile.x, cameraX);
    const y = GROUND - projectile.y * PPM;
    const angle = Math.atan2(projectile.vy, projectile.vx);
    context.strokeStyle = "#495057";
    context.lineWidth = 2.5;
    context.beginPath();
    context.moveTo(x - Math.cos(angle) * 40, y + Math.sin(angle) * 40);
    context.lineTo(x + Math.cos(angle) * 40, y - Math.sin(angle) * 40);
    context.stroke();
  }
  if (state.phase === "AIM") drawAngleGauge(context, toScreen(state.takeoffX, cameraX) + 20, GROUND - 60, state.angle);
};

const drawAngleGauge = (context: CanvasRenderingContext2D, x: number, y: number, angle: number) => {
  context.strokeStyle = "rgba(255, 255, 255, 0.8)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(x, y, 40, -Math.PI / 2, 0);
  context.stroke();
  const radians = (angle * Math.PI) / 180;
  context.strokeStyle = "#ffd43b";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + Math.cos(radians) * 48, y - Math.sin(radians) * 48);
  context.stroke();
  context.fillStyle = "#fff";
  context.font = "bold 14px sans-serif";
  context.textAlign = "left";
  context.fillText(`${angle.toFixed(0)}°`, x + 50, y - 20);
};

/** 해머던지기: 위에서 본 경기장 */
const drawHammer = (context: CanvasRenderingContext2D, state: EventState, options: DrawOptions) => {
  const scale = 7; // 1m = 7px
  const centerX = 60;
  const centerY = VIEW_HEIGHT / 2;
  context.fillStyle = "#2b8a3e";
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  // 부채꼴(유효 구역)
  const sector = (HAMMER_SECTOR * Math.PI) / 180;
  context.fillStyle = "#37b24d";
  context.beginPath();
  context.moveTo(centerX, centerY);
  context.arc(centerX, centerY, 110 * scale, -sector, sector);
  context.closePath();
  context.fill();
  context.strokeStyle = "#fff";
  context.lineWidth = 2;
  context.stroke();
  context.font = "bold 12px sans-serif";
  context.fillStyle = "#fff";
  context.textAlign = "center";
  for (let distance = 20; distance <= 100; distance += 10) {
    context.strokeStyle = "rgba(255, 255, 255, 0.5)";
    context.beginPath();
    context.arc(centerX, centerY, distance * scale, -sector, sector);
    context.stroke();
    context.fillText(`${distance}m`, centerX + distance * scale, centerY + 4);
  }
  // 그물(케이지)과 던지는 원
  context.strokeStyle = "#adb5bd";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(centerX, centerY, 28, sector + 0.4, -sector - 0.4 + Math.PI * 2);
  context.stroke();
  context.fillStyle = "#ced4da";
  context.beginPath();
  context.arc(centerX, centerY, 12, 0, Math.PI * 2);
  context.fill();
  // 지난 시도 자국
  state.attemptMarks.forEach((mark) => {
    if (mark === null) return;
    context.fillStyle = "#fff";
    context.beginPath();
    context.arc(centerX + (mark / 100) * scale, centerY, 4, 0, Math.PI * 2);
    context.fill();
  });
  // 선수(원 가운데)
  context.fillStyle = options.color;
  context.beginPath();
  context.arc(centerX, centerY, 7, 0, Math.PI * 2);
  context.fill();
  const projectile = state.projectile;
  if (projectile && (state.phase === "FLIGHT" || state.phase === "ATTEMPT_RESULT")) {
    const direction = (state.releaseDirection * Math.PI) / 180;
    const x = centerX + Math.cos(direction) * projectile.x * scale;
    const y = centerY + Math.sin(direction) * projectile.x * scale;
    const lift = Math.max(0, projectile.y);
    context.fillStyle = "rgba(0, 0, 0, 0.3)";
    context.beginPath();
    context.arc(x, y, 4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#343a40";
    context.beginPath();
    context.arc(x, y - lift * 2, 5 + lift * 0.15, 0, Math.PI * 2);
    context.fill();
  } else {
    // 돌아가는 해머(보기 좋게 반지름을 키워 그림)
    const radius = 26;
    const x = centerX + Math.cos(state.hammerAngle) * radius;
    const y = centerY + Math.sin(state.hammerAngle) * radius;
    context.strokeStyle = "#dee2e6";
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(x, y);
    context.stroke();
    // 지금 놓으면 부채꼴 안으로 날아가는 순간에는 해머를 노랗게 빛나게 해 타이밍을 돕는다
    const degrees = (((state.hammerAngle * 180) / Math.PI) % 360 + 540) % 360 - 180;
    if (Math.abs(degrees) <= HAMMER_SECTOR && state.phase === "RUN") {
      context.fillStyle = "rgba(255, 212, 59, 0.7)";
      context.beginPath();
      context.arc(x, y, 12, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = "#343a40";
    context.beginPath();
    context.arc(x, y, 6, 0, Math.PI * 2);
    context.fill();
  }
  // 회전 속도 막대
  context.fillStyle = "rgba(0, 0, 0, 0.35)";
  context.fillRect(VIEW_WIDTH - 190, 16, 170, 14);
  context.fillStyle = "#ffd43b";
  context.fillRect(VIEW_WIDTH - 190, 16, (state.omega / 16) * 170, 14);
  context.fillStyle = "#fff";
  context.textAlign = "right";
  context.fillText("회전 속도", VIEW_WIDTH - 196, 28);
};

export const drawEvent = (context: CanvasRenderingContext2D, state: EventState, options: DrawOptions) => {
  context.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  if (state.event === "HAMMER") drawHammer(context, state, options);
  else if (state.event === "SPRINT_100" || state.event === "HURDLES_110") drawRace(context, state, options);
  else drawField(context, state, options);
  // 크게 보여 줄 안내(출발 신호·결과)
  if (state.phase === "READY" || state.phase === "ATTEMPT_RESULT" || state.phase === "DONE") {
    context.fillStyle = "rgba(0, 0, 0, 0.45)";
    context.fillRect(VIEW_WIDTH / 2 - 210, 18, 420, 44);
    context.fillStyle = "#fff";
    context.font = "bold 22px sans-serif";
    context.textAlign = "center";
    context.fillText(state.message, VIEW_WIDTH / 2, 48);
  }
};
