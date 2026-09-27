import { useEffect, useRef, useState, type FormEvent } from "react";
import {
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

const parseKeywords = (keywordText: string): string[] => [...new Set(
  keywordText.split(/[,\n]/).map((keyword) => keyword.trim()).filter(Boolean),
)];

/** STEPS: 단계별 실행(새 방식) · LEGACY: [LEGACY-FORM] 기존 설정 방식(로그인·검색 설정). 마지막 선택을 기억한다. */
type CrawlerRunMode = "STEPS" | "LEGACY";
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
  const [waitMilliseconds, setWaitMilliseconds] = useState("500");
  const [validationMessage, setValidationMessage] = useState("");
  const [selectedConfigurationId, setSelectedConfigurationId] = useState<number>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [historyResponse, setHistoryResponse] = useState<CrawlerRunResponse>();
  const [resultViewKey, setResultViewKey] = useState(0);
  const [lastSubmittedRun, setLastSubmittedRun] = useState<{
    request: CrawlerRunRequest;
    sitePreset: CrawlerSitePreset;
  }>();
  const naverSessionQuery = useNaverCrawlerSessionStatus(sitePreset === "NAVER_CAFE");
  const useSavedSession = legacyForm.loginEnabled
    && sitePreset === "NAVER_CAFE"
    && legacyForm.preferSavedSession
    && naverSessionQuery.data?.available === true;

  useEffect(() => {
    if (rememberCredentials) {
      saveCrawlerCredentials({ username, password });
      return;
    }
    clearCrawlerCredentials();
  }, [password, rememberCredentials, username]);

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
    setHistoryResponse(undefined);
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

  const showStepProblem = (problem: StepProblem): void => {
    setValidationMessage(problem.message);
    setStepFocusRequest({ ...problem, requestId: ++stepFocusRequestId.current });
  };

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

  const runCrawler = (test: boolean): void => {
    const configured = buildCrawlerRequest();
    if (!configured) return;
    const request = test ? { ...configured, maxPages: 1, maxItems: Math.min(configured.maxItems, 3) } : configured;
    setLastSubmittedRun({ request, sitePreset });
    setResultViewKey((currentKey) => currentKey + 1);
    setHistoryResponse(undefined);
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

  const response = historyResponse ?? trackedCrawlerMutation.data?.result ?? crawlerMutation.data;
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
          <h1>웹 크롤링 도구</h1>
          <p>로그인 세션으로 페이지를 열고 CSS 선택자로 데이터를 수집한 뒤, 결과 필드에 원하는 검색 조건을 조합합니다.</p>
        </div>
        <div className="crawler-runtime-badge"><strong>Chromium · 격리 실행</strong><span>선택한 경우에만 이 브라우저에 로그인 정보 저장</span></div>
      </div>

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
        onSelect={(configurationId) => { setSelectedConfigurationId(configurationId); setHistoryResponse(undefined); }}
        onOpenEditor={() => setEditorOpen(true)}
        onCloseEditor={() => { setEditorOpen(false); setValidationMessage(""); }}
        onShowHistoryResult={(result) => { setHistoryResponse(result); setResultViewKey((currentKey) => currentKey + 1); }}
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
          <label className="checkbox-label crawler-login-toggle"><input type="checkbox" checked={collectDetail} onChange={(event) => setCollectDetail(event.target.checked)} /><span><strong>상세글도 가져오기</strong><small>목록을 다 모은 뒤 각 글의 링크를 열어 본문을 ‘상세내용’ 칸에 담습니다. 글 수만큼 페이지를 열어서 시간이 오래 걸립니다(150건 ≈ 5~8분).</small></span></label>
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
          <header><span>4</span><div><h2>페이지 이동과 제한</h2><p>과도한 요청을 막기 위해 한 번에 최대 10페이지·일치 결과 500건만 수집합니다.</p></div></header>
          <div className="crawler-option-grid">
            <label className="crawler-next-field">다음 페이지 버튼 선택자 <small>선택 · 비우면 페이지 번호(2, 3…)나 ‘다음’ 버튼을 자동으로 찾습니다. 한 페이지만 받으려면 최대 페이지를 1로 두세요.</small><input value={nextPageSelector} onChange={(event) => setNextPageSelector(event.target.value)} placeholder="비우면 자동 · 예: .pagination .next" /></label>
            <label><span><RequiredMark /> 최대 페이지</span><input required type="number" min="1" max="10" value={maxPages} onChange={(event) => setMaxPages(event.target.value)} /></label>
            <label><span><RequiredMark /> 최대 항목</span><input required type="number" min="1" max="500" value={maxItems} onChange={(event) => setMaxItems(event.target.value)} /></label>
            <label><span><RequiredMark /> 페이지 대기(ms)</span><input required type="number" min="0" max="30000" step="100" value={waitMilliseconds} onChange={(event) => setWaitMilliseconds(event.target.value)} /></label>
            <p className="crawler-full-field crawler-step-help"><strong>페이지 대기</strong>는 요청 간격이기도 합니다. 다음 페이지로 넘기기 전, 상세글을 하나 열기 전마다 이만큼 쉽니다. 너무 짧으면 상대 사이트에 요청이 몰리고 짧은 시간에 많이 요청해 차단될 수 있습니다. <strong>권장: 목록만 받을 때 1500~2000ms, 상세글까지 받을 때 2000~3000ms.</strong> 상세글 150건을 2000ms로 받으면 쉬는 시간만 약 5분이 더 걸립니다.</p>
          </div>
          <details className="crawler-selector-help" open><summary>CSS 선택자는 어떻게 찾나요?</summary><ol><li>대상 페이지에서 개발자 도구를 엽니다.</li><li>원하는 요소를 검사하고 반복되는 목록의 공통 클래스를 찾습니다.</li><li>예: 목록 한 건은 <code>.product-item</code>, 제목은 <code>.product-title</code>, 링크는 <code>a</code>의 <code>href</code>입니다.</li></ol></details>
        </section>

        {validationMessage ? <p className="field-error" role="alert">{validationMessage}</p> : null}
        <button className="crawler-run-button" type="submit" disabled={runPending}>{runPending ? "Chromium으로 수집하는 중..." : selectedConfigurationId === undefined ? "크롤링 실행" : `#${selectedConfigurationId} 설정 실행 · 이력 저장`}</button>
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
      {response ? <CrawlerResultsPanel key={resultViewKey} response={response} /> : null}
    </section>
  );
};
