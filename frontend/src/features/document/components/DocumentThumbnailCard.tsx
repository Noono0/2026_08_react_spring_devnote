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
            loading="lazy"
            onError={(imageErrorEvent) => {
              imageErrorEvent.currentTarget.style.display = "none";
              imageErrorEvent.currentTarget.parentElement?.classList.add("image-load-failed");
            }}
          />
        ) : null}
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
