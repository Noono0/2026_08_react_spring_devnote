/**
 * ============================================================================
 * HistorySearchForm.tsx — 업무 History 검색 폼
 * ============================================================================
 *
 * 검색어는 이 컴포넌트의 지역 State에 두었다가 검색 버튼(또는 Enter)을 눌러야 반영하고,
 * 드롭다운(검색 대상·상태)은 고르는 즉시 반영한다.
 * 글자마다 URL과 서버 요청이 바뀌지 않게 하려는 것이다.
 *
 * ※ 14단계 학습용 DocumentSearchForm과 동작이 같다. 자세한 학습 설명은
 *   practice/14-documents/components/DocumentSearchForm.tsx를 보자.
 *   운영 화면이 학습 폴더 코드에 묶이지 않도록 따로 두었다.
 */

import { useEffect, useState, type FormEvent } from "react";
import type { HistorySearchCondition } from "../types/historyTypes";
import { applicationLogger } from "@/shared/logging/applicationLogger";

interface HistorySearchFormProperties {
  searchCondition: HistorySearchCondition;
  handleSearchConditionChange: (condition: HistorySearchCondition) => void;
}

export const HistorySearchForm = ({
  searchCondition,
  handleSearchConditionChange,
}: HistorySearchFormProperties) => {
  // 입력 중인 검색어(로컬 드래프트). 부모의 값(URL)을 초기값으로 삼는다.
  const [searchKeywordInput, setSearchKeywordInput] = useState(searchCondition.searchKeyword);

  // 뒤로가기 등으로 URL의 검색어가 바뀌면 입력창도 맞춰 준다.
  // (useState의 초기값은 처음 한 번만 쓰이므로, 이 Effect가 없으면 입력창에 옛 글자가 남는다)
  useEffect(() => {
    setSearchKeywordInput(searchCondition.searchKeyword);
  }, [searchCondition.searchKeyword]);

  const handleSearchSubmit = (submitEvent: FormEvent<HTMLFormElement>): void => {
    // 폼의 기본 동작(페이지 새로고침)을 막는다. 빼먹으면 앱이 통째로 다시 시작된다.
    submitEvent.preventDefault();
    applicationLogger.info("[HistorySearchForm] 검색 실행", { searchKeywordInput });
    // 새로 검색하면 항상 첫 페이지(0)부터 본다.
    handleSearchConditionChange({ ...searchCondition, searchKeyword: searchKeywordInput.trim(), pageNumber: 0 });
  };

  return (
    // <form> + type="submit" 버튼이라 Enter 키로도 검색된다.
    <form className="search-panel" onSubmit={handleSearchSubmit}>
      <label>
        검색 대상
        <select
          value={searchCondition.searchType}
          onChange={(changeEvent) =>
            handleSearchConditionChange({
              ...searchCondition,
              searchType: changeEvent.target.value as HistorySearchCondition["searchType"],
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
        {/* 데이터의 "전체"는 undefined, <select>의 "전체"는 빈 문자열이라 오갈 때 변환한다. */}
        <select
          value={searchCondition.documentStatus ?? ""}
          onChange={(changeEvent) => {
            const selectedStatus = changeEvent.target.value;
            handleSearchConditionChange({
              ...searchCondition,
              documentStatus:
                selectedStatus === ""
                  ? undefined
                  : (selectedStatus as HistorySearchCondition["documentStatus"]),
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
