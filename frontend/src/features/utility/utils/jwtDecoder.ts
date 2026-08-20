/**
 * ============================================================================
 * jwtDecoder.ts — JWT 토큰 내용 읽기
 * ============================================================================
 *
 * [JWT가 뭔가요?]
 *   로그인한 사용자를 식별하는 데 흔히 쓰는 토큰이다.
 *   점(.)으로 구분된 세 부분으로 되어 있다.
 *
 *     eyJhbGci...  .  eyJzdWIi...  .  SflKxwRJ...
 *     └ Header ┘      └ Payload ┘     └ Signature ┘
 *       알고리즘        내용(누구인지)    위조 검증용 서명
 *
 * ★★ 반드시 알아야 할 것: Base64는 암호화가 아니다.
 *   Header와 Payload는 그냥 "인코딩"된 것이라 누구나 읽을 수 있다.
 *   그래서 JWT에 비밀번호나 민감한 개인정보를 넣으면 안 된다.
 *   이 도구가 서버 없이 내용을 보여줄 수 있는 이유도 그 때문이다.
 *
 * ★ 이 도구는 "읽기"만 한다. 서명 검증은 하지 않는다.
 *   서명 검증에는 비밀키가 필요하고, 비밀키를 브라우저에 넣는 것 자체가 위험하다.
 *   즉 "내용은 보여주지만 이 토큰이 진짜라는 뜻은 아니다."
 */

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  /** 시간 Claim으로 판단한 상태. 만료됨 / 아직 유효하지 않음 / 유효 / 시간 정보 없음 */
  state: "VALID_TIME" | "EXPIRED" | "NOT_ACTIVE" | "NO_TIME_CLAIMS";
  timeClaims: Array<{ name: "iat" | "exp" | "nbf"; rawValue: number; date: string }>;
}

/**
 * ★ Base64URL을 사람이 읽을 수 있는 글자로 되돌린다.
 *
 * [일반 Base64와 무엇이 다른가]
 *   Base64에는 `+` 와 `/` 가 들어가는데, 이 글자들은 URL에서 특별한 의미가 있다.
 *   그래서 JWT는 URL에 안전한 변형(Base64URL)을 쓴다.
 *     `+` → `-`,  `/` → `_`,  그리고 끝의 `=` 패딩을 생략
 *
 *   브라우저의 atob()는 일반 Base64만 이해하므로 되돌려 줘야 한다.
 *     1) `-` 를 `+` 로, `_` 를 `/` 로 복원
 *     2) 길이를 4의 배수로 맞추도록 `=` 를 다시 채운다
 *        (Base64는 4글자 단위라 길이가 안 맞으면 atob이 실패한다)
 *
 * [왜 atob 결과를 바로 쓰지 않고 TextDecoder를 거치나]
 *   atob()는 글자 하나를 바이트 하나로만 다룬다.
 *   한글은 UTF-8에서 3바이트라 그대로 쓰면 깨진다.
 *   바이트 배열로 만든 뒤 TextDecoder로 UTF-8 해석을 시켜야 한글이 제대로 나온다.
 */
const decodeBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

/**
 * Header 또는 Payload 한 조각을 JSON 객체로 바꾼다.
 *
 * ★ 객체인지까지 확인하는 게 중요하다.
 *   JSON.parse는 `"123"` 이나 `"[1,2]"` 도 성공시킨다.
 *   JWT의 Header/Payload는 반드시 객체여야 하므로
 *   null·배열·원시값이면 잘못된 토큰으로 본다.
 *
 * `label` 을 받아 오류 문구에 넣는다.
 * "디코딩 실패"보다 "Payload를 디코딩하지 못했습니다"가 훨씬 유용하다.
 */
const parseJwtPart = (value: string, label: string): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(value));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`${label}를 JSON으로 디코딩하지 못했습니다.`);
  }
};

/**
 * JWT를 해석한다.
 *
 * `nowMilliseconds = Date.now()` 를 기본값으로 둔 이유:
 * 만료 판정은 "현재 시각"에 따라 결과가 달라진다.
 * 테스트에서 고정된 시각을 넣을 수 있어야 결과가 항상 같아진다.
 */
export const decodeJwt = (source: string, nowMilliseconds = Date.now()): DecodedJwt => {
  // "Bearer eyJ..." 처럼 헤더째 복사해 붙이는 경우가 흔해 접두사를 떼어 준다.
  // `/i` 는 대소문자를 가리지 않는다는 뜻이다.
  const token = source.trim().replace(/^Bearer\s+/i, "");
  const parts = token.split(".");

  // 세 조각인지, 빈 조각이 없는지 확인한다.
  // some((part) => !part) 는 "빈 문자열인 조각이 하나라도 있으면" 이라는 뜻이다.
  if (parts.length !== 3 || parts.some((part) => !part)) throw new Error("JWT는 Header.Payload.Signature 세 부분이어야 합니다.");

  const header = parseJwtPart(parts[0] ?? "", "Header");
  const payload = parseJwtPart(parts[1] ?? "", "Payload");

  // ── 시간 관련 Claim 추출 ──
  //   iat (issued at)  발급 시각
  //   exp (expiration) 만료 시각
  //   nbf (not before) 이 시각 전에는 사용 불가
  //
  // ★ flatMap을 쓴 이유: "조건에 맞으면 하나, 아니면 없음"을 한 번에 처리한다.
  //   빈 배열 []을 돌려주면 결과에서 그냥 사라진다.
  //   filter로 거르고 map으로 변환하는 두 단계를 하나로 합친 관용구다.
  const claimNames = ["iat", "exp", "nbf"] as const;
  const timeClaims = claimNames.flatMap((name) => typeof payload[name] === "number"
    // ★ JWT의 시간은 "초" 단위인데 JavaScript Date는 "밀리초"라 1000을 곱한다.
    //   이걸 빠뜨리면 1970년대 날짜가 나온다. 아주 흔한 실수다.
    ? [{ name, rawValue: payload[name], date: new Date(payload[name] * 1000).toLocaleString("ko-KR") }]
    : []);

  // 비교를 위해 현재 시각도 초 단위로 맞춘다.
  const nowSeconds = Math.floor(nowMilliseconds / 1000);

  // ★ 판정 순서에 의미가 있다.
  //   만료(EXPIRED)를 가장 먼저 본다. 이미 끝난 토큰이면 다른 판정은 의미가 없다.
  //   그 다음 아직 유효하지 않은 경우(NOT_ACTIVE),
  //   시간 Claim이 하나라도 있으면 유효(VALID_TIME),
  //   아무 시간 정보도 없으면 판단 불가(NO_TIME_CLAIMS)로 구분한다.
  //   "판단 불가"를 "유효"와 섞지 않는 것이 중요하다. 만료 여부를 알 수 없는 상태이기 때문이다.
  const state = typeof payload.exp === "number" && payload.exp <= nowSeconds
    ? "EXPIRED"
    : typeof payload.nbf === "number" && payload.nbf > nowSeconds
      ? "NOT_ACTIVE"
      : timeClaims.length > 0 ? "VALID_TIME" : "NO_TIME_CLAIMS";

  // signature는 해석하지 않고 원문 그대로 돌려준다. 검증하지 않기 때문이다.
  return { header, payload, signature: parts[2] ?? "", state, timeClaims };
};
