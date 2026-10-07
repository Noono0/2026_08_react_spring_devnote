import { Link } from "react-router-dom";
import type { HistoryTagCount } from "../types/historyTypes";

/**
 * 글에 붙은 태그 목록. basePath를 주면 각 태그가 "이 태그로 목록 거르기" 링크가 된다.
 * 태그 값은 주소에 넣기 전에 encodeURIComponent로 감싼다. (공백·#·& 같은 문자가 주소를 깨뜨리지 않게)
 */
export const HistoryTagList = ({ tags, basePath }: { tags: string[]; basePath?: string }) => (
  tags.length > 0 ? (
    <ul className="topic-chip-list document-tag-list" aria-label="태그">
      {tags.map((tag) => (
        <li key={tag}>{basePath ? <Link to={`${basePath}?tag=${encodeURIComponent(tag)}`}>#{tag}</Link> : `#${tag}`}</li>
      ))}
    </ul>
  ) : null
);

interface HistoryTagFilterProperties {
  tags: HistoryTagCount[];
  selectedTag?: string;
  onSelect: (tag?: string) => void;
}

/** 업무 History 목록 위의 태그 필터. 다시 누르거나 "전체"를 누르면 필터를 해제한다. */
export const HistoryTagFilter = ({ tags, selectedTag, onSelect }: HistoryTagFilterProperties) => (
  tags.length > 0 ? (
    <div className="document-tag-filter" role="group" aria-label="태그로 거르기">
      <button type="button" className={selectedTag ? "ghost-button" : undefined} aria-pressed={!selectedTag} onClick={() => onSelect(undefined)}>전체</button>
      {tags.map((tag) => {
        const selected = tag.tagName === selectedTag;
        return (
          <button
            type="button"
            key={tag.tagName}
            className={selected ? undefined : "ghost-button"}
            aria-pressed={selected}
            onClick={() => onSelect(selected ? undefined : tag.tagName)}
          >
            #{tag.tagName} <small>{tag.documentCount}</small>
          </button>
        );
      })}
    </div>
  ) : null
);
