/**
 * ============================================================================
 * DocumentPagination.tsx — 페이지 번호 버튼 (재사용 컴포넌트)
 * ============================================================================
 *
 * [이 컴포넌트의 설계 방식이 중요하다]
 *   이 컴포넌트는 "문서"에 대해 아무것도 모른다.
 *   페이지 정보를 받아서 버튼을 그리고, 눌리면 알려 줄 뿐이다.
 *     받는 것 : pageInformation (현재/전체 페이지)
 *     알리는 것: handlePageChange (몇 번을 눌렀는지)
 *
 *   그래서 문서 목록이든 회원 목록이든 어디든 재사용할 수 있다.
 *   이런 걸 "표현 컴포넌트(presentational component)"라고 부른다.
 *   데이터를 가져오지 않고 받은 것만 그리는 컴포넌트다.
 *
 * [부모-자식 소통 방식]
 *   부모 → 자식 : props로 값을 내려 준다
 *   자식 → 부모 : 콜백 함수(handlePageChange)를 호출해 알린다
 *   자식이 부모의 State를 직접 바꾸는 일은 없다. 이것이 React의 단방향 흐름이다.
 */

import type { PageInformation } from "../types/documentTypes";

interface DocumentPaginationProperties {
  pageInformation: PageInformation;
  // "페이지 번호(number)를 받고 아무것도 안 돌려주는(void) 함수" 타입.
  handlePageChange: (pageNumber: number) => void;
  ariaLabel?: string;
}

export const DocumentPagination = ({
  pageInformation,
  handlePageChange,
  ariaLabel = "문서 목록 페이지 이동",
}: DocumentPaginationProperties) => {
  // ★ 페이지가 하나뿐이면 아예 그리지 않는다.
  //   "1"만 덩그러니 있는 페이지 버튼은 아무 쓸모가 없고 화면만 어지럽힌다.
  //   컴포넌트가 스스로 "지금 나는 필요 없다"고 판단하는 것도 좋은 설계다.
  if (pageInformation.totalPages <= 1) {
    return null;
  }

  // ★★ 현재 페이지 주변 5개만 보여준다.
  //
  //   전체가 100페이지면 버튼 100개가 화면을 뒤덮는다.
  //   그래서 "앞 2개 + 현재 + 뒤 2개"만 잘라 낸다.
  //
  //   [계산 과정]
  //   1) Array.from으로 [0, 1, 2, ..., totalPages-1] 전체 번호를 만든다
  //   2) slice로 필요한 구간만 자른다
  //        시작 = 현재 - 2, 단 0보다 작아지지 않게 Math.max(0, ...)
  //        끝   = 현재 + 3, 단 전체를 넘지 않게 Math.min(전체, ...)
  //
  //   ★ +3인 이유: slice의 끝 번호는 포함되지 않기 때문이다.
  //     현재가 5라면 slice(3, 8) → 3,4,5,6,7 → 다섯 개. 정확히 맞는다.
  //
  //   Math.max / Math.min으로 경계를 막아 두면
  //   첫 페이지나 마지막 페이지에서도 안전하게 동작한다.
  const visiblePageNumbers = Array.from(
    { length: pageInformation.totalPages },
    (_unusedValue, pageIndex) => pageIndex,
  ).slice(
    Math.max(0, pageInformation.pageNumber - 2),
    Math.min(pageInformation.totalPages, pageInformation.pageNumber + 3),
  );

  return (
    <nav className="pagination" aria-label={ariaLabel}>
      {/* ★ 서버가 알려준 firstPage로 버튼을 잠근다.
            직접 `pageNumber === 0` 으로 판단할 수도 있지만,
            서버가 준 값을 쓰면 페이징 규칙이 바뀌어도 화면이 따라간다. */}
      <button
        disabled={pageInformation.firstPage}
        onClick={() => handlePageChange(pageInformation.pageNumber - 1)}
      >
        이전
      </button>
      {visiblePageNumbers.map((pageNumber) => (
        <button
          key={pageNumber}
          // aria-current="page" → 화면 낭독기에 "지금 이 페이지"라고 알린다.
          // 색깔(active 클래스)만으로는 눈이 불편한 사용자가 알 수 없다.
          aria-current={pageNumber === pageInformation.pageNumber ? "page" : undefined}
          className={pageNumber === pageInformation.pageNumber ? "active" : undefined}
          onClick={() => handlePageChange(pageNumber)}
        >
          {/* ★★ 내부 번호는 0부터, 화면 표시는 1부터.
                서버가 페이지를 0부터 세기 때문에 여기서 +1로 변환한다.
                이 변환을 빠뜨리면 사용자에게 "0페이지"가 보인다.
                0-based와 1-based가 섞이는 건 흔한 버그 원인이니
                "어디서 변환하는지"를 분명히 정해 두는 게 좋다.
                여기서는 "화면에 그릴 때만 +1" 이라는 규칙을 쓴다. */}
          {pageNumber + 1}
        </button>
      ))}
      <button
        disabled={pageInformation.lastPage}
        onClick={() => handlePageChange(pageInformation.pageNumber + 1)}
      >
        다음
      </button>
    </nav>
  );
};
