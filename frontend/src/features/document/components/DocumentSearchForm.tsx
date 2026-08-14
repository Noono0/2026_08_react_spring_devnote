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
  const [searchKeywordInput, setSearchKeywordInput] = useState(searchCondition.searchKeyword);

  useEffect(() => {
    setSearchKeywordInput(searchCondition.searchKeyword);
  }, [searchCondition.searchKeyword]);

  const handleSearchSubmit = (submitEvent: FormEvent<HTMLFormElement>): void => {
    submitEvent.preventDefault();
    applicationLogger.info("[DocumentSearchForm] 검색 실행", { searchKeywordInput });
    handleSearchConditionChange({
      ...searchCondition,
      searchKeyword: searchKeywordInput.trim(),
      pageNumber: 0,
    });
  };

  return (
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
