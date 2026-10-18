/**
 * AlkkagiPractice.tsx — 알까기 혼자 연습(방 대기 중)
 *
 * 내 흑 알 4개로 위쪽의 백 알 6개를 모두 판 밖으로 떨어뜨리면 성공이다. 적은 횟수로 끝낼수록 잘한 것.
 * 서버 없이 브라우저가 계산한다(alkkagiPhysics.ts — 서버와 같은 규칙). 조작은 온라인 대전과 같다.
 *   - 내 알을 누른 채 반대쪽으로 끌어당겼다 놓기(새총), 또는 아래 슬라이더로 각도·힘을 정해 "튕기기"
 *
 * [학습 포인트]
 *   튕기면 결과(다 멈춘 뒤 위치)를 바로 상태에 넣고, 궤적(frames)은 따로 들고 1/30초마다 한 장씩 보여 준다.
 *   재생 타이머는 Effect에서 만들고 정리(cleanup)에서 지운다. 연습을 접거나 게임이 시작되면 타이머도 함께 사라진다.
 */
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { countAlive, createPracticeStones, simulateFlick, type PhysicsStone } from "@/features/games/alkkagi/alkkagiPhysics";
import {
  ALKKAGI_BOARD, ALKKAGI_STONE_RADIUS, aimFromPull, aimLineEnd, framePositions, MAX_POWER, MIN_POWER, REPLAY_FRAME_MS, toBoardPoint,
  type BoardPoint,
} from "@/features/games/online/games/alkkagiRules";

const GRID_COORDS = Array.from({ length: 19 }, (_, index) => 50 + index * 50);

export const AlkkagiPractice = () => {
  const [stones, setStones] = useState<PhysicsStone[]>(createPracticeStones);
  const [shots, setShots] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [angle, setAngle] = useState(90);
  const [power, setPower] = useState(60);
  const [pulling, setPulling] = useState(false);
  const [replayFrames, setReplayFrames] = useState<number[][] | null>(null);
  const [replayIndex, setReplayIndex] = useState(0);
  const boardRef = useRef<SVGSVGElement>(null);

  // 새 궤적이 들어오면 1/30초마다 다음 장면으로. 끝나면 재생을 멈춘다
  useEffect(() => {
    if (!replayFrames) return;
    let index = 0; // 이 재생에서만 쓰는 장면 번호(렌더링에 필요 없으니 지역 변수로 충분하다)
    const timerId = window.setInterval(() => {
      index += 1;
      if (index >= replayFrames.length) {
        window.clearInterval(timerId);
        setReplayFrames(null);
        return;
      }
      setReplayIndex(index);
    }, REPLAY_FRAME_MS);
    return () => window.clearInterval(timerId);
  }, [replayFrames]);

  const blackLeft = countAlive(stones, 0);
  const whiteLeft = countAlive(stones, 1);
  const finished = whiteLeft === 0 || blackLeft === 0;
  const replaying = replayFrames !== null;
  const canShoot = !finished && !replaying;
  const positions: (BoardPoint | null)[] = replaying
    ? framePositions(replayFrames[replayIndex] ?? [])
    : stones.map((stone) => (stone.alive ? { x: stone.x, y: stone.y } : null));
  const selectedPoint = selected !== null && stones[selected]?.alive ? positions[selected] ?? null : null;

  const flick = (stoneIndex: number, flickAngle: number, flickPower: number) => {
    const result = simulateFlick(stones, stoneIndex, flickAngle, flickPower);
    setStones(result.stones);
    setShots((count) => count + 1);
    setReplayIndex(0);
    setReplayFrames(result.frames);
    setSelected(null);
    setPulling(false);
  };

  const reset = () => {
    setStones(createPracticeStones());
    setShots(0);
    setSelected(null);
    setReplayFrames(null);
  };

  const pointerToBoard = (event: PointerEvent<SVGElement>): BoardPoint => {
    const box = boardRef.current?.getBoundingClientRect();
    return box ? toBoardPoint(event.clientX, event.clientY, box) : { x: 0, y: 0 };
  };

  const startPull = (event: PointerEvent<SVGCircleElement>, index: number) => {
    if (!canShoot || stones[index]?.side !== 0) return;
    setSelected(index);
    setPulling(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const movePull = (event: PointerEvent<SVGSVGElement>) => {
    if (!pulling || !selectedPoint) return;
    const aim = aimFromPull(selectedPoint, pointerToBoard(event));
    setAngle(aim.angle);
    setPower(aim.power);
  };

  const endPull = (event: PointerEvent<SVGSVGElement>) => {
    if (!pulling || selected === null || !selectedPoint) return;
    setPulling(false);
    const pointer = pointerToBoard(event);
    if (Math.hypot(pointer.x - selectedPoint.x, pointer.y - selectedPoint.y) < ALKKAGI_STONE_RADIUS) return; // 그냥 누른 것
    const aim = aimFromPull(selectedPoint, pointer);
    flick(selected, aim.angle, aim.power);
  };

  const aimEnd = selectedPoint && canShoot ? aimLineEnd(selectedPoint, angle, power) : null;
  const status = whiteLeft === 0 ? `성공! ${shots}번 만에 백 알을 모두 떨어뜨렸어요.`
    : blackLeft === 0 ? "내 흑 알이 모두 떨어졌어요. 다시 해 보세요."
    : replaying ? "알이 굴러가는 중…"
    : selected === null ? "튕길 흑 알을 누르세요." : "끌어당겼다 놓거나, 아래에서 각도·힘을 정해 튕기세요.";

  return (
    <div className="alkkagi alkkagi-practice">
      <div className="alkkagi-score">
        <span className="alkkagi-side">튕긴 횟수 {shots}</span>
        <span className="alkkagi-side">남은 흑 {blackLeft} · 남은 백 {whiteLeft}</span>
      </div>
      <p className="game-status" aria-live="polite">{status}</p>
      <svg ref={boardRef} className={`alkkagi-board${canShoot ? " playable" : ""}`} viewBox={`0 0 ${ALKKAGI_BOARD} ${ALKKAGI_BOARD}`}
        role="img" aria-label={`알까기 연습 판: 흑 ${blackLeft}개, 백 ${whiteLeft}개`}
        onPointerMove={movePull} onPointerUp={endPull} onPointerCancel={() => setPulling(false)}>
        <rect width={ALKKAGI_BOARD} height={ALKKAGI_BOARD} className="alkkagi-wood" />
        {GRID_COORDS.map((line) => (
          <g key={line} className="alkkagi-grid">
            <line x1={50} y1={line} x2={950} y2={line} />
            <line x1={line} y1={50} x2={line} y2={950} />
          </g>
        ))}
        {aimEnd && selectedPoint ? <line className="alkkagi-aim" x1={selectedPoint.x} y1={selectedPoint.y} x2={aimEnd.x} y2={aimEnd.y} /> : null}
        {positions.map((point, index) => {
          const stone = stones[index];
          if (!point || !stone) return null;
          return (
            <circle key={index} cx={point.x} cy={point.y} r={ALKKAGI_STONE_RADIUS}
              className={`alkkagi-stone side-${stone.side}${index === selected ? " selected" : ""}${canShoot && stone.side === 0 ? " mine" : ""}`}
              onPointerDown={(event) => startPull(event, index)} />
          );
        })}
      </svg>
      {canShoot ? (
        <div className="alkkagi-controls" role="group" aria-label="연습 튕기기 조작">
          <label>
            내 알
            <select value={selected ?? ""} onChange={(event) => setSelected(event.target.value === "" ? null : Number(event.target.value))}>
              <option value="">고르기</option>
              {stones.map((stone, index) => (stone.alive && stone.side === 0
                ? <option key={index} value={index}>{index + 1}번 알</option> : null))}
            </select>
          </label>
          <label>
            각도 {angle}°
            <input type="range" min={0} max={359} value={angle} onChange={(event) => setAngle(Number(event.target.value))} />
          </label>
          <label>
            힘 {power}
            <input type="range" min={MIN_POWER} max={MAX_POWER} value={power} onChange={(event) => setPower(Number(event.target.value))} />
          </label>
          <button type="button" disabled={selected === null} onClick={() => selected !== null && flick(selected, angle, power)}>튕기기</button>
        </div>
      ) : null}
      <button type="button" className="secondary-button" onClick={reset}>처음부터</button>
    </div>
  );
};
