/**
 * 17단계 연습 — Context 로그인과 보호 화면: createContext, Provider, 커스텀 훅
 *
 * 해 볼 것
 *  1. 사용자에 role("USER" | "ADMIN")을 추가하고 관리자 전용 화면을 만들어 보세요.
 *  2. Provider 밖에서 useAuth를 부르면 어떤 오류가 나는지 확인해 보세요.
 */
import { createContext, useContext, useState, type ReactNode } from "react";

interface AuthContextValue {
  userName: string | null;
  login: (name: string) => void;
  logout: () => void;
}

// 기본값 null: Provider 밖에서 쓰면 바로 알아챌 수 있게 한다.
const AuthContext = createContext<AuthContextValue | null>(null);

// 커스텀 훅으로 감싸면 쓰는 쪽은 useAuth()만 부르면 되고, null 검사도 한곳에서 끝난다.
const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth는 AuthProvider 안에서만 쓸 수 있습니다.");
  return context;
};

function AuthProvider({ children }: { children: ReactNode }) {
  const [userName, setUserName] = useState<string | null>(null);
  const value: AuthContextValue = { userName, login: setUserName, logout: () => setUserName(null) };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// 보호 화면: 로그인하지 않았으면 내용 대신 안내를 보여 준다.
function Protected({ children }: { children: ReactNode }) {
  const { userName } = useAuth();
  return userName ? children : <p className="error">로그인한 사용자만 볼 수 있습니다.</p>;
}

function LoginBox() {
  const { userName, login, logout } = useAuth();
  const [name, setName] = useState("");
  if (userName) return <div className="row"><span>{userName}님 환영합니다.</span><button className="secondary" onClick={logout}>로그아웃</button></div>;
  return (
    <div className="row">
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="이름" />
      <button disabled={!name.trim()} onClick={() => login(name.trim())}>로그인</button>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <main>
        <h1>Context 로그인</h1>
        <LoginBox />
        <div className="card">
          <h2>마이페이지</h2>
          <Protected><p className="ok">로그인했기 때문에 이 내용이 보입니다.</p></Protected>
        </div>
      </main>
    </AuthProvider>
  );
}
