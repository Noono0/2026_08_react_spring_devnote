/**
 * HighlightedTextarea.tsx — 글자에 문법 색이 입혀 보이는 textarea
 *
 * [원리: 두 겹 겹치기]
 *   textarea는 글자마다 색을 줄 수 없다. 그래서
 *     아래 겹: 같은 글자를 색칠한 <pre> (syntaxHighlighter.ts가 나눈 조각마다 <span class="syntax-종류">)
 *     위 겹  : 진짜 textarea. 글자색만 투명하게(caret·선택·입력·복사는 그대로)
 *   를 똑같은 글꼴·크기·여백으로 정확히 포개면, 사용자는 textarea에 쓰면서 아래 겹의 색 글자를 보게 된다.
 *   textarea를 스크롤하면 onScroll에서 아래 겹도 같은 위치로 옮긴다(안 하면 글자가 어긋난다).
 *
 * ★ 줄바꿈 없이(wrap="off") 가로 스크롤로 둔다. 자동 줄바꿈은 두 겹의 줄 나눔 위치가 달라질 수 있어서다.
 * ★ 아래 겹은 화면 낭독기가 두 번 읽지 않도록 aria-hidden이다. 접근성 이름·값은 위 겹 textarea가 가진다.
 */
import { useRef, type TextareaHTMLAttributes, type UIEvent } from "react";
import { highlightSegments } from "@/features/utility/utils/syntaxHighlighter";

interface HighlightedTextareaProperties extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "wrap"> {
  value: string;
  language: string; // syntaxHighlighter의 언어 이름: json, javascript, typescript, css, html, sql, markdown ...
}

export const HighlightedTextarea = ({ value, language, className, onScroll, ...textareaProperties }: HighlightedTextareaProperties) => {
  const highlightLayerRef = useRef<HTMLPreElement>(null);

  /** 위 겹(textarea)을 스크롤하면 아래 겹(색칠한 글자)도 같은 위치로 옮긴다. */
  const syncScroll = (event: UIEvent<HTMLTextAreaElement>): void => {
    const highlightLayer = highlightLayerRef.current;
    if (highlightLayer) {
      highlightLayer.scrollTop = event.currentTarget.scrollTop;
      highlightLayer.scrollLeft = event.currentTarget.scrollLeft;
    }
    onScroll?.(event);
  };

  return (
    <div className={`highlighted-textarea${className ? ` ${className}` : ""}`}>
      <pre ref={highlightLayerRef} className="highlighted-textarea-layer" aria-hidden="true">
        <code>
          {/* 조각 목록은 글자에서 매번 새로 만들고 순서만 의미가 있어 index를 key로 쓴다. */}
          {highlightSegments(value, language).map((segment, index) => (segment.type ? <span key={index} className={`syntax-${segment.type}`}>{segment.text}</span> : segment.text))}
          {/* 마지막 줄이 빈 줄이어도 textarea와 높이가 같도록 줄바꿈을 하나 더 둔다. */}
          {"\n"}
        </code>
      </pre>
      <textarea {...textareaProperties} value={value} wrap="off" spellCheck={false} onScroll={syncScroll} />
    </div>
  );
};
