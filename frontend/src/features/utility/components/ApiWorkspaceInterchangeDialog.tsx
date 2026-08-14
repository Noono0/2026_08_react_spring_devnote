import { useEffect, useState, type ChangeEvent } from "react";
import type {
  ApiWorkspaceCollection,
  ApiWorkspaceEnvironment,
  ApiWorkspaceFolder,
  ApiWorkspaceSavedRequest,
} from "@/features/utility/types/apiWorkspaceTypes";
import {
  createPostmanCollectionJson,
  createPostmanEnvironmentJson,
  parsePostmanCollection,
  parsePostmanEnvironment,
  type ImportedPostmanCollection,
  type ImportedPostmanEnvironment,
} from "@/features/utility/utils/apiWorkspaceInterchange";
import { downloadText } from "@/features/utility/utils/browserFileUtils";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ModalDialog } from "@/shared/ui/ModalDialog";

interface ApiWorkspaceInterchangeDialogProps {
  isOpen: boolean;
  authenticated: boolean;
  collections: ApiWorkspaceCollection[];
  folders: ApiWorkspaceFolder[];
  savedRequests: ApiWorkspaceSavedRequest[];
  environments: ApiWorkspaceEnvironment[];
  onRequestClose: () => void;
  onCollectionImport: (result: ImportedPostmanCollection) => void;
  onEnvironmentImport: (result: ImportedPostmanEnvironment) => void;
  onCurlShareOpen: () => void;
}

const safeFileName = (value: string): string => Array.from(value.trim())
  .map((character) => character.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(character) ? "-" : character)
  .join("")
  .replace(/\s+/g, "-")
  .slice(0, 80) || "devnote-api";

export const ApiWorkspaceInterchangeDialog = ({
  isOpen,
  authenticated,
  collections,
  folders,
  savedRequests,
  environments,
  onRequestClose,
  onCollectionImport,
  onEnvironmentImport,
  onCurlShareOpen,
}: ApiWorkspaceInterchangeDialogProps) => {
  const [collectionId, setCollectionId] = useState("");
  const [environmentId, setEnvironmentId] = useState("");
  const [importWarnings, setImportWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setCollectionId((currentId) => collections.some((collection) => collection.id === currentId) ? currentId : collections[0]?.id ?? "");
    setEnvironmentId((currentId) => environments.some((environment) => environment.id === currentId) ? currentId : environments[0]?.id ?? "");
    setImportWarnings([]);
  }, [collections, environments, isOpen]);

  const exportCollection = (): void => {
    const collection = collections.find((item) => item.id === collectionId);
    if (!collection) return;
    const requestCount = savedRequests.filter((request) => request.collectionId === collection.id && !request.deletedAt).length;
    if (requestCount === 0) { applicationNotification.warning("내보낼 요청이 없습니다.", "Collection에 요청을 먼저 저장해 주세요."); return; }
    downloadText(`${safeFileName(collection.name)}.postman_collection.json`, createPostmanCollectionJson(collection, folders, savedRequests), "application/json;charset=utf-8");
    applicationNotification.success("Postman Collection을 내보냈습니다.", `${requestCount}개 요청의 Secret 원문은 포함하지 않았습니다.`);
  };

  const exportEnvironment = (): void => {
    const environment = environments.find((item) => item.id === environmentId);
    if (!environment) return;
    downloadText(`${safeFileName(environment.name)}.postman_environment.json`, createPostmanEnvironmentJson(environment), "application/json;charset=utf-8");
    applicationNotification.success("Postman Environment를 내보냈습니다.", "Secret 변수의 값은 빈 값으로 내보냈습니다.");
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>, type: "COLLECTION" | "ENVIRONMENT"): Promise<void> => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const source = await file.text();
      if (type === "COLLECTION") {
        const result = parsePostmanCollection(source);
        onCollectionImport(result);
        setCollectionId(result.collection.id);
        setImportWarnings(result.warnings);
        applicationNotification.success("Postman Collection을 가져왔습니다.", `${result.savedRequests.length}개 요청을 저장했습니다.`);
      } else {
        const result = parsePostmanEnvironment(source);
        onEnvironmentImport(result);
        setEnvironmentId(result.environment.id);
        setImportWarnings(result.warnings);
        applicationNotification.success("Postman Environment를 가져왔습니다.", `${result.environment.variables.length}개 변수를 가져왔습니다.`);
      }
    } catch (error) {
      setImportWarnings([]);
      applicationNotification.warning(error instanceof Error ? error.message : "파일을 가져오지 못했습니다.");
    } finally {
      input.value = "";
    }
  };

  return (
    <ModalDialog isOpen={isOpen} title="다른 API 도구와 공유" description="Postman Collection v2.1·Environment JSON과 cURL을 사용해 요청 설정을 주고받습니다." size="large" onRequestClose={onRequestClose}>
      <div className="api-interchange-dialog">
        {!authenticated ? <div className="api-interchange-login-notice"><strong>로그인이 필요합니다.</strong><p>Collection과 Environment는 회원별 저장 데이터이므로 로그인 후 가져오거나 내보낼 수 있습니다. 단일 요청 cURL은 로그인 없이 사용할 수 있습니다.</p></div> : null}

        <section>
          <header><span>POSTMAN v2.1</span><div><h3>Collection 공유</h3><p>Folder와 저장 요청을 하나의 JSON 파일로 이동합니다.</p></div></header>
          <label>내보낼 Collection
            <select value={collectionId} disabled={!authenticated || collections.length === 0} onChange={(event) => setCollectionId(event.target.value)}>
              {collections.length === 0 ? <option value="">저장된 Collection 없음</option> : collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
            </select>
          </label>
          <div className="api-interchange-actions">
            <button type="button" disabled={!authenticated || !collectionId} onClick={exportCollection}>Postman Collection 내보내기</button>
            <label className={`secondary-button file-button${!authenticated ? " disabled" : ""}`}>Postman Collection 가져오기<input aria-label="Postman Collection 파일 가져오기" type="file" accept=".json,.postman_collection.json,application/json" disabled={!authenticated} onChange={(event) => void importFile(event, "COLLECTION")} /></label>
          </div>
          <small>중첩 Folder는 <code>상위 / 하위</code> 이름으로 가져오며 최대 500개 요청을 처리합니다.</small>
        </section>

        <section>
          <header><span>ENV</span><div><h3>Environment 공유</h3><p>baseUrl 같은 환경변수를 Postman 형식으로 이동합니다.</p></div></header>
          <label>내보낼 Environment
            <select value={environmentId} disabled={!authenticated || environments.length === 0} onChange={(event) => setEnvironmentId(event.target.value)}>
              {environments.length === 0 ? <option value="">저장된 Environment 없음</option> : environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}
            </select>
          </label>
          <div className="api-interchange-actions">
            <button type="button" disabled={!authenticated || !environmentId} onClick={exportEnvironment}>Postman Environment 내보내기</button>
            <label className={`secondary-button file-button${!authenticated ? " disabled" : ""}`}>Postman Environment 가져오기<input aria-label="Postman Environment 파일 가져오기" type="file" accept=".json,.postman_environment.json,application/json" disabled={!authenticated} onChange={(event) => void importFile(event, "ENVIRONMENT")} /></label>
          </div>
          <small>Secret 변수는 내보낼 때 값이 비워집니다. 가져온 Secret은 현재 세션에서만 값이 유지됩니다.</small>
        </section>

        <section className="api-interchange-curl-card">
          <header><span>cURL</span><div><h3>단일 요청 공유</h3><p>현재 탭의 요청을 cURL로 복사하거나 다른 도구의 cURL을 가져옵니다.</p></div></header>
          <button type="button" className="ghost-button" onClick={onCurlShareOpen}>cURL · 코드 생성 열기</button>
        </section>

        {importWarnings.length > 0 ? <div className="api-interchange-warnings" role="status"><strong>가져오기 확인사항</strong><ul>{importWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}
        <div className="api-interchange-security"><strong>Secret 보호</strong><p>Authorization, Cookie, API Key, Token, Password 등의 값은 Collection 내보내기에서 자리표시자로 교체합니다. 공유한 뒤 대상 도구에서 환경변수 값을 다시 설정하세요.</p></div>
      </div>
    </ModalDialog>
  );
};
