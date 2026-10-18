/**
 * SuikaBoard.tsx — 수박게임 판(혼자 연습·온라인 대전 공용)
 *
 * [조작] 마우스·손가락을 판 위에서 움직이면 떨어뜨릴 위치가 따라오고, 누르면(손을 떼면) 떨어뜨린다.
 *   키보드: 판에 포커스를 두고 ←·→(Shift와 함께 크게)로 옮기고 Space·Enter로 떨어뜨린다.
 *   떨어뜨린 뒤 0.5초는 다음 과일을 떨어뜨릴 수 없다(연타로 쌓기 방지).
 *
 * [학습 포인트]
 *   - 물리는 requestAnimationFrame으로 매 프레임 stepWorld(순수 함수)를 불러 새 상태를 만든다.
 *     Effect 정리에서 cancelAnimationFrame을 부르지 않으면 판을 닫아도 계산이 계속 돈다.
 *   - 다음 과일을 고르는 난수(random)는 부모가 준다. 온라인 대전은 서버 시드로 모두 같은 순서, 연습은 Math.random.
 *     useRef에 담아 두어 렌더링마다 새로 만들지 않는다(같은 순서를 이어 가야 하므로).
 *   - 점수가 바뀌거나 끝났을 때 부모에게 알린다(onScoreChange·onGameOver). 부모는 그것을 서버로 보내거나 기록한다.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  BOX_HEIGHT, BOX_WIDTH, clampDropX, createWorld, DANGER_LINE_Y, DROP_Y, dropFruit, FRUITS, randomLevel, stepWorld,
  type SuikaWorld,
} from "@/features/games/suika/suikaLogic";

const DROP_COOLDOWN_MS = 500;
const KEY_STEP = 12;

interface SuikaBoardProps {
  random: () => number;
  /** true면 멈춘다(온라인 대전이 끝났거나 아직 시작 전) */
  disabled?: boolean;
  onScoreChange?: (score: number) => void;
  onGameOver?: (score: number) => void;
}

export const SuikaBoard = ({ random, disabled = false, onScoreChange, onGameOver }: SuikaBoardProps) => {
  const randomRef = useRef(random);
  const [world, setWorld] = useState<SuikaWorld>(createWorld);
  const [current, setCurrent] = useState(() => randomLevel(randomRef.current));
  const [next, setNext] = useState(() => randomLevel(randomRef.current));
  const [aimX, setAimX] = useState(BOX_WIDTH / 2);
  const lastDropRef = useRef(-Infinity);
  const svgRef = useRef<SVGSVGElement>(null);
  const running = !disabled && !world.over;

  // 물리 루프. 멈춘 상태(끝남·비활성)면 돌리지 않는다
  useEffect(() => {
    if (!running) return;
    let frameId = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setWorld((previous) => stepWorld(previous, dt));
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [running]);

  // 점수·끝 알림(부모 콜백은 렌더링마다 새로 만들어질 수 있어 ref에 담아 Effect 의존성에서 뺀다)
  const callbacksRef = useRef({ onScoreChange, onGameOver });
  callbacksRef.current = { onScoreChange, onGameOver };
  useEffect(() => {
    callbacksRef.current.onScoreChange?.(world.score);
  }, [world.score]);
  useEffect(() => {
    if (world.over) callbacksRef.current.onGameOver?.(world.score);
  }, [world.over, world.score]);

  const drop = () => {
    if (!running) return;
    const now = performance.now();
    if (now - lastDropRef.current < DROP_COOLDOWN_MS) return;
    lastDropRef.current = now;
    setWorld((previous) => dropFruit(previous, current, aimX));
    setCurrent(next);
    setNext(randomLevel(randomRef.current));
  };

  const pointerX = (event: PointerEvent<SVGSVGElement>) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || box.width <= 0) return aimX;
    return ((event.clientX - box.left) / box.width) * BOX_WIDTH;
  };

  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const step = (event.shiftKey ? 4 : 1) * KEY_STEP * (event.key === "ArrowLeft" ? -1 : 1);
      setAimX((x) => clampDropX(current, x + step));
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      drop();
    }
  };

  const currentFruit = FRUITS[current];
  const nextFruit = FRUITS[next];
  const shownX = clampDropX(current, aimX);

  return (
    <div className="suika-board-wrap">
      <div className="suika-hud">
        <span>점수 <strong>{world.score}</strong></span>
        <span>다음 {nextFruit ? `${nextFruit.emoji} ${nextFruit.name}` : ""}</span>
      </div>
      <svg ref={svgRef} className={`suika-board${running ? "" : " stopped"}`} viewBox={`0 0 ${BOX_WIDTH} ${BOX_HEIGHT}`}
        role="application" tabIndex={0}
        aria-label={`수박게임 상자. 떨어뜨릴 과일 ${currentFruit?.name ?? ""}. ←·→로 옮기고 Space로 떨어뜨립니다. 점수 ${world.score}`}
        onPointerMove={(event) => setAimX(pointerX(event))}
        onPointerUp={(event) => { setAimX(pointerX(event)); drop(); }}
        onKeyDown={handleKeyDown}>
        <rect width={BOX_WIDTH} height={BOX_HEIGHT} className="suika-box" />
        <line x1={0} y1={DANGER_LINE_Y} x2={BOX_WIDTH} y2={DANGER_LINE_Y} className="suika-danger" />
        {running && currentFruit ? (
          <g className="suika-aim">
            <line x1={shownX} y1={DROP_Y} x2={shownX} y2={BOX_HEIGHT} />
            <circle cx={shownX} cy={DROP_Y} r={currentFruit.radius} fill={currentFruit.color} opacity={0.75} />
            <text x={shownX} y={DROP_Y} fontSize={currentFruit.radius * 1.2} textAnchor="middle" dominantBaseline="central">{currentFruit.emoji}</text>
          </g>
        ) : null}
        {world.fruits.map((fruit) => {
          const kind = FRUITS[fruit.level];
          if (!kind) return null;
          return (
            <g key={fruit.id} transform={`translate(${fruit.x} ${fruit.y})`}>
              <circle r={kind.radius} fill={kind.color} className="suika-fruit" />
              <text fontSize={kind.radius * 1.2} textAnchor="middle" dominantBaseline="central">{kind.emoji}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
