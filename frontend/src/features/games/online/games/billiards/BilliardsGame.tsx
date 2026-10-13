/**
 * BilliardsGame.tsx — 당구 대전 화면(3쿠션·4구·8볼, 1~2명)
 *
 * 물리와 판정은 서버(BilliardsPhysics·BilliardsGame)가 한다. 이 화면이 하는 일:
 *   1) 샷 값 고르기 — 조준 각도·힘·당점(공의 어디를 칠지). 고른 값은 로컬 UI 상태다(서버에 보내기 전까지).
 *   2) 3D 테이블에 조준선(예상 경로)과 큐를 보여 주기 — billiardsAim.ts의 직선 예상
 *   3) SHOT을 보내고, 서버가 돌려준 궤적을 재생한 뒤 다음 차례를 보여 주기
 *
 * [재생과 서버 상태] 서버 상태(room.game)는 샷이 끝난 "결과"다. 화면은 lastShot이 새로 오면
 *   궤적을 먼저 재생하고, 재생이 끝나면(onReplayEnd) 그 결과를 보여 준다. 그 사이에는 조작을 막는다.
 *   방에 늦게 들어온 사람은 이미 끝난 샷을 재생하지 않는다(처음 본 lastShot을 "이미 본 샷"으로 둔다).
 * [3D 지연 로딩] three.js는 커서(약 150KB) 당구 방에 들어갔을 때만 내려받는다(React.lazy).
 */
import { lazy, Suspense, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { CommonGameProperties } from "@/features/games/online/games/CommonGameArea";
import { canPlaceCue, nearestBallAngle, previewAim, toMilliDegrees, type Point } from "@/features/games/online/games/billiards/billiardsAim";
import { ballLook, billiardsSchema, variantRule, type BilliardsShot, type BilliardsView } from "@/features/games/online/games/billiards/billiardsRules";
import type { CameraMode } from "@/features/games/online/games/billiards/BilliardsTable3D";

const BilliardsTable3D = lazy(() => import("@/features/games/online/games/billiards/BilliardsTable3D"));

const TIP_LIMIT = 50;

/** 같은 seq라도 판이 새로 시작되면 다른 샷이므로, 몇 가지 값을 묶어 "샷 열쇠"로 쓴다 */
const shotKey = (shot: BilliardsShot | null | undefined) => (shot ? `${shot.seq}:${shot.durationMs}:${shot.events.length}` : null);

const cameraModes: { mode: CameraMode; label: string }[] = [
  { mode: "TOP", label: "위에서" },
  { mode: "BEHIND", label: "수구 뒤에서" },
  { mode: "FREE", label: "자유 시점" },
];

const tipPresets = [
  { label: "가운데", side: 0, vertical: 0 },
  { label: "밀어치기", side: 0, vertical: 35 },
  { label: "끌어치기", side: 0, vertical: -40 },
  { label: "왼쪽 회전", side: -35, vertical: 0 },
  { label: "오른쪽 회전", side: 35, vertical: 0 },
];

/** 당점을 원 안(반지름 50)으로 */
const clampTip = (side: number, vertical: number) => {
  const distance = Math.hypot(side, vertical);
  if (distance <= TIP_LIMIT) return { side: Math.round(side), vertical: Math.round(vertical) };
  return { side: Math.round((side / distance) * TIP_LIMIT), vertical: Math.round((vertical / distance) * TIP_LIMIT) };
};

const preferredTargets = (game: BilliardsView): number[] => (game.variant === "THREE_CUSHION" ? [2] : game.variant === "FOUR_BALL" ? [2, 3] : []);

export const BilliardsGame = ({ room, mySeat, connected, send }: CommonGameProperties) => {
  const parsed = billiardsSchema.safeParse(room.game);
  const game = parsed.success ? parsed.data : null;
  const myCue = game && mySeat !== null ? (game.cueBalls[mySeat] ?? 0) : 0;
  // 조준 각도. null = 아직 직접 고르지 않음 → 가장 가까운 목표 공 쪽(차례가 올 때마다 다시 null로)
  const [chosenDegrees, setDegrees] = useState<number | null>(null);
  const [power, setPower] = useState(35);
  const [tip, setTip] = useState({ side: 0, vertical: 0 });
  const [cameraMode, setCameraMode] = useState<CameraMode>("TOP");
  const [showGuide, setShowGuide] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [placeHint, setPlaceHint] = useState("");
  // 처음 화면을 열 때 이미 있던 샷은 재생하지 않는다
  const [playedKey, setPlayedKey] = useState(() => shotKey(game?.lastShot));
  const nameAt = (seat: number) => room.participants.find((participant) => participant.participantId === room.seats[seat])?.nickname ?? `${seat + 1}번 자리`;

  if (!game) {
    return <p className="online-hint">방장이 게임 옵션에서 종목(3쿠션·4구·8볼)을 고르고 시작하면 3D 당구대가 열립니다. 1명 방이면 혼자 연습할 수 있습니다.</p>;
  }

  const replayShot = game.lastShot && shotKey(game.lastShot) !== playedKey ? game.lastShot : null;
  const replaying = replayShot !== null;
  const playing = room.status === "PLAYING" && !game.finished;
  const myTurn = playing && connected && mySeat !== null && game.turnSeat === mySeat;
  const canShoot = myTurn && !replaying && !placing;
  const tableSize = { length: game.tableLength, width: game.tableWidth, radius: game.ballRadius };
  const degrees = chosenDegrees ?? nearestBallAngle(game.balls, myCue, preferredTargets(game));
  const preview = canShoot ? previewAim(tableSize, game.balls, myCue, degrees) : null;

  const finishReplay = () => {
    setPlayedKey(shotKey(game.lastShot));
    setDegrees(null);
  };

  const shoot = () => {
    if (!canShoot) return;
    send({ type: "GAME_ACTION", action: "SHOT", numbers: [toMilliDegrees(degrees), power, tip.side, tip.vertical] });
  };

  const placeCue = (point: Point) => {
    if (!canPlaceCue(tableSize, game.balls, point)) {
      setPlaceHint("테이블 안, 다른 공과 겹치지 않는 곳을 눌러 주세요.");
      return;
    }
    send({ type: "GAME_ACTION", action: "PLACE", numbers: [Math.round(point.x), Math.round(point.y)] });
    setPlacing(false);
    setPlaceHint("");
  };

  const turnAim = (delta: number) => setDegrees((((degrees + delta) % 360) + 360) % 360);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!canShoot) return;
    const fine = event.shiftKey ? 0.05 : 0.5;
    if (event.key === "ArrowLeft") turnAim(fine);
    else if (event.key === "ArrowRight") turnAim(-fine);
    else if (event.key === "ArrowUp") setPower((current) => Math.min(100, current + 2));
    else if (event.key === "ArrowDown") setPower((current) => Math.max(1, current - 2));
    else if (event.key === " " || event.key === "Enter") shoot();
    else return;
    event.preventDefault();
  };

  const pickTip = (event: ReactPointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const side = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2 * 60;
    const vertical = -((event.clientY - bounds.top) / bounds.height - 0.5) * 2 * 60;
    setTip(clampTip(side, vertical));
  };

  const status = game.finished ? room.lastResult ?? game.result ?? "게임 끝"
    : replaying ? `${nameAt(replayShot.shooterSeat)} 샷 재생 중…`
    : myTurn ? (game.ballInHand ? "내 차례 — 파울 뒤라 수구를 원하는 곳에 놓을 수 있습니다." : "내 차례 — 조준하고 치세요!")
    : `${nameAt(game.turnSeat ?? 0)} 차례`;
  const speed = (0.4 + (power / 100) * 6.6).toFixed(1);
  const leftBalls = (group: "SOLID" | "STRIPE") => game.balls.filter((ball) => (group === "SOLID" ? ball.id >= 1 && ball.id <= 7 : ball.id >= 9) && !ball.pocketed).length;

  return (
    <div className="billiards">
      <ul className="billiards-players" aria-label="점수">
        {game.scores.map((score, seat) => {
          const group = game.groups[seat];
          const cueLook = ballLook(game.variant, game.cueBalls[seat] ?? 0);
          return (
            <li key={seat} className={`billiards-player${game.turnSeat === seat ? " turn" : ""}${game.winners.includes(seat) ? " winner" : ""}`}>
              <strong>
                {game.variant !== "EIGHT_BALL" && <span className="billiards-ball-chip" style={{ background: cueLook.base }} aria-hidden="true" />}
                {nameAt(seat)}{seat === mySeat ? " (나)" : ""}
              </strong>
              {game.variant === "EIGHT_BALL" ? (
                <span>{group ? `${group === "SOLID" ? "솔리드" : "스트라이프"} · 남은 공 ${leftBalls(group)}개` : "무리 미정"}</span>
              ) : (
                <span>{score} / {game.target}점 · {game.innings[seat] ?? 0}이닝 · {cueLook.name}</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="game-status" aria-live="polite">{status}</p>
      <p className="billiards-rule">{game.variantLabel}: {variantRule[game.variant]}</p>

      <div className="billiards-stage-wrap" tabIndex={0} onKeyDown={handleKeyDown} aria-label="당구대(키보드: ←→ 조준, Shift는 미세 조정, ↑↓ 힘, 스페이스 치기)">
        <Suspense fallback={<p className="online-hint">3D 당구대를 불러오는 중…</p>}>
          <BilliardsTable3D
            game={game}
            replay={replayShot}
            onReplayEnd={finishReplay}
            aim={canShoot ? { cueId: myCue, degrees, power, side: tip.side, vertical: tip.vertical } : null}
            preview={preview}
            showGuide={showGuide}
            cameraMode={cameraMode}
            placing={myTurn && placing && !replaying}
            soundOn={soundOn}
            onAimDegrees={(next) => setDegrees(Math.round(next * 100) / 100)}
            onPlace={placeCue}
          />
        </Suspense>
      </div>

      <div className="billiards-toolbar" role="group" aria-label="시점과 보조">
        {cameraModes.map(({ mode, label }) => (
          <button key={mode} type="button" className={cameraMode === mode ? "" : "secondary-button"} aria-pressed={cameraMode === mode} onClick={() => setCameraMode(mode)}>
            {label}
          </button>
        ))}
        <label className="billiards-check"><input type="checkbox" checked={showGuide} onChange={(event) => setShowGuide(event.target.checked)} /> 조준선</label>
        <label className="billiards-check"><input type="checkbox" checked={soundOn} onChange={(event) => setSoundOn(event.target.checked)} /> 소리</label>
      </div>

      {game.lastShot && !replaying && <p className="billiards-last">지난 샷({nameAt(game.lastShot.shooterSeat)}): {game.lastShot.summary}</p>}

      {myTurn && (
        <section className="billiards-controls" aria-label="샷 조작">
          {game.ballInHand && (
            <div className="billiards-place">
              <button type="button" className={placing ? "" : "secondary-button"} aria-pressed={placing} disabled={replaying} onClick={() => setPlacing((current) => !current)}>
                {placing ? "수구 놓기 취소" : "수구 옮기기"}
              </button>
              <span>{placing ? "당구대에서 수구를 놓을 곳을 누르세요." : "그대로 쳐도 됩니다."}</span>
              {placeHint && <span role="alert">{placeHint}</span>}
            </div>
          )}
          <div className="billiards-control-row">
            <label htmlFor="billiards-angle">조준 각도 {degrees.toFixed(2)}°</label>
            <input id="billiards-angle" type="range" min={0} max={359.99} step={0.01} value={degrees} disabled={!canShoot} onChange={(event) => setDegrees(Number(event.target.value))} />
            <div className="billiards-nudge">
              {[1, 0.1, -0.1, -1].map((delta) => (
                <button key={delta} type="button" className="secondary-button" disabled={!canShoot} onClick={() => turnAim(delta)}>
                  {delta > 0 ? `↺ ${delta}°` : `↻ ${-delta}°`}
                </button>
              ))}
            </div>
          </div>
          <div className="billiards-control-row">
            <label htmlFor="billiards-power">힘 {power} (약 {speed} m/s)</label>
            <input id="billiards-power" className="billiards-power" type="range" min={1} max={100} value={power} disabled={!canShoot} onChange={(event) => setPower(Number(event.target.value))} />
          </div>
          <div className="billiards-tip">
            <svg viewBox="-60 -60 120 120" width="120" height="120" role="presentation" onPointerDown={canShoot ? pickTip : undefined} className="billiards-tip-pad">
              <circle r="58" className="billiards-tip-ball" />
              <circle r={TIP_LIMIT} className="billiards-tip-limit" />
              <line x1="-58" x2="58" y1="0" y2="0" className="billiards-tip-axis" />
              <line y1="-58" y2="58" x1="0" x2="0" className="billiards-tip-axis" />
              <circle cx={tip.side} cy={-tip.vertical} r="7" className="billiards-tip-dot" />
            </svg>
            <div className="billiards-tip-inputs">
              <label>당점 좌우 {tip.side}
                <input type="range" min={-TIP_LIMIT} max={TIP_LIMIT} value={tip.side} disabled={!canShoot} onChange={(event) => setTip((current) => clampTip(Number(event.target.value), current.vertical))} />
              </label>
              <label>당점 위아래 {tip.vertical}
                <input type="range" min={-TIP_LIMIT} max={TIP_LIMIT} value={tip.vertical} disabled={!canShoot} onChange={(event) => setTip((current) => clampTip(current.side, Number(event.target.value)))} />
              </label>
              <div className="billiards-presets">
                {tipPresets.map((preset) => (
                  <button key={preset.label} type="button" className="secondary-button" disabled={!canShoot} onClick={() => setTip({ side: preset.side, vertical: preset.vertical })}>
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button type="button" className="billiards-shoot" disabled={!canShoot} onClick={shoot}>치기</button>
        </section>
      )}
      {!myTurn && playing && mySeat !== null && !replaying && <p className="online-hint">상대가 치는 동안 기다려 주세요. 오른쪽 버튼(두 손가락)으로 시점을 돌려 볼 수 있습니다.</p>}
    </div>
  );
};
