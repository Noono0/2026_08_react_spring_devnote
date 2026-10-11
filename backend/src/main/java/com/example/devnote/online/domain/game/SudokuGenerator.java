package com.example.devnote.online.domain.game;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/**
 * 스도쿠 문제 만들기(스도쿠 대전용).
 *
 * [백트래킹(되추적)으로 만든다]
 *   1. 빈 판을 왼쪽 위부터 채운다. 넣을 수 있는 숫자를 섞어 하나씩 넣어 보고, 더 나아갈 수 없으면
 *      한 칸 되돌아가 다른 숫자를 넣는다. → 완성된 정답 판(숫자 순서를 섞으므로 매번 다른 판)
 *   2. 정답 판에서 칸을 무작위 순서로 하나씩 지운다. 지운 뒤 답이 둘 이상이 되면 그 칸은 되돌린다.
 *      → 답이 하나뿐인 문제. 그래서 "겹침 없이 다 채운 판 = 정답 판"이다.
 *   목표 숫자 수까지 못 지우면 새 정답 판으로 몇 번 더 해 보고 가장 적게 남은 문제를 쓴다.
 *
 * [답 세기를 빠르게] 넣을 수 있는 숫자가 가장 적은 빈 칸부터 채워 본다(MRV). 막다른 길을 일찍 알아차린다.
 * 같은 Random 시드면 같은 문제가 나온다(테스트에서 확인). 방 잠금 안에서 불리므로 수십 ms 안에 끝나야 한다.
 */
public final class SudokuGenerator {
    public static final int SIZE = 9;
    private static final int BOX = 3;
    private static final int CELLS = SIZE * SIZE;
    private static final int MAX_ATTEMPTS = 10;

    /** givens: 처음부터 놓인 숫자(0 = 빈 칸), solution: 정답 판 */
    public record Puzzle(int[][] givens, int[][] solution) {}

    private SudokuGenerator() {}

    public static Puzzle generate(int givenCount, Random random) {
        Puzzle best = attempt(givenCount, random);
        for (int count = 1; count < MAX_ATTEMPTS && countFilled(best.givens()) > givenCount; count++) {
            Puzzle next = attempt(givenCount, random);
            if (countFilled(next.givens()) < countFilled(best.givens())) best = next;
        }
        return best;
    }

    private static Puzzle attempt(int givenCount, Random random) {
        int[][] solution = createSolvedGrid(random);
        return new Puzzle(removeCells(solution, givenCount, random), solution);
    }

    /** 같은 가로줄·세로줄·3×3 상자의 "다른 칸"에 value가 없으면 true(그 칸 자신은 보지 않는다) */
    public static boolean canPlace(int[][] grid, int row, int col, int value) {
        for (int index = 0; index < SIZE; index++) {
            if (index != col && grid[row][index] == value) return false;
            if (index != row && grid[index][col] == value) return false;
        }
        int boxRow = row - row % BOX;
        int boxCol = col - col % BOX;
        for (int r = boxRow; r < boxRow + BOX; r++) {
            for (int c = boxCol; c < boxCol + BOX; c++) {
                if ((r != row || c != col) && grid[r][c] == value) return false;
            }
        }
        return true;
    }

    static int[][] createSolvedGrid(Random random) {
        int[][] grid = new int[SIZE][SIZE];
        fill(grid, 0, random);
        return grid;
    }

    private static boolean fill(int[][] grid, int cellIndex, Random random) {
        if (cellIndex == CELLS) return true;
        int row = cellIndex / SIZE;
        int col = cellIndex % SIZE;
        List<Integer> digits = new ArrayList<>(List.of(1, 2, 3, 4, 5, 6, 7, 8, 9));
        Collections.shuffle(digits, random);
        for (int digit : digits) {
            if (!canPlace(grid, row, col, digit)) continue;
            grid[row][col] = digit;
            if (fill(grid, cellIndex + 1, random)) return true;
        }
        grid[row][col] = 0; // 어떤 숫자도 안 되면 비우고 앞 칸으로 되돌아간다
        return false;
    }

    private static int[][] removeCells(int[][] solution, int givenCount, Random random) {
        int[][] givens = copy(solution);
        int filled = CELLS;
        List<Integer> cellIndexes = new ArrayList<>();
        for (int index = 0; index < CELLS; index++) cellIndexes.add(index);
        Collections.shuffle(cellIndexes, random);
        for (int cellIndex : cellIndexes) {
            if (filled <= givenCount) break;
            int row = cellIndex / SIZE;
            int col = cellIndex % SIZE;
            int removed = givens[row][col];
            givens[row][col] = 0;
            if (countSolutions(givens, 2) == 1) filled--;
            else givens[row][col] = removed;
        }
        return givens;
    }

    /** 답의 개수를 limit개까지만 센다(limit=2면 "하나뿐인가?"를 알 수 있다). grid는 바꾸지 않는다 */
    static int countSolutions(int[][] grid, int limit) {
        return search(copy(grid), limit);
    }

    private static int search(int[][] work, int limit) {
        int bestRow = -1;
        int bestCol = -1;
        List<Integer> bestCandidates = null;
        for (int row = 0; row < SIZE && (bestCandidates == null || bestCandidates.size() > 1); row++) {
            for (int col = 0; col < SIZE; col++) {
                if (work[row][col] != 0) continue;
                List<Integer> candidates = new ArrayList<>();
                for (int digit = 1; digit <= SIZE; digit++) if (canPlace(work, row, col, digit)) candidates.add(digit);
                if (bestCandidates == null || candidates.size() < bestCandidates.size()) {
                    bestRow = row;
                    bestCol = col;
                    bestCandidates = candidates;
                }
                if (candidates.size() <= 1) break; // 0개(막다른 길)나 1개면 더 찾을 필요가 없다
            }
        }
        if (bestCandidates == null) return 1; // 빈 칸이 없다 = 답 하나 완성
        int found = 0;
        for (int digit : bestCandidates) {
            work[bestRow][bestCol] = digit;
            found += search(work, limit);
            work[bestRow][bestCol] = 0; // 되돌리기
            if (found >= limit) break;
        }
        return found;
    }

    static int countFilled(int[][] grid) {
        int count = 0;
        for (int[] row : grid) for (int value : row) if (value != 0) count++;
        return count;
    }

    static int[][] copy(int[][] grid) {
        int[][] copied = new int[grid.length][];
        for (int row = 0; row < grid.length; row++) copied[row] = grid[row].clone();
        return copied;
    }
}
