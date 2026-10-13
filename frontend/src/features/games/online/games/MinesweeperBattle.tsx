/**
 * MinesweeperBattle.tsx — 지뢰 찾기 대전 화면(2~4명)
 *
 * 모두 같은 지뢰 배치를 각자 자기 판에서 푼다. 시작할 때 모든 판에 같은 빈 영역이 미리 열려 있다.
 * 지뢰가 아닌 칸을 가장 적은 클릭으로 모두 연 사람이 1위, 지뢰를 밟으면 그 판은 멈춘다.
 *   - 지뢰 위치는 서버만 안다. 화면은 칸을 눌렀다는 부탁(REVEAL·FLAG·CHORD)만 보내고 서버가 보낸 판으로 다시 그린다.
 *   - 조작: 누르기 = 열기(열린 숫자를 누르면 주변 깃발 수가 맞을 때 나머지를 한꺼번에 연다),
 *     오른쪽 클릭 = 깃발, 터치는 "깃발 모드", 키보드는 방향키 이동 · Enter·Space 열기 · F 깃발
 *   - 로빙 탭인덱스: 칸 수백 개 중 "지금 칸" 하나만 Tab으로 들어가고 방향키로 옮긴다(혼자 하기와 같은 방법).
 */
import { useRef, useState, type KeyboardEvent } from "react";
import type { CommonGameProperties } from "@/features/games/online/games/CommonGameArea";
import {
  arrowOffsets,
  cellAt,
  cellLabel,
  cellText,
  isNumberCell,
  isRevealedCell,
  minesweeperBattleSchema,
  type MinesweeperBattlePlayer,
  type MinesweeperBattleView,
} from "@/features/games/online/games/minesweeperBattleRules";
import { RaceNameplate } from "@/features/games/online/games/RaceNameplate";
import { raceStatusLabels } from "@/features/games/online/games/raceBattleRules";

const recordText = (player: MinesweeperBattlePlayer, safeCells: number) => `${player.revealed}/${safeCells}칸 · ${player.clicks}번`;

const describeMyState = (game: MinesweeperBattleView, me: MinesweeperBattlePlayer | undefined, lastResult: string | null | undefined): string => {
  if (game.finished) return `${lastResult ?? "게임 끝"} — 지뢰 위치가 공개되었습니다.`;
  if (!me) return "관전 중입니다. 지뢰 위치는 게임이 끝날 때까지 아무에게도 보이지 않습니다.";
  switch (me.status) {
    case "SUCCESS": return `지뢰를 모두 피했습니다! ${me.clicks}번 클릭 — 다른 사람이 끝날 때까지 기다립니다.`;
    case "FAILED": return `지뢰를 밟았습니다(${me.revealed}칸 열기). 다른 사람이 끝날 때까지 기다립니다.`;
    case "LEFT": return "기권했습니다. 다른 사람이 끝날 때까지 지켜볼 수 있습니다.";
    default: return `남은 지뢰 ${game.mines - me.flags}개 · 지뢰가 아닌 칸을 가장 적은 클릭으로 모두 열면 1위!`;
  }
};

/** 작은 판 칸의 색 클래스(글자 없이 색만) */
const miniCellClass = (cell: string): string => {
  if (cell === "F" || cell === "W") return "mini-flag";
  if (cell === "*") return "mini-mine";
  if (cell === "X") return "mini-exploded";
  return isRevealedCell(cell) ? "mini-revealed" : "mini-hidden";
};

const MiniBoard = ({ player, seat, mySeat, game }: { player: MinesweeperBattlePlayer; seat: number; mySeat: number | null; game: MinesweeperBattleView }) => (
  <figure className={`race-opponent${player.status === "PLAYING" ? "" : " done"}`}
    aria-label={`${player.nickname} 판, ${recordText(player, game.safeCells)}, ${raceStatusLabels[player.status]}${player.rank != null ? `, ${player.rank}위` : ""}`}>
    <RaceNameplate nickname={player.nickname} isMe={seat === mySeat} status={player.status} rank={player.rank}
      winner={game.winners.includes(seat)} record={recordText(player, game.safeCells)} />
    <div className="race-mini-mines" style={{ gridTemplateColumns: `repeat(${game.cols}, 1fr)` }} aria-hidden="true">
      {player.board.flatMap((line, rowIndex) => [...line].map((cell, colIndex) => <span key={`${rowIndex}-${colIndex}`} className={miniCellClass(cell)} />))}
    </div>
  </figure>
);

export const MinesweeperBattle = ({ room, mySeat, connected, send }: CommonGameProperties) => {
  const [isFlagMode, setIsFlagMode] = useState(false);
  const [savedFocus, setFocusedCell] = useState({ row: 0, col: 0 });
  // 칸 버튼들. "행-열" → 버튼. 포커스를 옮길 DOM이라 ref에 둔다
  const cellButtonsRef = useRef(new Map<string, HTMLButtonElement>());
  const parsed = minesweeperBattleSchema.safeParse(room.game);

  if (!parsed.success) {
    return <p className="online-hint">모두 앉고 방장이 시작하면 모두 같은 지뢰 배치를 받습니다. 지뢰가 아닌 칸을 가장 적은 클릭으로 모두 연 사람이 이기고, 지뢰를 밟으면 그 판은 끝납니다. 지뢰 위치는 게임이 끝난 뒤에 공개됩니다.</p>;
  }
  const game = parsed.data;
  const me = mySeat === null ? undefined : game.players[mySeat];
  const canPlay = room.status === "PLAYING" && !game.finished && connected && me?.status === "PLAYING";
  // 다음 판에서 난이도(판 크기)가 작아져도 Tab으로 들어갈 칸 하나는 판 안에 있게 한다
  const focusedCell = { row: Math.min(savedFocus.row, game.rows - 1), col: Math.min(savedFocus.col, game.cols - 1) };

  const sendCell = (action: "REVEAL" | "FLAG" | "CHORD", row: number, col: number) => {
    if (canPlay) send({ type: "GAME_ACTION", action, numbers: [row, col] });
  };

  // 바뀌지 않을 행동(빈 칸 0 누르기, 깃발 칸 열기)은 보내지 않는다
  const handleCellClick = (row: number, col: number) => {
    setFocusedCell({ row, col });
    if (!me) return;
    const cell = cellAt(me.board, row, col);
    if (isNumberCell(cell)) sendCell("CHORD", row, col);
    else if (isFlagMode && (cell === "." || cell === "F")) sendCell("FLAG", row, col);
    else if (cell === ".") sendCell("REVEAL", row, col);
  };

  const toggleFlag = (row: number, col: number) => {
    if (!me) return;
    const cell = cellAt(me.board, row, col);
    if (cell === "." || cell === "F") sendCell("FLAG", row, col);
  };

  const handleBoardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const offset = arrowOffsets[event.key];
    if (offset) {
      event.preventDefault();
      const next = {
        row: Math.min(game.rows - 1, Math.max(0, focusedCell.row + offset.row)),
        col: Math.min(game.cols - 1, Math.max(0, focusedCell.col + offset.col)),
      };
      setFocusedCell(next);
      cellButtonsRef.current.get(`${next.row}-${next.col}`)?.focus();
      return;
    }
    if (event.key === "f" || event.key === "F") {
      event.preventDefault();
      toggleFlag(focusedCell.row, focusedCell.col);
    }
  };

  const others = game.players.map((player, seat) => ({ player, seat })).filter(({ seat }) => seat !== mySeat);
  const statusTone = me?.status === "SUCCESS" || game.finished ? " success" : me?.status === "FAILED" ? " danger" : "";

  return (
    <div className="race-battle">
      <p className={`game-status${statusTone}`} aria-live="polite">{describeMyState(game, me, room.lastResult)}</p>
      <div className={`race-arena${me ? "" : " spectator"}`}>
        {me && mySeat !== null ? (
          <section className="race-arena-me" aria-label="내 판">
            <RaceNameplate nickname={me.nickname} isMe status={me.status} rank={me.rank} winner={game.winners.includes(mySeat)} record={recordText(me, game.safeCells)} />
            <button type="button" className={isFlagMode ? "" : "ghost-button"} aria-pressed={isFlagMode} disabled={!canPlay} onClick={() => setIsFlagMode((previous) => !previous)}>
              🚩 깃발 모드 {isFlagMode ? "켜짐" : "꺼짐"}
            </button>
            {/* 고급(30열)은 좁은 화면에서 넘치므로 판만 가로로 스크롤한다 */}
            <div className="minesweeper-scroll">
              <div
                className={`minesweeper-board${canPlay ? "" : " finished"}`}
                style={{ gridTemplateColumns: `repeat(${game.cols}, var(--mine-cell-size))` }}
                role="group"
                aria-label={`내 지뢰 찾기 판 ${game.cols}×${game.rows}. 방향키로 이동, Enter 열기, F 깃발`}
                onKeyDown={handleBoardKeyDown}
              >
                {me.board.map((line, rowIndex) => [...line].map((cell, colIndex) => {
                  const key = `${rowIndex}-${colIndex}`;
                  const className = [
                    "mine-cell",
                    isRevealedCell(cell) ? "revealed" : "hidden",
                    isNumberCell(cell) ? `mine-number-${cell}` : "",
                    cell === "X" ? "exploded" : "",
                  ].filter(Boolean).join(" ");
                  return (
                    <button
                      key={key}
                      ref={(element) => {
                        if (element) cellButtonsRef.current.set(key, element);
                        else cellButtonsRef.current.delete(key);
                      }}
                      type="button"
                      className={className}
                      tabIndex={focusedCell.row === rowIndex && focusedCell.col === colIndex ? 0 : -1}
                      aria-label={cellLabel(cell, rowIndex, colIndex)}
                      aria-disabled={!canPlay}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                      onContextMenu={(event) => {
                        event.preventDefault(); // 브라우저 메뉴 대신 깃발
                        setFocusedCell({ row: rowIndex, col: colIndex });
                        toggleFlag(rowIndex, colIndex);
                      }}
                    >
                      {cellText(cell)}
                    </button>
                  );
                }))}
              </div>
            </div>
          </section>
        ) : null}
        <section className="race-arena-others" aria-label={me ? "다른 플레이어 판" : "플레이어 판"}>
          {others.map(({ player, seat }) => <MiniBoard key={seat} player={player} seat={seat} mySeat={mySeat} game={game} />)}
        </section>
      </div>
    </div>
  );
};
