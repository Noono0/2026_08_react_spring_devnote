import { useEffect, useRef, useState } from "react";

/**
 * "CSS 선택자란?" 도움말 대화상자.
 * 접근성: 열리면 닫기 버튼으로 포커스를 옮기고, Esc로 닫으며, 닫히면 처음 누른 버튼으로 포커스를 돌려준다.
 */
export const CrawlerSelectorHelpDialog = () => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const closeWithEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeWithEscape);
    return () => document.removeEventListener("keydown", closeWithEscape);
  }, [open]);

  const close = (): void => {
    setOpen(false);
    // 대화상자가 화면에서 사라진 다음(다음 실행 순서)에 포커스를 돌려줘야 포커스가 사라진 요소에 머물지 않는다.
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="crawler-help-trigger"
        aria-label="검색 입력칸 선택자 도움말 열기"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        ?
      </button>
      {open ? (
        <div className="crawler-help-backdrop" role="presentation" onMouseDown={close}>
          <section
            className="crawler-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="crawler-selector-help-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>CSS 선택자 도움말</span>
                <h3 id="crawler-selector-help-title">검색 입력칸 선택자는 검색창의 주소예요</h3>
              </div>
              <button ref={closeRef} type="button" className="crawler-help-close" aria-label="도움말 닫기" onClick={close}>×</button>
            </header>

            <p>Playwright가 사이트의 검색창을 찾아 검색어를 입력할 수 있도록, 해당 <code>&lt;input&gt;</code>을 가리키는 값을 적습니다.</p>

            <figure className="crawler-selector-mini-figure">
              <div className="crawler-selector-fake-page" aria-hidden="true">
                <span className="crawler-selector-fake-input">LH</span>
                <b>검색</b>
              </div>
              <figcaption>웹페이지의 검색창</figcaption>
              <span className="crawler-selector-arrow" aria-hidden="true">↓</span>
              <code>&lt;input id=<mark>&quot;topLayerQueryInput&quot;</mark> class=&quot;inp&quot; name=&quot;query&quot;&gt;</code>
              <span className="crawler-selector-arrow" aria-hidden="true">↓</span>
              <strong>입력할 선택자: <code>#topLayerQueryInput</code></strong>
            </figure>

            <ol>
              <li>검색창 HTML에서 <code>id=&quot;topLayerQueryInput&quot;</code>을 찾습니다.</li>
              <li><code>id</code> 값 앞에 <code>#</code>을 붙입니다.</li>
              <li>따라서 보내주신 검색창은 <code>#topLayerQueryInput</code>이 맞습니다.</li>
            </ol>

            <div className="crawler-selector-rule">
              <span><code>id=&quot;search&quot;</code> → <code>#search</code></span>
              <span><code>class=&quot;search&quot;</code> → <code>.search</code></span>
              <span><code>name=&quot;query&quot;</code> → <code>input[name=&quot;query&quot;]</code></span>
            </div>
            <p className="crawler-selector-warning"><strong>팁:</strong> <code>.inp</code>도 가능하지만 같은 클래스가 여러 곳에 있을 수 있습니다. 고유한 <code>id</code> 선택자를 우선 사용하세요.</p>
          </section>
        </div>
      ) : null}
    </>
  );
};
