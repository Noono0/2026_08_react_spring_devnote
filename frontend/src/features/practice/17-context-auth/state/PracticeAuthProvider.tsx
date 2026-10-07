import { useMemo, useState, type ReactNode } from "react";
import {
  PRACTICE_PASSWORD,
  PracticeAuthContext,
  type PracticeAuthContextValue,
  type PracticeUser,
} from "@/features/practice/17-context-auth/state/practiceAuthContext";

/**
 * 실습용 로그인 상태를 갖고 아래 화면들에 Context로 전달합니다.
 *
 * ★ 학습용 흉내다. 비밀번호를 서버에 보내지 않고 State에만 두므로 새로고침하면 로그아웃된다.
 *   실제 로그인은 서버 세션(HttpOnly 쿠키)으로 확인해야 하며, 화면 State만 믿고 권한을 주면 안 된다.
 */
export const PracticeAuthProvider = ({ children }: { children: ReactNode }) => {
  // null = 로그인하지 않음. 이 State가 Context로 흘러가는 "원본"이다.
  const [user, setUser] = useState<PracticeUser | null>(null);

  // ★ useMemo를 쓴 이유: value가 렌더링마다 새 객체면 user가 그대로여도
  //   이 Context를 쓰는 모든 컴포넌트가 다시 렌더링된다. user가 바뀔 때만 새로 만든다.
  const value = useMemo<PracticeAuthContextValue>(() => ({
    user,
    // 아이디가 비었거나 비밀번호가 틀리면 false를 돌려 로그인 화면이 오류를 보여 주게 한다.
    login: (loginId, password) => {
      const trimmedLoginId = loginId.trim();
      if (!trimmedLoginId || password !== PRACTICE_PASSWORD) return false;
      setUser({ loginId: trimmedLoginId, displayName: `${trimmedLoginId} 님` });
      return true;
    },
    logout: () => setUser(null),
  }), [user]);

  // Provider로 감싼 children 안의 모든 컴포넌트가 usePracticeAuth()로 이 value를 읽을 수 있다.
  return <PracticeAuthContext.Provider value={value}>{children}</PracticeAuthContext.Provider>;
};
