package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * 배틀십(2명).
 *
 * [규칙]
 *   1. 배치: 10×10 판에 배 5척(길이 5·4·3·3·2)을 놓는다. "다시 배치"로 무작위 배치를 바꾸고, 마음에 들면 "준비 완료".
 *   2. 진행: 둘 다 준비되면 0번 자리부터 번갈아 상대 판의 한 칸을 쏜다. 배가 있으면 명중(X), 없으면 빗나감(o).
 *      배의 모든 칸이 맞으면 격침되고, 격침된 배는 모두에게 드러난다.
 *   3. 상대 배를 모두 격침하면 승리. 기권·퇴장하면 상대가 이긴다.
 *
 * [숨긴 정보] 내 배 위치는 나에게만 보낸다. 상대에게는 쏜 결과(o·X)와 격침된 배만 보인다. 끝나면 모두 공개.
 */
public class BattleshipGame implements OnlineGame {
    public static final int SIZE = 10;
    public static final List<Integer> SHIP_LENGTHS = List.of(5, 4, 3, 3, 2);
    private static final int MISS = 1;
    private static final int HIT = 2;

    public enum Phase { PLACE, PLAY, FINISHED }

    public record Cell(int row, int col) {}

    /**
     * 판 하나의 화면 상태. rows: 10줄 × 10글자
     *   "." 모름·빈 바다  "S" 배(보이는 사람에게만)  "o" 빗나감  "X" 명중  "#" 격침된 배
     */
    public record BoardView(int seat, List<String> rows, int shipsLeft) {}

    public record View(String phase, int size, List<Integer> shipLengths, Integer mySeat, List<Boolean> ready,
                       Integer turnSeat, Integer winnerSeat, int shotsFired, List<BoardView> boards) {}

    private final List<String> nicknames;
    private final Random random;
    /** 자리별 배 목록(배 = 칸 목록) */
    private final List<List<List<Cell>>> fleets = new ArrayList<>();
    /** 자리별로 "그 판에 쏜 기록": 0 안 쏨, 1 빗나감, 2 명중 */
    private final int[][][] shots;
    private final boolean[] ready;
    private final List<String> announcements = new ArrayList<>();
    private Phase phase = Phase.PLACE;
    private int turnSeat = -1;
    private Integer winnerSeat;
    private int shotsFired;

    public BattleshipGame(List<String> nicknames, Random random) {
        if (nicknames.size() != 2) throw new IllegalArgumentException("배틀십은 2명이 합니다.");
        this.nicknames = List.copyOf(nicknames);
        this.random = random;
        this.shots = new int[2][SIZE][SIZE];
        this.ready = new boolean[2];
        for (int seat = 0; seat < 2; seat++) fleets.add(randomFleet());
    }

    /** 배 5척을 겹치지 않게 무작위로 놓는다(가로·세로) */
    List<List<Cell>> randomFleet() {
        boolean[][] occupied = new boolean[SIZE][SIZE];
        List<List<Cell>> fleet = new ArrayList<>();
        for (int length : SHIP_LENGTHS) {
            while (true) {
                boolean horizontal = random.nextBoolean();
                int row = random.nextInt(horizontal ? SIZE : SIZE - length + 1);
                int col = random.nextInt(horizontal ? SIZE - length + 1 : SIZE);
                List<Cell> ship = new ArrayList<>();
                for (int offset = 0; offset < length; offset++) ship.add(horizontal ? new Cell(row, col + offset) : new Cell(row + offset, col));
                if (ship.stream().anyMatch(cell -> occupied[cell.row()][cell.col()])) continue;
                ship.forEach(cell -> occupied[cell.row()][cell.col()] = true);
                fleet.add(List.copyOf(ship));
                break;
            }
        }
        return fleet;
    }

    /** 테스트용: 배치를 직접 정한다 */
    void setFleet(int seat, List<List<Cell>> fleet) {
        fleets.set(seat, fleet);
    }

    @Override
    public void act(int seat, GameAction action) {
        if (phase == Phase.FINISHED || seat < 0 || seat > 1) throw new BusinessException(ErrorCode.ONLINE_GAME_NOT_PLAYING);
        switch (action.actionName()) {
            case "RANDOMIZE" -> {
                requirePlacing(seat);
                fleets.set(seat, randomFleet());
            }
            case "READY" -> {
                requirePlacing(seat);
                ready[seat] = true;
                announcements.add(nicknames.get(seat) + "님이 배치를 마쳤습니다.");
                if (ready[0] && ready[1]) {
                    phase = Phase.PLAY;
                    turnSeat = 0;
                    announcements.add("전투 시작! " + nicknames.get(0) + "님부터 쏩니다.");
                }
            }
            case "FIRE" -> fire(seat, action.numbers());
            default -> throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        }
    }

    private void requirePlacing(int seat) {
        if (phase != Phase.PLACE || ready[seat]) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "배치를 바꿀 수 있는 때가 아닙니다.");
    }

    private void fire(int seat, List<Integer> target) {
        if (phase != Phase.PLAY) throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "아직 쏠 수 없습니다.");
        if (seat != turnSeat) throw new BusinessException(ErrorCode.ONLINE_NOT_YOUR_TURN);
        if (target == null || target.size() != 2 || target.get(0) == null || target.get(1) == null) throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        int row = target.get(0);
        int col = target.get(1);
        int enemy = 1 - seat;
        if (row < 0 || row >= SIZE || col < 0 || col >= SIZE || shots[enemy][row][col] != 0) {
            throw new BusinessException(ErrorCode.ONLINE_MOVE_INVALID, "이미 쏜 칸이거나 판 밖입니다.");
        }
        shotsFired++;
        List<Cell> ship = shipAt(enemy, row, col);
        shots[enemy][row][col] = ship == null ? MISS : HIT;
        if (ship != null && isSunk(enemy, ship)) {
            announcements.add(nicknames.get(seat) + "님이 " + nicknames.get(enemy) + "님의 배(" + ship.size() + "칸)를 격침했습니다!");
            if (shipsLeft(enemy) == 0) {
                winnerSeat = seat;
                phase = Phase.FINISHED;
                return;
            }
        }
        turnSeat = enemy;
    }

    private List<Cell> shipAt(int seat, int row, int col) {
        for (List<Cell> ship : fleets.get(seat)) if (ship.contains(new Cell(row, col))) return ship;
        return null;
    }

    private boolean isSunk(int seat, List<Cell> ship) {
        return ship.stream().allMatch(cell -> shots[seat][cell.row()][cell.col()] == HIT);
    }

    int shipsLeft(int seat) {
        return (int) fleets.get(seat).stream().filter(ship -> !isSunk(seat, ship)).count();
    }

    @Override
    public void leave(int seat) {
        if (phase == Phase.FINISHED) return;
        winnerSeat = 1 - seat;
        phase = Phase.FINISHED;
    }

    @Override
    public boolean isFinished() {
        return phase == Phase.FINISHED;
    }

    @Override
    public String resultText() {
        return winnerSeat == null ? "배틀십 끝" : "배틀십 " + nicknames.get(winnerSeat) + " 승리 (" + shotsFired + "발)";
    }

    @Override
    public Object viewFor(Integer seat) {
        List<BoardView> boards = new ArrayList<>();
        for (int owner = 0; owner < 2; owner++) {
            boolean showShips = phase == Phase.FINISHED || (seat != null && seat == owner);
            boards.add(new BoardView(owner, rowsOf(owner, showShips), shipsLeft(owner)));
        }
        return new View(phase.name(), SIZE, SHIP_LENGTHS, seat, List.of(ready[0], ready[1]),
            phase == Phase.PLAY ? turnSeat : null, winnerSeat, shotsFired, boards);
    }

    private List<String> rowsOf(int owner, boolean showShips) {
        char[][] grid = new char[SIZE][SIZE];
        for (char[] row : grid) java.util.Arrays.fill(row, '.');
        for (List<Cell> ship : fleets.get(owner)) {
            boolean sunk = isSunk(owner, ship);
            for (Cell cell : ship) {
                if (sunk) grid[cell.row()][cell.col()] = '#';
                else if (showShips) grid[cell.row()][cell.col()] = 'S';
            }
        }
        for (int row = 0; row < SIZE; row++) {
            for (int col = 0; col < SIZE; col++) {
                if (shots[owner][row][col] == MISS) grid[row][col] = 'o';
                else if (shots[owner][row][col] == HIT && grid[row][col] != '#') grid[row][col] = 'X';
            }
        }
        List<String> rows = new ArrayList<>();
        for (char[] row : grid) rows.add(new String(row));
        return rows;
    }

    @Override
    public List<String> drainAnnouncements() {
        List<String> drained = List.copyOf(announcements);
        announcements.clear();
        return drained;
    }
}
