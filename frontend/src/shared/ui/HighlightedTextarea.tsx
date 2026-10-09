/**
 * HighlightedTextarea.tsx — 글자에 문법 색이 입혀 보이는 textarea (+ 읽기 전용 HighlightedCode)
 *
 * [원리: 두 겹 겹치기]
 *   textarea는 글자마다 색을 줄 수 없다. 그래서
 *     아래 겹: 같은 글자를 색칠한 <pre> (syntaxHighlighter.ts가 나눈 조각마다 <span class="syntax-종류">)
 *     위 겹  : 진짜 textarea. 글자색만 투명하게(caret·선택·입력·복사는 그대로)
 *   를 똑같은 글꼴·크기·여백으로 정확히 포개면, 사용자는 textarea에 쓰면서 아래 겹의 색 글자를 보게 된다.
 *   textarea를 스크롤하면 onScroll에서 아래 겹도 같은 위치로 옮긴다(안 하면 글자가 어긋난다).
 *
 * [줄바꿈]
 *   기본은 줄바꿈 없이(wrap="off") 가로 스크롤 — 코드에 맞는 방식이다.
 *   wrapLines를 주면(Markdown처럼 글이 긴 곳) 두 겹 모두 같은 규칙으로 줄을 바꾼다.
 *   두 겹의 줄 나눔 위치가 같으려면 글자가 들어갈 폭이 같아야 하므로, CSS scrollbar-gutter로
 *   스크롤바 자리를 두 겹 모두 미리 비워 둔다(global.css .highlighted-textarea.wrap-lines).
 *
 * [ref] React 19에서는 함수 컴포넌트도 ref를 일반 prop으로 받는다. 받은 ref는 진짜 textarea에 연결한다
 *   (Markdown 편집기 도구 모음이 선택 영역을 읽고 바꿀 때 쓴다).
 *
 * ★ 아래 겹은 화면 낭독기가 두 번 읽지 않도록 aria-hidden이다. 접근성 이름·값은 위 겹 textarea가 가진다.
 */
import { useRef, type HTMLAttributes, type Ref, type TextareaHTMLAttributes, type UIEvent } from "react";
import { highlightSegments } from "@/shared/lib/syntaxHighlighter";

/** 색칠 조각을 <span class="syntax-종류">로 그린다. 조각 목록은 글자에서 매번 새로 만들고 순서만 의미가 있어 index를 key로 쓴다. */
const renderSegments = (value: string, language: string) =>
  highlightSegments(value, language).map((segment, index) => (segment.type ? <span key={index} className={`syntax-${segment.type}`}>{segment.text}</span> : segment.text));

interface HighlightedTextareaProperties extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "wrap"> {
  value: string;
  language: string; // syntaxHighlighter의 언어 이름: json, yaml, javascript, typescript, css, html, sql, markdown, java, bash ...
  wrapLines?: boolean; // 긴 줄을 다음 줄로 넘길지(기본: 넘기지 않고 가로 스크롤)
  wrapperClassName?: string; // 바깥 상자(두 겹을 감싼 div)에 줄 클래스. className은 보통 textarea처럼 textarea에 붙는다.
  ref?: Ref<HTMLTextAreaElement>;
}

/**
 * ★ className은 textarea에 붙인다(기존 화면의 textarea 클래스를 그대로 쓰면 되도록).
 *   그 클래스의 높이·크기 조절(resize) 같은 값은 그대로 쓰이고, 두 겹이 어긋나면 안 되는 글꼴·여백·테두리 두께는
 *   global.css의 .highlighted-textarea 규칙이 덮어써 아래 겹과 똑같이 맞춘다.
 */
export const HighlightedTextarea = ({ value, language, wrapLines = false, wrapperClassName, onScroll, ref, ...textareaProperties }: HighlightedTextareaProperties) => {
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
    <div className={["highlighted-textarea", wrapLines ? "wrap-lines" : "", wrapperClassName ?? ""].filter(Boolean).join(" ")}>
      <pre ref={highlightLayerRef} className="highlighted-textarea-layer" aria-hidden="true">
        <code>
          {renderSegments(value, language)}
          {/* 마지막 줄이 빈 줄이어도 textarea와 높이가 같도록 줄바꿈을 하나 더 둔다. */}
          {"\n"}
        </code>
      </pre>
      <textarea {...textareaProperties} ref={ref} value={value} wrap={wrapLines ? "soft" : "off"} spellCheck={false} onScroll={syncScroll} />
    </div>
  );
};

interface HighlightedCodeProperties extends HTMLAttributes<HTMLPreElement> {
  code: string;
  language: string;
}

/**
 * 읽기 전용 결과를 색칠해 보여 주는 <pre><code>. 입력이 필요 없는 결과 칸(JWT Payload, 응답 Body 등)에 쓴다.
 * pre에 주는 className·aria 속성은 그대로 전달해 기존 화면 스타일을 유지한다.
 */
export const HighlightedCode = ({ code, language, ...preProperties }: HighlightedCodeProperties) => (
  <pre {...preProperties}><code>{renderSegments(code, language)}</code></pre>
);
