import { disableAutoLoginPreference, readLoginPreferences, saveLoginPreferences } from "@/features/auth/utils/loginPreferenceStorage";

describe("로그인 환경설정 저장", () => {
  beforeEach(() => localStorage.clear());

  it("아이디만 저장하고 비밀번호 저장 Key를 만들지 않는다", () => {
    saveLoginPreferences({ loginId: "admin", rememberLoginId: true, autoLogin: false });

    expect(readLoginPreferences()).toEqual({ loginId: "admin", rememberLoginId: true, autoLogin: false });
    expect(Object.keys(localStorage).every((key) => !key.toLowerCase().includes("password"))).toBe(true);
  });

  it("자동 로그인 선택은 아이디를 함께 기억하고 로그아웃 시 자동 로그인만 해제한다", () => {
    saveLoginPreferences({ loginId: "admin", rememberLoginId: false, autoLogin: true });

    expect(readLoginPreferences()).toEqual({ loginId: "admin", rememberLoginId: true, autoLogin: true });
    expect(disableAutoLoginPreference()).toEqual({ loginId: "admin", rememberLoginId: true, autoLogin: false });
  });
});
