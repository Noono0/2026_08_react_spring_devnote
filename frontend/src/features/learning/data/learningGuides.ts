export type LearningLevel = "왕초보" | "초급" | "중급" | "고급";

export interface LearningGuide {
  guideId: string;
  stageNumber: number;
  level: LearningLevel;
  difficultyScore: number;
  title: string;
  description: string;
  usageSteps: string[];
  learningTopics: string[];
  sourceFlow: string[];
  commonMistakes: string[];
  practiceTasks: string[];
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
    relatedFiles: ["src/features/learning/pages/LearningRoadmapPage.tsx", "src/features/learning/data/learningGuides.ts"],
  },
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
    relatedFiles: ["src/features/learning/pages/ReactFundamentalsPage.tsx"],
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
    relatedFiles: ["src/features/todo/pages/TodoPracticePage.tsx"],
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
    relatedFiles: ["src/features/contact/pages/ContactPracticePage.tsx"],
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
    relatedFiles: ["src/features/product/pages/ProductModalCrudPage.tsx", "src/shared/ui/ModalDialog.tsx"],
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
    relatedFiles: ["src/features/search/pages/SearchAutocompletePracticePage.tsx", "src/features/search/api/localSearchApi.ts"],
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
    relatedFiles: ["src/features/board/pages/GeneralBoardPracticePage.tsx"],
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
    relatedFiles: ["src/features/gallery/pages/GalleryPracticePage.tsx"],
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
    relatedFiles: ["src/features/comment/pages/CommentPracticePage.tsx"],
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
    relatedFiles: ["src/features/reservation/pages/ReservationPracticePage.tsx"],
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
    relatedFiles: ["src/features/task/pages/TaskManagementPage.tsx", "src/features/task/api/localTaskApi.ts"],
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
    relatedFiles: ["src/features/inquiry/pages/InquiryPracticePage.tsx"],
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
    relatedFiles: ["src/features/category/pages/CategoryTreePracticePage.tsx"],
  },
  {
    guideId: "document",
    stageNumber: 13,
    level: "고급",
    difficultyScore: 9,
    title: "문서 에디터·이미지·이력 CRUD",
    description: "Spring Boot·MyBatis·MySQL과 연결해 파일, 에디터, 검색, 버전 충돌을 다룹니다.",
    usageSteps: ["더미 데이터 ON/OFF를 선택합니다.", "문서를 작성하고 이미지와 첨부파일을 올립니다.", "표·썸네일 목록과 상세·수정을 확인합니다."],
    learningTopics: ["Axios/Fetch", "MSW", "Tiptap", "FormData", "MyBatis", "ProblemDetail", "versionNumber"],
    sourceFlow: ["Document Page", "Query Hook", "documentApi", "HttpClient", "Spring Controller", "Service", "DAO", "MyBatis"],
    commonMistakes: ["더미 모드와 실제 API 모드를 혼동하는 것", "버전 충돌 시 사용자 입력을 덮어쓰는 것"],
    practiceTasks: ["변경 이력 비교 화면을 추가하세요.", "자동저장과 페이지 이탈 경고를 구현하세요."],
    relatedFiles: ["src/features/document/pages", "src/features/document/api/documentApi.ts", "backend/src/main/java/com/example/devnote/document"],
  },
  {
    guideId: "admin",
    stageNumber: 14,
    level: "고급",
    difficultyScore: 9.5,
    title: "관리자 사용자·일괄 처리 CRUD",
    description: "대형 테이블 형태에서 역할 변경, 계정 잠금, Soft Delete와 일괄 처리를 연습합니다.",
    usageSteps: ["사용자를 선택합니다.", "일괄 역할 변경 또는 잠금을 실행합니다.", "삭제 사용자 보기에서 복구합니다."],
    learningTopics: ["다중 선택", "일괄 처리", "Soft Delete", "역할", "감사 로그"],
    sourceFlow: ["AdminUserPracticePage", "선택 ID Set", "일괄 변경 함수", "사용자 State", "감사 로그"],
    commonMistakes: ["선택 상태를 작업 후 초기화하지 않는 것", "삭제 데이터와 활성 데이터를 같은 목록에 섞는 것"],
    practiceTasks: ["CSV 다운로드를 추가하세요.", "변경 전·후 값을 감사 로그에 기록하세요."],
    relatedFiles: ["src/features/admin/pages/AdminUserPracticePage.tsx"],
  },
  {
    guideId: "development",
    stageNumber: 15,
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

export const findLearningGuideById = (guideId: string): LearningGuide | undefined =>
  learningGuideList.find((learningGuide) => learningGuide.guideId === guideId);

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
  if (learningPathname.startsWith("/development")) return findLearningGuideById("development");
  return undefined;
};
