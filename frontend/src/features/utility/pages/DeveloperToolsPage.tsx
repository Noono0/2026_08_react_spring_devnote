import { useMemo, useState } from "react";
import { UtilityHelpDialog, UtilityPageTitle } from "@/features/utility/components/UtilityHelpDialog";
import { copyText } from "@/features/utility/utils/browserFileUtils";
import { convertCase, type ConvertedCases } from "@/features/utility/utils/caseConverter";
import { decodeBase64Unicode, encodeBase64Unicode, generateSafePassword, hexToRgb, httpStatuses, rgbToHsl, sha256Hex } from "@/features/utility/utils/quickTools";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { createUuid } from "@/shared/lib/createUuid";

const convertedCaseFields: Array<{ key: keyof ConvertedCases; label: string }> = [
  { key: "camel", label: "camelCase" }, { key: "pascal", label: "PascalCase" }, { key: "snake", label: "snake_case" },
  { key: "kebab", label: "kebab-case" }, { key: "constant", label: "CONSTANT_CASE" },
];

export const DeveloperToolsPage = () => {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [sharedSourceEnabled, setSharedSourceEnabled] = useState(false);
  const [sharedSource, setSharedSource] = useState("DevNote 공통 문자열");
  const [caseSource, setCaseSource] = useState("devnote developer tools 한글");
  const [base64Source, setBase64Source] = useState("DevNote Base64 문자열");
  const [hashSource, setHashSource] = useState("DevNote SHA-256 문자열");
  const [jsonStringSource, setJsonStringSource] = useState("DevNote\nJSON 문자열");
  const [base64Value, setBase64Value] = useState("");
  const [hash, setHash] = useState("");
  const [timestamp, setTimestamp] = useState(() => Math.floor(Date.now() / 1000));
  const [timeZone, setTimeZone] = useState("Asia/Seoul");
  const [color, setColor] = useState("#6366f1");
  const [passwordLength, setPasswordLength] = useState(20);
  const [password, setPassword] = useState(() => generateSafePassword(20));
  const [statusKeyword, setStatusKeyword] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const activeCaseSource = sharedSourceEnabled ? sharedSource : caseSource;
  const activeBase64Source = sharedSourceEnabled ? sharedSource : base64Source;
  const activeHashSource = sharedSourceEnabled ? sharedSource : hashSource;
  const activeJsonStringSource = sharedSourceEnabled ? sharedSource : jsonStringSource;
  const converted = useMemo(() => convertCase(activeCaseSource), [activeCaseSource]);
  const colorResult = useMemo(() => { try { const rgb = hexToRgb(color); return { rgb, hsl: rgbToHsl(rgb.red, rgb.green, rgb.blue), error: "" }; } catch (error) { return { rgb: undefined, hsl: undefined, error: error instanceof Error ? error.message : "색상을 변환하지 못했습니다." }; } }, [color]);
  const visible = (keywords: string): boolean => keywords.toLocaleLowerCase().includes(searchKeyword.trim().toLocaleLowerCase());
  const filteredStatuses = httpStatuses.filter((status) => `${status.code} ${status.name} ${status.meaning}`.toLocaleLowerCase().includes(statusKeyword.toLocaleLowerCase()));
  const copy = (text: string, message: string): void => { void copyText(text).then(() => applicationNotification.success(message)); };
  const updateSharedSource = (nextSource: string): void => {
    setSharedSource(nextSource);
    setBase64Value("");
  };
  const toggleSharedSource = (): void => {
    if (sharedSourceEnabled) {
      setCaseSource(sharedSource);
      setBase64Source(sharedSource);
      setHashSource(sharedSource);
      setJsonStringSource(sharedSource);
    }
    setBase64Value("");
    setSharedSourceEnabled((currentEnabled) => !currentEnabled);
  };

  return (
    <section className="site-page utility-workbench-page">
      <UtilityPageTitle kicker="Developer Utility · Small Toolbox" title="Quick Tools" description="작지만 자주 찾는 인코딩·해시·시간·색상·문자열 도구를 검색 가능한 한 화면에 모았습니다." onHelpOpen={() => setHelpOpen(true)} />
      <label className="quick-tool-search"><span>도구 검색</span><input type="search" value={searchKeyword} placeholder="예: UUID, Base64, SHA, 색상" onChange={(event) => setSearchKeyword(event.target.value)} /></label>
      <section className="quick-tool-shared-source" aria-labelledby="quick-tool-shared-source-title">
        <header>
          <div><h2 id="quick-tool-shared-source-title">공통 문자열 입력</h2><p>공유를 켜면 아래 문자열 도구 네 곳이 이 값을 함께 사용합니다.</p></div>
          <button type="button" role="switch" aria-label="문자열 도구 공통 입력 공유" aria-checked={sharedSourceEnabled} className={sharedSourceEnabled ? "quick-tool-share-toggle active" : "quick-tool-share-toggle"} onClick={toggleSharedSource}>공유 <strong>{sharedSourceEnabled ? "ON" : "OFF"}</strong></button>
        </header>
        <label>공통 원본<textarea rows={4} value={sharedSource} placeholder="여러 문자열 도구에서 함께 사용할 내용을 입력하세요." onChange={(event) => updateSharedSource(event.target.value)} /></label>
        <small>{sharedSourceEnabled ? "케이스 변환 · Base64/URL · SHA-256 · JSON Escape가 지금 이 값을 공유합니다." : "공유 OFF 상태에서는 각 도구의 원본을 따로 편집할 수 있습니다."}</small>
      </section>
      <div className="developer-tool-grid quick-tool-grid">
        {visible("문자열 케이스 camel pascal snake kebab constant naming") ? <article className="tool-panel"><header><h2>문자열 케이스 변환</h2><span>Aa</span></header><label><span className="quick-tool-field-label">원본{sharedSourceEnabled ? <small>공통 입력 사용 중</small> : null}</span><textarea rows={4} value={activeCaseSource} onChange={(event) => sharedSourceEnabled ? updateSharedSource(event.target.value) : setCaseSource(event.target.value)} /></label>{convertedCaseFields.map((field) => <div className="case-result-field" key={field.key}><label htmlFor={`case-result-${field.key}`}>{field.label}</label><div className="input-copy-row case-result-row"><textarea id={`case-result-${field.key}`} className="case-result-textarea" rows={3} value={converted[field.key]} readOnly /><button type="button" className="ghost-button" onClick={() => copy(converted[field.key], `${field.label}를 복사했습니다.`)}>복사</button></div></div>)}</article> : null}
        {visible("Base64 URL Encode Decode 인코딩 디코딩") ? <article className="tool-panel"><header><h2>Base64 · URL</h2><span>64</span></header><label><span className="quick-tool-field-label">원본{sharedSourceEnabled ? <small>공통 입력 사용 중</small> : null}</span><textarea value={activeBase64Source} onChange={(event) => { if (sharedSourceEnabled) updateSharedSource(event.target.value); else setBase64Source(event.target.value); setBase64Value(""); }} /></label><div className="tool-action-row"><button type="button" onClick={() => setBase64Value(encodeBase64Unicode(activeBase64Source))}>Base64 Encode</button><button type="button" className="ghost-button" onClick={() => { try { const decodedSource = decodeBase64Unicode(base64Value || encodeBase64Unicode(activeBase64Source)); if (sharedSourceEnabled) updateSharedSource(decodedSource); else setBase64Source(decodedSource); setBase64Value(""); } catch { applicationNotification.warning("올바른 Base64를 입력해 주세요."); } }}>Base64 Decode</button></div><label>Base64<textarea value={base64Value || encodeBase64Unicode(activeBase64Source)} onChange={(event) => setBase64Value(event.target.value)} /></label><label>URL Encode<div className="input-copy-row"><input readOnly value={encodeURIComponent(activeBase64Source)} /><button type="button" className="ghost-button" onClick={() => copy(encodeURIComponent(activeBase64Source), "URL Encode 결과를 복사했습니다.")}>복사</button></div></label><button type="button" className="ghost-button" onClick={() => { try { const decodedSource = decodeURIComponent(activeBase64Source); if (sharedSourceEnabled) updateSharedSource(decodedSource); else setBase64Source(decodedSource); } catch { applicationNotification.warning("올바른 URL 인코딩 문자열을 입력해 주세요."); } }}>현재 원본을 URL Decode</button></article> : null}
        {visible("UUID SHA-256 파일 체크섬 hash") ? <article className="tool-panel"><header><h2>UUID · SHA-256</h2><span>#</span></header><label><span className="quick-tool-field-label">문자열 원본{sharedSourceEnabled ? <small>공통 입력 사용 중</small> : null}</span><textarea value={activeHashSource} onChange={(event) => sharedSourceEnabled ? updateSharedSource(event.target.value) : setHashSource(event.target.value)} /></label><button type="button" onClick={() => { const uuid = createUuid(); setHash(uuid); copy(uuid, "UUID를 생성하고 복사했습니다."); }}>UUID v4 생성</button><button type="button" className="ghost-button" onClick={() => void sha256Hex(activeHashSource).then(setHash)}>현재 문자열 SHA-256</button><label className="file-button secondary-button">파일 체크섬<input type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.arrayBuffer().then(sha256Hex).then(setHash); }} /></label><label>결과<textarea readOnly value={hash} /></label><button type="button" className="ghost-button" disabled={!hash} onClick={() => copy(hash, "결과를 복사했습니다.")}>복사</button></article> : null}
        {visible("Unix Timestamp 날짜 시간 타임존") ? <article className="tool-panel"><header><h2>Unix Timestamp · Timezone</h2><span>⏱</span></header><label>초 단위 Timestamp<input type="number" value={timestamp} onChange={(event) => setTimestamp(Number(event.target.value))} /></label><label>표시 시간대<select value={timeZone} onChange={(event) => setTimeZone(event.target.value)}><option value="Asia/Seoul">Asia/Seoul</option><option value="UTC">UTC</option><option value="America/New_York">America/New_York</option><option value="Europe/London">Europe/London</option><option value="Asia/Tokyo">Asia/Tokyo</option></select></label><label>선택 시간대<input readOnly value={Number.isFinite(timestamp) ? new Date(timestamp * 1000).toLocaleString("ko-KR", { timeZone }) : "올바른 숫자를 입력하세요."} /></label><label>브라우저 로컬 시간<input readOnly value={Number.isFinite(timestamp) ? new Date(timestamp * 1000).toLocaleString("ko-KR") : ""} /></label><label>ISO 8601<input readOnly value={Number.isFinite(timestamp) ? new Date(timestamp * 1000).toISOString() : ""} /></label><button type="button" className="ghost-button" onClick={() => setTimestamp(Math.floor(Date.now() / 1000))}>현재 시각</button></article> : null}
        {visible("JSON String Escape Unescape 문자열 이스케이프") ? <article className="tool-panel"><header><h2>JSON String Escape</h2><span>\"</span></header><label><span className="quick-tool-field-label">원본{sharedSourceEnabled ? <small>공통 입력 사용 중</small> : null}</span><textarea value={activeJsonStringSource} onChange={(event) => sharedSourceEnabled ? updateSharedSource(event.target.value) : setJsonStringSource(event.target.value)} /></label><label>Escape 결과<textarea readOnly value={JSON.stringify(activeJsonStringSource)} /></label><div className="tool-action-row"><button type="button" className="ghost-button" onClick={() => copy(JSON.stringify(activeJsonStringSource), "Escape 결과를 복사했습니다.")}>복사</button><button type="button" className="ghost-button" onClick={() => { try { const parsed: unknown = JSON.parse(activeJsonStringSource); if (typeof parsed !== "string") throw new Error(); if (sharedSourceEnabled) updateSharedSource(parsed); else setJsonStringSource(parsed); } catch { applicationNotification.warning("JSON 문자열 형태를 입력해 주세요."); } }}>입력을 Unescape</button></div></article> : null}
        {visible("HEX RGB HSL 색상 color") ? <article className="tool-panel"><header><h2>HEX · RGB · HSL</h2><span className="color-swatch" style={{ background: color }} /></header><label>HEX<input value={color} onChange={(event) => setColor(event.target.value)} /></label>{colorResult.error ? <p className="field-error">{colorResult.error}</p> : <><label>RGB<input readOnly value={`rgb(${colorResult.rgb?.red}, ${colorResult.rgb?.green}, ${colorResult.rgb?.blue})`} /></label><label>HSL<input readOnly value={`hsl(${colorResult.hsl?.hue} ${colorResult.hsl?.saturation}% ${colorResult.hsl?.lightness}%)`} /></label></>}</article> : null}
        {visible("비밀번호 password generator 안전 생성") ? <article className="tool-panel"><header><h2>안전한 비밀번호 생성</h2><span>•••</span></header><label>길이<input type="number" min={12} max={128} value={passwordLength} onChange={(event) => setPasswordLength(Number(event.target.value))} /></label><label>생성 결과<input readOnly value={password} /></label><div className="tool-action-row"><button type="button" onClick={() => { try { setPassword(generateSafePassword(passwordLength)); } catch (error) { applicationNotification.warning(error instanceof Error ? error.message : "길이를 확인해 주세요."); } }}>새로 생성</button><button type="button" className="ghost-button" onClick={() => copy(password, "비밀번호를 복사했습니다.")}>복사</button></div><p>crypto.getRandomValues를 사용하며 저장하지 않습니다.</p></article> : null}
        {visible("HTTP 상태 코드 status 200 404 500") ? <article className="tool-panel quick-status-tool"><header><h2>HTTP 상태 코드</h2><span>HTTP</span></header><label>검색<input type="search" value={statusKeyword} placeholder="404 또는 Not Found" onChange={(event) => setStatusKeyword(event.target.value)} /></label><ul>{filteredStatuses.map((status) => <li key={status.code}><strong>{status.code}</strong><span>{status.name}</span><small>{status.meaning}</small></li>)}</ul></article> : null}
      </div>
      <UtilityHelpDialog isOpen={helpOpen} title="Quick Tools" description="작은 기능을 메뉴로 흩뜨리지 않고 검색 가능한 카드로 구성했습니다." onClose={() => setHelpOpen(false)}><article><h3>포함 도구</h3><p>naming case, Base64, URL Encode·Decode, UUID, SHA-256·파일 체크섬, Unix Timestamp, JSON String Escape, HEX·RGB·HSL, 비밀번호 생성, HTTP 상태 검색을 제공합니다.</p></article><article><h3>보안</h3><p>해시, 파일, 비밀번호는 브라우저 Web API로 처리합니다. 생성된 비밀번호도 화면을 새로고침하면 사라집니다.</p></article></UtilityHelpDialog>
    </section>
  );
};
