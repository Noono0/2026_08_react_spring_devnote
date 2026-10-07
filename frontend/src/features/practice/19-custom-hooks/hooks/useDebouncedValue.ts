/**
 * useDebouncedValue — 값이 "잠시 멈췄을 때"만 바뀐 값을 돌려주는 커스텀 훅
 *
 * 5단계(검색 자동완성)에서는 setTimeout/clearTimeout을 페이지 안에서 직접 다뤘다.
 * 같은 일을 훅으로 빼면 검색창이 있는 어느 화면에서든 한 줄로 쓸 수 있다.
 *
 *   const debouncedKeyword = useDebouncedValue(keyword, 300);
 *   → 사용자가 타이핑하는 동안은 이전 값, 300ms 동안 입력이 멈추면 새 값
 *
 * ★ Effect 정리 함수(clearTimeout)가 핵심이다.
 *   값이 바뀔 때마다 이전 타이머를 지우고 새 타이머를 건다. 정리하지 않으면 타이핑한 글자 수만큼 갱신이 일어난다.
 */

import { useEffect, useState } from "react";

// <Value>: 제네릭. 문자열이든 숫자든 객체든, 넣은 값과 같은 타입을 그대로 돌려준다.
export const useDebouncedValue = <Value>(value: Value, delayMilliseconds: number): Value => {
  // 처음에는 지연 없이 받은 값 그대로 시작한다.
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // delay 동안 값이 다시 바뀌지 않으면 그때 새 값으로 바꾼다.
    const timerId = window.setTimeout(() => setDebouncedValue(value), delayMilliseconds);
    // 값이 delay 안에 또 바뀌면 이 정리 함수가 먼저 실행되어 이전 타이머가 취소된다.
    return () => window.clearTimeout(timerId);
  }, [value, delayMilliseconds]);

  return debouncedValue;
};
