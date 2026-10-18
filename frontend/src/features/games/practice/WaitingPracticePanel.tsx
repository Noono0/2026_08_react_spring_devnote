/**
 * WaitingPracticePanel.tsx — 방 대기 중에만 보이는 "혼자 연습하기"
 *
 * 상대를 기다리는 동안, 혼자 해도 의미가 있는 게임만 연습한다(practiceGames.ts).
 * 게임이 시작되면 부모(OnlineRoomScreen)가 이 패널을 그리지 않으므로 연습은 자동으로 닫힌다.
 * 펼쳐 두었을 때 방장이 게임 종류나 옵션을 바꾸면 key가 바뀌어 연습 판이 처음부터 다시 만들어진다.
 */
import { useState } from "react";
import { AlkkagiPractice } from "./AlkkagiPractice";
import { Game2048Practice } from "./Game2048Practice";
import { MemoryPractice } from "./MemoryPractice";
import { MinesweeperPractice } from "./MinesweeperPractice";
import { OlympicPractice } from "./OlympicPractice";
import {
  isPracticeGameType,
  practiceGameLabels,
  to2048Target,
  toMinesweeperDifficulty,
  toPuyoColorCount,
  toSudokuDifficulty,
  type PracticeGameType,
} from "./practiceGames";
import { PuyoPractice } from "./PuyoPractice";
import { SudokuPractice } from "./SudokuPractice";
import { TetrisPractice } from "./TetrisPractice";

interface WaitingPracticePanelProps {
  gameType: string;
  gameOption: string | null | undefined;
  nickname: string;
}

const PracticeBody = ({ gameType, gameOption, nickname }: { gameType: PracticeGameType; gameOption: string | null | undefined; nickname: string }) => {
  switch (gameType) {
    case "TETRIS":
      return <TetrisPractice nickname={nickname} />;
    case "PUYO":
      return <PuyoPractice nickname={nickname} colorCount={toPuyoColorCount(gameOption)} />;
    case "MEMORY_MATCH":
      return <MemoryPractice nickname={nickname} />;
    case "GAME_2048":
      return <Game2048Practice nickname={nickname} target={to2048Target(gameOption)} />;
    case "MINESWEEPER":
      return <MinesweeperPractice nickname={nickname} difficulty={toMinesweeperDifficulty(gameOption)} />;
    case "SUDOKU":
      return <SudokuPractice nickname={nickname} difficulty={toSudokuDifficulty(gameOption)} />;
    case "OLYMPIC":
      return <OlympicPractice />;
    case "ALKKAGI":
      return <AlkkagiPractice />;
  }
};

export const WaitingPracticePanel = ({ gameType, gameOption, nickname }: WaitingPracticePanelProps) => {
  const [open, setOpen] = useState(false);
  if (!isPracticeGameType(gameType)) return null;
  const label = practiceGameLabels[gameType];

  return (
    <section className="waiting-practice" aria-label="혼자 연습하기">
      <div className="waiting-practice-header">
        <div>
          <h2>혼자 연습하기</h2>
          <p className="online-hint">상대를 기다리는 동안 이 게임을 혼자 해 볼 수 있습니다. 게임이 시작되면 연습은 닫힙니다. 끝난 판은 연습 기록 랭킹에 올릴 수 있습니다.</p>
        </div>
        <button type="button" className={open ? "ghost-button" : ""} aria-expanded={open} onClick={() => setOpen((previous) => !previous)}>
          {open ? "연습 접기" : `${label} 연습하기`}
        </button>
      </div>
      {open ? <PracticeBody key={`${gameType}:${gameOption ?? ""}`} gameType={gameType} gameOption={gameOption} nickname={nickname} /> : null}
    </section>
  );
};
