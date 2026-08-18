/**
 * ============================================================================
 * loginPreferenceStorage.ts — "아이디 기억하기 / 자동 로그인" 설정 저장
 * ============================================================================
 *
 * ★★ 무엇을 저장하고 무엇을 저장하지 않는지가 이 파일의 전부다.
 *
 *   저장한다   : 로그인 아이디, 자동 로그인 체크 여부
 *   저장 안 한다: 비밀번호, 세션 토큰  ← 절대 금지!
 *
 * [비밀번호를 localStorage에 저장하면 안 되는 이유]
 *   - localStorage는 JavaScript로 누구나 읽을 수 있다
 *   - XSS 공격이 한 번 성공하면 통째로 털린다
 *   - 공용 컴퓨터에 그대로 남는다
 *   - 암호화해 봐야 소용없다. 복호화 키도 같은 브라우저에 있어야 하므로.
 *
 *   "자동 로그인"은 비밀번호를 기억해서 하는 게 아니다.
 *   서버가 발급한 세션 쿠키의 유효기간을 길게 잡는 방식이다.
 *   그래서 여기에는 "자동 로그인을 원한다는 표시"만 저장한다.
 *
 * [키 이름에 접두사를 붙인 이유]
 *   "devnote-auth:remembered-login-id" 처럼 이름이 길다.
 *   localStorage는 도메인 하나를 여러 앱이 공유할 수 있어서,
 *   "loginId" 같은 짧은 이름은 다른 코드와 충돌할 수 있다.
 *   접두사를 붙이면 어느 기능의 값인지도 한눈에 보인다.
 */

const REMEMBERED_LOGIN_ID_KEY = "devnote-auth:remembered-login-id";
const AUTO_LOGIN_PREFERENCE_KEY = "devnote-auth:auto-login";

export interface LoginPreferences {
  loginId: string;
  rememberLoginId: boolean;
  autoLogin: boolean;
}

/**
 * 저장된 설정을 읽어 온다.
 */
export const readLoginPreferences = (): LoginPreferences => {
  // ★ `?.slice(0, 100)` 로 길이를 자르는 이유
  //   저장소 값은 사용자가 개발자도구로 마음대로 고칠 수 있다.
  //   10만 글자짜리 문자열을 넣어 두면 화면이 깨지거나 느려질 수 있다.
  //   "바깥에서 들어온 데이터는 크기도 제한한다"는 방어 습관이다.
  //
  //   `??  ""` → 저장된 게 없으면(null) 빈 문자열로.
  const loginId = localStorage.getItem(REMEMBERED_LOGIN_ID_KEY)?.slice(0, 100) ?? "";

  // localStorage는 문자열만 저장하므로 문자열 "true"와 비교해 boolean으로 되돌린다.
  const autoLogin = localStorage.getItem(AUTO_LOGIN_PREFERENCE_KEY) === "true";

  // ★ rememberLoginId를 따로 저장하지 않고 계산해서 만든다.
  //   "아이디가 저장돼 있다 = 기억하기를 켜 뒀다"는 뜻이므로 별도 저장이 불필요하다.
  //   저장 항목이 하나 줄면 둘이 어긋날 가능성도 사라진다.
  //   Boolean("")은 false, Boolean("abc")는 true다.
  return { loginId, rememberLoginId: Boolean(loginId), autoLogin };
};

/**
 * 설정을 저장한다.
 */
export const saveLoginPreferences = (preferences: LoginPreferences): void => {
  const normalizedLoginId = preferences.loginId.trim().slice(0, 100);

  // ★ 저장 조건이 `(기억하기 || 자동로그인) && 아이디가 있음` 이다.
  //   자동 로그인을 켰다면 아이디는 당연히 기억해야 하므로 `||`로 묶었다.
  //   조건이 아니면 지운다.
  //
  //   ★ else에서 removeItem을 부르는 게 중요하다.
  //     사용자가 "기억하기"를 껐는데 예전 값이 그대로 남아 있으면
  //     끈 의미가 없다. 공용 컴퓨터에서는 특히 문제가 된다.
  //     "저장 조건이 아니면 반드시 지운다"를 짝으로 처리하자.
  if ((preferences.rememberLoginId || preferences.autoLogin) && normalizedLoginId) localStorage.setItem(REMEMBERED_LOGIN_ID_KEY, normalizedLoginId);
  else localStorage.removeItem(REMEMBERED_LOGIN_ID_KEY);

  // 자동 로그인도 같은 원칙. 켜면 저장, 끄면 삭제.
  // "false"라는 문자열을 저장하지 않고 아예 지우는 편이 깔끔하다.
  if (preferences.autoLogin) localStorage.setItem(AUTO_LOGIN_PREFERENCE_KEY, "true");
  else localStorage.removeItem(AUTO_LOGIN_PREFERENCE_KEY);
};

/**
 * 자동 로그인만 끈다. 아이디 기억하기는 그대로 둔다.
 *
 * ★ 언제 쓰나?
 *   자동 로그인을 시도했는데 실패한 경우다. (세션 만료, 비밀번호 변경 등)
 *   그대로 두면 들어올 때마다 자동 로그인을 시도하고 매번 실패한다.
 *   한 번 실패하면 꺼 두고, 사용자가 직접 로그인하게 하는 것이 맞다.
 *
 * 읽기 → 일부만 바꾸기 → 저장하기 → 결과 돌려주기.
 * `{ ...preferences, autoLogin: false }` 로 원본을 고치지 않고 새 객체를 만드는
 * 불변 갱신 패턴이 여기서도 그대로 쓰인다.
 */
export const disableAutoLoginPreference = (): LoginPreferences => {
  const preferences = readLoginPreferences();
  const nextPreferences = { ...preferences, autoLogin: false };
  saveLoginPreferences(nextPreferences);
  // 바뀐 설정을 돌려주면 호출한 쪽이 다시 읽을 필요가 없다.
  return nextPreferences;
};
