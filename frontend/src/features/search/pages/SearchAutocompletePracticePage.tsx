import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { searchLearningTopics } from "@/features/search/api/localSearchApi";
import type {
  LearningTopicSearchResult,
  SearchPracticeScenario,
} from "@/features/search/types/searchTypes";

type SearchStatus = "idle" | "debouncing" | "loading" | "success" | "error";

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
  const latestRequestIdReference = useRef(0);
  const resultListId = useId();

  const normalizedSearchKeyword = searchKeyword.trim();
  const canSearch = normalizedSearchKeyword.length >= 2;
  const hasOpenResults = searchStatus === "success" && searchResults.length > 0;
  const activeResult = activeResultIndex >= 0 ? searchResults[activeResultIndex] : undefined;

  useEffect(() => {
    if (selectedTopic?.topicTitle === normalizedSearchKeyword) {
      latestRequestIdReference.current += 1;
      setSearchStatus("idle");
      setSearchResults([]);
      setActiveResultIndex(-1);
      return undefined;
    }
    if (!canSearch) {
      latestRequestIdReference.current += 1;
      setSearchStatus("idle");
      setSearchResults([]);
      setActiveResultIndex(-1);
      return undefined;
    }

    setSearchStatus("debouncing");
    setSearchResults([]);
    setActiveResultIndex(-1);
    let abortController: AbortController | undefined;

    const debounceTimeoutId = window.setTimeout(() => {
      abortController = new AbortController();
      const requestId = latestRequestIdReference.current + 1;
      latestRequestIdReference.current = requestId;
      setSearchStatus("loading");

      void searchLearningTopics(
        normalizedSearchKeyword,
        searchScenario,
        abortController.signal,
      ).then((results) => {
        if (latestRequestIdReference.current !== requestId) return;
        setSearchResults(results);
        setSearchStatus("success");
      }).catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        if (latestRequestIdReference.current !== requestId) return;
        setSearchResults([]);
        setSearchStatus("error");
      });
    }, DEBOUNCE_DELAY_MILLISECONDS);

    return () => {
      window.clearTimeout(debounceTimeoutId);
      abortController?.abort();
    };
  }, [canSearch, normalizedSearchKeyword, searchScenario, selectedTopic]);

  const selectTopic = (topic: LearningTopicSearchResult): void => {
    setSelectedTopic(topic);
    setSearchKeyword(topic.topicTitle);
    setSearchResults([]);
    setSearchStatus("idle");
    setActiveResultIndex(-1);
  };

  const handleSearchInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Escape") {
      setSearchResults([]);
      setActiveResultIndex(-1);
      return;
    }
    if (!hasOpenResults) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveResultIndex((currentIndex) => Math.min(currentIndex + 1, searchResults.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveResultIndex((currentIndex) => Math.max(currentIndex - 1, 0));
    } else if (event.key === "Enter" && activeResult) {
      event.preventDefault();
      selectTopic(activeResult);
    }
  };

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
        <h1>실시간 검색 자동완성</h1>
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
                    onMouseDown={(event) => event.preventDefault()}
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
