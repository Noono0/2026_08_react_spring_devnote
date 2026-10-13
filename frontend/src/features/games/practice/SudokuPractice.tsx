/**
 * SudokuPractice.tsx — 대기 중인 스도쿠 대전 방에서 혼자 연습
 *
 * 처음 난이도는 방장이 고른 게임 옵션과 같다. 답이 하나뿐인 문제를 만들어, 겹침 없이 다 채우면 완성으로 본다.
 * 판 UI는 대전 화면과 같은 SudokuBoard를 쓰고, 숫자를 넣을지는 이 화면의 리듀서가 정한다(서버와 주고받지 않음).
 */
import { useEffect, useReducer, useState } from "react";
import { GameRankingSubmitPanel } from "@/features/games/ranking/components/GameRankingSubmitPanel";
import { GameStats } from "@/features/games/shared/GameStats";
import { SudokuBoard, SudokuNumberPad } from "@/features/games/online/games/SudokuBoard";
import { formatSeconds } from "@/features/games/memory/memoryLogic";
import {
  countEmptyCells,
  createSudokuState,
  generateSudoku,
  sudokuDifficulties,
  sudokuReducer,
  type SudokuDifficulty,
} from "@/features/games/sudoku/sudokuLogic";

const difficultyOrder: SudokuDifficulty[] = ["EASY", "NORMAL", "HARD"];

const createGame = (difficulty: SudokuDifficulty) => createSudokuState(difficulty, generateSudoku(difficulty, Math.random));

export const SudokuPractice = ({ nickname, difficulty: initialDifficulty }: { nickname: string; difficulty: SudokuDifficulty }) => {
  const [state, dispatch] = useReducer(sudokuReducer, initialDifficulty, createGame);
  const [selected, setSelected] = useState({ row: 0, col: 0 });

  const isPlaying = state.status === "PLAYING";
  useEffect(() => {
    if (!isPlaying) return;
    const timerId = window.setInterval(() => dispatch({ type: "TICK" }), 1000);
    return () => window.clearInterval(timerId);
  }, [isPlaying]);

  const restart = (nextDifficulty: SudokuDifficulty) => {
    dispatch({ type: "RESTART", difficulty: nextDifficulty, puzzle: generateSudoku(nextDifficulty, Math.random) });
    setSelected({ row: 0, col: 0 });
  };

  const place = (value: number) => dispatch({ type: "PLACE", row: selected.row, col: selected.col, value });
  const erase = () => dispatch({ type: "ERASE", row: selected.row, col: selected.col });
  const empty = countEmptyCells(state.values);
  const won = state.status === "WON";
  const statusMessage = won
    ? `완성했습니다! ${formatSeconds(state.elapsedSeconds)}`
    : state.status === "READY" ? "빈 칸을 고르고 숫자 버튼이나 키보드 1~9로 넣으세요. 겹치는 숫자는 빨갛게 보입니다." : `빈 칸 ${empty}개`;

  return (
    <div className="practice-game">
      <div className="game-toolbar">
        <div className="segmented-buttons" role="group" aria-label="난이도">
          {difficultyOrder.map((option) => (
            <button key={option} type="button" className={option === state.difficulty ? "active" : ""} aria-pressed={option === state.difficulty} onClick={() => restart(option)}>
              {sudokuDifficulties[option].label}
            </button>
          ))}
        </div>
        <button type="button" className="ghost-button" onClick={() => restart(state.difficulty)}>새 문제</button>
      </div>

      <GameStats items={[
        { label: "빈 칸", value: empty },
        { label: "시간", value: formatSeconds(state.elapsedSeconds) },
      ]} />

      <p className={`game-status${won ? " success" : ""}`} aria-live="polite">{statusMessage}</p>

      {won ? (
        <GameRankingSubmitPanel
          gameCode="SUDOKU"
          difficulty={state.difficulty}
          record={{ elapsedSeconds: state.elapsedSeconds }}
          summary={`${sudokuDifficulties[state.difficulty].label} ${formatSeconds(state.elapsedSeconds)}`}
          defaultNickname={nickname}
        />
      ) : null}

      <SudokuBoard
        givens={state.givens}
        values={state.values}
        solution={won ? state.values : null}
        selected={selected}
        readOnly={won}
        label="스도쿠 연습 판. 칸을 고르고 1~9로 넣고, Backspace로 지웁니다"
        onSelect={setSelected}
        onDigit={place}
        onErase={erase}
      />
      <SudokuNumberPad disabled={won} onDigit={place} onErase={erase} />
    </div>
  );
};
