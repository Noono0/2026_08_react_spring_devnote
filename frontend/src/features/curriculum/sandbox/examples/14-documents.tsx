/**
 * 14단계 연습 — 문서 CRUD: 서버 API(여기서는 가짜 API)와 TanStack Query, 버전 충돌(409)
 *
 * 실제 14단계는 Spring Boot·MySQL에 연결하지만, 이 편집기에는 서버가 없어 같은 모양의 가짜 API를 쓴다.
 *
 * 해 볼 것
 *  1. "다른 사람이 먼저 수정"을 눌러 서버 버전을 올린 뒤 저장해 보세요. 409 충돌이 납니다.
 *  2. 충돌이 나면 최신 내용을 다시 불러오는 버튼을 추가해 보세요.
 */
import { useState } from "react";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface DocumentItem { id: number; title: string; content: string; version: number; }

// ── 가짜 서버: 저장할 때 내가 알던 version이 서버 version과 다르면 거절한다(낙관적 잠금) ──
let serverDocument: DocumentItem = { id: 1, title: "React 상태 관리", content: "처음 내용", version: 1 };
const wait = () => new Promise((resolve) => setTimeout(resolve, 400));
class ConflictError extends Error {}
const getDocument = async (): Promise<DocumentItem> => { await wait(); return serverDocument; };
const updateDocument = async (request: DocumentItem): Promise<DocumentItem> => {
  await wait();
  if (request.version !== serverDocument.version) throw new ConflictError("다른 사용자가 먼저 수정했습니다(409).");
  serverDocument = { ...request, version: request.version + 1 };
  return serverDocument;
};

const queryClient = new QueryClient();
const DOCUMENT_KEY = ["document", 1];

function Editor() {
  const client = useQueryClient();
  const documentQuery = useQuery({ queryKey: DOCUMENT_KEY, queryFn: getDocument });
  const [draft, setDraft] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: updateDocument,
    // 서버가 돌려준 최신 문서로 캐시를 바로 채운다(다시 요청할 필요가 없다).
    onSuccess: (saved) => { client.setQueryData(DOCUMENT_KEY, saved); setDraft(null); },
  });

  if (documentQuery.isPending) return <p>문서를 불러오는 중…</p>;
  if (documentQuery.isError) return <p className="error">문서를 불러오지 못했습니다.</p>;
  const document = documentQuery.data;
  const content = draft ?? document.content;

  return (
    <main>
      <h1>{document.title} <span className="badge">버전 {document.version}</span></h1>
      <textarea rows={4} style={{ width: "100%" }} value={content} onChange={(event) => setDraft(event.target.value)} />
      <div className="row">
        {/* 저장할 때 "내가 알고 있는 버전"을 함께 보낸다 */}
        <button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate({ ...document, content })}>{saveMutation.isPending ? "저장 중…" : "저장"}</button>
        <button className="secondary" onClick={() => { serverDocument = { ...serverDocument, content: "다른 사람이 고친 내용", version: serverDocument.version + 1 }; }}>다른 사람이 먼저 수정</button>
      </div>
      {saveMutation.isError ? <p className="error" role="alert">{saveMutation.error.message}</p> : null}
      {saveMutation.isSuccess ? <p className="ok" role="status">저장했습니다.</p> : null}
    </main>
  );
}

export default function App() {
  return <QueryClientProvider client={queryClient}><Editor /></QueryClientProvider>;
}
