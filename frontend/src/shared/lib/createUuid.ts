
/**
 * ============================================================================
 * createUuid.ts — 어디서든 동작하는 UUID 생성기
 * ============================================================================
 *
 * [왜 crypto.randomUUID()를 그냥 쓰면 안 되나?]
 *   crypto.randomUUID()는 "보안 컨텍스트(secure context)"에서만 존재한다.
 *   보안 컨텍스트란 다음 둘 중 하나다.
 *     - https:// 로 접속한 페이지
 *     - http://localhost (개발 편의를 위한 예외)
 *
 *   그래서 개발 중에는 멀쩡히 잘 되다가,
 *   http://1.2.3.4 처럼 IP로 배포하는 순간 함수 자체가 사라진다.
 *     TypeError: crypto.randomUUID is not a function
 *
 *   ★ 실제로 이 프로젝트가 이 문제로 배포 후 모든 요청이 실패했다.
 *     요청 ID를 만드는 단계에서 예외가 나서 요청이 아예 나가지 못했고,
 *     화면에는 "백엔드 서버에 연결할 수 없습니다"라는 엉뚱한 메시지가 떴다.
 *     원인과 증상이 이렇게 멀어지면 디버깅이 아주 어려워진다.
 *
 * [해결 방법]
 *   crypto.getRandomValues()는 보안 컨텍스트 제한이 없다. http에서도 쓸 수 있다.
 *   이걸로 랜덤 바이트 16개를 받아 UUID v4 형식으로 직접 조립한다.
 *   품질은 randomUUID()와 동일하다. 같은 난수원을 쓰기 때문이다.
 *
 * ★ 교훈: "브라우저가 제공하니까 항상 있겠지"라고 가정하면 안 된다.
 *   특히 보안 컨텍스트를 요구하는 API(crypto.subtle, randomUUID,
 *   navigator.clipboard 등)는 배포 환경에서 조용히 사라질 수 있다.
 */

/** UUID v4 문자열을 만든다. 예: "3f2a1b4c-9d8e-4f7a-b6c5-1e2d3c4b5a69" */
export const createUuid = (): string => {
  // ── 1순위: 표준 API가 있으면 그대로 쓴다 ────────────────────
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // ── 2순위: 랜덤 바이트로 직접 조립한다 ──────────────────────
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // UUID v4 규격에 맞춰 두 바이트의 일부 비트를 고정한다.
    //   7번째 바이트 상위 4비트 = 0100 (버전 4라는 표시)
    //   9번째 바이트 상위 2비트 = 10   (variant 표시)
    // 이걸 안 하면 형식상 유효한 UUID가 아니게 된다.
    //
    // ★ `?? 0`이 붙은 이유
    //   tsconfig의 noUncheckedIndexedAccess가 켜져 있어서
    //   배열을 인덱스로 꺼내면 타입이 `number | undefined`가 된다.
    //   getRandomValues가 16칸을 반드시 채우므로 실제로 undefined일 수는 없지만,
    //   타입 시스템은 그걸 모른다. `!`로 우기는 대신 기본값을 주는 편이 안전하다.
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join("-");
  }

  // ── 3순위: 최후의 수단 ──────────────────────────────────────
  // crypto 자체가 없는 아주 오래된 환경. 실제로 여기까지 올 일은 거의 없다.
  // Math.random()은 예측 가능하므로 보안 용도로는 쓰면 안 되지만,
  // "화면에서 목록 항목을 구분하는 키" 정도로는 동작한다.
  const randomHex = (length: number): string =>
    Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-a${randomHex(3)}-${randomHex(12)}`;
};
