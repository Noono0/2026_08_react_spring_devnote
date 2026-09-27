import { CrawlerNaverSessionPanel } from "@/features/crawler/components/CrawlerNaverSessionPanel";
import { CrawlerSelectorHelpDialog } from "@/features/crawler/components/CrawlerSelectorHelpDialog";
import { RequiredMark } from "@/features/crawler/components/RequiredMark";
import type { CrawlerSitePreset } from "@/features/crawler/types/webCrawlerTypes";
import type { CrawlerLegacyForm } from "@/features/crawler/utils/crawlerLegacyForm";

interface CrawlerLegacyFormFieldsProps {
  form: CrawlerLegacyForm;
  onChange: (patch: Partial<CrawlerLegacyForm>) => void;
  sitePreset: CrawlerSitePreset;
  useSavedSession: boolean;
  username: string;
  password: string;
  rememberCredentials: boolean;
  onUsernameChange: (username: string) => void;
  onPasswordChange: (password: string) => void;
  onRememberCredentialsChange: (rememberCredentials: boolean) => void;
}

/** [LEGACY-FORM] 기존 설정 방식의 로그인·사이트 검색 입력칸. */
export const CrawlerLegacyFormFields = ({
  form,
  onChange,
  sitePreset,
  useSavedSession,
  username,
  password,
  rememberCredentials,
  onUsernameChange,
  onPasswordChange,
  onRememberCredentialsChange,
}: CrawlerLegacyFormFieldsProps) => (
  <>
    <label className="checkbox-label crawler-login-toggle"><input type="checkbox" checked={form.loginEnabled} onChange={(event) => onChange({ loginEnabled: event.target.checked })} /><span><strong>로그인 후 수집</strong><small>폼 로그인에 필요한 CSS 선택자를 직접 입력합니다.</small></span></label>
    {form.loginEnabled && sitePreset === "NAVER_CAFE" ? (
      <CrawlerNaverSessionPanel
        preferSavedSession={form.preferSavedSession}
        onPreferSavedSessionChange={(preferSavedSession) => onChange({ preferSavedSession })}
      />
    ) : null}
    {form.loginEnabled && !useSavedSession ? <div className="crawler-login-panel">
      <label className="crawler-full-field"><span><RequiredMark /> 로그인 URL</span><input required type="url" value={form.loginUrl} onChange={(event) => onChange({ loginUrl: event.target.value })} placeholder="https://example.com/login" /></label>
      <label><span><RequiredMark /> 아이디</span><input required autoComplete="off" value={username} onChange={(event) => onUsernameChange(event.target.value)} /></label>
      <label><span><RequiredMark /> 비밀번호</span><small>요청대로 화면에 그대로 표시됩니다.</small><input required type="text" autoComplete="off" value={password} onChange={(event) => onPasswordChange(event.target.value)} /></label>
      <label className="checkbox-label crawler-login-toggle crawler-remember-credentials"><input type="checkbox" checked={rememberCredentials} onChange={(event) => onRememberCredentialsChange(event.target.checked)} /><span><strong>아이디와 비밀번호 저장</strong><small>체크하면 실패 후에도 지워지지 않고 다음 접속 때 다시 불러옵니다.</small></span></label>
      {rememberCredentials ? <p className="crawler-credential-warning" role="note">주의: 아이디와 비밀번호가 이 브라우저의 localStorage에 암호화 없이 저장됩니다. 공용 PC에서는 사용하지 마세요.</p> : null}
      <label><span><RequiredMark /> 아이디 입력칸 선택자</span><input required value={form.usernameSelector} onChange={(event) => onChange({ usernameSelector: event.target.value })} /></label>
      <label><span><RequiredMark /> 비밀번호 입력칸 선택자</span><input required value={form.passwordSelector} onChange={(event) => onChange({ passwordSelector: event.target.value })} /></label>
      <label><span><RequiredMark /> 로그인 버튼 선택자</span><input required value={form.submitSelector} onChange={(event) => onChange({ submitSelector: event.target.value })} /></label>
      <label>로그인 완료 선택자 <small>선택 사항</small><input value={form.loggedInSelector} onChange={(event) => onChange({ loggedInSelector: event.target.value })} placeholder="예: .profile-menu" /></label>
    </div> : null}
    <label className="checkbox-label crawler-login-toggle"><input type="checkbox" checked={form.pageSearchEnabled} onChange={(event) => onChange({ pageSearchEnabled: event.target.checked })} /><span><strong>사이트 검색 후 수집</strong><small>사이트 검색창에 먼저 검색어를 입력한 뒤 결과 목록을 수집합니다.</small></span></label>
    {form.pageSearchEnabled ? <div className="crawler-login-panel">
      <label className="crawler-full-field"><span><RequiredMark /> 사이트 검색어</span><input required value={form.pageSearchKeyword} onChange={(event) => onChange({ pageSearchKeyword: event.target.value })} placeholder="예: LH" /></label>
      <div className="crawler-form-field">
        <div className="crawler-field-label-row">
          <label htmlFor="crawler-search-input-selector">검색 입력칸 선택자</label>
          <CrawlerSelectorHelpDialog />
        </div>
        <small>선택 사항 · 비우면 화면에 보이는 검색창(type=search, 제목·안내문에 ‘검색’/search가 들어간 입력칸 등)을 자동으로 찾습니다.</small>
        <input id="crawler-search-input-selector" value={form.searchInputSelector} onChange={(event) => onChange({ searchInputSelector: event.target.value })} placeholder="비우면 자동 탐색 · 예: input[title='카페글 검색어 입력']" />
      </div>
      <label>검색 버튼 선택자 <small>비우면 Enter</small><input value={form.searchSubmitSelector} onChange={(event) => onChange({ searchSubmitSelector: event.target.value })} placeholder="예: button.search" /></label>
    </div> : null}
  </>
);
