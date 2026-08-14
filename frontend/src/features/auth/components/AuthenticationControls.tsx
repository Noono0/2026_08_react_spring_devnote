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
  const [dialogMode, setDialogMode] = useState<"LOGIN" | "REGISTER">();
  const [initialLoginPreferences] = useState(readLoginPreferences);
  const [loginId, setLoginId] = useState(initialLoginPreferences.loginId);
  const [rememberLoginId, setRememberLoginId] = useState(initialLoginPreferences.rememberLoginId);
  const [autoLogin, setAutoLogin] = useState(initialLoginPreferences.autoLogin);
  const [password, setPassword] = useState("");
  const [memberName, setMemberName] = useState("");
  const [email, setEmail] = useState("");
  const isPending = loginMutation.isPending || registerMutation.isPending;

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    try {
      if (dialogMode === "REGISTER") await registerMutation.mutateAsync({ loginId, password, memberName, email });
      else {
        await loginMutation.mutateAsync({ loginId: loginId.trim(), password, autoLogin });
        saveLoginPreferences({ loginId, rememberLoginId, autoLogin });
      }
      setDialogMode(undefined); setLoginId(rememberLoginId || autoLogin ? loginId.trim() : ""); setPassword(""); setMemberName(""); setEmail("");
      applicationNotification.success(dialogMode === "REGISTER" ? "회원가입과 로그인을 완료했습니다." : "로그인했습니다.");
    } catch (error) { applicationNotification.apiError(convertRequestErrorToProblemDetails(error)); }
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await logoutMutation.mutateAsync();
      const nextPreferences = disableAutoLoginPreference();
      setLoginId(nextPreferences.loginId);
      setRememberLoginId(nextPreferences.rememberLoginId);
      setAutoLogin(false);
      applicationNotification.success("로그아웃했습니다.");
    } catch (error) {
      applicationNotification.apiError(convertRequestErrorToProblemDetails(error));
    }
  };

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
          <label>아이디<input value={loginId} onChange={(event) => setLoginId(event.target.value)} minLength={4} maxLength={100} autoComplete="username" required /></label>
          {dialogMode === "REGISTER" ? <><label>이름<input value={memberName} onChange={(event) => setMemberName(event.target.value)} maxLength={100} required /></label><label>이메일<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={200} required /></label></> : null}
          <label>비밀번호<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={dialogMode === "REGISTER" ? 8 : undefined} autoComplete={dialogMode === "REGISTER" ? "new-password" : "current-password"} required /></label>
          {dialogMode === "LOGIN" ? <div className="authentication-login-options"><label><input type="checkbox" checked={rememberLoginId} onChange={(event) => { setRememberLoginId(event.target.checked); if (!event.target.checked) setAutoLogin(false); }} />아이디 기억</label><label><input type="checkbox" checked={autoLogin} onChange={(event) => { setAutoLogin(event.target.checked); if (event.target.checked) setRememberLoginId(true); }} />자동 로그인</label><p>아이디만 브라우저에 저장합니다. 자동 로그인은 비밀번호를 저장하지 않고 HttpOnly 세션 쿠키를 최대 30일간 유지합니다.</p></div> : null}
          <div className="button-row"><button type="submit" disabled={isPending}>{isPending ? "처리 중..." : dialogMode === "REGISTER" ? "가입하기" : "로그인"}</button><button type="button" className="ghost-button" onClick={() => setDialogMode(undefined)}>취소</button></div>
        </form>
      </ModalDialog>
    </>
  );
};
