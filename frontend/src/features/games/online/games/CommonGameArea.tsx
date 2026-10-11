/**
 * CommonGameArea.tsx — 공통 틀(서버 OnlineGame)로 진행하는 게임의 화면 고르기
 *
 * 서버는 room.game에 "받는 사람에게 맞춘" 상태를 담아 보낸다. 모양은 gameType마다 다르므로,
 * 각 게임 화면이 자기 zod 스키마로 확인한 뒤 그린다. 새 게임을 추가하면 여기에 한 줄을 더한다.
 */
import { BattleshipGame } from "@/features/games/online/games/BattleshipGame";
import { BlackjackGame } from "@/features/games/online/games/BlackjackGame";
import { ChessGame } from "@/features/games/online/games/ChessGame";
import { Game2048Battle } from "@/features/games/online/games/Game2048Battle";
import { MafiaGame } from "@/features/games/online/games/MafiaGame";
import { MemoryMatchGame } from "@/features/games/online/games/MemoryMatchGame";
import { MinesweeperBattle } from "@/features/games/online/games/MinesweeperBattle";
import { NumberBaseballGame } from "@/features/games/online/games/NumberBaseballGame";
import { OneCardGame } from "@/features/games/online/games/OneCardGame";
import { PokerGame } from "@/features/games/online/games/PokerGame";
import { SudokuGame } from "@/features/games/online/games/SudokuGame";
import { SutdaGame } from "@/features/games/online/games/SutdaGame";
import type { OnlineClientMessage, OnlineRoom } from "@/features/games/online/onlineTypes";

export interface CommonGameProperties {
  room: OnlineRoom;
  mySeat: number | null;
  connected: boolean;
  send: (message: OnlineClientMessage) => boolean;
}

export const CommonGameArea = (properties: CommonGameProperties) => {
  switch (properties.room.gameType) {
    case "NUMBER_BASEBALL":
      return <NumberBaseballGame {...properties} />;
    case "BATTLESHIP":
      return <BattleshipGame {...properties} />;
    case "MEMORY_MATCH":
      return <MemoryMatchGame {...properties} />;
    case "ONE_CARD":
      return <OneCardGame {...properties} />;
    case "BLACKJACK":
      return <BlackjackGame {...properties} />;
    case "SUTDA":
      return <SutdaGame {...properties} />;
    case "POKER":
      return <PokerGame {...properties} />;
    case "CHESS":
      return <ChessGame {...properties} />;
    case "MAFIA":
      return <MafiaGame {...properties} />;
    case "SUDOKU":
      return <SudokuGame {...properties} />;
    case "GAME_2048":
      return <Game2048Battle {...properties} />;
    case "MINESWEEPER":
      return <MinesweeperBattle {...properties} />;
    default:
      return <p className="online-hint">아직 준비 중인 게임입니다.</p>;
  }
};
