import { useState } from "react";
import type { ApiProblemDetails } from "@/shared/api/error/apiErrorTypes";
import { useCrawlerLiveView } from "@/features/crawler/hooks/useWebCrawler";
import { buildCrawlerFailureReport } from "@/features/crawler/utils/crawlerFailureReport";
import type {
  CrawlerRunRequest,
  CrawlerSitePreset,
} from "@/features/crawler/types/webCrawlerTypes";

interface CrawlerErrorPanelProps {
  problem: ApiProblemDetails;
  request?: CrawlerRunRequest;
  sitePreset?: CrawlerSitePreset;
}

interface FailureInput {
  label: string;
  value: string;
}

const displayValue = (value: string | undefined): string => value?.trim() || "(입력하지 않음)";

const loginModeLabel = (request: CrawlerRunRequest): string => {
  if (request.login.mode === "SAVED_SESSION") return "저장된 로그인 세션";
  if (request.login.mode === "FORM") return "아이디·비밀번호 폼 로그인";
  return "로그인하지 않음";
};

const passwordState = (password: string): string => password.length > 0 ? password : "(입력하지 않음)";

const findFailureInputs = (
  problem: ApiProblemDetails,
  request: CrawlerRunRequest,
  sitePreset?: CrawlerSitePreset,
): FailureInput[] => {
  const stage = problem.crawlerStage ?? "";
  const common = [
    { label: "사이트 프리셋", value: sitePreset === "NAVER_CAFE" ? "네이버 카페" : "일반 사이트 · 직접 설정" },
  ];

  if (stage.includes("로그인 아이디")) {
    return [...common,
      { label: "로그인 URL", value: displayValue(request.login.loginUrl) },
      { label: "아이디 입력값", value: displayValue(request.login.username) },
      { label: "아이디 입력칸 선택자", value: displayValue(request.login.usernameSelector) },
    ];
  }
  if (stage.includes("로그인 비밀번호")) {
    return [...common,
      { label: "로그인 URL", value: displayValue(request.login.loginUrl) },
      { label: "비밀번호 입력값", value: passwordState(request.login.password) },
      { label: "비밀번호 입력칸 선택자", value: displayValue(request.login.passwordSelector) },
    ];
  }
  if (stage.includes("로그인 버튼")) {
    return [...common,
      { label: "로그인 URL", value: displayValue(request.login.loginUrl) },
      { label: "로그인 버튼 선택자", value: displayValue(request.login.submitSelector) },
    ];
  }
  if (stage.includes("로그인 완료")) {
    return [...common,
      { label: "로그인 URL", value: displayValue(request.login.loginUrl) },
      { label: "아이디 입력값", value: displayValue(request.login.username) },
      { label: "비밀번호 입력값", value: passwordState(request.login.password) },
      { label: "로그인 완료 선택자", value: displayValue(request.login.loggedInSelector) },
    ];
  }
  if (stage.includes("로그인 페이지")) {
    return [...common,
      { label: "수집할 URL", value: displayValue(request.startUrl) },
      { label: "로그인 URL", value: displayValue(request.login.loginUrl) },
      { label: "로그인 방식", value: loginModeLabel(request) },
    ];
  }
  if (stage.includes("저장된 로그인 세션")) {
    return [...common,
      { label: "수집할 URL", value: displayValue(request.startUrl) },
      { label: "로그인 방식", value: loginModeLabel(request) },
    ];
  }
  if (stage.includes("사이트 검색어")) {
    return [...common,
      { label: "수집할 URL", value: displayValue(request.startUrl) },
      { label: "사이트 검색어", value: displayValue(request.pageSearch.keyword) },
      { label: "검색 입력칸 선택자", value: displayValue(request.pageSearch.inputSelector) },
    ];
  }
  if (stage.includes("사이트 검색 실행")) {
    return [...common,
      { label: "사이트 검색어", value: displayValue(request.pageSearch.keyword) },
      { label: "검색 입력칸 선택자", value: displayValue(request.pageSearch.inputSelector) },
      { label: "검색 실행 방식", value: request.pageSearch.submitSelector.trim()
        ? `버튼 클릭: ${request.pageSearch.submitSelector.trim()}`
        : "검색창에서 Enter 키 입력" },
    ];
  }
  if (/페이지 필드 \d+ 추출/.test(stage)) {
    const fieldIndex = Number(stage.match(/필드 (\d+)/)?.[1] ?? 0) - 1;
    const field = request.fields[fieldIndex];
    return [...common,
      { label: "반복 항목 선택자", value: displayValue(request.itemSelector) },
      { label: "필드 이름", value: displayValue(field?.name) },
      { label: "항목 내부 선택자", value: displayValue(field?.selector) },
      { label: "읽을 값", value: field?.valueSource === "ATTRIBUTE"
        ? `HTML 속성: ${displayValue(field.attributeName)}`
        : "텍스트" },
    ];
  }
  if (stage.includes("페이지 목록") || stage.includes("목록 수집")) {
    return [...common,
      { label: "수집할 URL", value: displayValue(request.startUrl) },
      { label: "콘텐츠 iframe 선택자", value: displayValue(request.contentFrameSelector) },
      { label: "반복 항목 선택자", value: displayValue(request.itemSelector) },
    ];
  }
  if (stage.includes("다음 버튼")) {
    return [...common,
      { label: "다음 페이지 버튼 선택자", value: displayValue(request.nextPageSelector) },
      { label: "최대 페이지", value: String(request.maxPages) },
      { label: "페이지 대기", value: `${request.waitAfterNavigationMillis}ms` },
    ];
  }
  return [...common,
    { label: "수집할 URL", value: displayValue(request.startUrl) },
    { label: "로그인 방식", value: loginModeLabel(request) },
    { label: "최대 페이지 / 항목", value: `${request.maxPages}페이지 / ${request.maxItems}건` },
  ];
};

export const CrawlerErrorPanel = ({ problem, request, sitePreset }: CrawlerErrorPanelProps) => {
  const failureInputs = request ? findFailureInputs(problem, request, sitePreset) : [];
  const liveViewQuery = useCrawlerLiveView(true, false);
  const [occurredAt] = useState(() => new Date());
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const report = buildCrawlerFailureReport({
    problem, request, sitePreset, liveView: liveViewQuery.data, occurredAt, pageUrl: window.location.href,
  });

  const copyReport = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(report);
      setCopyState("copied");
    } catch {
      // 클립보드 권한이 없으면 아래 텍스트 상자를 직접 선택해 복사하도록 안내한다.
      setCopyState("failed");
    }
  };

  return (
    <section className="portfolio-state-panel error-state crawler-error-panel" role="alert">
      <header>
        <span>실행 실패</span>
        <strong>크롤링하지 못했습니다.</strong>
      </header>

      <div className="crawler-error-summary">
        <div>
          <small>실패 단계</small>
          <strong>{problem.crawlerStage || "정확한 단계를 확인하지 못했습니다."}</strong>
        </div>
        <div>
          <small>왜 실패했나요?</small>
          <p>{problem.detail || "서버가 상세 원인을 제공하지 않았습니다. 아래 오류 코드로 확인해 주세요."}</p>
        </div>
      </div>

      {problem.technicalMessage ? (
        <div className="crawler-error-original">
          <small>원본 오류 메시지</small>
          <pre>{problem.technicalMessage}</pre>
        </div>
      ) : null}

      {failureInputs.length > 0 ? (
        <section className="crawler-error-inputs" aria-labelledby="crawler-error-input-title">
          <h3 id="crawler-error-input-title">이 단계에서 실제로 사용한 입력값</h3>
          <dl>
            {failureInputs.map((input) => (
              <div key={input.label}>
                <dt>{input.label}</dt>
                <dd><code>{input.value}</code></dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {problem.suggestedAction ? (
        <div className="crawler-error-action">
          <small>다음 조치</small>
          <p>{problem.suggestedAction}</p>
        </div>
      ) : null}

      {problem.fieldErrors?.length ? <ul>{problem.fieldErrors.map((error, index) => (
        <li key={`${error.fieldName}-${index}`}>{error.fieldName}: {error.message}</li>
      ))}</ul> : null}

      <section className="crawler-error-report" aria-labelledby="crawler-error-report-title">
        <h3 id="crawler-error-report-title">실패 상세 (입력값 그대로)</h3>
        <p>실패 원인과 입력한 값을 가공하지 않고 그대로 보여줍니다. 아이디·비밀번호도 포함되니 공유할 때 필요하면 직접 지워 주세요.</p>
        <button type="button" className="secondary-button" onClick={() => void copyReport()}>
          {copyState === "copied" ? "복사했습니다" : "전체 복사"}
        </button>
        {copyState === "failed" ? <p className="field-error">자동 복사를 할 수 없습니다. 아래 상자를 클릭한 뒤 Ctrl+A, Ctrl+C로 복사해 주세요.</p> : null}
        <textarea
          aria-label="실패 상세 내용"
          readOnly
          rows={Math.min(report.split("\n").length, 24)}
          value={report}
          onFocus={(event) => event.currentTarget.select()}
        />
      </section>

      <details className="crawler-error-technical" open>
        <summary>기술 정보 보기</summary>
        <p>오류 코드: {problem.errorCode} · {problem.status ? `HTTP ${problem.status}` : "서버 응답 없음"}</p>
        {typeof problem.elapsedMillis === "number" ? <p>실패까지 걸린 시간: {(problem.elapsedMillis / 1000).toFixed(1)}초</p> : null}
        {problem.traceId ? <p>추적 번호: {problem.traceId}</p> : null}
      </details>
    </section>
  );
};
