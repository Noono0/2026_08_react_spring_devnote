/**
 * gameRecordStorage.ts — 게임 최고 기록을 브라우저(localStorage)에 저장·읽기
 *
 * 서버에 보내지 않으므로 서버 부담이 없다(대신 이 브라우저에서만 기억한다).
 *
 * ★ localStorage는 "믿을 수 없는 입력"이다.
 *   누구나 개발자 도구로 값을 바꿀 수 있고, 예전 버전 앱이 다른 모양으로 저장했을 수도 있다.
 *   그래서 읽을 때 zod 스키마로 모양을 확인하고, 틀리면 기록이 없는 것(null)으로 본다.
 *   또 사생활 보호 모드 등에서는 localStorage 자체가 오류를 던질 수 있어 try/catch로 감싸고,
 *   실패를 조용히 삼키지 않도록 경고 로그를 남긴다.
 */
import type { z } from "zod";
import { applicationLogger } from "@/shared/logging/applicationLogger";

const STORAGE_PREFIX = "devnote.games.";

/** 저장된 기록을 읽는다. 없거나 깨졌거나 모양이 틀리면 null */
export const readGameRecord = <Value>(key: string, schema: z.ZodType<Value>): Value | null => {
  try {
    const storedText = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (storedText === null) return null;
    const result = schema.safeParse(JSON.parse(storedText));
    return result.success ? result.data : null;
  } catch (error) {
    applicationLogger.warn("[Games] 저장된 기록을 읽지 못했습니다.", { key, error });
    return null;
  }
};

/** 기록을 저장한다. 저장소를 쓸 수 없으면 경고만 남기고 게임은 계속한다. */
export const writeGameRecord = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  } catch (error) {
    applicationLogger.warn("[Games] 기록을 저장하지 못했습니다.", { key, error });
  }
};
