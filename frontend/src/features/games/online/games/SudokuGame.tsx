/**
 * SudokuGame.tsx — 스도쿠 대전 화면(2~4명)
 *
 * 모두 같은 문제를 받아 각자 자기 판을 채운다(판을 함께 쓰지 않는다).
 *   - 숫자를 넣으면 화면이 판을 바꾸지 않고 서버에 PLACE·CLEAR를 보낸다. 서버가 보낸 내 판(myBoard)으로 다시 그린다.
 *   - 정답 판은 서버만 안다. 서버가 "내 판 = 정답"을 확인하는 순간 그 사람이 이기고 바로 끝난다.
 *   - 다른 사람의 판은 오지 않고 채운 칸 수만 온다(맞은 칸 수를 보내면 숫자를 넣어 보며 정답을 알아낼 수 있다).
 *   - 겹침(빨간 숫자)은 내 판만으로 화면이 계산한다. 정답은 끝난 뒤에 공개된다.
 */
import { useState } from "react";
import type { CommonGameProperties } from "@/features/games/online/games/CommonGameArea";
import { SudokuBoard, SudokuNumberPad } from "@/features/games/online/games/SudokuBoard";
import { sudokuBattleSchema, toSudokuGrid } from "@/features/games/online/games/sudokuRules";
import { countEmptyCells, valueAt, type Position } from "@/features/games/sudoku/sudokuLogic";

export const SudokuGame = ({ room, mySeat, connected, send }: CommonGameProperties) => {
  const [selected, setSelected] = useState<Position>({ row: 0, col: 0 });
  const parsed = sudokuBattleSchema.safeParse(room.game);
  const nameAt = (seat: number) => room.participants.find((participant) => participant.participantId === room.seats[seat])?.nickname ?? `${seat + 1}번 자리`;

  if (!parsed.success) {
    return <p className="online-hint">모두 앉고 방장이 시작하면 모두 같은 스도쿠 문제를 받습니다. 각자 자기 판을 채우고, 가장 먼저 정답을 완성한 사람이 이깁니다. 다른 사람의 판은 보이지 않고 채운 칸 수만 보입니다.</p>;
  }
  const game = parsed.data;
  const givens = toSudokuGrid(game.givens);
  const myBoard = game.myBoard ? toSudokuGrid(game.myBoard) : null;
  const values = myBoard ?? givens;
  const solution = game.solution ? toSudokuGrid(game.solution) : null;
  const playing = room.status === "PLAYING" && !game.finished;
  const amActive = mySeat !== null && game.players[mySeat]?.active === true;
  const canPlay = playing && connected && amActive && myBoard !== null;
  const selectedValue = valueAt(values, selected.row, selected.col);
  const selectedIsGiven = valueAt(givens, selected.row, selected.col) !== 0;

  // 바뀌지 않을 행동(고정 숫자 칸, 같은 숫자 다시 넣기, 빈 칸 지우기)은 서버에 보내지 않는다
  const placeDigit = (value: number) => {
    if (!canPlay || selectedIsGiven || selectedValue === value) return;
    send({ type: "GAME_ACTION", action: "PLACE", numbers: [selected.row, selected.col], number: value });
  };
  const erase = () => {
    if (!canPlay || selectedIsGiven || selectedValue === 0) return;
    send({ type: "GAME_ACTION", action: "CLEAR", numbers: [selected.row, selected.col] });
  };

  const statusText = game.finished ? `${room.lastResult ?? "게임 끝"} — 정답 공개: 틀린 숫자는 빨간 줄, 못 채운 칸은 흐린 정답으로 보입니다.`
    : mySeat === null ? "관전 중입니다. 각자 채운 칸 수만 보이고, 플레이어의 판은 끝날 때까지 비공개입니다."
      : !amActive ? "기권했습니다. 다른 사람이 끝날 때까지 지켜볼 수 있습니다."
        : myBoard && countEmptyCells(myBoard) === 0 ? "모든 칸을 채웠지만 겹치는 숫자가 있습니다. 빨간 숫자를 고쳐 보세요."
          : "모두 같은 문제를 풉니다. 가장 먼저 정답을 완성하면 승리!";

  return (
    <div className="sudoku-battle">
      <ul className="sudoku-battle-players" aria-label="진행 상황">
        {game.players.map((player, seat) => (
          <li key={seat} className={`sudoku-battle-player seat-${seat}${player.active ? "" : " out"}${game.winners.includes(seat) ? " winner" : ""}`}>
            <strong>{nameAt(seat)}{seat === mySeat ? " (나)" : ""}</strong>
            <progress max={game.emptyCells} value={player.filled} aria-label={`${nameAt(seat)} 채운 칸`} />
            <span>{player.filled}/{game.emptyCells}칸{player.active ? "" : " · 빠짐"}{game.winners.includes(seat) ? " · 승리" : ""}</span>
          </li>
        ))}
      </ul>
      <p className={`game-status${game.finished ? " success" : ""}`} aria-live="polite">{statusText}</p>
      <div className="sudoku-play">
        <SudokuBoard
          givens={givens}
          values={values}
          solution={solution}
          selected={selected}
          readOnly={!canPlay}
          label={myBoard ? "내 스도쿠 판. 방향키로 이동, 1~9 숫자 넣기, Backspace 지우기" : "스도쿠 문제"}
          onSelect={setSelected}
          onDigit={placeDigit}
          onErase={erase}
        />
        {myBoard ? <SudokuNumberPad disabled={!canPlay} onDigit={placeDigit} onErase={erase} /> : null}
      </div>
    </div>
  );
};
