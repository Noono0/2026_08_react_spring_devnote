import type { PageInformation } from "../types/documentTypes";

interface DocumentPaginationProperties {
  pageInformation: PageInformation;
  handlePageChange: (pageNumber: number) => void;
  ariaLabel?: string;
}

export const DocumentPagination = ({
  pageInformation,
  handlePageChange,
  ariaLabel = "문서 목록 페이지 이동",
}: DocumentPaginationProperties) => {
  if (pageInformation.totalPages <= 1) {
    return null;
  }

  const visiblePageNumbers = Array.from(
    { length: pageInformation.totalPages },
    (_unusedValue, pageIndex) => pageIndex,
  ).slice(
    Math.max(0, pageInformation.pageNumber - 2),
    Math.min(pageInformation.totalPages, pageInformation.pageNumber + 3),
  );

  return (
    <nav className="pagination" aria-label={ariaLabel}>
      <button
        disabled={pageInformation.firstPage}
        onClick={() => handlePageChange(pageInformation.pageNumber - 1)}
      >
        이전
      </button>
      {visiblePageNumbers.map((pageNumber) => (
        <button
          key={pageNumber}
          aria-current={pageNumber === pageInformation.pageNumber ? "page" : undefined}
          className={pageNumber === pageInformation.pageNumber ? "active" : undefined}
          onClick={() => handlePageChange(pageNumber)}
        >
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
