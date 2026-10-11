package com.example.devnote.online.domain.game;

import com.example.devnote.online.domain.OnlineGameType;

import java.util.List;
import java.util.Random;

/**
 * 게임 종류 → 게임 객체 만들기. 새 게임을 추가하면 여기와 OnlineGameType(available=true)만 고치면 된다.
 * random: 카드 섞기 등에 쓰는 난수. Service가 만든 시드로 만들어, 테스트에서는 같은 시드로 같은 결과를 확인한다.
 * option: 방장이 고른 게임 옵션 code(OnlineRoom이 OnlineGameType.getOptions()로 이미 검사했다). 옵션이 없는 게임은 null
 */
public final class OnlineGames {
    private OnlineGames() {}

    /** 이 공통 틀(OnlineGame)로 진행하는 게임인지. 오목·테트리스는 먼저 만든 전용 코드로 진행한다 */
    public static boolean usesCommonGame(OnlineGameType type) {
        return switch (type) {
            case OMOK, TETRIS -> false;
            default -> true;
        };
    }

    public static OnlineGame create(OnlineGameType type, List<String> nicknames, Random random, String option) {
        return switch (type) {
            case NUMBER_BASEBALL -> new NumberBaseballGame(nicknames);
            case BATTLESHIP -> new BattleshipGame(nicknames, random);
            case MEMORY_MATCH -> new MemoryMatchGame(nicknames, random);
            case ONE_CARD -> new OneCardGame(nicknames, random);
            case BLACKJACK -> new BlackjackGame(nicknames, random);
            case SUTDA -> new SutdaGame(nicknames, random);
            case POKER -> new PokerGame(nicknames, random);
            case CHESS -> new ChessGame(nicknames);
            case MAFIA -> new MafiaGame(nicknames, random);
            case SUDOKU -> new SudokuGame(nicknames, random, SudokuGame.givenCountFor(option));
            case GAME_2048 -> new Game2048Game(nicknames, random, Integer.parseInt(option));
            case MINESWEEPER -> new MinesweeperGame(nicknames, random, MinesweeperGame.Difficulty.valueOf(option));
            default -> throw new IllegalStateException("아직 만들지 않은 게임입니다: " + type);
        };
    }
}
