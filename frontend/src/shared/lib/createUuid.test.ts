/**
 * createUuid 회귀 테스트
 *
 * ★ 이 테스트가 존재하는 이유
 *   crypto.randomUUID()를 직접 쓰던 시절, https가 아닌 주소(http://IP)로
 *   배포하자 함수 자체가 없어서 모든 API 요청이 실패했다.
 *   화면에는 "백엔드 서버에 연결할 수 없습니다"라고만 떠서
 *   원인을 찾는 데 시간이 걸렸다.
 *   같은 일이 반복되지 않도록 "randomUUID가 없는 환경"을 만들어 검증한다.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUuid } from "./createUuid";

// 8-4-4-4-12 형식이면서 버전 자리가 4, variant 자리가 8/9/a/b 인지까지 확인한다.
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("createUuid", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("표준 API가 있으면 UUID v4 형식을 돌려준다", () => {
    expect(createUuid()).toMatch(UUID_V4_PATTERN);
  });

  it("randomUUID가 없어도(=https가 아닌 환경) 정상 동작한다", () => {
    // 보안 컨텍스트가 아닌 브라우저를 흉내낸다.
    // randomUUID는 없고 getRandomValues만 있는 상태다.
    vi.stubGlobal("crypto", {
      getRandomValues: (target: Uint8Array) => {
        for (let i = 0; i < target.length; i += 1) {
          target[i] = Math.floor(Math.random() * 256);
        }
        return target;
      },
    });

    const generated = createUuid();
    expect(generated).toMatch(UUID_V4_PATTERN);
  });

  it("crypto 자체가 없어도 예외를 던지지 않는다", () => {
    vi.stubGlobal("crypto", undefined);

    expect(() => createUuid()).not.toThrow();
    expect(createUuid()).toMatch(UUID_V4_PATTERN);
  });

  it("연속 호출해도 값이 겹치지 않는다", () => {
    const generated = new Set(Array.from({ length: 500 }, () => createUuid()));
    expect(generated.size).toBe(500);
  });
});
