/**
 * ============================================================================
 * gameExercises.ts — React 연습의 "게임 규칙 직접 만들어 보기" 목록
 * ============================================================================
 *
 * 게임에서 실제로 쓰는 규칙 함수 하나를 사이트 안 편집기(Sandpack)에서 직접 완성해 보는 연습이다.
 * 편집기는 iframe 안에서 따로 실행되므로, 고친 코드가 실제 게임(온라인 대전)에는 영향을 주지 않는다.
 *
 * [어디에 보이나]
 *   level이 같은 난이도 목록(/react/level/basic 등)과 전체 로드맵 아래에 카드로 보이고,
 *   카드를 누르면 연습 화면(/react/game-exercises/:exerciseId, GameExercisePage)으로 간다.
 *   level은 LearningLevelPage의 난이도 설명에 맞춰 정했다(초급 = 배열 다루기, 중급 = 2차원 판·탐색 같은 게임 규칙).
 *
 * [새 연습을 추가할 때]
 *   1. sandbox/examples/game-*.tsx 예제를 만든다(맨 위 "해 볼 것", "TODO: 여기를 완성하세요", 채점표 runChecks)
 *   2. sandbox/stageSandboxes.ts에 exerciseId 키로 원문을 등록한다
 *   3. 아래 목록에 한 덩어리를 더한다
 * gameExerciseSandboxes.test.tsx가 목록·예제·등록이 서로 맞는지 검사한다.
 */
import type { LearningLevel } from "@/features/curriculum/data/learningGuides";

export interface GameExercise {
  /** 주소(/react/game-exercises/memory-shuffle)와 편집기 예제(stageSandboxes.ts)의 키 */
  exerciseId: string;
  level: LearningLevel;
  /** 이 규칙을 쓰는 게임 이름 */
  game: string;
  title: string;
  description: string;
  /** 카드에 짧게 보여 줄 개념 */
  topics: string[];
  /** 이 연습에서 배우는 React·JavaScript 개념(연습 화면의 목록) */
  learningPoints: string[];
  /** 같은 규칙을 실제 게임에서 쓰는 파일(frontend/ 기준) */
  relatedFiles: string[];
}

export const gameExerciseList: GameExercise[] = [
  {
    exerciseId: "memory-shuffle",
    level: "초급",
    game: "카드 짝 맞추기",
    title: "카드 섞기(피셔–예이츠)",
    description: "shuffle 함수를 완성해 카드판을 고르게 섞습니다. 원본 배열은 그대로 두고 복사본을 섞습니다.",
    topics: ["배열 복사", "불변성", "피셔–예이츠 섞기", "useEffect cleanup"],
    learningPoints: [
      "피셔–예이츠 섞기: 뒤에서부터 0 ~ i 중 한 자리와 바꿔 모든 순서가 같은 확률로 나오게 합니다. sort(() => Math.random() - 0.5)가 왜 틀린 섞기인지 채점표가 보여 줍니다.",
      "불변성: [...items]로 복사한 배열만 바꿔, State로 쓰는 원래 배열을 직접 고치지 않습니다.",
      "useEffect cleanup: 미리보기의 카드판은 틀린 두 장을 setTimeout으로 잠시 뒤 덮고, 그 전에 다른 카드를 누르면 예약을 취소합니다.",
    ],
    relatedFiles: ["src/features/games/shared/random.ts", "src/features/games/memory/memoryLogic.ts"],
  },
  {
    exerciseId: "2048-slide-row",
    level: "초급",
    game: "2048",
    title: "2048 한 줄 밀기",
    description: "slideRow 함수를 완성해 한 줄의 타일을 왼쪽으로 밀고, 부딪친 같은 숫자를 한 번씩만 합칩니다.",
    topics: ["filter", "배열 만들기", "순수 함수", "키보드 이벤트"],
    learningPoints: [
      "배열 다루기: filter로 빈칸(0)을 빼고, 앞에서부터 같은 두 수를 한 번씩만 합친 뒤 0으로 길이를 맞춥니다.",
      "작은 함수 재사용: 한 줄 밀기 하나만 만들면 판 뒤집기·전치(transpose)로 네 방향 이동에 모두 씁니다.",
      "순수 함수: 같은 입력이면 언제나 같은 결과를 돌려주고 원본 배열을 바꾸지 않아, 채점표로 바로 확인할 수 있습니다.",
    ],
    relatedFiles: ["src/features/games/game2048/game2048Logic.ts"],
  },
  {
    exerciseId: "sudoku-placement",
    level: "초급",
    game: "스도쿠",
    title: "스도쿠 숫자 놓기 검사",
    description: "isValidPlacement 함수를 완성해 같은 가로줄·세로줄·3×3 상자에 같은 숫자가 있는지 검사합니다.",
    topics: ["2차원 배열", "반복문", "읽기만 하는 함수", "그릴 때 계산"],
    learningPoints: [
      "2차원 배열 읽기: grid[row][col]로 칸을 찾고, Math.floor(row / 3) * 3으로 3×3 상자의 첫 칸을 구합니다.",
      "읽기만 하는 함수: 판을 바꾸지 않고 true·false만 돌려주므로 화면 어디서나 안심하고 부를 수 있습니다.",
      "그릴 때 계산하기: 미리보기는 겹치는 숫자를 State로 따로 두지 않고, 그릴 때마다 판에서 계산해 빨갛게 보여 줍니다.",
    ],
    relatedFiles: ["src/features/games/sudoku/sudokuLogic.ts", "src/features/games/online/games/SudokuBoard.tsx"],
  },
  {
    exerciseId: "tetris-clear-lines",
    level: "중급",
    game: "테트리스",
    title: "테트리스 줄 지우기",
    description: "clearLines 함수를 완성해 꽉 찬 가로줄을 지우고, 지운 만큼 맨 위에 빈 줄을 채웁니다.",
    topics: ["2차원 배열", "filter", "불변성", "타이머 + 리듀서"],
    learningPoints: [
      "2차원 배열 filter: 빈칸이 하나라도 있는 줄만 남기고, 지운 만큼 맨 위에 빈 줄을 새로 만들어 판 높이를 지킵니다.",
      "타이머와 리듀서: 실제 게임은 setInterval이 TICK만 보내고, 내리기·굳히기·줄 지우기는 모두 순수 리듀서가 합니다.",
      "행렬 회전·충돌 검사: 블록도 2차원 배열이라, 돌린 뒤 벽·바닥·쌓인 블록과 겹치는지 같은 방법으로 확인합니다(tetrisLogic.ts에서 이어 보기).",
    ],
    relatedFiles: ["src/features/games/tetris/tetrisLogic.ts"],
  },
  {
    exerciseId: "minesweeper-reveal-area",
    level: "중급",
    game: "지뢰 찾기",
    title: "지뢰 찾기 빈 칸 연쇄 열기(BFS)",
    description: "revealArea 함수를 완성해, 주변에 지뢰가 없는 칸을 누르면 이웃 칸으로 넓게 열리게 합니다.",
    topics: ["BFS", "큐", "2차원 판 복사", "탐색 멈춤 조건"],
    learningPoints: [
      "BFS(너비 우선 탐색): 큐에 칸을 넣고 하나씩 꺼내며 가까운 칸부터 넓혀 엽니다. 숫자 칸에서 멈추고 깃발 칸은 건너뜁니다.",
      "불변 2차원 배열: 판을 복사한 뒤 바꿔 원래 State를 직접 고치지 않습니다.",
      "실제 게임은 로빙 탭인덱스(칸 하나만 Tab, 나머지는 방향키)와 onContextMenu 깃발로 키보드·마우스를 모두 지원합니다.",
    ],
    relatedFiles: ["src/features/games/minesweeper/minesweeperLogic.ts"],
  },
];

/** 연습 화면 주소의 앞부분. 뒤에 exerciseId가 붙는다 */
export const GAME_EXERCISE_ROUTE_PREFIX = "/react/game-exercises/";

export const gameExerciseRoute = (exercise: GameExercise): string => `${GAME_EXERCISE_ROUTE_PREFIX}${exercise.exerciseId}`;

/** 주소의 exerciseId로 연습을 찾는다. 주소는 누구나 고쳐 칠 수 있으므로 목록에 없으면 undefined */
export const findGameExerciseById = (exerciseId: string): GameExercise | undefined =>
  gameExerciseList.find((exercise) => exercise.exerciseId === exerciseId);
