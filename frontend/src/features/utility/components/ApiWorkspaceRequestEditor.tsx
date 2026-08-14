import type {
  ApiWorkspaceFormDataEntry,
  ApiWorkspaceRequest,
  RequestBodyType,
  RequestEditorSection,
} from "@/features/utility/types/apiWorkspaceTypes";
import { createEmptyFormDataEntry } from "@/features/utility/utils/apiWorkspaceUtils";
import { ApiKeyValueEditor } from "@/features/utility/components/ApiKeyValueEditor";

interface ApiWorkspaceRequestEditorProps {
  request: ApiWorkspaceRequest;
  activeSection: RequestEditorSection;
  onSectionChange: (section: RequestEditorSection) => void;
  onRequestChange: (request: ApiWorkspaceRequest) => void;
}

const requestSections: Array<{ value: RequestEditorSection; label: string }> = [
  { value: "PARAMS", label: "Params" },
  { value: "AUTHORIZATION", label: "Authorization" },
  { value: "HEADERS", label: "Headers" },
  { value: "BODY", label: "Body" },
];

const bodyTypes: Array<{ value: RequestBodyType; label: string }> = [
  { value: "NONE", label: "none" },
  { value: "JSON", label: "JSON" },
  { value: "TEXT", label: "Text" },
  { value: "FORM_URLENCODED", label: "x-www-form-urlencoded" },
  { value: "FORM_DATA", label: "form-data" },
];

export const ApiWorkspaceRequestEditor = ({ request, activeSection, onSectionChange, onRequestChange }: ApiWorkspaceRequestEditorProps) => {
  const updateRequest = (changes: Partial<ApiWorkspaceRequest>): void => onRequestChange({ ...request, ...changes });
  const updateFormDataEntry = (entryId: string, changes: Partial<ApiWorkspaceFormDataEntry>): void => {
    updateRequest({ formData: request.formData.map((entry) => entry.id === entryId ? { ...entry, ...changes } : entry) });
  };
  const removeFormDataEntry = (entryId: string): void => {
    const remainingEntries = request.formData.filter((entry) => entry.id !== entryId);
    updateRequest({ formData: remainingEntries.length > 0 ? remainingEntries : [createEmptyFormDataEntry()] });
  };

  return (
    <section className="api-request-editor">
      <div className="api-editor-tabs" role="tablist" aria-label="요청 설정">
        {requestSections.map((section) => (
          <button key={section.value} type="button" role="tab" aria-selected={activeSection === section.value} className={activeSection === section.value ? "active" : undefined} onClick={() => onSectionChange(section.value)}>
            {section.label}
            {section.value === "PARAMS" && request.params.some((entry) => entry.enabled && entry.key) ? <span>{request.params.filter((entry) => entry.enabled && entry.key).length}</span> : null}
            {section.value === "HEADERS" && request.headers.some((entry) => entry.enabled && entry.key) ? <span>{request.headers.filter((entry) => entry.enabled && entry.key).length}</span> : null}
          </button>
        ))}
      </div>

      <div className="api-request-editor-content">
        {activeSection === "PARAMS" ? <ApiKeyValueEditor entries={request.params} keyLabel="Query Key" valueLabel="Value" emptyMessage="Query Parameter가 없습니다." onChange={(params) => updateRequest({ params })} /> : null}

        {activeSection === "HEADERS" ? <ApiKeyValueEditor entries={request.headers} keyLabel="Header" valueLabel="Value" emptyMessage="Request Header가 없습니다." onChange={(headers) => updateRequest({ headers })} /> : null}

        {activeSection === "AUTHORIZATION" ? (
          <div className="api-authorization-editor">
            <label>인증 방식
              <select value={request.authorization.type} onChange={(event) => updateRequest({ authorization: { ...request.authorization, type: event.target.value as ApiWorkspaceRequest["authorization"]["type"] } })}>
                <option value="NONE">No Auth</option>
                <option value="BEARER">Bearer Token</option>
                <option value="BASIC">Basic Auth</option>
                <option value="API_KEY">API Key</option>
              </select>
            </label>
            <div className="api-auth-fields">
              {request.authorization.type === "NONE" ? <div className="api-inline-notice"><strong>인증을 사용하지 않습니다.</strong><p>로그인 세션이 필요한 현재 프로젝트 API는 브라우저 Cookie가 함께 전송됩니다.</p></div> : null}
              {request.authorization.type === "BEARER" ? <label>Token<input type="password" autoComplete="off" value={request.authorization.bearerToken} placeholder="토큰은 저장되지 않습니다." onChange={(event) => updateRequest({ authorization: { ...request.authorization, bearerToken: event.target.value } })} /></label> : null}
              {request.authorization.type === "BASIC" ? <><label>Username<input autoComplete="off" value={request.authorization.username} onChange={(event) => updateRequest({ authorization: { ...request.authorization, username: event.target.value } })} /></label><label>Password<input type="password" autoComplete="new-password" value={request.authorization.password} onChange={(event) => updateRequest({ authorization: { ...request.authorization, password: event.target.value } })} /></label></> : null}
              {request.authorization.type === "API_KEY" ? <><label>Key<input value={request.authorization.apiKeyName} onChange={(event) => updateRequest({ authorization: { ...request.authorization, apiKeyName: event.target.value } })} /></label><label>Value<input type="password" autoComplete="off" value={request.authorization.apiKeyValue} onChange={(event) => updateRequest({ authorization: { ...request.authorization, apiKeyValue: event.target.value } })} /></label><label>추가 위치<select value={request.authorization.apiKeyLocation} onChange={(event) => updateRequest({ authorization: { ...request.authorization, apiKeyLocation: event.target.value as "HEADER" | "QUERY" } })}><option value="HEADER">Header</option><option value="QUERY">Query Parameter</option></select></label></> : null}
            </div>
            <p className="api-secret-note">Authorization, Cookie, API Key는 열린 탭 복구와 History에 원문으로 저장하지 않습니다.</p>
          </div>
        ) : null}

        {activeSection === "BODY" ? (
          <div className="api-body-editor">
            <div className="api-body-type-row" role="radiogroup" aria-label="Request Body 형식">
              {bodyTypes.map((bodyType) => <label key={bodyType.value}><input type="radio" name="request-body-type" value={bodyType.value} checked={request.bodyType === bodyType.value} onChange={() => updateRequest({ bodyType: bodyType.value })} />{bodyType.label}</label>)}
            </div>
            {request.bodyType === "NONE" ? <div className="api-inline-notice"><strong>Body가 없는 요청입니다.</strong><p>GET·HEAD 요청은 일반적으로 Body를 보내지 않습니다.</p></div> : null}
            {request.bodyType === "JSON" || request.bodyType === "TEXT" ? <textarea className="api-code-editor" value={request.bodyText} spellCheck={false} aria-label={`${request.bodyType} Request Body`} placeholder={request.bodyType === "JSON" ? '{\n  "title": "DevNote"\n}' : "전송할 텍스트를 입력하세요."} onChange={(event) => updateRequest({ bodyText: event.target.value })} /> : null}
            {request.bodyType === "FORM_URLENCODED" ? <ApiKeyValueEditor entries={request.formData} keyLabel="Field" valueLabel="Value" emptyMessage="Form Field가 없습니다." onChange={(entries) => updateRequest({ formData: entries.map((entry) => ({ ...entry, valueType: "TEXT" as const })) })} /> : null}
            {request.bodyType === "FORM_DATA" ? (
              <div className="api-key-value-editor">
                <div className="api-grid-heading api-form-data-heading" aria-hidden="true"><span>사용</span><span>Key</span><span>Type</span><span>Value</span><span>삭제</span></div>
                {request.formData.map((entry, entryIndex) => (
                  <div className="api-key-value-row api-form-data-row" key={entry.id}>
                    <input type="checkbox" checked={entry.enabled} aria-label={`${entryIndex + 1}번째 form-data 사용`} onChange={(event) => updateFormDataEntry(entry.id, { enabled: event.target.checked })} />
                    <input value={entry.key} aria-label={`${entryIndex + 1}번째 form-data Key`} placeholder="Key" onChange={(event) => updateFormDataEntry(entry.id, { key: event.target.value })} />
                    <select value={entry.valueType} aria-label={`${entryIndex + 1}번째 form-data Type`} onChange={(event) => updateFormDataEntry(entry.id, { valueType: event.target.value as "TEXT" | "FILE", file: undefined, value: "" })}><option value="TEXT">Text</option><option value="FILE">File</option></select>
                    {entry.valueType === "FILE" ? <input type="file" aria-label={`${entryIndex + 1}번째 form-data 파일`} onChange={(event) => updateFormDataEntry(entry.id, { file: event.target.files?.[0], value: event.target.files?.[0]?.name ?? "" })} /> : <input value={entry.value} aria-label={`${entryIndex + 1}번째 form-data Value`} placeholder="Value" onChange={(event) => updateFormDataEntry(entry.id, { value: event.target.value })} />}
                    <button type="button" className="api-icon-button" aria-label={`${entryIndex + 1}번째 form-data 삭제`} onClick={() => removeFormDataEntry(entry.id)}>×</button>
                  </div>
                ))}
                <button type="button" className="ghost-button api-add-row-button" onClick={() => updateRequest({ formData: [...request.formData, createEmptyFormDataEntry()] })}>+ 항목 추가</button>
                <p className="api-secret-note">파일은 저장 요청이나 History에 보관되지 않습니다. 다시 실행할 때 파일을 다시 선택해야 합니다.</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
};
