/**
 * ============================================================================
 * appleLogic.ts — 사과게임 규칙(순수 함수)
 * ============================================================================
 *
 * [규칙] 17칸 × 10줄 판의 사과마다 1~9 숫자가 있다. 사각형으로 사과를 고르면,
 *   그 안에 남은 사과 숫자의 합이 딱 10일 때 사과가 모두 사라지고 사라진 개수만큼 점수를 얻는다.
 *   제한 시간(2분) 안에 최대한 많이 없앤다. 최고 점수는 170(전부 없애기).
 *
 * ★ 온라인 대전에서는 서버(AppleGame.java)가 같은 규칙으로 판정한다(점수를 화면이 정하지 않는다).
 *   혼자 연습만 이 파일로 브라우저가 계산하므로, 서버를 바꾸면 이 파일도 함께 바꾼다.
 *
 * [판 표현] board[줄][칸] = 숫자(1~9), 없앤 자리는 0.
 * [불변성] 판을 바꾸는 함수는 새 배열을 돌려준다(React 상태에 그대로 넣을 수 있다).
 */

export const APPLE_COLUMNS = 17;
export const APPLE_ROWS = 10;
export const APPLE_TARGET_SUM = 10;
export const APPLE_TIME_LIMIT_SECONDS = 120;

export type AppleBoard = number[][];

export interface CellPoint {
  row: number;
  col: number;
}

/** 두 칸(어느 쪽이 먼저든)으로 만든 사각형 */
export interface CellRect {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export const toRect = (first: CellPoint, second: CellPoint): CellRect => ({
  top: Math.min(first.row, second.row),
  left: Math.min(first.col, second.col),
  bottom: Math.max(first.row, second.row),
  right: Math.max(first.col, second.col),
});

export const isInRect = (rect: CellRect, row: number, col: number) =>
  row >= rect.top && row <= rect.bottom && col >= rect.left && col <= rect.right;

/** random()은 0 이상 1 미만(Math.random과 같은 모양). 테스트에서는 정해진 값을 넣는다 */
export const createAppleBoard = (random: () => number): AppleBoard =>
  Array.from({ length: APPLE_ROWS }, () => Array.from({ length: APPLE_COLUMNS }, () => 1 + Math.floor(random() * 9)));

/** 사각형 안에 남은 사과들의 숫자 합과 개수 */
export const summarizeRect = (board: AppleBoard, rect: CellRect): { sum: number; count: number } => {
  let sum = 0;
  let count = 0;
  for (let row = rect.top; row <= rect.bottom; row++) {
    for (let col = rect.left; col <= rect.right; col++) {
      const value = board[row]?.[col] ?? 0;
      if (value > 0) {
        sum += value;
        count++;
      }
    }
  }
  return { sum, count };
};

/** 합이 10이면 사과를 없앤 새 판과 없앤 개수, 아니면 원래 판과 0 */
export const applySelection = (board: AppleBoard, rect: CellRect): { board: AppleBoard; removed: number } => {
  const { sum, count } = summarizeRect(board, rect);
  if (sum !== APPLE_TARGET_SUM || count === 0) return { board, removed: 0 };
  return {
    board: board.map((cells, row) => cells.map((value, col) => (isInRect(rect, row, col) ? 0 : value))),
    removed: count,
  };
};

/** 남은 사과 수 */
export const countApples = (board: AppleBoard) => board.reduce((total, cells) => total + cells.filter((value) => value > 0).length, 0);
