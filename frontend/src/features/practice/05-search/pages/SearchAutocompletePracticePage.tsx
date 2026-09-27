/**
 * ============================================================================
 * SearchAutocompletePracticePage.tsx — 【중급】 실시간 검색 자동완성
 * ============================================================================
 *
 * 검색창에 글자를 칠 때마다 추천 목록이 뜨는, 그 흔한 기능이다.
 * 그런데 제대로 만들려면 생각보다 까다로운 문제 네 가지를 풀어야 한다.
 *
 * [문제 1: 요청 폭탄]
 *   "리액트"를 치면 ㄹ, 리, 릭, 리애, 리액, 리액트… 글자마다 요청이 나간다.
 *   → 해결: 디바운스(debounce). 입력이 멈추고 400ms 지나야 요청한다.
 *
 * [문제 2: 경쟁 상태(race condition)] ★ 가장 까다롭다
 *   "리액"을 검색하고(느림) 이어서 "리액트"를 검색했는데(빠름),
 *   나중에 보낸 "리액트" 결과가 먼저 도착하고
 *   그 뒤에 "리액" 결과가 도착하면 화면에 엉뚱한 결과가 남는다.
 *   → 해결: 요청마다 번호를 붙이고, 최신 번호의 응답만 화면에 반영한다.
 *
 * [문제 3: 쓸모없어진 요청]
 *   검색어가 바뀌면 이전 요청은 이제 필요 없다.
 *   → 해결: AbortController로 진행 중인 요청을 취소한다.
 *
 * [문제 4: 마우스 없이 쓰기]
 *   추천 목록을 방향키로 오르내리고 Enter로 고를 수 있어야 한다.
 *   → 해결: onKeyDown으로 키를 직접 처리하고 aria 속성으로 상태를 알린다.
 *
 * [연습 방법]
 *   화면의 "응답 상황" 드롭다운으로 느린 응답/빈 결과/오류를 재현할 수 있다.
 *   "2초 느린 응답"으로 바꾸고 빠르게 타이핑하면
 *   개발자도구 Network 탭에서 취소되는 요청을 눈으로 볼 수 있다.
 */

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { LearningGuideTitle } from "@/features/curriculum/components/LearningGuideTitle";
import { searchLearningTopics } from "@/features/practice/05-search/api/localSearchApi";
import type {
  LearningTopicSearchResult,
  SearchPracticeScenario,
} from "@/features/practice/05-search/types/searchTypes";

/**
 * 검색이 지금 어떤 단계인지.
 *
 * ★ 단계를 다섯 개로 잘게 나눈 이유
 *   흔히 isLoading(boolean) 하나로 처리하지만 그러면 구분할 수 없는 게 많다.
 *     - 아직 아무것도 안 함(idle) vs 결과가 0개(success + 빈 배열)
 *     - 입력을 기다리는 중(debouncing) vs 실제 요청 중(loading)
 *   각각 화면에 다른 안내를 띄우려면 상태를 나눠야 한다.
 *   문자열 유니온으로 만들면 불가능한 조합도 생기지 않는다.
 */
type SearchStatus = "idle" | "debouncing" | "loading" | "success" | "error";

// 입력이 멈춘 뒤 기다릴 시간.
// 너무 짧으면(100ms) 요청이 여전히 많고, 너무 길면(1000ms) 느리게 느껴진다.
// 보통 300~500ms 사이를 쓴다.
const DEBOUNCE_DELAY_MILLISECONDS = 400;

const scenarioLabelMap: Record<SearchPracticeScenario, string> = {
  success: "정상 응답",
  slow: "2초 느린 응답",
  empty: "항상 빈 결과",
  error: "서버 오류",
};

const exampleKeywords = ["상태", "검색", "오류", "키보드"];

export const SearchAutocompletePracticePage = () => {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchScenario, setSearchScenario] = useState<SearchPracticeScenario>("success");
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [searchResults, setSearchResults] = useState<LearningTopicSearchResult[]>([]);
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const [selectedTopic, setSelectedTopic] = useState<LearningTopicSearchResult | null>(null);

  // ★★ useRef를 "값 보관함"으로 쓰는 예. (DOM을 잡는 용도가 아니다!)
  //
  //   useRef의 두 가지 용도를 구분하자:
  //     (1) DOM 요소를 잡기      → ModalDialog, GalleryPage에서 본 방식
  //     (2) 값을 보관하기        → 여기서 쓰는 방식
  //
  //   useState와 결정적으로 다른 점:
  //     useState → 값을 바꾸면 화면이 다시 그려진다
  //     useRef   → 값을 바꿔도 화면이 다시 그려지지 않는다
  //
  //   여기서 요청 번호는 화면에 보여줄 값이 아니라 내부 판단용이다.
  //   이걸 useState로 만들면 번호를 올릴 때마다 쓸데없이 다시 그려진다.
  //
  //   또 하나 중요한 점: ref는 값이 "즉시" 바뀐다.
  //   State는 다음 렌더까지 옛 값이 남지만 ref.current는 바로 반영된다.
  //   그래서 비동기 콜백 안에서 "지금 진짜 최신값"을 확인하는 데 딱 맞다.
  const latestRequestIdReference = useRef(0);

  // 추천 목록에 붙일 고유 id. 아래 aria 속성 연결에 쓴다.
  const resultListId = useId();

  // ── 계산으로 얻는 값들 (State가 아니다) ─────────────────────────
  // ★ State로 만들 필요가 없는 것은 만들지 않는 게 좋다.
  //   State가 늘어날수록 "서로 안 맞는 상태"가 생길 위험이 커진다.
  //   다른 값에서 계산할 수 있으면 그냥 계산하자.
  const normalizedSearchKeyword = searchKeyword.trim();
  // 두 글자 미만이면 검색하지 않는다. 한 글자로는 결과가 너무 많고 서버만 힘들다.
  const canSearch = normalizedSearchKeyword.length >= 2;
  // 추천 목록을 펼쳐야 하는가?
  const hasOpenResults = searchStatus === "success" && searchResults.length > 0;
  // 방향키로 지금 선택해 둔 항목. -1이면 아무것도 안 고른 상태.
  const activeResult = activeResultIndex >= 0 ? searchResults[activeResultIndex] : undefined;

  // ══════════════════════════════════════════════════════════════════
  // ★★★ 이 페이지의 심장. 디바운스 + 취소 + 경쟁 상태 방지가 전부 여기 있다.
  // ══════════════════════════════════════════════════════════════════
  useEffect(() => {
    // ── 검색을 하지 말아야 하는 경우 두 가지를 먼저 걸러낸다 ──

    // (1) 추천 목록에서 항목을 골라 그 이름이 그대로 입력창에 들어간 경우.
    //     이때 또 검색하면 "고르자마자 그 이름으로 다시 목록이 뜨는" 이상한 일이 생긴다.
    if (selectedTopic?.topicTitle === normalizedSearchKeyword) {
      // 요청 번호를 올려서 "혹시 날아오고 있는 이전 응답"을 전부 무효로 만든다.
      latestRequestIdReference.current += 1;
      setSearchStatus("idle");
      setSearchResults([]);
      setActiveResultIndex(-1);
      // ★ 정리 함수 대신 undefined를 반환한다.
      //   이 경로에서는 타이머도 요청도 만들지 않았으니 정리할 게 없다.
      return undefined;
    }

    // (2) 글자 수가 부족한 경우.
    if (!canSearch) {
      latestRequestIdReference.current += 1;
      setSearchStatus("idle");
      setSearchResults([]);
      setActiveResultIndex(-1);
      return undefined;
    }

    // ── 여기서부터 실제 검색 준비 ──
    // 아직 요청은 안 보냈지만 "곧 검색할 것"임을 화면에 알린다.
    setSearchStatus("debouncing");
    setSearchResults([]);
    setActiveResultIndex(-1);

    let abortController: AbortController | undefined;

    // ★ 디바운스의 정체 = setTimeout이다.
    //   "400ms 뒤에 요청해라"고 예약만 해 둔다.
    //   그 사이에 사용자가 또 타이핑하면?
    //   → 이 Effect가 다시 실행되기 전에 아래 정리 함수가 먼저 돌아
    //     예약을 취소한다. 그래서 요청이 아예 안 나간다.
    //   결과적으로 "입력이 멈춘 뒤 400ms"에만 요청이 나간다.
    const debounceTimeoutId = window.setTimeout(() => {
      // 이 요청을 취소할 수 있는 리모컨을 만든다.
      abortController = new AbortController();

      // ★ 요청마다 고유 번호를 매긴다. 경쟁 상태를 막는 장치다.
      const requestId = latestRequestIdReference.current + 1;
      latestRequestIdReference.current = requestId;

      setSearchStatus("loading");

      void searchLearningTopics(
        normalizedSearchKeyword,
        searchScenario,
        // signal을 넘겨야 abort()가 실제로 요청을 끊을 수 있다.
        abortController.signal,
      ).then((results) => {
        // ★★ 경쟁 상태 방어의 핵심 한 줄.
        //   "내가 보낸 요청 번호가 아직도 최신인가?"
        //   그 사이 새 요청이 나갔다면 번호가 달라져 있고,
        //   그러면 이 응답은 낡은 것이므로 화면에 반영하지 않고 버린다.
        //
        //   이 한 줄이 없으면 느린 옛 응답이 최신 결과를 덮어쓰는
        //   재현하기도 어렵고 찾기도 어려운 버그가 생긴다.
        if (latestRequestIdReference.current !== requestId) return;
        setSearchResults(results);
        setSearchStatus("success");
      }).catch((requestError: unknown) => {
        // ★ 취소로 인한 에러는 "오류"가 아니다. 우리가 일부러 취소한 것이다.
        //   이걸 안 걸러내면 타이핑할 때마다 빨간 오류 메시지가 번쩍인다.
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        // 여기서도 최신 요청인지 확인한다. 낡은 요청의 실패는 무시한다.
        if (latestRequestIdReference.current !== requestId) return;
        setSearchResults([]);
        setSearchStatus("error");
      });
    }, DEBOUNCE_DELAY_MILLISECONDS);

    // ★★ useEffect의 정리 함수(cleanup).
    //
    //   언제 실행되나?
    //     1) 의존성이 바뀌어 Effect를 다시 실행하기 "직전"
    //     2) 컴포넌트가 화면에서 사라질 때
    //
    //   여기서 두 가지를 정리한다:
    //     clearTimeout → 아직 안 나간 예약 요청을 취소 (디바운스의 원리)
    //     abort()      → 이미 나간 요청을 중단
    //
    //   ★ 정리 함수를 빠뜨리면 어떤 일이 생기나?
    //     - 타이핑할 때마다 요청이 쌓여 디바운스가 무의미해진다
    //     - 페이지를 떠난 뒤 응답이 도착해 없는 화면을 갱신하려 한다
    //     - 메모리 누수가 쌓인다
    //   타이머나 구독을 만들었으면 반드시 정리 함수를 짝으로 쓰자.
    return () => {
      window.clearTimeout(debounceTimeoutId);
      abortController?.abort();
    };
    // 이 네 값 중 하나라도 바뀌면 위 과정을 처음부터 다시 한다.
  }, [canSearch, normalizedSearchKeyword, searchScenario, selectedTopic]);

  const selectTopic = (topic: LearningTopicSearchResult): void => {
    setSelectedTopic(topic);
    setSearchKeyword(topic.topicTitle);
    setSearchResults([]);
    setSearchStatus("idle");
    setActiveResultIndex(-1);
  };

  /**
   * ★ 키보드만으로 추천 목록을 다루기.
   *
   *   마우스 없이도 쓸 수 있어야 하는 이유:
   *     - 검색은 손이 키보드에 있는 상태에서 하는 동작이다.
   *       마우스로 옮겨 가는 것 자체가 불편하다.
   *     - 시각장애 사용자는 마우스를 아예 쓸 수 없다.
   *   구글, 네이버 검색창도 전부 이렇게 동작한다.
   */
  const handleSearchInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    // Escape → 목록 닫기. 목록이 열려 있든 아니든 항상 동작하게 맨 위에 뒀다.
    if (event.key === "Escape") {
      setSearchResults([]);
      setActiveResultIndex(-1);
      return;
    }
    // 목록이 닫혀 있으면 방향키를 가로챌 이유가 없다.
    // 그냥 두면 입력창 안에서 커서를 움직이는 기본 동작이 살아 있다.
    if (!hasOpenResults) return;

    if (event.key === "ArrowDown") {
      // ★ preventDefault()가 꼭 필요하다.
      //   막지 않으면 입력창의 커서가 맨 끝으로 튀거나 페이지가 스크롤된다.
      //   방향키를 목록 이동에만 쓰겠다고 브라우저에 알리는 것이다.
      event.preventDefault();
      // Math.min으로 마지막 항목을 넘지 않게 막는다.
      setActiveResultIndex((currentIndex) => Math.min(currentIndex + 1, searchResults.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      // Math.max로 0보다 작아지지 않게 막는다.
      setActiveResultIndex((currentIndex) => Math.max(currentIndex - 1, 0));
    } else if (event.key === "Enter" && activeResult) {
      // Enter로 선택. 아무것도 안 고른 상태면 activeResult가 undefined라 그냥 넘어간다.
      event.preventDefault();
      selectTopic(activeResult);
    }
  };

  // ★ 상태에 따른 안내 문구를 삼항 연산자로 이어 붙였다.
  //   위에서부터 순서대로 확인하다가 처음 맞는 문구를 쓴다.
  //
  //   ★ 왜 이렇게 여러 문구를 준비했을까?
  //     "결과 없음"과 "오류"는 사용자가 해야 할 행동이 완전히 다르다.
  //       결과 없음 → 다른 검색어를 넣어 본다
  //       오류      → 잠시 뒤 다시 시도한다
  //     둘 다 "결과가 없습니다"로 뭉뚱그리면 사용자는 헛수고를 하게 된다.
  //
  //   ※ 조건이 더 늘어난다면 switch나 별도 함수로 빼는 게 읽기 좋다.
  const statusMessage = !canSearch
    ? "두 글자 이상 입력하면 검색을 시작합니다."
    : searchStatus === "debouncing"
      ? "입력이 멈추기를 기다리는 중입니다."
      : searchStatus === "loading"
        ? "학습 주제를 검색하는 중입니다."
        : searchStatus === "error"
          ? "검색 중 오류가 발생했습니다. 시나리오를 바꾸거나 다시 입력해 주세요."
          : searchStatus === "success" && searchResults.length === 0
            ? "검색 결과가 없습니다."
            : searchStatus === "success"
              ? `${searchResults.length}개의 검색 결과가 있습니다.`
              : "검색어를 입력해 주세요.";

  return (
    <section className="autocomplete-practice-page">
      <div className="page-hero">
        <span className="page-kicker">Effect · Debounce · Request Cancellation</span>
        <LearningGuideTitle guideId="search">실시간 검색 자동완성</LearningGuideTitle>
        <p>
          입력할 때마다 바로 요청하지 않고 잠시 기다린 뒤 검색합니다. 검색어가 바뀌면 이전 요청을
          취소하고, 가장 최근 요청만 화면에 반영하는 흐름을 확인하세요.
        </p>
      </div>

      <div className="autocomplete-practice-layout">
        <article className="practice-card autocomplete-demo-card">
          <div className="autocomplete-card-heading">
            <div>
              <span className="level-badge level-중급">중급 · 비동기 상태</span>
              <h2>React 학습 주제 찾기</h2>
            </div>
            <label>
              응답 상황
              <select
                value={searchScenario}
                onChange={(event) => setSearchScenario(event.target.value as SearchPracticeScenario)}
              >
                {(Object.keys(scenarioLabelMap) as SearchPracticeScenario[]).map((scenario) => (
                  <option key={scenario} value={scenario}>{scenarioLabelMap[scenario]}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="autocomplete-input-area">
            <label htmlFor="learning-topic-search">학습 주제</label>
            {/* ★ 자동완성 입력창의 표준 접근성 속성 세트.
                  화면 낭독기 사용자도 "지금 목록이 몇 개 떴고 무엇이 선택됐는지"를
                  알 수 있게 해 주는 장치다. 하나씩 보면:

                  role="combobox"        → "이건 자동완성 입력창이다"
                  aria-autocomplete="list" → "치면 목록이 뜬다"
                  aria-controls          → "내가 조종하는 목록은 이 id다"
                  aria-expanded          → "지금 목록이 펼쳐졌나?"
                  aria-activedescendant  → "지금 선택된 항목은 이 id다"
                                           (방향키로 옮길 때마다 낭독기가 읽어 준다)

                  autoComplete="off"     → 브라우저 자체 자동완성을 끈다.
                                           안 끄면 우리 목록과 겹쳐서 보인다. */}
            <input
              id="learning-topic-search"
              role="combobox"
              aria-autocomplete="list"
              aria-controls={resultListId}
              aria-expanded={hasOpenResults}
              aria-activedescendant={activeResult ? `${resultListId}-${activeResult.topicId}` : undefined}
              autoComplete="off"
              value={searchKeyword}
              onChange={(event) => {
                setSearchKeyword(event.target.value);
                setSelectedTopic(null);
              }}
              onKeyDown={handleSearchInputKeyDown}
              placeholder="예: 상태, 검색, 키보드"
            />

            {hasOpenResults ? (
              <ul id={resultListId} className="autocomplete-result-list" role="listbox">
                {searchResults.map((topic, resultIndex) => (
                  <li
                    id={`${resultListId}-${topic.topicId}`}
                    key={topic.topicId}
                    role="option"
                    aria-selected={resultIndex === activeResultIndex}
                    className={resultIndex === activeResultIndex ? "active" : ""}
                    // ★ onMouseDown에서 preventDefault()를 부르는 이유.
                    //   마우스로 목록 항목을 누르면 순서가 이렇다:
                    //     mousedown → 입력창이 포커스를 잃음(blur) → mouseup → click
                    //   중간에 포커스를 잃으면 목록이 닫히면서 click이 도달하지 못하는
                    //   경우가 생긴다. "클릭했는데 선택이 안 되는" 버그다.
                    //   mousedown의 기본 동작(포커스 이동)을 막으면 해결된다.
                    //   자동완성 UI를 만들 때 반드시 알아야 하는 요령이다.
                    onMouseDown={(event) => event.preventDefault()}
                    // 마우스를 올리면 그 항목이 선택된 상태가 된다.
                    // 키보드 선택과 마우스 위치를 하나로 통일해 두면 헷갈리지 않는다.
                    onMouseEnter={() => setActiveResultIndex(resultIndex)}
                    onClick={() => selectTopic(topic)}
                  >
                    <strong>{topic.topicTitle}</strong>
                    <span>{topic.categoryName}</span>
                    <small>{topic.description}</small>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="autocomplete-example-row" aria-label="예제 검색어">
            <span>빠른 입력</span>
            {exampleKeywords.map((keyword) => (
              <button key={keyword} type="button" className="ghost-button" onClick={() => setSearchKeyword(keyword)}>
                {keyword}
              </button>
            ))}
          </div>

          {/* ★ role="status" + aria-live="polite"
                이 영역의 글자가 바뀌면 화면 낭독기가 자동으로 읽어 준다.
                눈으로 보는 사용자는 "검색 중..."이 뜨는 걸 볼 수 있지만,
                안 보이는 사용자는 이런 장치가 없으면 아무것도 알 수 없다.

                "polite"는 "지금 읽는 게 끝나면 알려줘"라는 뜻이다.
                "assertive"는 말을 끊고 즉시 읽는데, 급한 경고에만 써야 한다. */}
          <p className={`autocomplete-status status-${searchStatus}`} role="status" aria-live="polite">
            {searchStatus === "loading" ? <span className="loading-dot" aria-hidden="true" /> : null}
            {statusMessage}
          </p>

          {selectedTopic ? (
            <article className="autocomplete-selection-card">
              <span>{selectedTopic.categoryName}</span>
              <h3>{selectedTopic.topicTitle}</h3>
              <p>{selectedTopic.description}</p>
              <ul className="topic-chip-list">
                {selectedTopic.keywords.map((keyword) => <li key={keyword}>{keyword}</li>)}
              </ul>
            </article>
          ) : null}
        </article>

        <aside className="learning-note-card autocomplete-observation-card">
          <h2>개발자 도구에서 확인할 것</h2>
          <ol>
            <li>한 글자만 입력하면 요청하지 않습니다.</li>
            <li>빠르게 타이핑하면 마지막 입력 후 400ms 뒤에 검색합니다.</li>
            <li>느린 응답 중 검색어를 바꾸면 이전 요청을 취소합니다.</li>
            <li>빈 결과와 서버 오류가 서로 다른 상태로 표시됩니다.</li>
            <li>방향키와 Enter, Escape만으로 결과를 선택하고 닫을 수 있습니다.</li>
          </ol>
          <div className="code-flow-card autocomplete-flow-card">
            <code>입력 → debounce → 요청 취소 → 최신 요청 확인 → 결과 렌더링</code>
          </div>
        </aside>
      </div>
    </section>
  );
};
