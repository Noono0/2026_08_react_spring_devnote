/**
 * ============================================================================
 * AuthenticationControls.tsx — 로그인/회원가입/로그아웃 버튼과 모달
 * ============================================================================
 *
 * 헤더와 사이드바 양쪽에서 쓰이는 컴포넌트다.
 * 로그인 여부에 따라 완전히 다른 모습을 보여준다.
 *   로그인함   → 이름 + 등급 + 로그아웃 버튼
 *   로그인 안 함 → 로그인 / 회원가입 버튼 + 모달
 *
 * [이 파일에서 배울 것]
 *   1. 하나의 모달로 로그인/회원가입 두 화면 처리하기
 *   2. 브라우저 기본 폼 검증(required, minLength) 활용
 *   3. autoComplete 속성으로 비밀번호 관리자와 협력하기
 *   4. 서로 연동되는 체크박스 다루기
 *
 * ★ 이 프로젝트에서 유일하게 비밀번호를 다루는 화면이다.
 *   비밀번호는 State에 잠깐 담겼다가 서버로 보내지고,
 *   성공 즉시 비워진다. 어디에도 저장되지 않는다.
 */

import { useState, type FormEvent } from "react";
import { ModalDialog } from "@/shared/ui/ModalDialog";
import { useAuthSessionQuery, useLoginMutation, useLogoutMutation, useRegisterMutation } from "@/features/auth/hooks/useAuthSession";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { disableAutoLoginPreference, readLoginPreferences, saveLoginPreferences } from "@/features/auth/utils/loginPreferenceStorage";

export const AuthenticationControls = () => {
  const sessionQuery = useAuthSessionQuery();
  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();
  const logoutMutation = useLogoutMutation();
  // ★ 모달 상태를 boolean이 아니라 세 가지 값으로 표현했다.
  //   undefined = 닫힘 / "LOGIN" = 로그인 모달 / "REGISTER" = 가입 모달
  //   ProductModalCrudPage에서 본 것과 같은 발상이다.
  //   isOpen + isRegisterMode 두 개로 나누면 모순된 조합이 생길 수 있다.
  const [dialogMode, setDialogMode] = useState<"LOGIN" | "REGISTER">();

  // ★ useState에 함수 이름을 그대로 넘겼다(호출한 게 아니다!).
  //   useState(readLoginPreferences)  ← 함수 자체 (첫 렌더에 한 번만 실행)
  //   useState(readLoginPreferences()) ← 매 렌더마다 실행 (낭비)
  //   localStorage 읽기는 느린 편이라 이 차이가 의미가 있다.
  //   set 함수를 안 받은 건 "초기값을 읽는 용도로만 쓴다"는 뜻이다.
  const [initialLoginPreferences] = useState(readLoginPreferences);

  // 저장돼 있던 값으로 입력창을 미리 채운다.
  const [loginId, setLoginId] = useState(initialLoginPreferences.loginId);
  const [rememberLoginId, setRememberLoginId] = useState(initialLoginPreferences.rememberLoginId);
  const [autoLogin, setAutoLogin] = useState(initialLoginPreferences.autoLogin);

  // ★ 비밀번호는 항상 빈 문자열로 시작한다. 저장된 값을 채우는 일은 절대 없다.
  const [password, setPassword] = useState("");
  const [memberName, setMemberName] = useState("");
  const [email, setEmail] = useState("");

  // 로그인이든 가입이든 처리 중이면 버튼을 잠근다.
  const isPending = loginMutation.isPending || registerMutation.isPending;

  /**
   * 폼 제출(로그인 또는 회원가입).
   */
  const submit = async (event: FormEvent): Promise<void> => {
    // 폼의 기본 제출(페이지 새로고침)을 막는다.
    event.preventDefault();
    try {
      if (dialogMode === "REGISTER") await registerMutation.mutateAsync({ loginId, password, memberName, email });
      else {
        await loginMutation.mutateAsync({ loginId: loginId.trim(), password, autoLogin });
        // ★ 설정 저장은 "로그인이 성공한 뒤에" 한다.
        //   실패했는데 아이디를 저장하면, 오타 난 아이디가 계속 남는다.
        saveLoginPreferences({ loginId, rememberLoginId, autoLogin });
      }

      // 성공 후 정리.
      setDialogMode(undefined);
      // ★ 아이디는 "기억하기"를 켰을 때만 남긴다. 아니면 비운다.
      setLoginId(rememberLoginId || autoLogin ? loginId.trim() : "");
      // ★★ 비밀번호는 무조건 즉시 비운다.
      //   메모리에 남아 있을 이유가 전혀 없다. 보안의 기본이다.
      setPassword(""); setMemberName(""); setEmail("");
      applicationNotification.success(dialogMode === "REGISTER" ? "회원가입과 로그인을 완료했습니다." : "로그인했습니다.");
    } catch (error) {
      // ★ 실패하면 아무것도 비우지 않는다.
      //   비밀번호만 틀렸는데 입력한 걸 전부 지우면 처음부터 다시 쳐야 한다.
      //   (실무에서는 비밀번호만 비우고 아이디는 남기기도 한다)
      applicationNotification.apiError(convertRequestErrorToProblemDetails(error));
    }
  };

  /**
   * 로그아웃.
   */
  const handleLogout = async (): Promise<void> => {
    try {
      await logoutMutation.mutateAsync();

      // ★ 로그아웃하면 자동 로그인을 꺼야 한다.
      //   안 그러면 방금 나갔는데 다음에 들어올 때 자동으로 다시 로그인된다.
      //   "로그아웃했다"는 의사를 무시하는 셈이 된다.
      //   반면 아이디 기억하기는 유지한다. 다시 로그인할 때 편하기 때문이다.
      const nextPreferences = disableAutoLoginPreference();
      setLoginId(nextPreferences.loginId);
      setRememberLoginId(nextPreferences.rememberLoginId);
      setAutoLogin(false);
      applicationNotification.success("로그아웃했습니다.");
    } catch (error) {
      applicationNotification.apiError(convertRequestErrorToProblemDetails(error));
    }
  };

  // ── 로그인 상태면 이름과 로그아웃 버튼만 보여주고 끝낸다 ──────────
  // early return으로 아래의 긴 모달 코드를 아예 건너뛴다.
  if (sessionQuery.data?.authenticated) {
    return (
      <div className="authentication-controls">
        <span><strong>{sessionQuery.data.memberName}</strong> · {sessionQuery.data.grade}</span>
        <button type="button" className="ghost-button" disabled={logoutMutation.isPending} onClick={() => void handleLogout()}>{logoutMutation.isPending ? "로그아웃 중..." : "로그아웃"}</button>
      </div>
    );
  }

  return (
    <>
      <div className="authentication-controls">
        <button type="button" className="ghost-button" onClick={() => setDialogMode("LOGIN")}>로그인</button>
        <button type="button" className="secondary-button" onClick={() => setDialogMode("REGISTER")}>회원가입</button>
      </div>
      <ModalDialog isOpen={Boolean(dialogMode)} title={dialogMode === "REGISTER" ? "회원가입" : "로그인"} description="비회원도 공개 기능을 사용할 수 있습니다." onRequestClose={() => setDialogMode(undefined)}>
        <form className="authentication-form" onSubmit={(event) => void submit(event)}>
          {/* ★ HTML 기본 검증 속성들.
                required, minLength, maxLength를 적어 두면
                브라우저가 제출 전에 알아서 확인하고 안내 문구까지 띄운다.
                Zod 같은 라이브러리 없이도 기본적인 검증이 된다.

              ★ autoComplete="username"이 중요하다.
                브라우저와 비밀번호 관리자에게 "여기가 아이디 칸"이라고 알려 준다.
                이게 있어야 저장된 계정 자동 채우기가 제대로 동작한다.
                지정하지 않으면 엉뚱한 칸에 값을 채워 넣기도 한다.

              ★ 다만 HTML 검증은 개발자도구로 쉽게 우회할 수 있다.
                진짜 검증은 언제나 서버가 해야 한다. */}
          <label>아이디<input value={loginId} onChange={(event) => setLoginId(event.target.value)} minLength={4} maxLength={100} autoComplete="username" required /></label>
          {dialogMode === "REGISTER" ? <><label>이름<input value={memberName} onChange={(event) => setMemberName(event.target.value)} maxLength={100} required /></label><label>이메일<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={200} required /></label></> : null}
          {/* ★ 비밀번호 입력창의 세 가지 포인트.
                type="password" → 글자를 •••로 가린다. 어깨너머로 못 보게.

                minLength: 가입할 때만 8자 이상을 요구한다.
                  로그인에는 안 건다. 예전에 짧은 비밀번호로 가입한 사람이
                  로그인조차 못 하는 상황을 막기 위해서다.

                autoComplete: 상황에 따라 값이 다르다.
                  "new-password"     → 비밀번호 관리자가 "새 비밀번호 생성"을 제안한다
                  "current-password" → 저장된 비밀번호를 채워 준다
                  이걸 구분하지 않으면 가입 화면에서 기존 비밀번호가 채워지는
                  이상한 일이 생긴다. 작지만 사용자 경험에 큰 차이를 만든다. */}
          <label>비밀번호<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={dialogMode === "REGISTER" ? 8 : undefined} autoComplete={dialogMode === "REGISTER" ? "new-password" : "current-password"} required /></label>
          {/* ★★ 서로 연동되는 체크박스 두 개.
                논리적으로 "자동 로그인 → 아이디 기억"이 반드시 따라온다.
                아이디를 기억하지 않으면서 자동 로그인을 할 수는 없기 때문이다.

                그래서 양방향으로 맞춰 준다:
                  아이디 기억을 끄면  → 자동 로그인도 끈다
                  자동 로그인을 켜면  → 아이디 기억도 켠다

                이런 처리가 없으면 사용자가 "말이 안 되는 조합"을 만들 수 있고,
                나중에 왜 자동 로그인이 안 되는지 알 수 없게 된다.

                체크박스는 value가 아니라 checked와 event.target.checked를 쓴다. */}
          {dialogMode === "LOGIN" ? <div className="authentication-login-options"><label><input type="checkbox" checked={rememberLoginId} onChange={(event) => { setRememberLoginId(event.target.checked); if (!event.target.checked) setAutoLogin(false); }} />아이디 기억</label><label><input type="checkbox" checked={autoLogin} onChange={(event) => { setAutoLogin(event.target.checked); if (event.target.checked) setRememberLoginId(true); }} />자동 로그인</label><p>아이디만 브라우저에 저장합니다. 자동 로그인은 비밀번호를 저장하지 않고 HttpOnly 세션 쿠키를 최대 30일간 유지합니다.</p></div> : null}
          <div className="button-row"><button type="submit" disabled={isPending}>{isPending ? "처리 중..." : dialogMode === "REGISTER" ? "가입하기" : "로그인"}</button><button type="button" className="ghost-button" onClick={() => setDialogMode(undefined)}>취소</button></div>
        </form>
      </ModalDialog>
    </>
  );
};
