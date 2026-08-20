/**
 * ============================================================================
 * DocumentThumbnailCard.tsx — 썸네일 목록의 카드 한 장
 * ============================================================================
 *
 * ★ 이 컴포넌트의 배울 점: "이미지가 깨졌을 때"까지 대비한다.
 *
 *   이미지는 여러 이유로 안 뜰 수 있다.
 *     - 서버에서 파일이 삭제됨
 *     - 네트워크 문제
 *     - 주소는 있는데 접근 권한이 없음
 *   그때 깨진 이미지 아이콘이 그대로 보이면 매우 조악해 보인다.
 *   아래 onError 처리로 대체 화면을 보여준다.
 *
 * 이 컴포넌트도 데이터를 직접 가져오지 않는 "표현 컴포넌트"다.
 * props로 받은 것만 그린다.
 */

import { Link } from "react-router-dom";
import type { DocumentListItem } from "../types/documentTypes";

interface DocumentThumbnailCardProperties {
  documentItem: DocumentListItem;
  basePath?: string;
}

const statusLabelMap: Record<DocumentListItem["documentStatus"], string> = {
  DRAFT: "임시저장",
  PUBLISHED: "발행",
  ARCHIVED: "보관",
};

export const DocumentThumbnailCard = ({ documentItem, basePath = "/react/documents" }: DocumentThumbnailCardProperties) => (
  <article className="document-thumbnail-card">
    <Link className="document-thumbnail-link" to={`${basePath}/${documentItem.documentId}`}>
      <div className="document-thumbnail-frame">
        {documentItem.thumbnailImageUrl ? (
          <img
            src={documentItem.thumbnailImageUrl}
            alt={`${documentItem.documentTitle} 대표 이미지`}
            // loading="lazy" → 화면에 보이기 직전까지 다운로드를 미룬다.
            // 카드가 수십 개인 목록에서 첫 로딩 속도가 크게 좋아진다.
            loading="lazy"
            // ★ 이미지 로딩이 실패했을 때 실행된다.
            //   여기서는 예외적으로 DOM을 직접 조작한다.
            //     1) 깨진 이미지를 숨기고
            //     2) 부모에 클래스를 붙여 CSS가 대체 화면을 보여주게 한다
            //
            //   ★ 보통은 State로 처리하는 게 React다운 방법이다.
            //     하지만 그러려면 카드마다 State가 하나씩 생기고,
            //     이 컴포넌트가 State를 갖는 순간 재사용성이 떨어진다.
            //     "화면 표시만 바꾸는 아주 국소적인 처리"라서 이 정도는 허용된다.
            //     다만 이런 예외를 남발하면 안 된다는 점을 기억하자.
            onError={(imageErrorEvent) => {
              imageErrorEvent.currentTarget.style.display = "none";
              imageErrorEvent.currentTarget.parentElement?.classList.add("image-load-failed");
            }}
          />
        ) : null}
        {/* 대체 화면. 평소엔 이미지 뒤에 깔려 있다가 이미지가 없거나 실패하면 드러난다.
            aria-hidden={이미지가 있으면 true} → 이미지가 정상일 때는
            화면 낭독기가 이 대체 문구를 읽지 않게 한다. 중복 안내를 막는 것이다. */}
        <div className="document-thumbnail-placeholder" aria-hidden={Boolean(documentItem.thumbnailImageUrl)}>
          <span>DN</span>
          <small>{documentItem.thumbnailImageUrl ? "이미지를 불러오지 못했습니다." : "대표 이미지 없음"}</small>
        </div>
        <span className={`document-status-badge status-${documentItem.documentStatus.toLowerCase()}`}>
          {statusLabelMap[documentItem.documentStatus]}
        </span>
      </div>
      <div className="document-thumbnail-content">
        <h2>{documentItem.documentTitle}</h2>
        <p>{documentItem.authorName}</p>
        <div className="document-card-metadata">
          <span>조회 {documentItem.viewCount.toLocaleString()}</span>
          <span>{new Date(documentItem.updatedAt).toLocaleDateString()}</span>
        </div>
      </div>
    </Link>
  </article>
);
