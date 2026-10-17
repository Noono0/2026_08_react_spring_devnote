/**
 * AlkkagiGame.tsx — 알까기 화면(2명, 0번 자리 = 흑·아래·먼저, 1번 자리 = 백·위)
 *
 * 0) 커스텀(방 옵션)이면 먼저 배치 단계: 내 쪽 절반의 교차점을 눌러 알을 놓고(다시 누르면 빼기) "배치 완료"를 누른다.
 *    둘 다 완료할 때까지 상대 알은 서버가 보내지 않아 보이지 않는다. 정석은 정해진 자리에서 바로 1)부터 한다.
 * 1) 내 차례에 내 알을 누르면 고른다. 그 알을 끌어당겼다 놓으면(새총) 반대쪽으로 튕긴다.
 *    키보드·화면 낭독기 사용자를 위해 각도·힘 슬라이더와 "튕기기" 버튼도 함께 둔다(같은 FLICK을 보낸다).
 * 2) 서버가 계산한 궤적(lastShot.frames)이 오면 1/30초마다 한 프레임씩 재생한 뒤 최종 위치를 보여 준다.
 *
 * [학습 포인트]
 *   - 재생은 requestAnimationFrame으로 하고, Effect 정리(cleanup)에서 cancelAnimationFrame을 부른다.
 *     정리를 빼먹으면 방을 나가도 애니메이션이 계속 setState를 불러 경고가 나고 메모리가 샌다.
 *   - "이미 본 궤적인지"는 useRef(seenSeqRef)로 기억한다. 렌더링마다 바뀔 필요가 없는 값이기 때문이다.
 *     처음 들어왔을 때 지난 궤적을 다시 재생하지 않도록 첫 값은 지금 seq로 둔다.
 */
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import type { CommonGameProperties } from "@/features/games/online/games/CommonGameArea";
import {
  ALKKAGI_BOARD, ALKKAGI_STONE_RADIUS, aimFromPull, aimLineEnd, alkkagiSchema, framePositions, GRID_LINES, GRID_START, GRID_STEP,
  isOwnHalf, MAX_POWER, MIN_POWER, REPLAY_FRAME_MS, snapToGrid, toBoardPoint, type BoardPoint,
} from "@/features/games/online/games/alkkagiRules";

/** 바둑판 19줄(배경)의 좌표. 판 가장자리에서 한 칸 안쪽부터 긋는다 */
const GRID_COORDS = Array.from({ length: GRID_LINES }, (_, index) => GRID_START + index * GRID_STEP);

export const AlkkagiGame = ({ room, mySeat, connected, send }: CommonGameProperties) => {
  const [selectedStone, setSelectedStone] = useState<number | null>(null);
  // 키보드로 놓을 때 쓰는 칸·줄(1부터 세는 사람용 번호). 처음 값은 내 쪽 절반의 한가운데쯤
  const [placeCol, setPlaceCol] = useState(10);
  const [placeRow, setPlaceRow] = useState(mySeat === 1 ? 4 : 16);
  const [angle, setAngle] = useState(90);
  const [power, setPower] = useState(60);
  const [pulling, setPulling] = useState(false);
  const [replayFrame, setReplayFrame] = useState<number | null>(null);
  const boardRef = useRef<SVGSVGElement>(null);
  const parsed = alkkagiSchema.safeParse(room.game);
  const game = parsed.success ? parsed.data : null;
  const lastShot = game?.lastShot ?? null;
  const shotSeq = lastShot?.seq ?? 0;
  const frameCount = lastShot?.frames.length ?? 0;
  const seenSeqRef = useRef(shotSeq);

  // 새 궤적이 오면 처음부터 재생한다
  useEffect(() => {
    if (shotSeq === seenSeqRef.current || frameCount === 0) return;
    seenSeqRef.current = shotSeq;
    let frameId = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const index = Math.floor((now - startedAt) / REPLAY_FRAME_MS);
      if (index >= frameCount) {
        setReplayFrame(null);
        return;
      }
      setReplayFrame(index);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [shotSeq, frameCount]);

  const nameAt = (seat: number) => room.participants.find((participant) => participant.participantId === room.seats[seat])?.nickname ?? `${seat + 1}번 자리`;
  if (!game) {
    return <p className="online-hint">두 명이 앉고 방장이 시작하면 흑(먼저)과 백이 바둑판 위의 알을 번갈아 튕깁니다. 내 알을 끌어당겼다 놓으면 반대쪽으로 날아가요. 상대 알을 모두 판 밖으로 떨어뜨리면 이깁니다.</p>;
  }
  const replaying = replayFrame !== null && lastShot !== null;
  const positions: (BoardPoint | null)[] = replaying
    ? framePositions(lastShot.frames[replayFrame] ?? [])
    : game.stones.map((stone) => (stone.alive ? { x: stone.x, y: stone.y } : null));
  const playing = room.status === "PLAYING" && !game.finished && connected;
  const myTurn = playing && game.phase === "PLAY" && !replaying && game.turnSeat === mySeat;
  // 커스텀 배치: 앉은 사람이 아직 "배치 완료"를 누르지 않았을 때만 놓을 수 있다
  const settingUp = game.phase === "SETUP";
  const canPlace = playing && settingUp && mySeat != null && game.ready[mySeat] === false;
  const myPlaced = mySeat != null ? game.placedCounts[mySeat] ?? 0 : 0;
  const selected = myTurn && selectedStone !== null && game.stones[selectedStone]?.alive && game.stones[selectedStone]?.side === mySeat
    ? selectedStone : null;
  const selectedPoint = selected !== null ? positions[selected] ?? null : null;

  const sendFlick = (stone: number, flickAngle: number, flickPower: number) => {
    send({ type: "GAME_ACTION", action: "FLICK", numbers: [stone, flickAngle, flickPower] });
    setSelectedStone(null);
    setPulling(false);
  };

  const pointerToBoard = (event: PointerEvent<SVGElement>) => {
    const box = boardRef.current?.getBoundingClientRect();
    return box ? toBoardPoint(event.clientX, event.clientY, box) : { x: 0, y: 0 };
  };

  const startPull = (event: PointerEvent<SVGCircleElement>, index: number) => {
    if (!myTurn || game.stones[index]?.side !== mySeat) return;
    setSelectedStone(index);
    setPulling(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const movePull = (event: PointerEvent<SVGElement>) => {
    if (!pulling || !selectedPoint) return;
    const aim = aimFromPull(selectedPoint, pointerToBoard(event));
    setAngle(aim.angle);
    setPower(aim.power);
  };

  const endPull = (event: PointerEvent<SVGElement>) => {
    if (!pulling || selected === null || !selectedPoint) return;
    const pointer = pointerToBoard(event);
    setPulling(false);
    // 거의 안 당기고 놓으면(그냥 누른 것) 고르기만 한다
    if (Math.hypot(pointer.x - selectedPoint.x, pointer.y - selectedPoint.y) < ALKKAGI_STONE_RADIUS) return;
    const aim = aimFromPull(selectedPoint, pointer);
    sendFlick(selected, aim.angle, aim.power);
  };

  /** 커스텀 배치: 그 교차점에 놓기(이미 내 알이 있으면 서버가 뺀다) */
  const sendPlace = (col: number, row: number) => send({ type: "GAME_ACTION", action: "PLACE", numbers: [col, row] });

  const clickBoard = (event: MouseEvent<SVGSVGElement>) => {
    if (!canPlace || mySeat == null) return;
    const box = boardRef.current?.getBoundingClientRect();
    if (!box) return;
    const point = snapToGrid(toBoardPoint(event.clientX, event.clientY, box));
    if (point && isOwnHalf(mySeat, point.row)) sendPlace(point.col, point.row);
  };

  const aimEnd = selectedPoint ? aimLineEnd(selectedPoint, angle, power) : null;
  const sideName = (seat: number) => (seat === 0 ? "흑" : "백");
  const opponent = mySeat === 0 ? 1 : 0;
  const status = game.finished ? room.lastResult ?? "게임 끝"
    : settingUp ? (mySeat == null ? "두 사람이 알을 놓는 중입니다. 배치는 둘 다 끝나면 공개됩니다."
      : game.ready[mySeat] ? `배치 완료! 상대(${game.ready[opponent] ? "완료" : `${game.placedCounts[opponent] ?? 0}개 놓는 중`})를 기다리는 중…`
      : `내 쪽(${mySeat === 0 ? "아래" : "위"} 절반)의 교차점을 눌러 알을 놓으세요. 다시 누르면 뺍니다. (${myPlaced}/${game.maxStones}개)`)
    : replaying ? "알이 굴러가는 중…"
    : myTurn ? (selected === null ? "튕길 내 알을 누르세요." : "알을 끌어당겼다 놓거나, 아래에서 각도·힘을 정해 튕기세요.")
    : `${sideName(game.turnSeat)}(${nameAt(game.turnSeat)}) 차례`;

  return (
    <div className="alkkagi">
      <div className="alkkagi-score">
        <span className="alkkagi-mode">{game.mode === "STANDARD" ? "정석" : `커스텀 · 최대 ${game.maxStones}개`}</span>
        {[0, 1].map((seat) => (
          <span key={seat} className={`alkkagi-side side-${seat}${game.turnSeat === seat && game.phase === "PLAY" ? " turn" : ""}`}>
            {sideName(seat)} · {nameAt(seat)}{seat === mySeat ? " (나)" : ""} — {settingUp
              ? `놓은 알 ${game.placedCounts[seat] ?? 0}${game.ready[seat] ? " · 완료" : ""}`
              : `남은 알 ${game.remaining[seat]}`}
          </span>
        ))}
      </div>
      <p className="game-status" aria-live="polite">{status}</p>

      <svg ref={boardRef} className={`alkkagi-board${myTurn ? " playable" : ""}${canPlace ? " placing" : ""}`} viewBox={`0 0 ${ALKKAGI_BOARD} ${ALKKAGI_BOARD}`}
        role="img" aria-label={settingUp ? `알까기 배치 판: 내 알 ${myPlaced}개` : `알까기 판: 흑 ${game.remaining[0]}개, 백 ${game.remaining[1]}개`}
        onPointerMove={movePull} onPointerUp={endPull} onPointerCancel={() => setPulling(false)} onClick={clickBoard}>
        <rect width={ALKKAGI_BOARD} height={ALKKAGI_BOARD} className="alkkagi-wood" />
        {/* 배치 중에는 내가 놓을 수 있는 절반(흑 = 아래, 백 = 위)을 밝게 표시한다 */}
        {canPlace ? (
          <rect className="alkkagi-own-half" x={0} width={ALKKAGI_BOARD} height={ALKKAGI_BOARD / 2 - GRID_STEP / 2}
            y={mySeat === 0 ? ALKKAGI_BOARD / 2 + GRID_STEP / 2 : 0} />
        ) : null}
        {GRID_COORDS.map((line) => (
          <g key={line} className="alkkagi-grid">
            <line x1={GRID_START} y1={line} x2={ALKKAGI_BOARD - GRID_START} y2={line} />
            <line x1={line} y1={GRID_START} x2={line} y2={ALKKAGI_BOARD - GRID_START} />
          </g>
        ))}
        {settingUp ? <line className="alkkagi-center-line" x1={GRID_START} y1={ALKKAGI_BOARD / 2} x2={ALKKAGI_BOARD - GRID_START} y2={ALKKAGI_BOARD / 2} /> : null}
        {aimEnd && selectedPoint ? (
          <line className="alkkagi-aim" x1={selectedPoint.x} y1={selectedPoint.y} x2={aimEnd.x} y2={aimEnd.y} />
        ) : null}
        {positions.map((point, index) => {
          const stone = game.stones[index];
          if (!point || !stone) return null;
          return (
            <circle key={index} cx={point.x} cy={point.y} r={ALKKAGI_STONE_RADIUS}
              className={`alkkagi-stone side-${stone.side}${index === selected ? " selected" : ""}${myTurn && stone.side === mySeat ? " mine" : ""}`}
              onPointerDown={(event) => startPull(event, index)} />
          );
        })}
      </svg>

      {canPlace ? (
        <div className="alkkagi-controls" role="group" aria-label="알 배치">
          {/* 마우스 없이도 놓을 수 있게 칸·줄을 골라 놓는 입력을 함께 둔다(1부터 세는 번호) */}
          <label>
            칸(1~19)
            <input type="number" min={1} max={GRID_LINES} value={placeCol} onChange={(event) => setPlaceCol(Number(event.target.value))} />
          </label>
          <label>
            줄({mySeat === 0 ? "11~19" : "1~9"})
            <input type="number" min={mySeat === 0 ? 11 : 1} max={mySeat === 0 ? GRID_LINES : 9} value={placeRow}
              onChange={(event) => setPlaceRow(Number(event.target.value))} />
          </label>
          <button type="button" className="secondary-button" onClick={() => sendPlace(placeCol - 1, placeRow - 1)}>놓기·빼기</button>
          <button type="button" className="secondary-button" disabled={myPlaced === 0} onClick={() => send({ type: "GAME_ACTION", action: "CLEAR" })}>모두 빼기</button>
          <button type="button" disabled={myPlaced === 0} onClick={() => send({ type: "GAME_ACTION", action: "READY" })}>
            배치 완료 ({myPlaced}/{game.maxStones})
          </button>
        </div>
      ) : null}

      {myTurn ? (
        <div className="alkkagi-controls" role="group" aria-label="튕기기 조작">
          <label>
            내 알
            <select value={selected ?? ""} onChange={(event) => setSelectedStone(event.target.value === "" ? null : Number(event.target.value))}>
              <option value="">고르기</option>
              {game.stones.map((stone, index) => (stone.alive && stone.side === mySeat
                ? <option key={index} value={index}>{index + 1}번 알 ({stone.x}, {stone.y})</option> : null))}
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
          <button type="button" disabled={selected === null} onClick={() => selected !== null && sendFlick(selected, angle, power)}>튕기기</button>
        </div>
      ) : null}

      {game.log.length > 0 && (
        <ol className="alkkagi-log" aria-label="진행 기록">
          {game.log.slice(-8).map((entry, index) => <li key={index}>{entry}</li>)}
        </ol>
      )}
    </div>
  );
};
