/**
 * ============================================================================
 * WebCrawlerPage.tsx — 웹 크롤링 도구 화면 (유틸리티 › 웹 크롤러)
 * ============================================================================
 *
 * [화면 구성]
 *   저장된 설정 게시판(CrawlerConfigurationBoard) → 실행 설정 폼(단계 방식 또는 기존 폼 방식)
 *   → 실행 중 실시간 화면(CrawlerLiveViewPanel) → 실패 패널(CrawlerErrorPanel) 또는 결과 표(CrawlerResultsPanel)
 *
 * [상태 나누기]
 *   입력 중인 설정 값  → 이 페이지의 useState들(폼은 화면 State)
 *   실행·저장·이력      → TanStack Query 훅(useWebCrawler.ts)
 *   실행 요청 만들기    → buildCrawlerRequest(): 입력값을 검사하고 서버 CrawlerRunRequest 모양으로 바꾼다.
 *
 * 서버 쪽 흐름은 backend의 CrawlerController → CrawlerService → PlaywrightCrawlerEngine을 보면 된다. 사용법은 docs/crawler.md.
 */

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  useCrawlerBrowserStatus,
  useNaverCrawlerSessionStatus,
  useRunCrawlerConfiguration,
  useWebCrawlerMutation,
} from "@/features/crawler/hooks/useWebCrawler";
import { CrawlerErrorPanel } from "@/features/crawler/components/CrawlerErrorPanel";
import { CrawlerConfigurationBoard } from "@/features/crawler/components/CrawlerConfigurationBoard";
import { CrawlerLegacyFormFields } from "@/features/crawler/components/CrawlerLegacyFormFields";
import { CrawlerLiveViewPanel } from "@/features/crawler/components/CrawlerLiveViewPanel";
import { CrawlerResultsPanel } from "@/features/crawler/components/CrawlerResultsPanel";
import { CrawlerStepEditor } from "@/features/crawler/components/CrawlerStepEditor";
import { RequiredMark } from "@/features/crawler/components/RequiredMark";
import { highlightInvalidFields, markInvalidFields } from "@/shared/lib/formValidation";
import { toEditableSteps, toRequestSteps, validateSteps, type EditableScenarioStep, type StepProblem } from "@/features/crawler/utils/crawlerSteps";
import type { CrawlerComparisonBaseline } from "@/features/crawler/utils/crawlerResultComparison";
import {
  type CrawlerConfiguration,
  type CrawlerFieldRequest,
  type CrawlerBrowserWindow,
  type CrawlerMatchMode,
  type CrawlerRunRequest,
  type CrawlerRunResponse,
  type CrawlerSitePreset,
  type CrawlerValueSource,
} from "@/features/crawler/types/webCrawlerTypes";
import {
  clearCrawlerCredentials,
  loadCrawlerCredentials,
  saveCrawlerCredentials,
} from "@/features/crawler/utils/crawlerCredentialStorage";
import {
  buildCrawlerLegacyRequestParts,
  initialCrawlerLegacyForm,
  naverCafeLegacyForm,
  toCrawlerLegacyForm,
  type CrawlerLegacyForm,
} from "@/features/crawler/utils/crawlerLegacyForm";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { createUuid } from "@/shared/lib/createUuid";
import { createCrawlerCsvFileName, downloadCrawlerCsv } from "@/features/crawler/utils/crawlerCsv";
import { FeatureHelpButton } from "@/features/help/FeatureHelpButton";

// 화면 편집용 필드·키워드 그룹(React key와 수정 대상을 찾기 위한 id를 붙인 모양).
interface EditableCrawlerField extends CrawlerFieldRequest {
  id: string;
}

interface EditableKeywordGroup {
  id: string;
  matchMode: CrawlerMatchMode;
  keywordText: string;
}

const createField = (
  name = "새 필드",
  selector = "",
  valueSource: CrawlerValueSource = "TEXT",
  attributeName = "",
): EditableCrawlerField => ({ id: createUuid(), name, selector, valueSource, attributeName });

const createKeywordGroup = (): EditableKeywordGroup => ({
  id: createUuid(),
  matchMode: "ANY",
  keywordText: "",
});

/** 쉼표·줄바꿈으로 구분한 키워드 글 → 앞뒤 공백을 지운, 중복 없는 키워드 배열(Set으로 중복 제거). */
const parseKeywords = (keywordText: string): string[] => [...new Set(
  keywordText.split(/[,\n]/).map((keyword) => keyword.trim()).filter(Boolean),
)];

/** STEPS: 단계별 실행(새 방식) · LEGACY: [LEGACY-FORM] 기존 설정 방식(로그인·검색 설정). 마지막 선택을 기억한다. */
type CrawlerRunMode = "STEPS" | "LEGACY";
// 마지막으로 고른 실행 방식(단계/기존 폼)을 이 브라우저에 기억한다. 저장소 접근이 막혀도 기본값으로 동작한다.
const RUN_MODE_STORAGE_KEY = "devnote.crawler.runMode.v1";
const loadRunMode = (): CrawlerRunMode => {
  try {
    return window.localStorage.getItem(RUN_MODE_STORAGE_KEY) === "STEPS" ? "STEPS" : "LEGACY";
  } catch {
    return "LEGACY";
  }
};
const saveRunMode = (mode: CrawlerRunMode): void => {
  try {
    window.localStorage.setItem(RUN_MODE_STORAGE_KEY, mode);
  } catch {
    // 저장소를 쓸 수 없는 환경이면 이번 화면에서만 유지한다.
  }
};

export const WebCrawlerPage = () => {
  const crawlerMutation = useWebCrawlerMutation();
  const trackedCrawlerMutation = useRunCrawlerConfiguration();
  // 브라우저 실행 위치(LOCAL/REMOTE)와 원격 Chrome 연결 여부. 어디서 실행할지는 서버 설정이 정하고, 화면은 상태만 보여 준다.
  const browserStatusQuery = useCrawlerBrowserStatus();
  // 서버가 "준비 안 됨"이라고 답했을 때만 막는다. 상태를 아직 못 받았거나 조회가 실패하면 막지 않고,
  // 실제 실행 요청에서 서버가 원인을 알려 준다(상태 조회 실패 때문에 도구 전체를 못 쓰게 되지 않도록).
  const browserUnavailable = browserStatusQuery.data?.ready === false;
  // 기억해 둔 계정 정보는 처음 한 번만 읽는다(함수를 넘기는 지연 초기화).
  const [initialCredentials] = useState(loadCrawlerCredentials);
  const [sitePreset, setSitePreset] = useState<CrawlerSitePreset>("GENERIC");
  const [showBrowser, setShowBrowser] = useState(true);
  const [browserWindow, setBrowserWindow] = useState<CrawlerBrowserWindow>("WEB");
  const [runMode, setRunModeState] = useState<CrawlerRunMode>(loadRunMode);
  const [steps, setSteps] = useState<EditableScenarioStep[]>([]);
  const [stepFocusRequest, setStepFocusRequest] = useState<StepProblem & { requestId: number }>();
  const stepFocusRequestId = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  const setRunMode = (mode: CrawlerRunMode): void => {
    setRunModeState(mode);
    saveRunMode(mode);
  };
  // 아래는 실행 설정 입력값들. 기본값은 크롤링 연습용 공개 사이트(quotes.toscrape.com)의 예시 설정이다.
  // 숫자 칸(maxPages 등)도 입력 중 빈 값을 허용하려고 문자열로 두고, 요청을 만들 때 숫자로 바꾼다.
  const [startUrl, setStartUrl] = useState("https://quotes.toscrape.com/");
  const [legacyForm, setLegacyForm] = useState<CrawlerLegacyForm>(initialCrawlerLegacyForm);
  const [username, setUsername] = useState(initialCredentials?.username ?? "");
  const [password, setPassword] = useState(initialCredentials?.password ?? "");
  const [rememberCredentials, setRememberCredentials] = useState(initialCredentials !== null);
  const [contentFrameSelector, setContentFrameSelector] = useState("");
  const [itemSelector, setItemSelector] = useState(".quote");
  const [fields, setFields] = useState<EditableCrawlerField[]>(() => [
    createField("문구", ".text"),
    createField("작성자", ".author"),
    createField("상세URL", "a[href*='/author/']", "ATTRIBUTE", "href"),
  ]);
  const [collectionFilterEnabled, setCollectionFilterEnabled] = useState(false);
  const [keywordGroups, setKeywordGroups] = useState<EditableKeywordGroup[]>(() => [createKeywordGroup()]);
  const [groupMatchMode, setGroupMatchMode] = useState<CrawlerMatchMode>("ALL");
  const [nextPageSelector, setNextPageSelector] = useState(".next a");
  const [collectDetail, setCollectDetail] = useState(false);
  const [detailSelector, setDetailSelector] = useState("");
  const [parseListing, setParseListing] = useState(false);
  const [maxPages, setMaxPages] = useState("2");
  const [maxItems, setMaxItems] = useState("100");
  const [waitMilliseconds, setWaitMilliseconds] = useState("1500");
  const [validationMessage, setValidationMessage] = useState("");
  const [selectedConfigurationId, setSelectedConfigurationId] = useState<number>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [historyView, setHistoryView] = useState<{ result: CrawlerRunResponse; baseline?: CrawlerComparisonBaseline }>();
  const [resultViewKey, setResultViewKey] = useState(0);
  const [lastSubmittedRun, setLastSubmittedRun] = useState<{
    request: CrawlerRunRequest;
    sitePreset: CrawlerSitePreset;
  }>();
  // 네이버 카페 프리셋일 때만 저장 세션 상태를 묻는다. 세션이 실제로 있고 사용자가 원할 때만 저장 세션으로 로그인한다.
  const naverSessionQuery = useNaverCrawlerSessionStatus(sitePreset === "NAVER_CAFE");
  const useSavedSession = legacyForm.loginEnabled
    && sitePreset === "NAVER_CAFE"
    && legacyForm.preferSavedSession
    && naverSessionQuery.data?.available === true;

  // "계정 정보 기억"을 켜면 입력할 때마다 저장하고, 끄면 즉시 지운다.
  useEffect(() => {
    if (rememberCredentials) {
      saveCrawlerCredentials({ username, password });
      return;
    }
    clearCrawlerCredentials();
  }, [password, rememberCredentials, username]);

  /** 네이버 카페 프리셋을 고르면 카페 게시판 구조에 맞는 예시 값(iframe·목록·필드 선택자)으로 한 번에 채운다. */
  const applySitePreset = (preset: CrawlerSitePreset): void => {
    setSitePreset(preset);
    if (preset !== "NAVER_CAFE") return;
    setStartUrl("https://cafe.naver.com/lhuniv9");
    setLegacyForm(naverCafeLegacyForm);
    setContentFrameSelector("iframe#cafe_main");
    setItemSelector("div.article-board tbody tr");
    setFields([
      createField("제목", "a.article"),
      createField("작성자", ".nickname"),
      createField("등록일", "td:nth-child(4)"),
      createField("조회수", "td:nth-child(5)"),
      createField("링크", "a.article", "ATTRIBUTE", "href"),
    ]);
    setNextPageSelector("");
    setWaitMilliseconds("1500");
  };

  /** 저장된 설정(서버 CrawlerRunRequest)을 화면 입력값들로 되돌린다. 단계가 있으면 단계 방식으로 전환한다. */
  const applySavedConfiguration = (configuration: CrawlerConfiguration): void => {
    const request = configuration.request;
    setSitePreset(configuration.sitePreset);
    setShowBrowser(request.showBrowser);
    setBrowserWindow(request.browserWindow);
    setSteps(toEditableSteps(request.steps));
    setRunMode(request.steps.length > 0 ? "STEPS" : "LEGACY");
    setStartUrl(request.startUrl);
    setLegacyForm(toCrawlerLegacyForm(request));
    setUsername((current) => request.login.username || current);
    setPassword((current) => request.login.password || current);
    setContentFrameSelector(request.contentFrameSelector);
    setItemSelector(request.itemSelector);
    setFields(request.fields.map((field) => createField(field.name, field.selector, field.valueSource, field.attributeName)));
    setCollectionFilterEnabled(request.collectionFilter.groups.length > 0);
    setGroupMatchMode(request.collectionFilter.groupMatchMode);
    setKeywordGroups(request.collectionFilter.groups.length > 0
      ? request.collectionFilter.groups.map((group) => ({ id: createUuid(), matchMode: group.matchMode, keywordText: group.keywords.join(", ") }))
      : [createKeywordGroup()]);
    setNextPageSelector(request.nextPageSelector);
    setCollectDetail(request.collectDetail);
    setDetailSelector(request.detailSelector);
    setParseListing(request.parseListing);
    setMaxPages(String(request.maxPages));
    setWaitMilliseconds(String(request.waitAfterNavigationMillis));
    setMaxItems(String(request.maxItems));
    setHistoryView(undefined);
    setValidationMessage("");
  };

  const updateField = (fieldId: string, patch: Partial<CrawlerFieldRequest>): void => {
    setFields((currentFields) => currentFields.map((field) => field.id === fieldId ? { ...field, ...patch } : field));
  };

  const updateLegacyForm = (patch: Partial<CrawlerLegacyForm>): void => {
    setLegacyForm((currentForm) => ({ ...currentForm, ...patch }));
  };

  const updateKeywordGroup = (groupId: string, patch: Partial<EditableKeywordGroup>): void => {
    setKeywordGroups((currentGroups) => currentGroups.map((group) => group.id === groupId ? { ...group, ...patch } : group));
  };

  /** 문제 있는 입력칸을 붉게 표시하고 포커스한 뒤 안내 문장을 띄운다. */
  const failValidation = (message: string, elements: Element[] = []): undefined => {
    setValidationMessage(message);
    if (elements.length > 0) markInvalidFields(elements);
    return undefined;
  };

  /** 단계 편집기에 "이 칸을 고치라"고 알린다. requestId를 매번 늘려 같은 칸이라도 다시 포커스가 가게 한다. */
  const showStepProblem = (problem: StepProblem): void => {
    setValidationMessage(problem.message);
    setStepFocusRequest({ ...problem, requestId: ++stepFocusRequestId.current });
  };

  /** 새 단계를 추가하기 전에 기존 단계의 빈 필수 칸부터 채우게 한다(문제가 있으면 추가하지 않는다). */
  const validateBeforeAddAction = (): boolean => {
    if (steps.length === 0) return true;
    const problem = validateSteps(steps);
    if (problem) {
      showStepProblem(problem);
      return false;
    }
    setValidationMessage("");
    return true;
  };

  /**
   * 화면 입력값 → 서버 실행 요청. 검사에 실패하면 문제 칸을 표시하고 undefined를 돌려준다.
   * 저장(설정 게시판)과 실행이 같은 함수를 쓰므로 "저장은 되는데 실행은 안 되는" 어긋남이 없다.
   */
  const buildCrawlerRequest = (): CrawlerRunRequest | undefined => {
    // 1) 필수값(*)·형식(URL, 숫자 범위) 검사: 비어 있거나 틀린 칸을 모두 붉게 표시하고 첫 칸으로 이동한다.
    const invalidLabels = highlightInvalidFields(formRef.current);
    if (invalidLabels.length > 0) {
      setValidationMessage(`붉게 표시된 칸을 확인해 주세요: ${invalidLabels.join(", ")}`);
      return undefined;
    }
    // 2) 화면 규칙 검사(중복 이름, 단계 규칙 등)
    if (!startUrl.trim()) {
      setValidationMessage("수집할 URL을 입력해 주세요.");
      return undefined;
    }
    // 반복 항목 선택자·필드는 비워도 된다: 비우면 표·목록과 열 제목을 자동으로 찾는다.
    const fieldNames = fields.map((field) => field.name.trim().toLocaleLowerCase("ko-KR"));
    if (fieldNames.some((fieldName) => !fieldName)) {
      setValidationMessage("모든 수집 필드의 이름을 입력해 주세요.");
      return undefined;
    }
    if (new Set(fieldNames).size !== fieldNames.length) {
      const duplicated = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);
      const duplicatedInputs = [...(formRef.current?.querySelectorAll<HTMLInputElement>("[data-field-name-input]") ?? [])]
        .filter((input) => duplicated.includes(input.value.trim().toLocaleLowerCase("ko-KR")));
      return failValidation("필드 이름은 서로 달라야 합니다.", duplicatedInputs);
    }
    const parsedKeywordGroups = keywordGroups.map((group) => ({
      matchMode: group.matchMode,
      keywords: parseKeywords(group.keywordText),
    }));
    if (collectionFilterEnabled && parsedKeywordGroups.some((group) => group.keywords.length === 0)) {
      setValidationMessage("사용 중인 키워드 그룹마다 키워드를 한 개 이상 입력해 주세요.");
      return undefined;
    }
    const collectionRequest = {
      contentFrameSelector: contentFrameSelector.trim(),
      itemSelector: itemSelector.trim(),
      fields: fields.map(({ id: _id, ...field }) => ({
        ...field,
        name: field.name.trim(),
        selector: field.selector.trim(),
        attributeName: field.attributeName.trim(),
      })),
      collectionFilter: {
        groupMatchMode,
        groups: collectionFilterEnabled ? parsedKeywordGroups : [],
      },
      nextPageSelector: nextPageSelector.trim(),
      maxPages: Number(maxPages),
      waitAfterNavigationMillis: Number(waitMilliseconds),
      maxItems: Number(maxItems),
      collectDetail,
      detailSelector: collectDetail ? detailSelector.trim() : "",
      parseListing,
    };
    if (runMode === "STEPS") {
      const stepProblem = validateSteps(steps);
      if (stepProblem) {
        showStepProblem(stepProblem);
        return undefined;
      }
      setValidationMessage("");
      // 단계별 실행: 로그인·검색 설정은 쓰지 않고, 계정정보는 {{username}}/{{password}} 치환용으로만 보낸다.
      return {
        showBrowser,
        browserWindow,
        steps: toRequestSteps(steps),
        startUrl: startUrl.trim(),
        login: {
          mode: "NONE", loginUrl: "", username, password,
          usernameSelector: "", passwordSelector: "", submitSelector: "", loggedInSelector: "",
        },
        pageSearch: { enabled: false, keyword: "", inputSelector: "", submitSelector: "" },
        ...collectionRequest,
      };
    }
    // ─── [LEGACY-FORM] 기존 설정 방식 요청 만들기 (단계별 실행으로 옮기면 삭제) ───
    const legacyParts = buildCrawlerLegacyRequestParts(legacyForm, { useSavedSession, username, password });
    if (!legacyParts.valid) {
      setValidationMessage(legacyParts.message);
      return undefined;
    }
    setValidationMessage("");
    return {
      showBrowser,
      browserWindow,
      steps: [],
      startUrl: startUrl.trim(),
      login: legacyParts.login,
      pageSearch: legacyParts.pageSearch,
      ...collectionRequest,
    };
  };

  const submitCrawler = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    runCrawler(false);
  };

  /**
   * 실행. test면 1페이지·최대 3건으로 줄여 설정이 맞는지 빠르게 확인한다.
   * 저장된 설정을 선택한 상태면 "설정으로 실행(이력 남김)", 아니면 "바로 실행" API를 쓴다.
   * 마지막 단계가 CSV 저장이면 성공 후 브라우저에서 CSV를 내려받는다.
   * 계정 정보 기억을 끈 상태에서는 실행이 끝나면 비밀번호 입력칸을 비운다.
   */
  const runCrawler = (test: boolean): void => {
    // 버튼은 이미 막혀 있지만, 입력칸에서 Enter로 폼을 제출하는 경로도 있어 여기서 한 번 더 막는다.
    if (browserUnavailable) {
      setValidationMessage(browserStatusQuery.data?.message ?? "원격 브라우저에 연결할 수 없습니다.");
      return;
    }
    const configured = buildCrawlerRequest();
    if (!configured) return;
    const request = test ? { ...configured, maxPages: 1, maxItems: Math.min(configured.maxItems, 3) } : configured;
    setLastSubmittedRun({ request, sitePreset });
    setResultViewKey((currentKey) => currentKey + 1);
    setHistoryView(undefined);
    const handleSuccess = (result: CrawlerRunResponse): void => {
      const lastStep = request.steps.at(-1);
      if (lastStep?.type === "CSV") {
        downloadCrawlerCsv(createCrawlerCsvFileName(lastStep.value), result.fieldNames, result.items);
      }
    };
    const mutationOptions = {
      onSuccess: (data: CrawlerRunResponse | { result: CrawlerRunResponse }) => {
        handleSuccess("result" in data ? data.result : data);
        if (sitePreset === "NAVER_CAFE") void naverSessionQuery.refetch();
      },
      onSettled: () => {
        if (!rememberCredentials && !useSavedSession) setPassword("");
      },
    };
    if (selectedConfigurationId !== undefined) {
      crawlerMutation.reset();
      trackedCrawlerMutation.mutate({ configurationId: selectedConfigurationId, request }, mutationOptions);
      return;
    }
    trackedCrawlerMutation.reset();
    crawlerMutation.mutate(request, mutationOptions);
  };

  // 보여 줄 결과 우선순위: 이력에서 연 결과 → 설정으로 실행한 결과 → 바로 실행한 결과.
  const response = historyView?.result ?? trackedCrawlerMutation.data?.result ?? crawlerMutation.data;
  const runPending = crawlerMutation.isPending || trackedCrawlerMutation.isPending;
  const runError = trackedCrawlerMutation.error ?? crawlerMutation.error;
  const requestProblem = runError
    ? convertRequestErrorToProblemDetails(runError)
    : undefined;

  return (
    <section className="site-page crawler-page">
      <div className="page-hero crawler-page-hero">
        <div>
          <span className="page-kicker">Playwright Data Collector</span>
          <div className="page-title-with-guide"><h1>웹 크롤링 도구</h1><FeatureHelpButton topic="crawler" /></div>
          <p>로그인 세션으로 페이지를 열고 CSS 선택자로 데이터를 수집한 뒤, 결과 필드에 원하는 검색 조건을 조합합니다.</p>
        </div>
        <div className="crawler-runtime-badge">
          <strong>{browserStatusQuery.data?.mode === "REMOTE" ? "원격 브라우저 · 격리 실행" : "Chromium · 격리 실행"}</strong>
          <span>선택한 경우에만 이 브라우저에 로그인 정보 저장</span>
        </div>
      </div>

      {/* 원격 브라우저 연결 상태. role="status"라 연결이 바뀌면 화면 낭독기가 알려 준다.
          LOCAL 모드(로컬 개발)에서는 알릴 것이 없으므로 그리지 않는다. */}
      {browserStatusQuery.data?.mode === "REMOTE" ? (
        <div className={`crawler-browser-status ${browserUnavailable ? "is-unavailable" : "is-ready"}`} role="status">
          <strong>{browserUnavailable ? "⚠ 원격 브라우저 연결 안 됨" : "✓ 원격 브라우저 연결됨"}</strong>
          <span>{browserStatusQuery.data.message}</span>
          {browserUnavailable ? (
            <button type="button" className="secondary-button" disabled={browserStatusQuery.isFetching} onClick={() => void browserStatusQuery.refetch()}>
              {browserStatusQuery.isFetching ? "확인 중..." : "다시 확인"}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="crawler-safety-notice">
        <strong>사용 전 확인</strong>
        <p>본인 계정과 자동 수집 권한이 있는 사이트에서만 사용하세요. 캡차 우회·차단 회피 기능은 없습니다. 로그인 정보 저장을 선택하면 이 브라우저의 localStorage에 평문으로 보관됩니다.</p>
      </div>

      <CrawlerConfigurationBoard
        sitePreset={sitePreset}
        editorOpen={editorOpen}
        selectedConfigurationId={selectedConfigurationId}
        getCurrentRequest={buildCrawlerRequest}
        onLoad={applySavedConfiguration}
        onSelect={(configurationId) => { setSelectedConfigurationId(configurationId); setHistoryView(undefined); }}
        onOpenEditor={() => setEditorOpen(true)}
        onCloseEditor={() => { setEditorOpen(false); setValidationMessage(""); }}
        onShowHistoryResult={(result, baseline) => { setHistoryView({ result, baseline }); setResultViewKey((currentKey) => currentKey + 1); }}
      />

      {editorOpen ? <form ref={formRef} noValidate className="crawler-config-form" onSubmit={submitCrawler}>
        <p className="crawler-required-guide"><RequiredMark /> 표시 항목은 필수 입력입니다.</p>
        <fieldset className="crawler-run-mode-choice">
          <legend>실행 방식</legend>
          <label className="checkbox-label"><input type="radio" name="crawlerRunMode" value="STEPS" checked={runMode === "STEPS"} onChange={() => setRunMode("STEPS")} /><span><strong>단계별 실행</strong><small>매크로처럼 동작을 순서대로 만들고, 막히면 직접 처리하며 이어갑니다.</small></span></label>
          <label className="checkbox-label"><input type="radio" name="crawlerRunMode" value="LEGACY" checked={runMode === "LEGACY"} onChange={() => setRunMode("LEGACY")} /><span><strong>기존 설정 방식</strong><small>로그인·사이트 검색 설정으로 실행합니다. (단계별 실행으로 대체 예정)</small></span></label>
        </fieldset>
        <section className="crawler-config-section">
          <header><span>1</span><div><h2>접속과 로그인</h2><p>일반 사이트 또는 네이버 카페 프리셋으로 접속 정보를 구성합니다.</p></div></header>
          <label className="crawler-full-field">사이트 프리셋<select value={sitePreset} onChange={(event) => applySitePreset(event.target.value as CrawlerSitePreset)}><option value="GENERIC">일반 사이트 · 직접 설정</option><option value="NAVER_CAFE">네이버 카페</option></select></label>
          <label className="checkbox-label crawler-login-toggle crawler-browser-view-toggle"><input type="checkbox" checked={showBrowser} onChange={(event) => setShowBrowser(event.target.checked)} /><span><strong>브라우저 동작 화면 보기</strong><small>기본값 · Chromium을 headless: false로 실행하고 아래에서 진행 화면을 보여줍니다.</small></span></label>
          {showBrowser ? <fieldset className="crawler-full-field crawler-browser-window-choice">
            <legend>브라우저 표시 방식</legend>
            <label className="checkbox-label"><input type="radio" name="browserWindow" value="WEB" checked={browserWindow === "WEB"} onChange={() => setBrowserWindow("WEB")} /><span><strong>웹 화면 안에서 보기</strong><small>아래 실행 화면을 보면서 캡차 등은 웹 화면에서 클릭·입력합니다.</small></span></label>
            <label className="checkbox-label"><input type="radio" name="browserWindow" value="PC_WINDOW" checked={browserWindow === "PC_WINDOW"} onChange={() => setBrowserWindow("PC_WINDOW")} /><span><strong>내 PC에 새 창으로 열기</strong><small>새 브라우저 창에서 로그인·캡차를 직접 처리하고 작업을 이어갑니다. Docker로 실행 중이면 start-pc-chrome.cmd를 먼저 실행하세요.</small></span></label>
          </fieldset> : null}
          <label className="crawler-full-field"><span><RequiredMark /> 수집할 URL</span><input required type="url" value={startUrl} onChange={(event) => setStartUrl(event.target.value)} placeholder="https://example.com/items" /></label>
          {/* [LEGACY-FORM] 기존 설정 방식: 로그인 · 사이트 검색 (단계별 실행으로 옮기면 삭제) */}
          {runMode === "LEGACY" ? (
            <CrawlerLegacyFormFields
              form={legacyForm}
              onChange={updateLegacyForm}
              sitePreset={sitePreset}
              useSavedSession={useSavedSession}
              username={username}
              password={password}
              rememberCredentials={rememberCredentials}
              onUsernameChange={setUsername}
              onPasswordChange={setPassword}
              onRememberCredentialsChange={setRememberCredentials}
            />
          ) : null}
        </section>

        {runMode === "STEPS" ? (
          <CrawlerStepEditor
            steps={steps}
            onChange={setSteps}
            onLoadExample={(exampleSteps) => {
              // 예시는 목록을 자동 감지하도록 수집 설정을 비운다(연습용 .quote 등 이전 값 제거).
              setSteps(exampleSteps);
              setItemSelector("");
              setFields([]);
              setContentFrameSelector("");
              setNextPageSelector("");
              setMaxPages("10");
              setMaxItems("500");
              setWaitMilliseconds("2000");
            }}
            startUrl={startUrl}
            browserWindow={showBrowser ? browserWindow : "WEB"}
            username={username}
            password={password}
            onUsernameChange={setUsername}
            onPasswordChange={setPassword}
            disabled={runPending}
            runBlocked={browserUnavailable}
            onRun={runCrawler}
            onBeforeAddAction={validateBeforeAddAction}
            commonFields={fields}
            commonItemSelector={itemSelector}
            focusProblem={stepFocusRequest}
          />
        ) : null}

        <section className="crawler-config-section">
          <header><span>2</span><div><h2>반복 항목과 필드</h2><p>목록 한 건을 감싸는 선택자와 그 안에서 읽을 값을 정합니다. 둘 다 비우면 화면에서 가장 큰 표·목록을 찾아 열 제목(제목·작성자·작성일 등)을 그대로 필드로 씁니다.</p></div></header>
          <label className="crawler-full-field">콘텐츠 iframe 선택자 <small>일반 페이지는 비워 두세요.</small><input value={contentFrameSelector} onChange={(event) => setContentFrameSelector(event.target.value)} placeholder="예: iframe#cafe_main" /></label>
          <label className="crawler-full-field"><span>반복 항목 선택자 <small>선택 · 비우면 표·목록 자동 감지</small></span><input value={itemSelector} onChange={(event) => setItemSelector(event.target.value)} placeholder="비우면 자동 감지 · 예: .product-item, table tbody tr" /></label>
          <div className="crawler-field-list">
            <div className="crawler-field-heading"><strong>수집 필드 {fields.length === 0 ? "자동 (표의 열 제목 + 링크)" : `${fields.length}개`}</strong><button type="button" className="secondary-button" onClick={() => setFields((currentFields) => [...currentFields, createField()])}>+ 필드 추가</button></div>
            {fields.map((field) => <div className="crawler-field-row" key={field.id}>
              <label><span><RequiredMark /> 필드 이름</span><input required data-field-name-input value={field.name} onChange={(event) => updateField(field.id, { name: event.target.value })} placeholder="예: 상품명" /></label>
              <label>항목 내부 선택자<input value={field.selector} onChange={(event) => updateField(field.id, { selector: event.target.value })} placeholder="비우면 항목 전체" /></label>
              <label>읽을 값<select value={field.valueSource} onChange={(event) => updateField(field.id, { valueSource: event.target.value as CrawlerValueSource })}><option value="TEXT">텍스트</option><option value="ATTRIBUTE">HTML 속성</option></select></label>
              {field.valueSource === "ATTRIBUTE" ? <label><span><RequiredMark /> 속성 이름</span><input required value={field.attributeName} onChange={(event) => updateField(field.id, { attributeName: event.target.value })} placeholder="href, src, data-price" /></label> : <div className="crawler-field-placeholder" />}
              <button type="button" className="danger-button" aria-label={`${field.name} 필드 삭제`} onClick={() => setFields((currentFields) => currentFields.filter((currentField) => currentField.id !== field.id))}>삭제</button>
            </div>)}
          </div>
          <label className="checkbox-label crawler-login-toggle"><input type="checkbox" checked={parseListing} onChange={(event) => setParseListing(event.target.checked)} /><span><strong>제목에서 조건 뽑아 칸으로 나누기</strong><small>보증금(만원)·월세(만원)·방수·전용면적(㎡)·역·도보(분)·층 칸이 추가됩니다. 엑셀에서 바로 정렬하고 거를 수 있습니다. 글마다 표기가 달라 못 읽은 칸은 비어 있고, 상세글을 켜면 본문에서 한 번 더 찾습니다.</small></span></label>
          <label className="checkbox-label crawler-login-toggle"><input type="checkbox" checked={collectDetail} onChange={(event) => setCollectDetail(event.target.checked)} /><span><strong>상세글도 가져오기</strong><small>수집한 글마다 상세 페이지를 엽니다. 한 번 실행에도 많은 요청이 발생해 사이트 제한이나 계정 보호조치가 생길 수 있습니다.</small></span></label>
          {collectDetail ? <label className="crawler-full-field">상세글 본문 선택자 <small>선택 · 비우면 본문 영역을 자동으로 찾습니다(네이버 카페·블로그, article 등).</small><input value={detailSelector} onChange={(event) => setDetailSelector(event.target.value)} placeholder="비우면 자동 · 예: .se-main-container" /></label> : null}
        </section>

        <section className="crawler-config-section">
          <header><span>3</span><div><h2>수집 단계 키워드 조건</h2><p>각 항목의 추출 필드를 읽은 직후 조건을 검사해 일치한 데이터만 결과에 담습니다.</p></div></header>
          <label className="checkbox-label crawler-login-toggle"><input type="checkbox" checked={collectionFilterEnabled} onChange={(event) => setCollectionFilterEnabled(event.target.checked)} /><span><strong>키워드 조건으로 수집 결과 제한</strong><small>끄면 찾은 항목을 모두 수집합니다.</small></span></label>
          {collectionFilterEnabled ? <div className="crawler-keyword-panel">
            <div className="crawler-keyword-toolbar">
              <label>그룹 사이 결합<select value={groupMatchMode} onChange={(event) => setGroupMatchMode(event.target.value as CrawlerMatchMode)}><option value="ALL">AND · 모든 그룹 만족</option><option value="ANY">OR · 한 그룹 이상 만족</option></select></label>
              <button type="button" className="secondary-button" disabled={keywordGroups.length >= 10} onClick={() => setKeywordGroups((currentGroups) => [...currentGroups, createKeywordGroup()])}>+ 키워드 그룹</button>
            </div>
            <p className="crawler-keyword-help">쉼표 또는 줄바꿈으로 키워드를 구분합니다. 예를 들어 그룹 사이를 AND로 두고, 각 그룹을 <code>필수어</code> / <code>노선명</code> / <code>지역 A, 지역 B, 지역 C (OR)</code>처럼 만들 수 있습니다.</p>
            {keywordGroups.map((group, groupIndex) => <div className="crawler-keyword-row" key={group.id}>
              <strong>그룹 {groupIndex + 1}</strong>
              <label>그룹 안 결합<select aria-label={`키워드 그룹 ${groupIndex + 1} 결합 방식`} value={group.matchMode} onChange={(event) => updateKeywordGroup(group.id, { matchMode: event.target.value as CrawlerMatchMode })}><option value="ANY">OR · 하나 이상 포함</option><option value="ALL">AND · 모두 포함</option></select></label>
              <label className="crawler-keyword-input"><span><RequiredMark /> 키워드</span><input required value={group.keywordText} onChange={(event) => updateKeywordGroup(group.id, { keywordText: event.target.value })} placeholder="쉼표로 구분 (예: 키워드 A, 키워드 B)" /></label>
              <button type="button" className="danger-button" aria-label={`키워드 그룹 ${groupIndex + 1} 삭제`} disabled={keywordGroups.length === 1} onClick={() => setKeywordGroups((currentGroups) => currentGroups.filter((currentGroup) => currentGroup.id !== group.id))}>삭제</button>
            </div>)}
          </div> : null}
        </section>

        <section className="crawler-config-section">
          <header><span>4</span><div><h2>페이지 이동과 제한</h2><p>최대 10페이지·500건까지 설정할 수 있지만, 상한값으로 실행하면 요청이 많아질 수 있습니다.</p></div></header>
          <div className="crawler-option-grid">
            <label className="crawler-next-field">다음 페이지 버튼 선택자 <small>선택 · 비우면 페이지 번호(2, 3…)나 ‘다음’ 버튼을 자동으로 찾습니다. 한 페이지만 받으려면 최대 페이지를 1로 두세요.</small><input value={nextPageSelector} onChange={(event) => setNextPageSelector(event.target.value)} placeholder="비우면 자동 · 예: .pagination .next" /></label>
            <label><span><RequiredMark /> 최대 페이지</span><input required type="number" min="1" max="10" value={maxPages} onChange={(event) => setMaxPages(event.target.value)} /></label>
            <label><span><RequiredMark /> 최대 항목</span><input required type="number" min="1" max="500" value={maxItems} onChange={(event) => setMaxItems(event.target.value)} /></label>
            <label><span><RequiredMark /> 페이지 대기(ms)</span><input required type="number" min="0" max="30000" step="100" value={waitMilliseconds} onChange={(event) => setWaitMilliseconds(event.target.value)} /></label>
            <p className="crawler-full-field crawler-step-help"><strong>페이지 대기</strong>는 다음 페이지나 상세글을 열기 전에 쉬는 시간입니다. 간격을 늘려도 계정 보호조치를 막는 안전한 값은 없으며, 사이트가 허용한 수집 범위와 요청 제한을 먼저 확인해야 합니다. 네이버 로그인·보호조치 화면이 나타나면 추가 수집을 중단합니다.</p>
          </div>
          <details className="crawler-selector-help" open><summary>CSS 선택자는 어떻게 찾나요?</summary><ol><li>대상 페이지에서 개발자 도구를 엽니다.</li><li>원하는 요소를 검사하고 반복되는 목록의 공통 클래스를 찾습니다.</li><li>예: 목록 한 건은 <code>.product-item</code>, 제목은 <code>.product-title</code>, 링크는 <code>a</code>의 <code>href</code>입니다.</li></ol></details>
        </section>

        {validationMessage ? <p className="field-error" role="alert">{validationMessage}</p> : null}
        <button className="crawler-run-button" type="submit" disabled={runPending || browserUnavailable}>{runPending ? "Chromium으로 수집하는 중..." : selectedConfigurationId === undefined ? "크롤링 실행" : `#${selectedConfigurationId} 설정 실행 · 이력 저장`}</button>
      </form> : null}

      {editorOpen && requestProblem ? (
        <CrawlerErrorPanel
          problem={requestProblem}
          request={lastSubmittedRun?.request}
          sitePreset={lastSubmittedRun?.sitePreset}
        />
      ) : null}
      {editorOpen && showBrowser && (runPending || requestProblem) ? <CrawlerLiveViewPanel running={runPending} /> : null}
      {editorOpen && runPending ? <div className="portfolio-state-panel">로그인과 페이지 렌더링을 기다리는 중입니다. 여러 페이지를 수집하면 몇 분 걸릴 수 있습니다.</div> : null}

      {/* 새 실행·이력 결과마다 key를 바꿔 결과 검색 조건을 초기화한다. */}
      {response ? <CrawlerResultsPanel key={resultViewKey} response={response} baseline={historyView?.baseline} /> : null}
    </section>
  );
};
