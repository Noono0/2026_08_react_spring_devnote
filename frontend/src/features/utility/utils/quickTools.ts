/**
 * ============================================================================
 * quickTools.ts — 자잘하지만 자주 쓰는 개발 도구 모음
 * ============================================================================
 *
 * Base64 · 해시 · 색상 변환 · 비밀번호 생성 · HTTP 상태 코드를 모아 뒀다.
 * 각각을 별도 페이지로 만들 만큼 크지 않아 Quick Tools 한 화면에서 함께 제공한다.
 *
 * ★ 이 파일에서 배울 개념
 *   - 브라우저 내장 암호 API(crypto) 사용법
 *   - "안전한 난수"와 Math.random()의 차이
 *   - 한글 같은 다국어 문자를 바이트로 다룰 때 주의할 점
 */

/**
 * 글자를 Base64로 인코딩한다.
 *
 * ★ 왜 `btoa(value)` 한 줄로 안 끝나나?
 *   btoa()는 글자 하나를 1바이트(0~255)로만 다룬다.
 *   한글 "가"는 UTF-8에서 3바이트라 btoa에 바로 넣으면 오류가 난다.
 *     btoa("가")  →  InvalidCharacterError
 *
 *   그래서 두 단계를 거친다.
 *     1) TextEncoder로 UTF-8 바이트 배열로 바꾼다
 *     2) 각 바이트를 "1바이트짜리 글자"로 이어 붙여 btoa가 이해할 형태로 만든다
 *
 *   (jwtDecoder.ts의 디코딩과 정확히 반대 방향의 처리다)
 */
export const encodeBase64Unicode = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};

/** Base64를 원래 글자로 되돌린다. 위 인코딩의 역순이다. */
export const decodeBase64Unicode = (value: string): string => {
  const binary = atob(value.trim());
  // 글자 → 바이트 배열 → UTF-8 해석. TextDecoder를 거쳐야 한글이 안 깨진다.
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
};

/**
 * SHA-256 해시를 16진수 문자열로 만든다.
 *
 * ★ 해시는 암호화가 아니다. 되돌릴 수 없는 "지문"이다.
 *   같은 입력은 항상 같은 결과를 내지만, 결과에서 원본을 복원할 수 없다.
 *   파일이 바뀌었는지 확인하거나 무결성을 검증할 때 쓴다.
 *
 * ★ 비밀번호 저장에 이걸 그대로 쓰면 안 된다.
 *   SHA-256은 너무 빨라서 무차별 대입에 취약하다.
 *   비밀번호에는 bcrypt·PBKDF2처럼 일부러 느린 알고리즘을 쓴다.
 *   (이 프로젝트 백엔드도 PBKDF2를 쓴다)
 *
 * crypto.subtle.digest 는 비동기라 async/await가 필요하다.
 *
 * [16진수 변환 과정]
 *   결과는 바이트 배열이라 그대로 보면 숫자 나열이다.
 *   각 바이트를 16진수 두 자리로 바꿔 이어 붙인다.
 *   `padStart(2, "0")` 이 중요하다. 10 미만은 "a"가 아니라 "0a"로 써야
 *   자릿수가 맞고, 없으면 해시 길이가 들쭉날쭉해진다.
 */
export const sha256Hex = async (value: string | ArrayBuffer): Promise<string> => {
  const data = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

/**
 * HEX 색상을 RGB 숫자로 바꾼다.
 *
 * 짧은 형식(`#63f`)도 받는다.
 * 각 글자를 두 번 반복해 6자리로 늘린다: `63f` → `6633ff`
 * 이건 CSS 표준 규칙이라 임의로 정한 게 아니다.
 *
 * 정규식으로 6자리 16진수인지 확인한 뒤 두 자리씩 잘라 10진수로 바꾼다.
 * `parseInt(값, 16)` 의 두 번째 인자 16이 "16진수로 읽어라"는 뜻이다.
 */
export const hexToRgb = (hex: string): { red: number; green: number; blue: number } => {
  const normalized = hex.trim().replace(/^#/, "");
  const expanded = normalized.length === 3 ? [...normalized].map((character) => character.repeat(2)).join("") : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) throw new Error("HEX 색상은 #6366f1 또는 #63f 형식으로 입력해 주세요.");
  return { red: parseInt(expanded.slice(0, 2), 16), green: parseInt(expanded.slice(2, 4), 16), blue: parseInt(expanded.slice(4, 6), 16) };
};

/**
 * RGB를 HSL로 바꾼다.
 *
 * [왜 HSL이 필요한가]
 *   RGB는 "빨강을 조금 더"처럼 사람이 직관적으로 조절하기 어렵다.
 *   HSL은 색조(Hue) · 채도(Saturation) · 명도(Lightness)로 나뉘어
 *   "같은 색인데 조금 더 밝게" 같은 조작이 쉽다. 디자인 토큰에 자주 쓴다.
 *
 * [변환 공식]
 *   표준 색공간 변환 공식을 그대로 옮긴 것이라 임의로 바꾸면 안 된다.
 *     1) 0~255를 0~1로 정규화한다
 *     2) 최댓값과 최솟값을 찾는다
 *     3) 명도 = (최대 + 최소) / 2
 *     4) 최대 == 최소면 무채색(회색)이라 색조·채도가 0이다  ← 0으로 나누는 것 방지
 *     5) 아니면 어느 색이 최대인지에 따라 색조를 계산한다
 *
 *   `+ 6` 이 붙은 부분은 색조가 음수가 되는 경우를 한 바퀴 돌려 양수로 만드는 처리다.
 *   마지막에 6으로 나누고 360을 곱해 각도(0~360°)로 바꾼다.
 *
 * `?? 0` 이 많은 이유: TypeScript가 배열 구조 분해 결과를
 * "없을 수도 있음"으로 보기 때문에 붙인 안전장치다.
 */
export const rgbToHsl = (red: number, green: number, blue: number): { hue: number; saturation: number; lightness: number } => {
  const [normalizedRed, normalizedGreen, normalizedBlue] = [red, green, blue].map((value) => value / 255);
  const maximum = Math.max(normalizedRed ?? 0, normalizedGreen ?? 0, normalizedBlue ?? 0);
  const minimum = Math.min(normalizedRed ?? 0, normalizedGreen ?? 0, normalizedBlue ?? 0);
  const lightness = (maximum + minimum) / 2;
  if (maximum === minimum) return { hue: 0, saturation: 0, lightness: Math.round(lightness * 100) };
  const difference = maximum - minimum;
  const saturation = lightness > 0.5 ? difference / (2 - maximum - minimum) : difference / (maximum + minimum);
  let hue = maximum === normalizedRed ? ((normalizedGreen ?? 0) - (normalizedBlue ?? 0)) / difference + ((normalizedGreen ?? 0) < (normalizedBlue ?? 0) ? 6 : 0)
    : maximum === normalizedGreen ? ((normalizedBlue ?? 0) - (normalizedRed ?? 0)) / difference + 2
      : ((normalizedRed ?? 0) - (normalizedGreen ?? 0)) / difference + 4;
  hue /= 6;
  return { hue: Math.round(hue * 360), saturation: Math.round(saturation * 100), lightness: Math.round(lightness * 100) };
};

/**
 * ★★ 안전한 무작위 비밀번호를 만든다. 이 파일에서 가장 배울 게 많은 함수다.
 *
 * [Math.random()을 쓰지 않은 이유]
 *   Math.random()은 "예측 가능한" 난수다.
 *   내부 상태를 알면 다음 값을 계산해 낼 수 있어 비밀번호·토큰에 쓰면 안 된다.
 *   crypto.getRandomValues()는 운영체제의 암호학적 난수를 쓴다.
 *
 * [세 가지 설계 포인트]
 *
 *   1) 헷갈리는 글자를 뺐다
 *      대문자에 I·O가, 소문자에 l이, 숫자에 0·1이 없다.
 *      손으로 옮겨 적을 때 0과 O, l과 1을 혼동하는 사고를 막기 위해서다.
 *
 *   2) 각 그룹에서 최소 1글자를 먼저 뽑는다
 *      `groups.map(randomCharacter)` 가 그 부분이다.
 *      전부 무작위로만 뽑으면 운 나쁘게 특수문자가 하나도 없는 비밀번호가 나올 수 있다.
 *      "대문자·소문자·숫자·특수문자를 각각 포함" 규칙을 보장하는 방법이다.
 *
 *   3) 마지막에 섞는다 (Fisher-Yates 셔플)
 *      2번 때문에 앞 4글자가 항상 "대문자, 소문자, 숫자, 특수문자" 순서가 된다.
 *      그대로 두면 패턴이 노출되므로 뒤에서부터 무작위 위치와 교환해 섞는다.
 *      이 셔플은 모든 배열 순서가 같은 확률로 나오는 표준 알고리즘이다.
 *      여기서도 교환 위치를 crypto로 정한다.
 *
 * `% characters.length` 는 난수를 글자 개수 범위로 줄이는 처리다.
 * (엄밀히는 아주 미세한 편향이 생기지만, 비밀번호 용도에서는 무시할 수준이다)
 */
export const generateSafePassword = (length: number): string => {
  if (length < 12 || length > 128) throw new Error("비밀번호 길이는 12~128자로 설정해 주세요.");
  const groups = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%^&*_-+="];
  const randomCharacter = (characters: string): string => {
    const values = new Uint32Array(1); crypto.getRandomValues(values); return characters[(values[0] ?? 0) % characters.length] ?? "A";
  };
  // (2) 각 그룹에서 하나씩 확보한다.
  const characters = groups.map(randomCharacter);
  const allCharacters = groups.join("");
  // 나머지는 전체 글자에서 뽑아 길이를 채운다.
  while (characters.length < length) characters.push(randomCharacter(allCharacters));
  // (3) Fisher-Yates 셔플. 뒤에서부터 앞쪽 무작위 위치와 교환한다.
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const values = new Uint32Array(1); crypto.getRandomValues(values); const swapIndex = (values[0] ?? 0) % (index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex] ?? "A", characters[index] ?? "A"];
  }
  return characters.join("");
};

/**
 * 자주 만나는 HTTP 상태 코드 사전.
 *
 * 전부 나열하지 않고 실무에서 실제로 자주 보는 것만 골랐다.
 * 100개를 나열하면 오히려 찾기 어려워지기 때문이다.
 *
 * ★ 헷갈리기 쉬운 짝을 함께 익혀 두면 좋다.
 *   401 vs 403 — 401은 "누군지 모르겠다(로그인 필요)",
 *                403은 "누군지는 알지만 권한이 없다"
 *   400 vs 422 — 400은 문법 자체가 잘못됨,
 *                422는 문법은 맞지만 값이 규칙에 안 맞음
 */
export const httpStatuses = [
  { code: 200, name: "OK", meaning: "요청이 정상 처리됨" }, { code: 201, name: "Created", meaning: "새 리소스 생성 완료" },
  { code: 204, name: "No Content", meaning: "응답 본문 없이 성공" }, { code: 400, name: "Bad Request", meaning: "요청값 또는 문법 오류" },
  { code: 401, name: "Unauthorized", meaning: "인증이 필요함" }, { code: 403, name: "Forbidden", meaning: "인증됐지만 권한 없음" },
  { code: 404, name: "Not Found", meaning: "리소스를 찾을 수 없음" }, { code: 409, name: "Conflict", meaning: "현재 상태와 요청이 충돌" },
  { code: 422, name: "Unprocessable Content", meaning: "문법은 맞지만 처리할 수 없는 값" }, { code: 429, name: "Too Many Requests", meaning: "요청 횟수 제한 초과" },
  { code: 500, name: "Internal Server Error", meaning: "서버 내부 오류" }, { code: 503, name: "Service Unavailable", meaning: "일시적으로 서비스를 사용할 수 없음" },
];
