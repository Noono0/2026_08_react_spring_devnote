/**
 * ============================================================================
 * DocumentSearchForm.tsx — 문서 검색 폼
 * ============================================================================
 *
 * ★ 이 컴포넌트에는 아주 중요한 설계 판단이 하나 들어 있다.
 *   "검색어"와 "나머지 조건"을 다르게 다룬다.
 *
 *     검색어  → 지역 State에 담아 두고, 검색 버튼(또는 Enter)을 눌러야 반영
 *     드롭다운 → 고르는 즉시 반영
 *
 * [왜 다르게 할까?]
 *   검색어를 글자마다 반영하면 URL이 계속 바뀌고 API 요청이 폭주한다.
 *   ("리액트"를 치면 요청이 3번 나간다)
 *   반면 드롭다운은 한 번 선택이 곧 완결된 의사표시라 바로 반영해도 된다.
 *
 * ※ 참고: 검색어도 즉시 반영하고 싶다면 SearchAutocompletePracticePage처럼
 *   디바운스를 쓰면 된다. 여기서는 더 단순한 "제출 방식"을 택했다.
 */

import { useEffect, useState, type FormEvent } from "react";
import type { DocumentSearchCondition } from "../types/documentTypes";
import { applicationLogger } from "@/shared/logging/applicationLogger";

interface DocumentSearchFormProperties {
  searchCondition: DocumentSearchCondition;
  handleSearchConditionChange: (condition: DocumentSearchCondition) => void;
}

export const DocumentSearchForm = ({
  searchCondition,
  handleSearchConditionChange,
}: DocumentSearchFormProperties) => {
  // ★ 입력 중인 검색어만 이 컴포넌트가 따로 들고 있는다.
  //   부모의 값(URL)을 초기값으로 삼는다.
  //   이렇게 "부모 값을 복사해 임시로 편집하는" 상태를 로컬 드래프트라고 부른다.
  const [searchKeywordInput, setSearchKeywordInput] = useState(searchCondition.searchKeyword);

  // ★ 부모의 검색어가 바뀌면 입력창도 맞춰 준다.
  //
  //   왜 필요한가?
  //     useState의 초기값은 처음 한 번만 쓰인다.
  //     사용자가 뒤로가기를 눌러 URL의 검색어가 바뀌어도
  //     이 Effect가 없으면 입력창에는 옛 글자가 그대로 남는다.
  //     "주소는 '리액트'인데 입력창은 '스프링'"인 어긋난 상태가 된다.
  //
  //   ※ 이런 "props를 State로 동기화하는" 패턴은 되도록 피하는 게 좋다.
  //     대부분은 State 없이 props를 그대로 쓰면 해결된다.
  //     여기서는 "입력 중에는 부모에 안 알린다"는 요구 때문에 불가피하다.
  useEffect(() => {
    setSearchKeywordInput(searchCondition.searchKeyword);
  }, [searchCondition.searchKeyword]);

  /**
   * 검색 버튼을 누르거나 입력창에서 Enter를 쳤을 때.
   */
  const handleSearchSubmit = (submitEvent: FormEvent<HTMLFormElement>): void => {
    // ★★ preventDefault()를 빼먹으면 안 된다.
    //   HTML 폼의 기본 동작은 "페이지를 서버로 전송하고 새로고침"이다.
    //   그러면 React 앱이 통째로 다시 시작되어 화면이 깜빡이고 상태가 날아간다.
    //   React에서 <form onSubmit>을 쓸 때는 거의 항상 첫 줄에 이걸 넣는다.
    submitEvent.preventDefault();

    applicationLogger.info("[DocumentSearchForm] 검색 실행", { searchKeywordInput });

    handleSearchConditionChange({
      ...searchCondition,
      searchKeyword: searchKeywordInput.trim(),
      // ★ 새로 검색하면 항상 1페이지(0)부터.
      //   3페이지를 보다가 다른 검색어를 넣었는데 3페이지로 가면
      //   결과가 없어 빈 화면이 나온다. 아래 드롭다운들도 전부 마찬가지다.
      pageNumber: 0,
    });
  };

  return (
    // ★ <form>으로 감싸고 버튼을 type="submit"으로 두면
    //   Enter 키로도 검색이 실행된다. <div>와 onClick으로 만들면 그게 안 된다.
    //   시맨틱 HTML을 쓰면 이런 동작이 공짜로 따라온다.
    <form className="search-panel" onSubmit={handleSearchSubmit}>
      <label>
        검색 대상
        <select
          value={searchCondition.searchType}
          onChange={(changeEvent) =>
            handleSearchConditionChange({
              ...searchCondition,
              searchType: changeEvent.target.value as DocumentSearchCondition["searchType"],
              pageNumber: 0,
            })
          }
        >
          <option value="TITLE_CONTENT">제목 + 내용</option>
          <option value="TITLE">제목</option>
          <option value="CONTENT">내용</option>
          <option value="AUTHOR">작성자</option>
        </select>
      </label>
      <label className="search-keyword-field">
        검색어
        <input
          value={searchKeywordInput}
          onChange={(changeEvent) => setSearchKeywordInput(changeEvent.target.value)}
          placeholder="문서 제목이나 내용을 입력하세요"
        />
      </label>
      <label>
        상태
        {/* ★ undefined와 빈 문자열("")을 오가는 변환에 주의.
              우리 데이터: documentStatus가 undefined면 "전체"
              HTML select : value에 undefined를 넣을 수 없다 (제어 불가 경고가 뜬다)
            그래서 화면에 넣을 땐 `?? ""`, 꺼낼 땐 `"" → undefined`로 되돌린다.
            이런 "빈 값 표현 방식의 차이"를 맞춰 주는 처리는 폼에서 자주 필요하다. */}
        <select
          value={searchCondition.documentStatus ?? ""}
          onChange={(changeEvent) => {
            const selectedStatus = changeEvent.target.value;
            handleSearchConditionChange({
              ...searchCondition,
              documentStatus:
                selectedStatus === ""
                  ? undefined
                  : (selectedStatus as DocumentSearchCondition["documentStatus"]),
              pageNumber: 0,
            });
          }}
        >
          <option value="">전체</option>
          <option value="DRAFT">임시저장</option>
          <option value="PUBLISHED">발행</option>
          <option value="ARCHIVED">보관</option>
        </select>
      </label>
      <button type="submit">검색</button>
    </form>
  );
};
