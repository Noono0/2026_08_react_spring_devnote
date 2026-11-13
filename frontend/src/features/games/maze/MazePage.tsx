import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { createSeededRandom } from "@/features/games/shared/random";
import { readGameRecord, writeGameRecord } from "@/features/games/shared/gameRecordStorage";
import { createMaze, findMazePath, isMazeExit, mazeDifficulties, moveInMaze, type Direction, type MazeDifficulty } from "./mazeLogic";
import "@/features/games/shared/games.css";
import { MazeBoardView } from "./MazeBoardView";
import "./maze.css";

const bestTimeSchema = z.number().int().positive();

function MazeRun({ difficulty, seed }: { difficulty: MazeDifficulty; seed: number }) {
  const [maze] = useState(() => createMaze(mazeDifficulties[difficulty].size, createSeededRandom(seed)));
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  const [game, setGame] = useState({ position: maze.start, steps: 0, finishedAt: 0, hintUsed: false });
  const [showHint, setShowHint] = useState(false);
  const recordKey = `maze.${difficulty}.best-ms`;
  const [best, setBest] = useState(() => readGameRecord(recordKey, bestTimeSchema));
  const resultReference = useRef<HTMLHeadingElement>(null);
  const elapsed = Math.max(0, (game.finishedAt || now) - startedAt);
  useEffect(() => {
    if (game.finishedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [game.finishedAt]);
  useEffect(() => {
    if (!game.finishedAt) return;
    resultReference.current?.focus();
    const milliseconds = Math.max(1, game.finishedAt - startedAt);
    if (!game.hintUsed && (best === null || milliseconds < best)) { setBest(milliseconds); writeGameRecord(recordKey, milliseconds); }
  }, [game.finishedAt, game.hintUsed, startedAt, best, recordKey]);

  const move = (direction: Direction) => {
    const movedAt = Date.now();
    setGame((previous) => {
      if (previous.finishedAt) return previous;
      const position = moveInMaze(maze, previous.position, direction);
      if (position === previous.position) return previous;
      return { ...previous, position, steps: previous.steps + 1, finishedAt: isMazeExit(maze, position) ? Math.max(startedAt + 1, movedAt) : 0 };
    });
  };
  const hint = showHint ? findMazePath(maze, game.position) : [];
  return <section className="game-panel maze-run" aria-label="미로 탈출">
    <dl className="game-stats"><div><dt>시간</dt><dd>{(elapsed / 1000).toFixed(1)}초</dd></div><div><dt>이동</dt><dd>{game.steps}칸</dd></div>
      <div><dt>이 난이도 최고 기록</dt><dd>{best === null ? "없음" : `${(best / 1000).toFixed(1)}초`}</dd></div></dl>
    {game.finishedAt ? <div role="status"><h2 ref={resultReference} tabIndex={-1}>탈출 성공!</h2><p>{(elapsed / 1000).toFixed(1)}초 · {game.steps}칸 이동{game.hintUsed ? " · 길 안내 사용: 최고 기록에 저장하지 않습니다." : " · 이 브라우저에 최고 기록을 저장합니다."}</p></div> : <p className="game-status">파란 말을 초록색 출구까지 이동하세요. 화살표·WASD 키 또는 아래 버튼을 사용합니다.</p>}
    <MazeBoardView maze={maze} position={game.position} disabled={Boolean(game.finishedAt)} onMove={move} hint={hint} />
    <button type="button" className="ghost-button" disabled={Boolean(game.finishedAt)} aria-pressed={showHint} onClick={() => { setShowHint((previous) => !previous); setGame((previous) => ({ ...previous, hintUsed: true })); }}>{showHint ? "길 안내 숨기기" : "길 안내 보기"}</button>
    <p className="game-status">길 안내를 한 번이라도 사용한 판은 최고 기록에서 제외합니다. 미로마다 길이가 달라 최고 시간은 개인 연습용입니다.</p>
  </section>;
}

export function MazePractice({ initialDifficulty = "NORMAL" }: { initialDifficulty?: MazeDifficulty }) {
  const [difficulty, setDifficulty] = useState<MazeDifficulty>(initialDifficulty);
  const [run, setRun] = useState<{ difficulty: MazeDifficulty; seed: number; version: number }>();
  return <div className="maze-page">
    <div className="game-panel"><div className="game-toolbar"><label htmlFor="maze-difficulty">난이도</label>
      <select id="maze-difficulty" value={difficulty} onChange={(event) => { const next = Object.keys(mazeDifficulties).find((key) => key === event.target.value); if (next === "EASY" || next === "NORMAL" || next === "HARD") setDifficulty(next); }}>
        {Object.entries(mazeDifficulties).map(([value, option]) => <option key={value} value={value}>{option.label} ({option.size} × {option.size})</option>)}</select>
      <button type="button" onClick={() => setRun((previous) => ({ difficulty, seed: Math.floor(Math.random() * 0x1_0000_0000), version: (previous?.version ?? 0) + 1 }))}>{run ? "새 미로 시작" : "미로 시작"}</button></div>
      <p className="game-status">시작을 누르면 시간이 흐릅니다. 새 미로를 시작하면 현재 진행은 초기화됩니다. 기록은 이 브라우저에만 저장합니다.</p></div>
    {run ? <MazeRun key={run.version} difficulty={run.difficulty} seed={run.seed} /> : <div className="game-panel"><p>난이도를 고르고 미로 시작을 누르세요. 벽을 통과할 수 없으며, 모든 미로에는 출구로 가는 길이 있습니다.</p></div>}
  </div>;
}

export function MazePage() {
  return <section className="site-page maze-page"><div className="page-hero"><span className="page-kicker">Maze</span><h1>미로게임</h1><p>매번 달라지는 길을 탐색하고 출구를 찾아보세요.</p><Link to="/games">게임 홈으로</Link> · <Link to="/games/online">온라인 대전</Link></div><MazePractice /></section>;
}
