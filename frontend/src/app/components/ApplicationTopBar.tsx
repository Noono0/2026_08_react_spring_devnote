/**
 * ============================================================================
 * ApplicationTopBar.tsx — 학습 영역 화면 위쪽의 제목 줄 + 도구 버튼
 * ============================================================================
 *
 * 여기서 하는 일은 세 가지다.
 *   1) 지금 보고 있는 페이지 제목을 주소로부터 알아내서 보여준다
 *   2) 모바일에서 사이드바를 여는 ☰ 버튼
 *   3) 다크모드 토글 버튼
 *
 * [배울 점]
 *   - 컴포넌트 바깥에 "순수 함수"를 빼 두는 패턴
 *   - 접근성(aria-label, title)을 챙기는 방법
 */

import { useLocation } from "react-router-dom";
import { useApplicationUiStore } from "@/app/state/applicationUiStore";
import { LearningGuideButton } from "@/features/learning/components/LearningGuideButton";
import { findLearningGuideByPathname } from "@/features/learning/data/learningGuides";

/**
 * 주소를 받아서 화면에 띄울 제목 문자열을 돌려준다.
 *
 * ★ 왜 컴포넌트 바깥에 뒀나?
 *   이 함수는 React 기능(useState 등)을 전혀 쓰지 않는다.
 *   "같은 입력을 넣으면 항상 같은 출력이 나오는" 순수 함수(pure function)다.
 *   이런 함수는 컴포넌트 밖으로 빼는 게 좋다.
 *     - 컴포넌트가 다시 그려질 때마다 함수를 새로 만들지 않아도 된다
 *     - 테스트할 때 컴포넌트를 렌더링하지 않고 함수만 따로 검사할 수 있다
 *     - 컴포넌트 본문이 짧아져서 읽기 쉬워진다
 */
const getCurrentPageTitle = (pathname: string): string => {
  // 주소 앞의 "/react" 접두사를 떼어낸다.
  //   "/react/todos" → "/todos"
  //   "/react"       → ""  → `|| "/"` 덕분에 "/" 가 된다
  //
  // `||` 는 "왼쪽이 비어 있으면(빈 문자열, 0, null 등) 오른쪽을 쓴다"는 뜻이다.
  // slice("/react".length) 는 slice(6) 과 같지만, 문자열을 그대로 써서
  // 나중에 접두사가 바뀌어도 숫자를 고칠 필요가 없다는 장점이 있다.
  const learningPathname = pathname.startsWith("/react") ? pathname.slice("/react".length) || "/" : pathname;

  // 아래는 위에서부터 순서대로 검사하다가 처음 맞는 걸 바로 return 한다.
  // ★ 순서가 매우 중요하다. 아래쪽 "/documents" 관련 세 줄을 보면
  //   좁은 조건(/documents/new)을 먼저, 넓은 조건(/documents)을 나중에 뒀다.
  //   반대로 두면 넓은 조건이 먼저 걸려서 좁은 조건은 영원히 실행되지 않는다.
  if (learningPathname === "/") return "학습 로드맵";
  if (learningPathname.startsWith("/fundamentals")) return "React 기초 실습";
  if (learningPathname.startsWith("/todos")) return "할 일 인라인 CRUD";
  if (learningPathname.startsWith("/contacts")) return "연락처 Reducer CRUD";
  if (learningPathname.startsWith("/modal-products")) return "상품 모달 CRUD";
  if (learningPathname.startsWith("/search-autocomplete")) return "실시간 검색 자동완성";
  if (learningPathname.startsWith("/general-board")) return "일반 페이지형 게시판";
  if (learningPathname.startsWith("/gallery")) return "이미지 갤러리 CRUD";
  if (learningPathname.startsWith("/comments")) return "댓글·대댓글 CRUD";
  if (learningPathname.startsWith("/reservations")) return "예약 관리 CRUD";
  if (learningPathname.startsWith("/tasks")) return "업무·칸반 API CRUD";
  if (learningPathname.startsWith("/inquiries")) return "문의·답변 권한 CRUD";
  if (learningPathname.startsWith("/categories")) return "카테고리 트리 CRUD";
  if (learningPathname.startsWith("/admin-users")) return "관리자 사용자 CRUD";
  if (learningPathname.startsWith("/documents/new")) return "고급 문서 작성";
  if (learningPathname.includes("/edit")) return "고급 문서 수정";
  if (learningPathname.startsWith("/documents")) return "문서 에디터·이미지 CRUD";
  if (learningPathname.startsWith("/development")) return "개발 오류 시나리오";
  // 위 어디에도 안 걸리면 기본 제목을 쓴다.
  // 함수는 모든 경로에서 값을 return 해야 하므로 이런 "기본값 줄"이 꼭 필요하다.
  return "DevNote Practice";
};

export const ApplicationTopBar = () => {
  const location = useLocation();
  // 현재 페이지에 딸린 학습 가이드가 있으면 가져온다. 없으면 undefined.
  const learningGuide = findLearningGuideByPathname(location.pathname);

  // 여기서는 selector 없이 스토어 전체를 가져와 구조 분해로 필요한 것만 꺼냈다.
  // 짧고 읽기 편하지만, 스토어의 아무 값이나 바뀌어도 이 컴포넌트가 다시 그려진다.
  // 상단바는 가볍고 자주 안 바뀌므로 이 정도는 괜찮다.
  // (성능이 중요한 곳이라면 ApplicationProviders처럼 selector로 하나씩 꺼내는 게 낫다)
  const {
    applicationTheme,
    toggleApplicationTheme,
    openMobileSidebar,
  } = useApplicationUiStore();

  return (
    <header className="application-top-bar">
      <div className="top-bar-title-row">
        {/* 모바일 전용 메뉴 버튼. PC에서는 CSS(mobile-menu-button)로 숨긴다.

            type="button"을 꼭 적는 이유:
            <form> 안에 있는 <button>은 type을 안 적으면 기본이 "submit"이라서
            누르는 순간 폼이 전송되고 페이지가 새로고침된다. 초보자가 자주 겪는 버그다.
            습관적으로 항상 붙이는 게 안전하다.

            aria-label:
            버튼 안의 내용이 "☰" 기호뿐이라 화면 낭독기는 이걸 읽어 줄 수 없다.
            aria-label로 실제 의미를 글로 알려 준다. */}
        <button
          className="top-bar-icon-button mobile-menu-button"
          type="button"
          onClick={openMobileSidebar}
          aria-label="사이드바 메뉴 열기"
        >
          ☰
        </button>
        <div>
          <span className="top-bar-eyebrow">React Beginner to Advanced</span>
          {/* JSX 안의 중괄호 `{}` = "여기서부터 JavaScript 표현식이다".
              함수를 호출해서 나온 문자열을 그대로 화면에 찍는다. */}
          <strong className="top-bar-title">{getCurrentPageTitle(location.pathname)}</strong>
        </div>
      </div>

      <div className="top-bar-actions">
        {/* 학습 가이드가 있는 페이지에서만 가이드 버튼을 보여준다.
            learningGuide가 undefined면 null → 아무것도 안 그림. */}
        {learningGuide ? <LearningGuideButton learningGuide={learningGuide} /> : null}
        <span className="top-bar-mode-description">
          {applicationTheme === "dark" ? "다크 모드" : "라이트 모드"}
        </span>
        {/* 다크모드 토글 버튼.

            onClick에 `toggleApplicationTheme`를 그대로 넘겼다.
            ★ 흔한 실수: onClick={toggleApplicationTheme()} 처럼 괄호를 붙이면
              클릭할 때가 아니라 화면을 그리는 순간 바로 실행돼 버린다.
              "함수를 실행한 결과"가 아니라 "함수 자체"를 넘겨야 한다.
              (인자를 넘겨야 할 때만 onClick={() => 함수(값)} 형태로 감싼다)

            aria-label과 title 둘 다 적은 이유:
              aria-label → 화면 낭독기가 읽어 준다 (눈이 불편한 사용자용)
              title      → 마우스를 올리면 뜨는 말풍선 (마우스 사용자용)
            문구가 "지금 상태"가 아니라 "누르면 일어날 일"인 점에 주목하자.
            다크 모드일 때 "라이트 모드로 변경"이라고 적어야 헷갈리지 않는다. */}
        <button
          className="top-bar-icon-button"
          type="button"
          onClick={toggleApplicationTheme}
          aria-label={applicationTheme === "dark" ? "라이트 모드로 변경" : "다크 모드로 변경"}
          title={applicationTheme === "dark" ? "라이트 모드로 변경" : "다크 모드로 변경"}
        >
          {applicationTheme === "dark" ? "☀" : "☾"}
        </button>
      </div>
    </header>
  );
};
