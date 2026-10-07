/**
 * ============================================================================
 * useLocalStorageState.ts — "useState인데 새로고침해도 값이 남는" 커스텀 훅
 * ============================================================================
 *
 * [커스텀 훅이 뭔가요?]
 *   이름이 use로 시작하고, 안에서 다른 훅(useState·useEffect…)을 쓰는 평범한 함수다.
 *   여러 화면에 똑같이 반복되던 "State + Effect" 묶음을 한 곳으로 옮겨 이름을 붙인 것이다.
 *
 *   3단계(연락처)에서는 페이지 안에 이런 코드가 직접 있었다.
 *     const [items, setItems] = useState(() => JSON.parse(localStorage.getItem(...)))
 *     useEffect(() => localStorage.setItem(...), [items])
 *   저장이 필요한 화면마다 이걸 복사하면, 한 곳만 고치고 나머지를 잊는 실수가 생긴다.
 *   훅으로 빼면 쓰는 쪽은 한 줄이다.
 *     const [items, setItems] = useLocalStorageState("key", [], schema);
 *
 * [이 훅이 지키는 세 가지]
 *   1. 저장된 값은 믿지 않는다 → Zod 스키마로 검사하고, 틀리면 초기값을 쓴다.
 *   2. localStorage는 실패할 수 있다(사생활 보호 모드·용량 초과) → try/catch로 감싸 화면이 멈추지 않게 한다.
 *   3. 반환 모양을 useState와 똑같이 [값, 바꾸는 함수]로 맞춘다 → 쓰는 사람이 새로 배울 게 없다.
 *
 * ★ 커스텀 훅은 "State를 공유"하지 않는다.
 *   두 컴포넌트가 같은 훅을 부르면 State는 각자 따로 생긴다. 공유하려면 Context(17단계)나 Zustand(21단계)를 쓴다.
 */

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { z } from "zod";
import { applicationLogger } from "@/shared/logging/applicationLogger";

/** localStorage에서 값을 읽어 스키마로 검사한다. 없거나, 깨졌거나, 모양이 다르면 initialValue. */
const readStoredValue = <Value>(storageKey: string, initialValue: Value, schema: z.ZodType<Value>): Value => {
  try {
    const storedText = window.localStorage.getItem(storageKey);
    if (storedText === null) return initialValue;
    const parsed = schema.safeParse(JSON.parse(storedText));
    // 모양이 다르면(예전 버전 데이터, 누가 직접 고친 값) 버리고 초기값으로 시작한다.
    return parsed.success ? parsed.data : initialValue;
  } catch (error) {
    applicationLogger.warn("[useLocalStorageState] 저장된 값을 읽지 못해 초기값을 사용합니다.", { storageKey, error });
    return initialValue;
  }
};

export const useLocalStorageState = <Value>(
  storageKey: string,
  initialValue: Value,
  schema: z.ZodType<Value>,
// 반환 타입을 useState와 똑같이 적는다. SetStateAction은 "새 값" 또는 "이전 값 → 새 값 함수" 둘 다 받는다.
): [Value, Dispatch<SetStateAction<Value>>] => {
  // ★ 함수를 넘기는 "지연 초기화": localStorage 읽기는 처음 한 번만 실행된다.
  //   useState(readStoredValue(...))라고 쓰면 화면을 다시 그릴 때마다 매번 읽는다.
  const [value, setValue] = useState<Value>(() => readStoredValue(storageKey, initialValue, schema));

  // 값이 바뀔 때마다 저장한다. 렌더링이 끝난 뒤 실행되므로 화면 그리기를 막지 않는다.
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch (error) {
      // 저장에 실패해도 화면의 State는 그대로 쓸 수 있다. 원인만 기록한다.
      applicationLogger.warn("[useLocalStorageState] 값을 저장하지 못했습니다.", { storageKey, error });
    }
  }, [storageKey, value]);

  return [value, setValue];
};
