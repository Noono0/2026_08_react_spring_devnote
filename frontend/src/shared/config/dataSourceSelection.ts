/**
 * ============================================================================
 * dataSourceSelection.ts — "진짜 서버 vs 가짜 서버" 전환 스위치
 * ============================================================================
 *
 * [왜 가짜 서버(mock)가 필요한가?]
 *   프론트엔드를 연습하거나 개발할 때 백엔드를 항상 켜 둘 수는 없다.
 *     - Java, MySQL, Docker를 다 설치하고 실행해야 한다
 *     - 백엔드 API가 아직 안 만들어졌을 수도 있다
 *     - "서버가 500 에러를 낼 때"를 테스트하고 싶은데 일부러 고장 낼 수도 없다
 *
 *   그래서 MSW(Mock Service Worker)로 가짜 서버를 띄운다.
 *   브라우저가 보내는 요청을 중간에서 가로채 미리 준비한 답을 돌려주는 방식이다.
 *   ★ 프론트엔드 코드는 이게 진짜인지 가짜인지 전혀 모른다. 그게 핵심이다.
 *
 * [값이 정해지는 우선순위]
 *   1순위: 사용자가 화면 스위치로 고른 값 (localStorage에 저장)
 *   2순위: .env의 VITE_DATA_SOURCE 기본값
 *
 *   이렇게 하면 "기본값은 팀이 정하되, 개인은 언제든 바꿔 볼 수 있는" 구조가 된다.
 */

import { applicationEnvironment } from "./applicationEnvironment";

export type DataSourceMode = "backend" | "mock";

// localStorage에 저장할 때 쓸 키 이름을 상수로 빼 뒀다.
//
// ★ 왜 그냥 문자열을 쓰지 않고 상수로 만들까?
//   이 키는 아래 세 함수(읽기/쓰기/삭제)에서 똑같이 쓰인다.
//   문자열을 직접 쓰면 한 곳에서 오타가 나도 에러가 안 나고,
//   그냥 "저장은 되는데 읽히지 않는" 버그가 조용히 생긴다.
//   상수로 만들면 오타를 내는 순간 TypeScript가 "그런 변수 없다"고 잡아 준다.
const DATA_SOURCE_STORAGE_KEY = "devnoteDataSource";

/**
 * localStorage에서 꺼낸 값이 우리가 아는 값인지 확인하는 타입 가드.
 *
 * 매개변수 타입이 `string | null`인 이유:
 * localStorage.getItem()은 키가 없으면 null을 돌려주기 때문이다.
 *
 * 반환 타입 `storedValue is DataSourceMode`가 타입 가드 문법이다.
 * true를 돌려주면 TypeScript가 그 값을 DataSourceMode로 확정해 준다.
 */
const isDataSourceMode = (storedValue: string | null): storedValue is DataSourceMode =>
  storedValue === "backend" || storedValue === "mock";

/**
 * 현재 화면에서 사용할 데이터 출처를 반환합니다.
 *
 * 우선순위:
 * 1. 사용자가 화면에서 선택해 localStorage에 저장한 값
 * 2. 빌드 시 지정한 VITE_DATA_SOURCE 기본값
 */
export const getSelectedDataSource = (): DataSourceMode => {
  const storedDataSource = localStorage.getItem(DATA_SOURCE_STORAGE_KEY);

  // ★ 저장된 값을 왜 그냥 안 믿고 검사할까?
  //   localStorage는 사용자가 개발자도구로 얼마든지 고칠 수 있는 공간이다.
  //   "바나나" 같은 값이 들어 있어도 이상하지 않다.
  //   "바깥에서 들어온 데이터는 일단 의심한다"가 안전한 코드의 기본 원칙이다.
  //   (환경변수를 Zod로 검사한 것과 완전히 같은 이유다)
  if (isDataSourceMode(storedDataSource)) {
    return storedDataSource;
  }

  // 저장된 게 없거나 이상한 값이면 .env의 기본값으로 되돌아간다.
  return applicationEnvironment.VITE_DATA_SOURCE;
};

/**
 * 데이터 출처 선택을 브라우저에 저장합니다.
 * MSW는 애플리케이션 시작 전에 켜져야 하므로 변경 후 화면을 새로고침해야 합니다.
 */
// ↑ 이 "새로고침이 필요하다"는 설명이 중요하다.
//   MSW는 main.tsx에서 React가 그려지기 전에 딱 한 번 켜진다.
//   앱이 이미 돌아가는 중에 값만 바꿔 봐야 이미 켜진(또는 안 켜진) 상태는 안 바뀐다.
//   그래서 화면의 전환 스위치(DataSourceToggle)는 저장 후 새로고침을 안내한다.
export const saveSelectedDataSource = (dataSource: DataSourceMode): void => {
  localStorage.setItem(DATA_SOURCE_STORAGE_KEY, dataSource);
};

/**
 * 사용자의 선택을 지워서 .env 기본값으로 되돌린다.
 *
 * removeItem은 "키 자체를 삭제"한다.
 * setItem(key, "")로 빈 문자열을 넣는 것과는 다르다.
 * 빈 문자열을 넣으면 키는 남아 있어서 getItem이 null이 아닌 ""를 돌려주고,
 * 위의 isDataSourceMode 검사에서 걸러지긴 하지만 의도가 불분명해진다.
 * "없앤다"는 뜻이면 정직하게 removeItem을 쓰자.
 */
export const resetSelectedDataSource = (): void => {
  localStorage.removeItem(DATA_SOURCE_STORAGE_KEY);
};
