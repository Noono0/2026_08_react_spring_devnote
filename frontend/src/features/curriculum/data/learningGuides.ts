/**
 * ============================================================================
 * learningGuides.ts — React 학습 단계별 "사용 설명서" 데이터
 * ============================================================================
 *
 * 각 학습 화면 제목 옆의 ? 버튼(LearningGuideButton)과 로드맵 카드가 이 데이터를 읽는다.
 * 화면 코드에 설명 글을 흩어 두지 않고 한 파일에 모아, 단계를 추가·수정할 때 이곳만 고치면 되게 했다.
 *
 * [새 학습 단계를 추가할 때]
 *   1. learningGuideList에 가이드 객체 추가(stageNumber는 순서대로)
 *   2. learningStageRoutes에 guideId → 주소 추가
 *   3. findLearningGuideByPathname에 주소 → guideId 판단 추가
 *   4. 라우트(App.tsx)와 사이드바 메뉴(app/navigation/navigationGroups.ts)에 화면 연결
 * learningGuides.test.ts가 단계 번호가 빠짐없이 이어지는지, 로드맵 단계마다 주소가 연결되는지 검사한다.
 */

export type LearningLevel = "왕초보" | "초급" | "중급" | "고급";

/** 학습 가이드 하나. 대화상자의 네 탭(사용 방법·학습 내용·소스 흐름·실습 과제)이 각 배열을 그대로 목록으로 그린다. */
export interface LearningGuide {
  /** 단계를 가리키는 고유 이름(주소·라우트 연결에 쓰는 키). 예: "todo", "zustand" */
  guideId: string;
  /** 로드맵 순서. 0은 로드맵 안내 자체, 26은 로드맵 카드에서 빼는 오류 실험실(개발 도구). */
  stageNumber: number;
  level: LearningLevel;
  /** 체감 난이도 1~10 */
  difficultyScore: number;
  title: string;
  description: string;
  usageSteps: string[];
  learningTopics: string[];
  /** 사용자 동작 → 이벤트 → State → 화면으로 이어지는 코드 실행 순서 */
  sourceFlow: string[];
  commonMistakes: string[];
  practiceTasks: string[];
  /** 함께 열어 볼 소스 파일 경로(src/ 기준) */
  relatedFiles: string[];
}

export const learningGuideList: LearningGuide[] = [
  {
    guideId: "roadmap",
    stageNumber: 0,
    level: "왕초보",
    difficultyScore: 0,
    title: "전체 학습 로드맵",
    description: "간단한 로컬 상태 CRUD부터 실제 백엔드, 파일, 권한, 트리, 이력까지 순서대로 학습합니다.",
    usageSteps: ["카드의 난이도와 선수 지식을 확인합니다.", "단계 시작하기를 눌러 화면으로 이동합니다.", "각 화면의 ? 아이콘에서 사용법과 소스 흐름을 확인합니다."],
    learningTopics: ["CRUD 난이도 비교", "UI 패턴 비교", "로컬 상태와 서버 상태 구분"],
    sourceFlow: ["LearningRoadmapPage", "learningGuides", "React Router", "각 실습 페이지"],
    commonMistakes: ["고급 단계부터 바로 시작해 기본 상태 흐름을 놓치는 경우", "화면만 실행하고 콘솔과 소스를 확인하지 않는 경우"],
    practiceTasks: ["1단계부터 순서대로 한 번씩 CRUD를 실행하세요.", "같은 수정 기능이 인라인·모달·Drawer·페이지 방식에서 어떻게 달라지는지 적어 보세요."],
    relatedFiles: ["src/features/practice/00-roadmap/pages/LearningRoadmapPage.tsx", "src/features/curriculum/data/learningGuides.ts"],
  },
  // ─── 1~14단계: 로컬 State CRUD부터 실제 API 문서 CRUD까지(기초·핵심) ───
  {
    guideId: "fundamentals",
    stageNumber: 1,
    level: "왕초보",
    difficultyScore: 1,
    title: "React 기초",
    description: "State가 바뀌면 화면이 다시 렌더링되는 가장 기본적인 흐름을 확인합니다.",
    usageSteps: ["카운터 값을 증가·감소합니다.", "입력값이 화면에 즉시 반영되는지 확인합니다.", "설명을 숨기고 다시 표시합니다."],
    learningTopics: ["컴포넌트", "useState", "이벤트", "조건부 렌더링", "배열 렌더링"],
    sourceFlow: ["버튼 클릭", "상태 변경 함수", "React 재렌더링", "화면 값 변경"],
    commonMistakes: ["State 값을 직접 변경하는 것", "map의 key를 빠뜨리는 것"],
    practiceTasks: ["카운터 증감 단위를 5로 바꿔 보세요.", "입력한 이름을 목록에 추가해 보세요."],
    relatedFiles: ["src/features/practice/01-fundamentals/pages/ReactFundamentalsPage.tsx"],
  },
  {
    guideId: "todo",
    stageNumber: 2,
    level: "초급",
    difficultyScore: 2,
    title: "할 일 인라인 CRUD",
    description: "useState 배열로 생성·조회·수정·삭제를 구현하고 불변성을 연습합니다.",
    usageSteps: ["할 일을 입력하고 추가합니다.", "체크박스로 완료 상태를 변경합니다.", "수정 버튼으로 인라인 편집하고 삭제합니다."],
    learningTopics: ["배열 CRUD", "map", "filter", "불변성", "인라인 편집"],
    sourceFlow: ["TodoPracticePage", "State 배열", "map/filter", "목록 재렌더링"],
    commonMistakes: ["push로 기존 배열을 직접 바꾸는 것", "수정 중인 ID를 초기화하지 않는 것"],
    practiceTasks: ["전체 완료 버튼을 추가하세요.", "완료 항목만 한 번에 삭제하세요."],
    relatedFiles: ["src/features/practice/02-todo/pages/TodoPracticePage.tsx"],
  },
  {
    guideId: "contact",
    stageNumber: 3,
    level: "초급",
    difficultyScore: 3,
    title: "연락처 Reducer CRUD",
    description: "상태 변경 규칙을 Reducer로 분리하고 localStorage에 저장합니다.",
    usageSteps: ["연락처를 등록합니다.", "카드의 수정 버튼으로 폼을 채웁니다.", "새로고침 후 데이터가 남는지 확인합니다."],
    learningTopics: ["useReducer", "Action", "localStorage", "검색", "폼 초기화"],
    sourceFlow: ["ContactPracticePage", "dispatch", "contactReducer", "localStorage 저장"],
    commonMistakes: ["수정 후 폼을 초기화하지 않는 것", "JSON 파싱 오류를 처리하지 않는 것"],
    practiceTasks: ["즐겨찾기 필드를 추가하세요.", "전화번호 형식을 검증하세요."],
    relatedFiles: ["src/features/practice/03-contact/pages/ContactPracticePage.tsx"],
  },
  {
    guideId: "product",
    stageNumber: 4,
    level: "중급",
    difficultyScore: 4,
    title: "상품 모달 CRUD",
    description: "추가·수정 폼 모달과 삭제 확인 모달을 재사용합니다.",
    usageSteps: ["상품 추가 모달을 엽니다.", "목록의 수정 모달에서 기존 값을 변경합니다.", "삭제 모달에서 대상을 확인한 뒤 삭제합니다."],
    learningTopics: ["ModalDialog", "React Hook Form", "Zod", "폼 reset", "삭제 확인"],
    sourceFlow: ["ProductModalCrudPage", "ModalDialog", "React Hook Form", "State 갱신", "Sonner"],
    commonMistakes: ["추가와 수정 모달의 이전 입력이 섞이는 것", "삭제 대상을 잘못 보관하는 것"],
    practiceTasks: ["재고만 인라인 수정하게 만들어 보세요.", "여러 상품 일괄 삭제를 추가하세요."],
    relatedFiles: ["src/features/practice/04-product/pages/ProductModalCrudPage.tsx", "src/shared/ui/ModalDialog.tsx"],
  },
  {
    guideId: "search",
    stageNumber: 5,
    level: "중급",
    difficultyScore: 5,
    title: "실시간 검색 자동완성",
    description: "Effect에서 debounce, 요청 취소, 최신 응답 보호와 키보드 탐색을 연습합니다.",
    usageSteps: ["두 글자 이상의 검색어를 빠르게 입력합니다.", "느린 응답 중 검색어를 바꿔 이전 요청 취소를 확인합니다.", "방향키와 Enter로 결과를 선택하고 빈 결과·오류 상황도 전환합니다."],
    learningTopics: ["useEffect", "debounce", "AbortController", "비동기 경쟁 조건", "Combobox 접근성"],
    sourceFlow: ["검색어 State", "Effect debounce", "localSearchApi", "이전 요청 cleanup", "최신 결과 렌더링"],
    commonMistakes: ["입력할 때마다 불필요한 요청을 보내는 것", "느린 이전 응답이 최신 검색 결과를 덮어쓰게 두는 것"],
    practiceTasks: ["최근 검색어를 안전하게 localStorage에 저장하세요.", "검색어가 일치한 부분을 접근성을 유지하며 강조하세요."],
    relatedFiles: ["src/features/practice/05-search/pages/SearchAutocompletePracticePage.tsx", "src/features/practice/05-search/api/localSearchApi.ts"],
  },
  {
    guideId: "board",
    stageNumber: 6,
    level: "중급",
    difficultyScore: 5,
    title: "일반 페이지형 게시판",
    description: "목록·작성·상세·수정 화면 전환과 검색·페이지네이션을 연습합니다.",
    usageSteps: ["새 글 작성에서 제목과 내용을 저장합니다.", "목록에서 글을 열어 상세를 확인합니다.", "상세에서 수정하거나 삭제합니다."],
    learningTopics: ["페이지 상태", "검색", "페이지네이션", "상세 조회", "공개 상태"],
    sourceFlow: ["GeneralBoardPracticePage", "게시글 State", "검색/페이징", "작성·상세 화면"],
    commonMistakes: ["수정 대상 ID를 잃는 것", "삭제 후 현재 페이지가 빈 상태가 되는 것"],
    practiceTasks: ["작성자 검색 조건을 추가하세요.", "임시저장 상태를 추가하세요."],
    relatedFiles: ["src/features/practice/06-board/pages/GeneralBoardPracticePage.tsx"],
  },
  {
    guideId: "gallery",
    stageNumber: 7,
    level: "중급",
    difficultyScore: 6,
    title: "이미지 갤러리 CRUD",
    description: "파일 업로드, 썸네일 목록, 이미지 미리보기와 대표 이미지 변경을 연습합니다.",
    usageSteps: ["이미지 파일과 제목을 선택해 등록합니다.", "표·카드 보기를 전환합니다.", "이미지를 눌러 미리보고 수정·삭제합니다."],
    learningTopics: ["FileReader", "파일 입력", "썸네일", "Object/Data URL", "이미지 오류 처리"],
    sourceFlow: ["파일 선택", "FileReader", "Gallery State", "카드/표 렌더링", "미리보기 모달"],
    commonMistakes: ["이미지가 아닌 파일을 허용하는 것", "큰 파일을 무제한으로 메모리에 저장하는 것"],
    practiceTasks: ["다중 이미지 업로드를 추가하세요.", "대표 이미지 순서 변경을 구현하세요."],
    relatedFiles: ["src/features/practice/07-gallery/pages/GalleryPracticePage.tsx"],
  },
  {
    guideId: "comment",
    stageNumber: 8,
    level: "중급",
    difficultyScore: 6.5,
    title: "댓글·대댓글 CRUD",
    description: "부모·자식 관계를 가진 계층형 데이터를 추가·수정·삭제합니다.",
    usageSteps: ["댓글을 작성합니다.", "답글 버튼으로 대댓글을 작성합니다.", "수정·삭제 후 계층 구조가 유지되는지 확인합니다."],
    learningTopics: ["parentCommentId", "중첩 렌더링", "삭제 자리 유지", "좋아요", "인라인 폼"],
    sourceFlow: ["CommentPracticePage", "부모 댓글 필터", "대댓글 필터", "계층 렌더링"],
    commonMistakes: ["부모 삭제 시 자식 댓글까지 사라지는 것", "대댓글을 잘못된 부모에 연결하는 것"],
    practiceTasks: ["대댓글 접기·펼치기를 추가하세요.", "좋아요 낙관적 업데이트 실패를 재현하세요."],
    relatedFiles: ["src/features/practice/08-comment/pages/CommentPracticePage.tsx"],
  },
  {
    guideId: "reservation",
    stageNumber: 9,
    level: "중급",
    difficultyScore: 7,
    title: "예약 관리 CRUD",
    description: "날짜·시간 업무 규칙과 중복 예약 충돌을 처리합니다.",
    usageSteps: ["예약 추가 모달에서 날짜와 시간을 선택합니다.", "같은 자원·시간으로 중복 예약을 시도합니다.", "예약 상태를 변경하거나 취소합니다."],
    learningTopics: ["날짜/시간", "업무 규칙", "409 Conflict 개념", "상태 전이", "모달 폼"],
    sourceFlow: ["ReservationPracticePage", "폼 검증", "중복 검사", "State 저장", "충돌 알림"],
    commonMistakes: ["종료 시간이 시작 시간보다 빠른 것", "수정 중 자기 예약과 중복 검사하는 것"],
    practiceTasks: ["과거 날짜 수정 금지를 추가하세요.", "달력 보기를 추가하세요."],
    relatedFiles: ["src/features/practice/09-reservation/pages/ReservationPracticePage.tsx"],
  },
  {
    guideId: "task",
    stageNumber: 10,
    level: "중급",
    difficultyScore: 7.5,
    title: "업무·칸반 API CRUD",
    description: "TanStack Query와 낙관적 업데이트로 업무 상태를 변경합니다.",
    usageSteps: ["업무를 등록합니다.", "상태 선택으로 칸반 열을 이동합니다.", "제목에 error를 넣어 실패와 롤백을 확인합니다."],
    learningTopics: ["TanStack Query", "Mutation", "Optimistic Update", "Rollback", "캐시 무효화"],
    sourceFlow: ["TaskManagementPage", "useMutation", "localTaskApi", "Query Cache", "UI 재렌더링"],
    commonMistakes: ["onError에서 이전 캐시를 복구하지 않는 것", "Mutation 후 invalidateQueries를 빠뜨리는 것"],
    practiceTasks: ["드래그앤드롭 상태 변경을 추가하세요.", "일괄 담당자 변경을 구현하세요."],
    relatedFiles: ["src/features/practice/10-task/pages/TaskManagementPage.tsx", "src/features/practice/10-task/api/localTaskApi.ts"],
  },
  {
    guideId: "inquiry",
    stageNumber: 11,
    level: "고급",
    difficultyScore: 8,
    title: "문의·답변 권한 CRUD",
    description: "사용자와 관리자 역할에 따라 가능한 작업과 상태 전이를 다르게 처리합니다.",
    usageSteps: ["USER 역할로 문의를 작성합니다.", "MANAGER 역할로 담당자를 배정하고 답변합니다.", "권한 없는 작업을 시도해 경고를 확인합니다."],
    learningTopics: ["Role", "권한별 UI", "403 개념", "상태 전이", "답변 CRUD"],
    sourceFlow: ["InquiryPracticePage", "현재 역할", "권한 함수", "문의 State", "상태/답변 갱신"],
    commonMistakes: ["버튼만 숨기고 실제 작업 권한을 검사하지 않는 것", "종료된 문의를 다시 수정하는 것"],
    practiceTasks: ["ADMIN만 강제 종료하도록 만드세요.", "비밀글 표시를 추가하세요."],
    relatedFiles: ["src/features/practice/11-inquiry/pages/InquiryPracticePage.tsx"],
  },
  {
    guideId: "category",
    stageNumber: 12,
    level: "고급",
    difficultyScore: 8.5,
    title: "카테고리 트리 CRUD",
    description: "부모·자식 트리 구조를 재귀적으로 렌더링하고 삭제 제한을 처리합니다.",
    usageSteps: ["최상위 카테고리를 추가합니다.", "하위 추가 버튼으로 자식 항목을 만듭니다.", "이름 수정과 삭제 제한을 확인합니다."],
    learningTopics: ["재귀 컴포넌트", "parentCategoryId", "트리", "삭제 제한", "순서"],
    sourceFlow: ["CategoryTreePracticePage", "CategoryTreeNode", "자식 필터", "재귀 렌더링"],
    commonMistakes: ["하위 항목이 있는데 부모를 삭제하는 것", "순환 부모 관계를 만드는 것"],
    practiceTasks: ["위·아래 순서 변경을 추가하세요.", "다른 부모로 이동하는 기능을 추가하세요."],
    relatedFiles: ["src/features/practice/12-category/pages/CategoryTreePracticePage.tsx"],
  },
  // 13단계는 아직 React State만 쓰는 마지막 로컬 CRUD, 14단계는 실제 백엔드에 연결하는 기본 과정의 마무리다.
  // (예전에는 둘의 순서가 반대라 "실제 API → 다시 로컬 State" 로 흐름이 거꾸로 돌아갔다)
  {
    guideId: "admin",
    stageNumber: 13,
    level: "고급",
    difficultyScore: 9,
    title: "관리자 사용자·일괄 처리 CRUD",
    description: "대형 테이블 형태에서 역할 변경, 계정 잠금, Soft Delete와 일괄 처리를 연습합니다.",
    usageSteps: ["사용자를 선택합니다.", "일괄 역할 변경 또는 잠금을 실행합니다.", "삭제 사용자 보기에서 복구합니다."],
    learningTopics: ["다중 선택", "일괄 처리", "Soft Delete", "역할", "감사 로그"],
    sourceFlow: ["AdminUserPracticePage", "선택 ID Set", "일괄 변경 함수", "사용자 State", "감사 로그"],
    commonMistakes: ["선택 상태를 작업 후 초기화하지 않는 것", "삭제 데이터와 활성 데이터를 같은 목록에 섞는 것"],
    practiceTasks: ["CSV 다운로드를 추가하세요.", "변경 전·후 값을 감사 로그에 기록하세요."],
    relatedFiles: ["src/features/practice/13-admin-users/pages/AdminUserPracticePage.tsx"],
  },
  {
    guideId: "document",
    stageNumber: 14,
    level: "고급",
    difficultyScore: 9.5,
    title: "문서 에디터·이미지·이력 CRUD",
    description: "Spring Boot·MyBatis·MySQL과 연결해 파일, 에디터, 검색, 버전 충돌을 다룹니다. 1~13단계에서 익힌 상태·폼·목록 패턴을 실제 서버와 합치는 기본 과정의 마지막 단계입니다.",
    usageSteps: ["더미 데이터 ON/OFF를 선택합니다.", "문서를 작성하고 이미지와 첨부파일을 올립니다.", "표·썸네일 목록과 상세·수정을 확인합니다."],
    learningTopics: ["Axios/Fetch", "MSW", "Tiptap", "FormData", "MyBatis", "ProblemDetail", "versionNumber"],
    sourceFlow: ["Document Page", "Query Hook", "documentApi", "HttpClient", "Spring Controller", "Service", "DAO", "MyBatis"],
    commonMistakes: ["더미 모드와 실제 API 모드를 혼동하는 것", "버전 충돌 시 사용자 입력을 덮어쓰는 것"],
    practiceTasks: [
      "변경 이력 비교 화면을 추가하세요.",
      "자동저장과 페이지 이탈 경고를 구현하세요.",
      "같은 API 모양을 다른 권한 규칙으로 쓰는 업무 History(features/history)와 이 단계의 코드를 비교해 보세요.",
    ],
    relatedFiles: [
      "src/features/practice/14-documents/pages",
      "src/features/practice/14-documents/api/documentApi.ts",
      "src/features/rich-text-editor/components/RichTextEditor.tsx",
      "backend/src/main/java/com/example/devnote/document",
    ],
  },
  // ─── 15~25단계: 심화(실무 주제) — ADVANCED_TOPIC_FIRST_STAGE_NUMBER부터 "심화" 묶음으로 표시 ───
  {
    guideId: "infinite-feed",
    stageNumber: 15,
    level: "중급",
    difficultyScore: 7.5,
    title: "무한 스크롤 피드",
    description: "useInfiniteQuery와 IntersectionObserver로 스크롤 끝에서 다음 글 묶음을 커서 방식으로 이어 붙입니다.",
    usageSteps: ["피드를 끝까지 스크롤하거나 더 보기를 누릅니다.", "검색어를 바꿔 처음 묶음부터 다시 받는지 확인합니다.", "검색어에 error를 넣어 오류와 다시 시도를 확인합니다."],
    learningTopics: ["useInfiniteQuery", "커서 페이지네이션", "IntersectionObserver", "Effect 정리", "다음 묶음 중복 요청 방지"],
    sourceFlow: ["InfiniteFeedPracticePage", "useInfiniteQuery", "getNextPageParam", "localFeedApi.getFeedPage", "data.pages.flatMap"],
    commonMistakes: ["observer.disconnect()를 하지 않아 화면을 떠나도 감시가 남는 것", "isFetchingNextPage를 확인하지 않아 같은 묶음을 여러 번 요청하는 것", "배열 순서를 key로 써서 묶음이 추가될 때 항목이 다시 그려지는 것"],
    practiceTasks: ["한 번에 받는 글 수를 화면에서 고를 수 있게 하세요.", "맨 위로 이동 버튼을 추가하세요.", "새 글 알림(새로 고침 시 맨 앞 묶음만 다시 받기)을 구현하세요."],
    relatedFiles: ["src/features/practice/15-infinite-feed/pages/InfiniteFeedPracticePage.tsx", "src/features/practice/15-infinite-feed/api/localFeedApi.ts"],
  },
  {
    guideId: "dynamic-form",
    stageNumber: 16,
    level: "고급",
    difficultyScore: 8,
    title: "동적 견적서 폼",
    description: "useFieldArray로 품목 줄을 추가·삭제·이동하고 Zod로 줄 단위·배열 전체 규칙을 검증합니다.",
    usageSteps: ["품목을 추가하고 수량·단가를 입력해 합계를 확인합니다.", "같은 품목명을 두 번 넣고 제출해 오류 위치를 확인합니다.", "줄을 이동·삭제한 뒤 입력값이 자기 줄을 따라가는지 확인합니다."],
    learningTopics: ["useFieldArray", "useWatch", "valueAsNumber", "Zod superRefine", "field.id key"],
    sourceFlow: ["DynamicQuoteFormPage", "useForm + zodResolver", "useFieldArray(append·remove·move)", "useWatch 합계", "handleSubmit"],
    commonMistakes: ["key에 index를 써서 삭제 후 입력값이 다른 줄로 옮겨 가는 것", "숫자 칸을 문자열로 받아 합계가 이어 붙는 것", "합계를 별도 State로 만들어 입력값과 어긋나는 것"],
    practiceTasks: ["할인율 칸을 추가하고 합계에 반영하세요.", "품목을 복제하는 버튼을 추가하세요.", "작성한 견적을 CSV로 내려받으세요."],
    relatedFiles: ["src/features/practice/16-dynamic-form/pages/DynamicQuoteFormPage.tsx"],
  },
  {
    guideId: "context-auth",
    stageNumber: 17,
    level: "고급",
    difficultyScore: 8.5,
    title: "Context 로그인과 보호 라우트",
    description: "createContext·Provider·커스텀 훅으로 로그인 상태를 공유하고, 보호 화면에서 로그인 화면으로 보냈다가 원래 주소로 돌려보냅니다.",
    usageSteps: ["로그인하지 않고 마이페이지(보호)를 누릅니다.", "실습용 비밀번호로 로그인해 원래 화면으로 돌아오는지 확인합니다.", "로그아웃 후 새로고침하면 상태가 사라지는 이유를 확인합니다."],
    learningTopics: ["createContext", "Provider value 고정", "커스텀 훅", "보호 라우트", "location.state 검증"],
    sourceFlow: ["ContextAuthPracticeLayout", "PracticeAuthProvider", "usePracticeAuth", "RequirePracticeLogin", "Navigate state.from"],
    commonMistakes: ["Provider 밖에서 Context를 읽어 null을 그대로 쓰는 것", "화면 숨김만으로 데이터가 보호된다고 생각하는 것", "location.state를 검증하지 않고 이동 주소로 쓰는 것"],
    practiceTasks: ["권한(일반·관리자)을 추가해 관리자 전용 화면을 만드세요.", "sessionStorage로 새로고침 후에도 로그인 상태를 유지해 보고 위험을 정리하세요.", "실제 로그인(useAuthSession)과 구조를 비교해 보세요."],
    relatedFiles: ["src/features/practice/17-context-auth/pages/ContextAuthPracticePages.tsx", "src/features/practice/17-context-auth/state/practiceAuthContext.ts", "src/features/practice/17-context-auth/state/PracticeAuthProvider.tsx"],
  },
  {
    guideId: "react19-actions",
    stageNumber: 18,
    level: "고급",
    difficultyScore: 9,
    title: "React 19 Actions 방명록",
    description: "useActionState·useFormStatus·useOptimistic으로 제출 상태와 오류, 응답 전 낙관적 표시를 처리합니다.",
    usageSteps: ["이름과 내용을 입력해 등록하고 저장 중 표시를 확인합니다.", "내용에 error를 넣어 임시 글이 사라지고 입력값이 남는지 확인합니다.", "빈 값으로 제출해 서버 호출 없이 안내되는지 확인합니다."],
    learningTopics: ["useActionState", "form action", "useFormStatus", "useOptimistic", "폼 자동 초기화"],
    sourceFlow: ["form action={formAction}", "useActionState action", "addOptimisticMessage", "addGuestbookMessage", "setMessages 또는 오류 상태 반환"],
    commonMistakes: ["useFormStatus를 폼 바깥 컴포넌트에서 호출하는 것", "실패 시 입력값을 결과 상태에 담지 않아 자동 초기화로 사라지는 것", "낙관적 값을 진짜 State처럼 직접 수정하는 것"],
    practiceTasks: ["좋아요 버튼에 useOptimistic을 적용하세요.", "글 삭제를 Action으로 만들어 보세요.", "10단계 TanStack Query 낙관적 업데이트와 코드 양을 비교해 보세요."],
    relatedFiles: ["src/features/practice/18-react19-actions/pages/ReactActionsGuestbookPage.tsx", "src/features/practice/18-react19-actions/api/localGuestbookApi.ts"],
  },
  {
    guideId: "custom-hooks",
    stageNumber: 19,
    level: "고급",
    difficultyScore: 8,
    title: "커스텀 훅으로 반복 로직 분리하기",
    description: "localStorage 저장·디바운스·외부 값 구독을 커스텀 훅으로 옮겨 페이지에는 화면 그리기만 남깁니다.",
    usageSteps: ["메모를 추가하고 새로고침해 유지되는지 확인합니다.", "검색어를 빠르게 입력해 멈춘 뒤에만 거르는지 확인합니다.", "개발자 도구에서 Offline을 켜 상태 표시가 바뀌는지 확인합니다."],
    learningTopics: ["커스텀 훅", "지연 초기화", "useSyncExternalStore", "Effect 정리", "저장값 검증"],
    sourceFlow: ["CustomHooksPracticePage", "useLocalStorageState", "useDebouncedValue", "useOnlineStatus"],
    commonMistakes: ["커스텀 훅이 State를 공유한다고 생각하는 것", "useState 초기값에서 매 렌더링마다 localStorage를 읽는 것", "subscribe 함수를 컴포넌트 안에서 매번 새로 만드는 것"],
    practiceTasks: ["useToggle 훅을 만들어 메모 완료 토글에 써 보세요.", "useLocalStorageState에 다른 탭의 변경(storage 이벤트) 반영을 추가하세요.", "3단계 연락처 페이지를 이 훅으로 바꿔 보세요."],
    relatedFiles: ["src/features/practice/19-custom-hooks/pages/CustomHooksPracticePage.tsx", "src/features/practice/19-custom-hooks/hooks/useLocalStorageState.ts", "src/features/practice/19-custom-hooks/hooks/useDebouncedValue.ts", "src/features/practice/19-custom-hooks/hooks/useOnlineStatus.ts"],
  },
  {
    guideId: "performance",
    stageNumber: 20,
    level: "고급",
    difficultyScore: 9,
    title: "측정하고 나서 최적화하기",
    description: "2,000개 목록에서 Profiler로 렌더링 시간을 재고 memo·useCallback·useDeferredValue를 켜고 끄며 비교합니다.",
    usageSteps: ["최적화 끔 상태에서 즐겨찾기를 누르고 측정값 보기를 누릅니다.", "최적화를 켜고 같은 동작 후 측정값을 비교합니다.", "검색어를 빠르게 입력하며 목록 갱신 중 표시를 확인합니다."],
    learningTopics: ["React Profiler", "memo", "useCallback", "useMemo", "useDeferredValue"],
    sourceFlow: ["PerformancePracticePage", "Profiler onRender", "MemoizedProductRow", "toggleFavoriteStable", "useDeferredValue"],
    commonMistakes: ["측정 없이 모든 컴포넌트에 memo를 붙이는 것", "memo만 하고 함수 props를 매번 새로 만드는 것", "Profiler onRender 안에서 setState를 호출하는 것"],
    practiceTasks: ["React DevTools Profiler 탭으로 같은 동작을 녹화해 비교하세요.", "목록 가상화(보이는 줄만 그리기)를 직접 구현해 보세요.", "favorite만 바뀔 때 다시 그리는 줄 수를 세는 방법을 찾아보세요."],
    relatedFiles: ["src/features/practice/20-performance/pages/PerformancePracticePage.tsx"],
  },
  {
    guideId: "zustand",
    stageNumber: 21,
    level: "고급",
    difficultyScore: 8,
    title: "Zustand 전역 상태로 장바구니 만들기",
    description: "Provider 없이 저장소를 공유하고 selector로 필요한 값만 구독하며, persist로 새로고침 후에도 유지합니다.",
    usageSteps: ["상품을 담고 배지·장바구니가 함께 바뀌는지 확인합니다.", "수량을 바꾸고 새로고침해 유지되는지 확인합니다.", "17단계 Context 예제와 구조를 비교합니다."],
    learningTopics: ["Zustand create", "selector 구독", "persist 미들웨어", "저장값 검증(merge)", "계산 값 분리"],
    sourceFlow: ["ZustandCartPracticePage", "usePracticeCartStore", "addItem·changeQuantity", "persist(localStorage)", "selectCartTotal"],
    commonMistakes: ["state.items.push처럼 저장소 값을 직접 바꾸는 것", "저장소 전체를 구독해 필요 없는 렌더링이 생기는 것", "합계처럼 계산 가능한 값을 따로 저장하는 것"],
    practiceTasks: ["장바구니 비우기 전에 ConfirmDialog를 띄우세요.", "persist에 version과 migrate를 추가해 보세요.", "같은 기능을 Context로 만들고 렌더링 횟수를 비교하세요."],
    relatedFiles: ["src/features/practice/21-zustand/pages/ZustandCartPracticePage.tsx", "src/features/practice/21-zustand/state/practiceCartStore.ts", "src/app/state/applicationUiStore.ts"],
  },
  {
    guideId: "url-state",
    stageNumber: 22,
    level: "고급",
    difficultyScore: 8,
    title: "검색·필터·페이지를 주소에 담기",
    description: "useSearchParams로 조건을 URL에 저장해 새로고침·링크 공유·뒤로 가기에도 같은 화면을 유지합니다.",
    usageSteps: ["분류·정렬·페이지를 바꾸고 주소창을 확인합니다.", "새로고침과 뒤로 가기로 조건이 유지되는지 확인합니다.", "주소에 ?page=바나나를 넣어 기본값으로 바뀌는지 확인합니다."],
    learningTopics: ["useSearchParams", "URL 값 검증", "push vs replace", "기본값은 주소에서 생략", "필터 변경 시 페이지 초기화"],
    sourceFlow: ["UrlStatePracticePage", "searchParams.get", "readCategory·readSort·readPage", "updateParams", "setSearchParams"],
    commonMistakes: ["주소 값을 검사하지 않고 그대로 쓰는 것", "검색어 입력마다 기록을 쌓아 뒤로 가기가 불편해지는 것", "필터를 바꿨는데 페이지 번호가 남아 빈 결과가 나오는 것"],
    practiceTasks: ["가격 범위 필터를 주소에 추가하세요.", "14단계 문서 목록의 URL 처리와 비교하세요.", "조건을 공유하는 '링크 복사' 버튼을 만드세요."],
    relatedFiles: ["src/features/practice/22-url-state/pages/UrlStatePracticePage.tsx", "src/features/practice/14-documents/pages/DocumentListPage.tsx"],
  },
  {
    guideId: "refs-focus",
    stageNumber: 23,
    level: "고급",
    difficultyScore: 8,
    title: "ref로 포커스·스크롤 다루기",
    description: "입력 오류·삭제·추가 뒤에 포커스와 스크롤을 옮겨 키보드·화면 낭독기 사용자도 흐름을 잃지 않게 합니다.",
    usageSteps: ["빈 제목으로 추가해 포커스가 입력칸으로 가는지 확인합니다.", "Tab 키로 삭제 버튼에 가서 삭제한 뒤 포커스 위치를 확인합니다.", "안건을 여러 개 추가해 새 항목으로 스크롤되는지 확인합니다."],
    learningTopics: ["useRef", "ref를 prop으로 전달(React 19)", "콜백 ref와 정리 함수", "aria-describedby", "포커스 복귀"],
    sourceFlow: ["RefsFocusPracticePage", "AgendaTextField(ref prop)", "titleInputRef.focus()", "deleteButtonRefs Map", "requestAnimationFrame"],
    commonMistakes: ["화면에 보일 값을 ref에 두어 갱신되지 않는 것", "삭제 후 포커스를 옮기지 않아 페이지 맨 위로 튀는 것", "오류 문구를 입력칸과 연결하지 않는 것"],
    practiceTasks: ["Escape 키로 입력칸을 비우고 포커스를 유지하세요.", "위·아래 화살표로 안건 사이를 이동하게 만드세요.", "4단계 상품 모달의 포커스 흐름을 점검하세요."],
    relatedFiles: ["src/features/practice/23-refs-focus/pages/RefsFocusPracticePage.tsx", "src/shared/ui/ModalDialog.tsx"],
  },
  {
    guideId: "use-suspense",
    stageNumber: 24,
    level: "고급",
    difficultyScore: 9,
    title: "React 19 use()와 Suspense",
    description: "use()로 Promise 결과를 읽고, 로딩은 Suspense, 실패는 Error Boundary에 맡겨 컴포넌트는 성공한 경우만 그립니다.",
    usageSteps: ["처음 열 때 로딩 문구가 목록으로 바뀌는지 확인합니다.", "실패 연습을 켜고 오류 화면과 다시 시도를 확인합니다.", "PageOutlet의 오류 경계·Suspense 구조와 비교합니다."],
    learningTopics: ["use()", "Suspense fallback", "Error Boundary", "Promise 캐시", "경계 배치 순서"],
    sourceFlow: ["UseSuspensePracticePage", "getNoticePromise(캐시)", "NoticeList use()", "Suspense", "NoticeErrorBoundary"],
    commonMistakes: ["렌더링마다 새 Promise를 만들어 로딩이 끝나지 않는 것", "다시 시도할 때 실패한 Promise를 그대로 쓰는 것", "테스트에서 Suspense 렌더링을 await act로 감싸지 않는 것"],
    practiceTasks: ["TanStack Query의 useSuspenseQuery로 바꿔 보세요.", "두 개의 Suspense 경계로 목록과 요약을 따로 불러오세요.", "실패 횟수에 따라 다시 시도 버튼을 막아 보세요."],
    relatedFiles: ["src/features/practice/24-use-suspense/pages/UseSuspensePracticePage.tsx", "src/features/practice/24-use-suspense/api/localNoticeApi.ts", "src/app/components/PageOutlet.tsx"],
  },
  {
    guideId: "testing",
    stageNumber: 25,
    level: "고급",
    difficultyScore: 8.5,
    title: "Vitest·Testing Library로 테스트 작성하기",
    description: "계산 규칙은 순수 함수로, 화면은 사용자 흐름으로 나눠 테스트하고, 실제 테스트 코드를 화면에서 함께 읽습니다.",
    usageSteps: ["계산기에 쿠폰을 넣어 결과를 확인합니다.", "아래 테스트 코드에서 각 화면 동작을 어떻게 확인하는지 찾습니다.", "npm run test -- 25-testing 으로 직접 실행합니다."],
    learningTopics: ["순수 함수 테스트", "it.each 경계값", "role·라벨로 찾기", "getBy vs findBy", "?raw import"],
    sourceFlow: ["TestingPracticePage", "CheckoutCalculator", "calculateCheckoutPrice", "CheckoutCalculator.test.tsx"],
    commonMistakes: ["클래스 이름으로 요소를 찾아 디자인 변경에 깨지는 것", "경계값 없이 대표값 하나만 확인하는 것", "비동기 결과를 getBy로 바로 찾는 것"],
    practiceTasks: ["새 쿠폰 규칙을 추가하고 테스트부터 작성하세요.", "규칙을 일부러 틀리게 바꿔 테스트가 잡는지 확인하세요.", "테스트가 없는 다른 단계에 테스트를 하나 추가하세요."],
    relatedFiles: ["src/features/practice/25-testing/pages/TestingPracticePage.tsx", "src/features/practice/25-testing/components/CheckoutCalculator.test.tsx", "src/features/practice/25-testing/utils/checkoutPrice.ts"],
  },
  // ─── 26: 개발 도구(오류 실험실). 로드맵 카드에는 나오지 않는다 ───
  {
    guideId: "development",
    stageNumber: 26,
    level: "고급",
    difficultyScore: 10,
    title: "오류·네트워크 시나리오",
    description: "더미 데이터와 오류 시나리오를 바꿔 로딩·빈 결과·권한·충돌·서버 장애 UI를 확인합니다.",
    usageSteps: ["더미 데이터를 ON으로 바꿉니다.", "오류 시나리오를 선택합니다.", "문서 목록으로 이동해 표시되는 오류 UI를 확인합니다."],
    learningTopics: ["MSW", "401/403/409/500", "지연", "네트워크 오류", "Error UI"],
    sourceFlow: ["DevelopmentScenarioPage", "developmentSettingsStore", "MSW handler", "HttpClient", "오류 화면"],
    commonMistakes: ["HTTP 계층과 화면에서 Toast를 중복 표시하는 것", "기술 오류 메시지를 사용자에게 그대로 노출하는 것"],
    practiceTasks: ["413 파일 크기 오류를 추가하세요.", "재시도 버튼과 백오프를 추가하세요."],
    relatedFiles: ["src/features/development/pages/DevelopmentScenarioPage.tsx", "src/mocks/requestHandlers.ts"],
  },
];

/** 로드맵 카드로 보여 주는 마지막 학습 단계 번호. 그 뒤 번호(오류 실험실)는 로드맵 카드에서 뺀다. */
export const ROADMAP_LAST_STAGE_NUMBER = 25;

/** 이 번호부터는 기본 CRUD를 마친 뒤 실무 주제를 다루는 "심화" 묶음으로 보여 준다. */
export const ADVANCED_TOPIC_FIRST_STAGE_NUMBER = 15;

/** 학습 단계 ID → 화면 주소. 로드맵과 난이도별 목록이 같은 값을 쓴다. */
export const learningStageRoutes: Record<string, string> = {
  fundamentals: "/react/fundamentals",
  todo: "/react/todos",
  contact: "/react/contacts",
  product: "/react/modal-products",
  search: "/react/search-autocomplete",
  board: "/react/general-board",
  gallery: "/react/gallery",
  comment: "/react/comments",
  reservation: "/react/reservations",
  task: "/react/tasks",
  inquiry: "/react/inquiries",
  category: "/react/categories",
  document: "/react/documents",
  admin: "/react/admin-users",
  "infinite-feed": "/react/infinite-feed",
  "dynamic-form": "/react/dynamic-form",
  "context-auth": "/react/context-auth",
  "react19-actions": "/react/react19-actions",
  "custom-hooks": "/react/custom-hooks",
  performance: "/react/performance",
  zustand: "/react/zustand",
  "url-state": "/react/url-state",
  "refs-focus": "/react/refs-focus",
  "use-suspense": "/react/use-suspense",
  testing: "/react/testing",
};

/** 로드맵 화면에 카드로 보여 줄 단계(1~25). */
export const roadmapLearningGuides = learningGuideList.filter(
  (learningGuide) => learningGuide.stageNumber > 0 && learningGuide.stageNumber <= ROADMAP_LAST_STAGE_NUMBER,
);

export const findLearningGuideById = (guideId: string): LearningGuide | undefined =>
  learningGuideList.find((learningGuide) => learningGuide.guideId === guideId);

/**
 * 지금 주소에 맞는 가이드를 찾는다(화면 제목 옆 ? 버튼이 사용).
 * /react 아래로 옮기기 전의 예전 주소(/practice/…)도 함께 인정해 북마크가 깨지지 않게 한다.
 * startsWith로 비교하므로 /todos/3 같은 하위 주소도 같은 단계로 본다.
 */
export const findLearningGuideByPathname = (pathname: string): LearningGuide | undefined => {
  const learningPathname = pathname.startsWith("/react") ? pathname.slice("/react".length) || "/learning-roadmap" : pathname;
  if (learningPathname === "/learning-roadmap" || learningPathname === "/") return findLearningGuideById("roadmap");
  if (learningPathname.startsWith("/fundamentals") || learningPathname.startsWith("/practice/fundamentals")) return findLearningGuideById("fundamentals");
  if (learningPathname.startsWith("/todos") || learningPathname.startsWith("/practice/todos")) return findLearningGuideById("todo");
  if (learningPathname.startsWith("/contacts") || learningPathname.startsWith("/practice/contacts")) return findLearningGuideById("contact");
  if (learningPathname.startsWith("/modal-products") || learningPathname.startsWith("/practice/modal-products")) return findLearningGuideById("product");
  if (learningPathname.startsWith("/search-autocomplete") || learningPathname.startsWith("/practice/search-autocomplete")) return findLearningGuideById("search");
  if (learningPathname.startsWith("/general-board") || learningPathname.startsWith("/practice/general-board")) return findLearningGuideById("board");
  if (learningPathname.startsWith("/gallery") || learningPathname.startsWith("/practice/gallery")) return findLearningGuideById("gallery");
  if (learningPathname.startsWith("/comments") || learningPathname.startsWith("/practice/comments")) return findLearningGuideById("comment");
  if (learningPathname.startsWith("/reservations") || learningPathname.startsWith("/practice/reservations")) return findLearningGuideById("reservation");
  if (learningPathname.startsWith("/tasks")) return findLearningGuideById("task");
  if (learningPathname.startsWith("/inquiries") || learningPathname.startsWith("/practice/inquiries")) return findLearningGuideById("inquiry");
  if (learningPathname.startsWith("/categories") || learningPathname.startsWith("/practice/categories")) return findLearningGuideById("category");
  if (learningPathname.startsWith("/documents")) return findLearningGuideById("document");
  if (learningPathname.startsWith("/admin-users") || learningPathname.startsWith("/practice/admin-users")) return findLearningGuideById("admin");
  if (learningPathname.startsWith("/infinite-feed")) return findLearningGuideById("infinite-feed");
  if (learningPathname.startsWith("/dynamic-form")) return findLearningGuideById("dynamic-form");
  if (learningPathname.startsWith("/context-auth")) return findLearningGuideById("context-auth");
  if (learningPathname.startsWith("/react19-actions")) return findLearningGuideById("react19-actions");
  if (learningPathname.startsWith("/custom-hooks")) return findLearningGuideById("custom-hooks");
  if (learningPathname.startsWith("/performance")) return findLearningGuideById("performance");
  if (learningPathname.startsWith("/zustand")) return findLearningGuideById("zustand");
  if (learningPathname.startsWith("/url-state")) return findLearningGuideById("url-state");
  if (learningPathname.startsWith("/refs-focus")) return findLearningGuideById("refs-focus");
  if (learningPathname.startsWith("/use-suspense")) return findLearningGuideById("use-suspense");
  if (learningPathname.startsWith("/testing")) return findLearningGuideById("testing");
  if (learningPathname.startsWith("/development")) return findLearningGuideById("development");
  return undefined;
};
