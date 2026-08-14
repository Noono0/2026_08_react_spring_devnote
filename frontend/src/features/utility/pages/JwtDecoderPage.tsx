import { useMemo, useState } from "react";
import { UtilityHelpDialog, UtilityPageTitle } from "@/features/utility/components/UtilityHelpDialog";
import { copyText } from "@/features/utility/utils/browserFileUtils";
import { decodeJwt } from "@/features/utility/utils/jwtDecoder";
import { applicationNotification } from "@/shared/notification/applicationNotification";

const base64Url = (value: object): string => btoa(unescape(encodeURIComponent(JSON.stringify(value)))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const exampleToken = `${base64Url({ alg: "HS256", typ: "JWT" })}.${base64Url({ sub: "devnote-user", role: "USER", iat: 1786622400, exp: 1786626000 })}.example-signature`;
const stateLabels = { VALID_TIME: "시간 조건상 사용 가능", EXPIRED: "만료됨", NOT_ACTIVE: "아직 유효하지 않음", NO_TIME_CLAIMS: "시간 Claim 없음" } as const;

export const JwtDecoderPage = () => {
  const [source, setSource] = useState(exampleToken);
  const [helpOpen, setHelpOpen] = useState(false);
  const decodedState = useMemo(() => {
    try { return { decoded: decodeJwt(source), error: "" }; }
    catch (error) { return { decoded: undefined, error: error instanceof Error ? error.message : "JWT를 디코딩하지 못했습니다." }; }
  }, [source]);
  const decoded = decodedState.decoded;

  return (
    <section className="site-page utility-workbench-page">
      <UtilityPageTitle kicker="Developer Utility · Token Inspector" title="JWT Decoder" description="JWT Header와 Payload를 브라우저에서만 디코딩하고 시간 Claim을 읽기 쉽게 확인합니다." onHelpOpen={() => setHelpOpen(true)} />
      <div className="jwt-security-notice"><strong>서명 검증이 아닙니다</strong><p>내용을 Base64URL로 읽는 기능이며 토큰이 신뢰할 수 있다는 뜻이 아닙니다. 비밀키 입력이나 토큰 위조 기능은 제공하지 않습니다.</p></div>
      <label className="jwt-input-field"><span>JWT 또는 Bearer Token</span><textarea aria-label="JWT 또는 Bearer Token" value={source} spellCheck={false} autoComplete="off" onChange={(event) => setSource(event.target.value)} /></label>
      {decodedState.error ? <p className="field-error" role="alert">{decodedState.error}</p> : null}
      {decoded ? <>
        <div className="jwt-state-row"><span className={`jwt-state ${decoded.state.toLowerCase()}`}>{stateLabels[decoded.state]}</span><span>서명 데이터 {decoded.signature.length.toLocaleString("ko-KR")}자</span><button type="button" className="ghost-button" onClick={() => setSource("")}>초기화</button></div>
        <div className="jwt-parts-grid">
          <section className="tool-result-card"><header><h2>Header</h2><button type="button" className="ghost-button" onClick={() => void copyText(JSON.stringify(decoded.header, null, 2)).then(() => applicationNotification.success("Header를 복사했습니다."))}>복사</button></header><pre>{JSON.stringify(decoded.header, null, 2)}</pre></section>
          <section className="tool-result-card"><header><h2>Payload</h2><button type="button" className="ghost-button" onClick={() => void copyText(JSON.stringify(decoded.payload, null, 2)).then(() => applicationNotification.success("Payload를 복사했습니다."))}>복사</button></header><pre>{JSON.stringify(decoded.payload, null, 2)}</pre></section>
        </div>
        <section className="jwt-claims-panel"><h2>시간 Claim</h2>{decoded.timeClaims.length === 0 ? <div className="portfolio-state-panel">iat, exp, nbf Claim이 없습니다.</div> : <div>{decoded.timeClaims.map((claim) => <article key={claim.name}><code>{claim.name}</code><strong>{claim.rawValue}</strong><span>{claim.date}</span></article>)}</div>}</section>
      </> : null}
      <UtilityHelpDialog isOpen={helpOpen} title="JWT Decoder" description="JWT 세 부분 중 Header와 Payload만 디코딩합니다." onClose={() => setHelpOpen(false)}>
        <article><h3>사용 방법</h3><ol><li>JWT 또는 `Bearer ` 접두사가 붙은 값을 붙여넣습니다.</li><li>Header의 알고리즘과 Payload의 Claim을 확인합니다.</li><li>exp·nbf 상태와 변환된 날짜를 확인합니다.</li></ol></article>
        <article><h3>학습 포인트</h3><p>JWT는 점으로 구분된 Base64URL 문자열입니다. Base64는 암호화가 아니므로 누구나 Payload를 읽을 수 있습니다.</p></article>
        <article><h3>보안</h3><p>토큰은 서버, DB, localStorage, URL, console로 보내거나 저장하지 않습니다. 운영 토큰은 가능하면 붙여넣지 마세요.</p></article>
      </UtilityHelpDialog>
    </section>
  );
};

