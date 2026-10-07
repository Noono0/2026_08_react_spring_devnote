/**
 * ============================================================================
 * DocumentTagList.tsx — 문서에 붙은 태그를 칩(chip) 목록으로 보여 준다
 * ============================================================================
 *
 * [배울 점]
 *   1. 주소에 사용자 입력을 넣을 때는 encodeURIComponent로 감싼다
 *   2. 같은 컴포넌트가 "링크로 보여 줄 때"와 "글자로만 보여 줄 때"를 props 하나로 나눈다
 *
 * ★ basePath를 주면 각 태그가 "이 태그로 목록 거르기" 링크가 된다.
 *   예: basePath="/react/documents", 태그 "배포" → /react/documents?tag=%EB%B0%B0%ED%8F%AC
 *   목록 화면(DocumentListPage)은 URL의 tag 값을 읽어 서버에 그대로 조건으로 보낸다.
 *
 * ★ basePath를 안 주면 링크 없이 "#태그" 글자만 보여 준다.
 *   카드 전체가 이미 링크인 썸네일 카드처럼, 링크 안에 링크를 넣을 수 없는 곳에서 쓴다.
 *   (HTML 규칙상 <a> 안에 <a>를 넣으면 브라우저가 구조를 멋대로 고쳐 버린다)
 *
 * ※ 포트폴리오 업무 History의 태그 목록·태그 필터는 features/history/components/HistoryTags.tsx에 따로 있다.
 */

import { Link } from "react-router-dom";

interface DocumentTagListProperties {
  tags: string[];
  basePath?: string;
}

export const DocumentTagList = ({ tags, basePath }: DocumentTagListProperties) => (
  // 태그가 하나도 없으면 빈 <ul>을 남기지 않고 아무것도 그리지 않는다.
  tags.length > 0 ? (
    <ul className="topic-chip-list document-tag-list" aria-label="태그">
      {/* 태그 이름은 한 문서 안에서 중복되지 않으므로(서버가 정리한다) key로 써도 안전하다. */}
      {tags.map((tag) => (
        <li key={tag}>
          {/* ★ encodeURIComponent를 빼먹으면 "C# & .NET" 같은 태그에서
                #(주소의 조각 시작)과 &(다음 파라미터 시작)이 주소를 깨뜨린다.
                ❌ `?tag=${tag}`  →  ?tag=C# & .NET  (서버에는 "C"만 도착)
                ✓ `?tag=${encodeURIComponent(tag)}` → ?tag=C%23%20%26%20.NET */}
          {basePath ? <Link to={`${basePath}?tag=${encodeURIComponent(tag)}`}>#{tag}</Link> : `#${tag}`}
        </li>
      ))}
    </ul>
  ) : null
);
