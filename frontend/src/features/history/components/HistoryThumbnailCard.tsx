/**
 * ============================================================================
 * HistoryThumbnailCard.tsx — 업무 History 썸네일 목록의 카드 한 장
 * ============================================================================
 *
 * 받은 글 요약(historyItem)만 그리는 표현 컴포넌트다. 카드 전체가 상세 화면 링크다.
 * 대표 이미지가 없거나 불러오기에 실패하면 "DN" 대체 화면을 보여 준다.
 *
 * ※ 14단계 학습용 DocumentThumbnailCard와 모양이 같다. 이미지 실패 처리 같은 학습 설명은
 *   practice/14-documents/components/DocumentThumbnailCard.tsx에 자세히 적혀 있다.
 */

import { Link } from "react-router-dom";
import { HistoryTagList } from "./HistoryTags";
import type { HistoryListItem } from "../types/historyTypes";

interface HistoryThumbnailCardProperties {
  historyItem: HistoryListItem;
}

// 상태 코드 → 화면에 보여 줄 한국어 이름. Record 타입이라 상태를 하나라도 빠뜨리면 TypeScript가 알려 준다.
const statusLabelMap: Record<HistoryListItem["documentStatus"], string> = {
  DRAFT: "임시저장",
  PUBLISHED: "발행",
  ARCHIVED: "보관",
};

export const HistoryThumbnailCard = ({ historyItem }: HistoryThumbnailCardProperties) => (
  <article className="document-thumbnail-card">
    <Link className="document-thumbnail-link" to={`/history/${historyItem.documentId}`}>
      <div className="document-thumbnail-frame">
        {historyItem.thumbnailImageUrl ? (
          <img
            src={historyItem.thumbnailImageUrl}
            alt={`${historyItem.documentTitle} 대표 이미지`}
            loading="lazy"
            // 이미지가 깨지면 숨기고, 부모에 클래스를 붙여 CSS가 대체 화면을 드러내게 한다.
            onError={(imageErrorEvent) => {
              imageErrorEvent.currentTarget.style.display = "none";
              imageErrorEvent.currentTarget.parentElement?.classList.add("image-load-failed");
            }}
          />
        ) : null}
        {/* 이미지가 정상일 때는 화면 낭독기가 대체 문구를 읽지 않게 aria-hidden으로 감춘다. */}
        <div className="document-thumbnail-placeholder" aria-hidden={Boolean(historyItem.thumbnailImageUrl)}>
          <span>DN</span>
          <small>{historyItem.thumbnailImageUrl ? "이미지를 불러오지 못했습니다." : "대표 이미지 없음"}</small>
        </div>
        <span className={`document-status-badge status-${historyItem.documentStatus.toLowerCase()}`}>
          {statusLabelMap[historyItem.documentStatus]}
        </span>
      </div>
      <div className="document-thumbnail-content">
        <h2>{historyItem.documentTitle}</h2>
        <p>{historyItem.authorName}</p>
        {/* 카드 전체가 링크라 태그는 글자로만 보여 준다(링크 안에 링크를 넣을 수 없다). */}
        <HistoryTagList tags={historyItem.tags} />
        <div className="document-card-metadata">
          <span>조회 {historyItem.viewCount.toLocaleString()}</span>
          <span>{new Date(historyItem.updatedAt).toLocaleDateString()}</span>
        </div>
      </div>
    </Link>
  </article>
);
