/**
 * CatchMindGame.tsx — 캐치마인드(그림 맞히기) 화면(2~8명)
 *
 * 출제자는 Canvas에 그리고, 나머지는 같은 그림을 보며 답을 적는다.
 *   - 그리는 동안 점을 모았다가 0.12초마다 서버로 보낸다(DRAW). 서버는 모든 선을 모아 모두에게 다시 보낸다.
 *     보낸 선이 돌아오기 전에도 내 화면에는 바로 보이도록, 그리는 중인 선은 drawingRef에 들고 직접 그린다.
 *   - 제시어는 서버가 출제자에게만 보낸다. 다른 사람에게는 글자 수만 온다.
 *   - 정답 판정·점수·차례 넘기기는 모두 서버가 한다.
 *
 * [학습 포인트]
 *   1. useRef: 그리는 중인 점처럼 "바뀔 때마다 다시 렌더링할 필요가 없는 값"을 담는다.
 *      useState에 넣으면 마우스가 움직일 때마다(1초에 수십 번) 컴포넌트 전체가 다시 그려진다.
 *   2. useEffect: 서버에서 새 그림이 오면 Canvas를 다시 그린다. Canvas는 React가 그려 주지 않는 "바깥 세계"다.
 *   3. useMemo: 답을 타이핑할 때마다 zod 검사를 다시 하고 그림 전체(최대 수천 개 점)를 다시 그리지 않도록,
 *      서버 상태(room.game)가 바뀔 때만 검사 결과를 새로 만든다.
 *   4. Pointer Events: 마우스·펜·손가락을 한 가지 코드로 처리한다. setPointerCapture로 그림판 밖으로 나가도 선이 이어진다.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from "react";
import type { CommonGameProperties } from "@/features/games/online/games/CommonGameArea";
import {
  CANVAS_HEIGHT, CANVAS_WIDTH, catchMindSchema, DRAW_FLUSH_INTERVAL_MS, drawStroke, GUESS_MAX_LENGTH, isFarEnough,
  MAX_POINTS_PER_MESSAGE, penColors, penWidths, toCanvasPoint, toDrawNumbers, wordHint,
  type CanvasPoint, type CatchMindStroke,
} from "@/features/games/online/games/catchMindRules";
import { DeadlineTimer } from "@/features/games/online/games/DeadlineTimer";

/** 지금 그리는 중인 선. sentCount = 서버로 이미 보낸 점 개수 */
interface DrawingStroke {
  color: number;
  width: number;
  points: CanvasPoint[];
  sentCount: number;
  lastFlushAt: number;
  active: boolean;
}

/** 흰 바탕을 깔고 서버의 선들, 그리고 그리는 중인 선을 차례로 그린다 */
const paintCanvas = (canvas: HTMLCanvasElement | null, strokes: CatchMindStroke[], drawing: DrawingStroke | null) => {
  const context = canvas?.getContext("2d") ?? null;
  if (!context) return; // 테스트 환경(jsdom)처럼 Canvas를 그릴 수 없는 곳
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  // Canvas의 실제 크기를 1000×750으로 두고 CSS로만 늘리거나 줄이므로 배율은 항상 1이다
  for (const stroke of strokes) drawStroke(context, stroke, 1);
  if (drawing) {
    drawStroke(context, { color: drawing.color, width: drawing.width, points: drawing.points.flatMap((point) => [point.x, point.y]) }, 1);
  }
};

export const CatchMindGame = ({ room, mySeat, connected, send }: CommonGameProperties) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef<DrawingStroke | null>(null);
  const [colorIndex, setColorIndex] = useState(0);
  const [penWidth, setPenWidth] = useState<number>(penWidths[1].value);
  const [guessText, setGuessText] = useState("");
  const parsed = useMemo(() => catchMindSchema.safeParse(room.game), [room.game]);
  const game = parsed.success ? parsed.data : null;
  const strokes = game?.strokes;

  // 서버에서 새 그림이 오면 다시 그린다. 손을 뗀 뒤라면 내 화면에만 있던 선은 버린다(서버에 이미 들어갔다).
  useEffect(() => {
    if (!drawingRef.current?.active) drawingRef.current = null;
    paintCanvas(canvasRef.current, strokes ?? [], drawingRef.current);
  }, [strokes]);

  const nameAt = (seat: number) => room.participants.find((participant) => participant.participantId === room.seats[seat])?.nickname ?? `${seat + 1}번 자리`;
  if (!game) {
    return <p className="online-hint">2~8명이 앉고 방장이 시작하면 한 명씩 돌아가며 제시어를 그림으로 그립니다. 나머지는 그림을 보고 정답을 적으세요. 먼저 맞힌 사람 +10점, 출제자 +5점!</p>;
  }
  const playing = room.status === "PLAYING" && !game.finished && connected;
  const iAmDrawer = mySeat === game.drawerSeat;
  const canDraw = playing && iAmDrawer;
  const canGuess = playing && mySeat != null && !iAmDrawer && game.active[mySeat] !== false;

  const sendAction = (action: string, extra: { text?: string; numbers?: number[] } = {}) =>
    send({ type: "GAME_ACTION", action, ...extra });

  /** 모은 점을 서버로 보낸다. 앞 조각과 이어지도록 "마지막으로 보낸 점"부터 다시 넣는다 */
  const flush = (final: boolean) => {
    const drawing = drawingRef.current;
    if (!drawing) return;
    for (;;) {
      const start = Math.max(0, drawing.sentCount - 1);
      const chunk = drawing.points.slice(start, start + MAX_POINTS_PER_MESSAGE);
      if (start + chunk.length <= drawing.sentCount) break; // 새로 보낼 점이 없다
      // 처음 찍은 점 하나뿐이면 아직 선인지 콕 찍기인지 모른다. 손을 뗄 때(final) 점으로 보낸다
      if (drawing.sentCount === 0 && chunk.length === 1 && !final) break;
      sendAction("DRAW", { numbers: toDrawNumbers(drawing.color, drawing.width, chunk) });
      drawing.sentCount = start + chunk.length;
    }
    drawing.lastFlushAt = Date.now();
  };

  const pointFrom = (event: PointerEvent<HTMLCanvasElement>) =>
    toCanvasPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drawingRef.current = { color: colorIndex, width: penWidth, points: [pointFrom(event)], sentCount: 0, lastFlushAt: Date.now(), active: true };
    paintCanvas(canvasRef.current, game.strokes, drawingRef.current);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const drawing = drawingRef.current;
    if (!drawing?.active) return;
    const point = pointFrom(event);
    if (!isFarEnough(drawing.points.at(-1), point)) return;
    drawing.points.push(point);
    const unsent = drawing.points.length - drawing.sentCount;
    if (Date.now() - drawing.lastFlushAt >= DRAW_FLUSH_INTERVAL_MS || unsent >= MAX_POINTS_PER_MESSAGE - 1) flush(false);
    paintCanvas(canvasRef.current, game.strokes, drawing);
  };

  const handlePointerUp = () => {
    const drawing = drawingRef.current;
    if (!drawing?.active) return;
    flush(true);
    drawing.active = false;
  };

  /** 되돌리기·모두 지우기: 내 화면에만 남은 선도 함께 버려야 지운 선이 계속 보이지 않는다 */
  const sendEdit = (action: "UNDO" | "CLEAR") => {
    drawingRef.current = null;
    sendAction(action);
  };

  const submitGuess = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const answer = guessText.trim();
    if (!answer) return;
    sendAction("GUESS", { text: answer });
    setGuessText("");
  };

  const status = game.finished
    ? (game.winnerSeats.length > 0 ? `${game.winnerSeats.map(nameAt).join(" · ")} 승리!` : "무승부!")
    : iAmDrawer ? "내가 출제자입니다. 제시어를 그림으로 그려 주세요(채팅은 쓸 수 없어요)."
    : `${nameAt(game.drawerSeat)} 님이 그리는 중 · 정답: ${wordHint(game.wordLength)}`;

  return (
    <div className="catch-mind">
      <div className="catch-mind-head">
        {/* 남은 시간은 aria-live 문단 밖에 둔다. 안에 두면 화면 낭독기가 1초마다 읽어 버린다 */}
        {!game.finished ? <DeadlineTimer deadline={game.turnDeadline} /> : null}
        <p className="game-status" aria-live="polite">
          {game.turnNumber}/{game.totalTurns}번째 그림 · {status}
        </p>
      </div>

      {iAmDrawer && game.word && !game.finished && (
        <p className="catch-mind-word" aria-label="제시어">제시어: <strong>{game.word}</strong></p>
      )}

      {canDraw && (
        <div className="catch-mind-tools">
          <div role="group" aria-label="펜 색">
            {penColors.map((color, index) => (
              <button key={color.value} type="button" className="catch-mind-color" style={{ background: color.value }}
                aria-label={color.label} aria-pressed={colorIndex === index} onClick={() => setColorIndex(index)} />
            ))}
          </div>
          <div role="group" aria-label="펜 굵기">
            {penWidths.map((width) => (
              <button key={width.value} type="button" className={penWidth === width.value ? "" : "secondary-button"}
                aria-pressed={penWidth === width.value} onClick={() => setPenWidth(width.value)}>
                {width.label}
              </button>
            ))}
          </div>
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => sendEdit("UNDO")}>되돌리기</button>
            <button type="button" className="secondary-button" onClick={() => sendEdit("CLEAR")}>모두 지우기</button>
            <button type="button" className="danger-button" onClick={() => sendAction("PASS")}>넘기기</button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className={`catch-mind-canvas${canDraw ? " drawable" : ""}`} width={CANVAS_WIDTH} height={CANVAS_HEIGHT}
        role="img" aria-label={canDraw ? "그림판(마우스나 손가락으로 그리세요)" : "출제자의 그림"}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} />

      {canGuess && (
        <form className="catch-mind-guess" onSubmit={submitGuess}>
          <label htmlFor="catch-mind-guess-input">정답</label>
          <input id="catch-mind-guess-input" value={guessText} maxLength={GUESS_MAX_LENGTH} autoComplete="off"
            onChange={(event) => setGuessText(event.target.value)} placeholder="그림을 보고 정답을 적으세요" />
          <button type="submit" disabled={!guessText.trim()}>맞히기</button>
        </form>
      )}

      <div className="catch-mind-side">
        <ol className="catch-mind-scores" aria-label="점수">
          {game.scores.map((score, seat) => (
            <li key={seat} className={`${seat === game.drawerSeat && !game.finished ? "drawer" : ""}${game.active[seat] === false ? " left" : ""}`}>
              <strong>{nameAt(seat)}{seat === mySeat ? " (나)" : ""}</strong>
              <span>{score}점{seat === game.drawerSeat && !game.finished ? " · ✏️ 출제자" : ""}{game.active[seat] === false ? " · 나감" : ""}</span>
            </li>
          ))}
        </ol>
        {game.guesses.length > 0 && (
          <ul className="catch-mind-guesses" aria-label="틀린 답">
            {game.guesses.map((entry, index) => <li key={index}>{entry}</li>)}
          </ul>
        )}
        {game.log.length > 0 && (
          <ol className="catch-mind-log" aria-label="진행 기록">
            {game.log.slice(-6).map((entry, index) => <li key={index}>{entry}</li>)}
          </ol>
        )}
      </div>
    </div>
  );
};
