/**
 * ============================================================================
 * ContextAuthPracticePages.tsx — 【고급】 Context 로그인 상태와 보호 라우트
 * ============================================================================
 *
 * /react/context-auth          → 공개 화면 (누구나)
 * /react/context-auth/login    → 로그인 화면
 * /react/context-auth/mypage   → 보호 화면 (로그인해야 볼 수 있음)
 *
 * [화면 흐름]
 *   1. 로그인하지 않고 마이페이지에 가면 RequirePracticeLogin이 로그인 화면으로 보낸다.
 *      이때 "원래 가려던 주소"를 location.state.from에 담아 보낸다.
 *   2. 로그인에 성공하면 그 주소로 돌려보낸다. (로그인 후 다시 메뉴를 찾을 필요가 없다)
 *   3. 레이아웃·공개 화면·마이페이지는 props 없이 usePracticeAuth()로 같은 로그인 정보를 본다.
 *
 * [보호 라우트의 한계]
 *   화면을 숨기는 것은 "사용자 경험"일 뿐 보안이 아니다.
 *   개발자 도구로 화면 코드는 누구나 볼 수 있으므로, 진짜 데이터 보호는 서버가 요청마다 권한을 확인해야 한다.
 *   (이 프로젝트의 실제 관리자 화면도 서버 AdminService가 다시 권한을 검사한다)
 */

import { useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LearningGuideTitle } from "@/features/curriculum/components/LearningGuideTitle";
import { PracticeAuthProvider } from "@/features/practice/17-context-auth/state/PracticeAuthProvider";
import { PRACTICE_PASSWORD, usePracticeAuth } from "@/features/practice/17-context-auth/state/practiceAuthContext";

// 이 실습 화면들의 공통 주소. 주소를 한 곳에 모아 두면 바뀌어도 한 줄만 고치면 된다.
const BASE_PATH = "/react/context-auth";

/**
 * location.state는 누구나 만들어 넣을 수 있는 값이라 타입이 unknown이다.
 * 이 실습 영역 안의 주소일 때만 돌아갈 곳으로 인정한다. (외부 주소로 튕겨 보내는 것을 막는 습관)
 */
const readReturnPath = (state: unknown): string => {
  if (typeof state === "object" && state !== null && "from" in state) {
    // "from" in state 검사 덕분에 TypeScript가 state.from을 읽어도 된다고 판단한다.
    const from = state.from;
    if (typeof from === "string" && from.startsWith(`${BASE_PATH}/`)) return from;
  }
  return `${BASE_PATH}/mypage`;
};

/** 레이아웃: Provider로 감싸서 아래 모든 화면이 같은 로그인 정보를 보게 한다. */
export const ContextAuthPracticeLayout = () => (
  <PracticeAuthProvider>
    <section>
      <div className="page-heading-row">
        <div>
          <span className="level-badge level-고급">고급</span>
          <LearningGuideTitle guideId="context-auth">Context 로그인과 보호 라우트</LearningGuideTitle>
          <p>createContext·Provider·커스텀 훅으로 로그인 상태를 공유하고, 로그인하지 않은 사용자를 로그인 화면으로 보냅니다.</p>
        </div>
      </div>
      <PracticeAuthStatusBar />
      {/* Outlet: 지금 주소에 맞는 하위 화면(공개·로그인·마이페이지)이 이 자리에 그려진다. */}
      <Outlet />
    </section>
  </PracticeAuthProvider>
);

/** props를 하나도 받지 않지만 Context로 로그인 정보를 읽는다. */
const PracticeAuthStatusBar = () => {
  const { user, logout } = usePracticeAuth();
  return (
    <nav className="practice-card button-row" aria-label="Context 실습 메뉴">
      {/* NavLink는 현재 주소와 같으면 active 클래스를 붙인다. end: 하위 주소(/mypage)에서는 "공개 화면"이 활성으로 보이지 않게 한다. */}
      <NavLink to={BASE_PATH} end>공개 화면</NavLink>
      <NavLink to={`${BASE_PATH}/mypage`}>마이페이지(보호)</NavLink>
      <span role="status">{user ? `${user.displayName} 로그인 중` : "로그인하지 않음"}</span>
      {user ? <button type="button" className="ghost-button" onClick={logout}>로그아웃</button> : <NavLink to={`${BASE_PATH}/login`}>로그인</NavLink>}
    </nav>
  );
};

export const ContextAuthHomePage = () => {
  const { user } = usePracticeAuth();
  return (
    <article className="practice-card">
      <h2>공개 화면</h2>
      <p>로그인하지 않아도 볼 수 있습니다. 상단 상태 표시와 이 문장은 같은 Context 값을 읽습니다.</p>
      <p>{user ? `${user.displayName}, 마이페이지로 이동할 수 있습니다.` : "마이페이지를 누르면 로그인 화면으로 이동합니다."}</p>
    </article>
  );
};

/** 보호 라우트 문지기: 로그인하지 않았으면 원래 주소를 기억한 채 로그인 화면으로 보낸다. */
export const RequirePracticeLogin = ({ children }: { children: ReactNode }) => {
  const { user } = usePracticeAuth();
  const location = useLocation();
  // replace: 뒤로 가기를 눌렀을 때 다시 보호 화면 → 로그인 화면으로 튕기는 반복을 막는다.
  if (!user) return <Navigate to={`${BASE_PATH}/login`} replace state={{ from: location.pathname }} />;
  // 로그인했으면 감싼 화면을 그대로 보여 준다.
  return children;
};

export const ContextAuthLoginPage = () => {
  const { user, login } = usePracticeAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  // 로그인 후 돌아갈 주소. 문지기가 state.from에 담아 보냈다(검증한 값만 사용).
  const returnPath = readReturnPath(location.state);

  // 이미 로그인했다면 로그인 화면을 보여 줄 이유가 없다.
  if (user) return <Navigate to={returnPath} replace />;

  const submitLogin = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    // login은 Context가 준 함수다. 성공하면 Provider의 State가 바뀌어 이 Context를 읽는 모든 화면이 다시 그려진다.
    if (!login(loginId, password)) {
      setErrorMessage(`아이디를 입력하고 실습용 비밀번호(${PRACTICE_PASSWORD})를 사용해 주세요.`);
      return;
    }
    // replace: 방문 기록에서 로그인 화면을 지워, 뒤로 가기를 눌러도 로그인 화면으로 돌아오지 않게 한다.
    navigate(returnPath, { replace: true });
  };

  return (
    <form className="practice-card" onSubmit={submitLogin} noValidate>
      <h2>실습 로그인</h2>
      <p>서버에 보내지 않는 학습용 로그인입니다. 비밀번호는 <code>{PRACTICE_PASSWORD}</code>입니다.</p>
      {/* 제어 컴포넌트: 입력값을 State에 두고(value), 바뀔 때마다 setState로 갱신한다(onChange). */}
      <label>아이디<input value={loginId} autoComplete="off" onChange={(event) => setLoginId(event.target.value)} /></label>
      <label>비밀번호<input type="password" value={password} autoComplete="off" onChange={(event) => setPassword(event.target.value)} /></label>
      {errorMessage ? <p className="field-error" role="alert">{errorMessage}</p> : null}
      <button type="submit">로그인</button>
    </form>
  );
};

/** 라우트에 등록하는 보호된 마이페이지: 문지기(RequirePracticeLogin)가 화면을 감싼다. */
export const ContextAuthProtectedMyPage = () => (
  <RequirePracticeLogin><ContextAuthMyPage /></RequirePracticeLogin>
);

export const ContextAuthMyPage = () => {
  const { user, logout } = usePracticeAuth();
  // RequirePracticeLogin 안에서만 열리지만, 타입상 null일 수 있으므로 한 번 더 확인한다.
  if (!user) return null;
  return (
    <article className="practice-card">
      <h2>마이페이지</h2>
      <p><strong>{user.displayName}</strong>만 볼 수 있는 화면입니다.</p>
      <p>새로고침하면 State가 사라져 다시 로그인해야 합니다. 실제 서비스는 서버 세션으로 로그인을 유지합니다.</p>
      <div className="button-row">
        <Link to={BASE_PATH}>공개 화면으로</Link>
        <button type="button" className="ghost-button" onClick={logout}>로그아웃</button>
      </div>
    </article>
  );
};
