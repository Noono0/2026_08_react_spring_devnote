import { useMemo, useState } from "react";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ModalDialog } from "@/shared/ui/ModalDialog";

type UserRole = "USER" | "MANAGER" | "ADMIN";
type InquiryStatus = "WAITING" | "IN_PROGRESS" | "ANSWERED" | "CLOSED";

interface InquiryItem {
  inquiryId: number;
  title: string;
  content: string;
  writerName: string;
  assignedManagerName: string | null;
  answerContent: string | null;
  status: InquiryStatus;
  isSecret: boolean;
  createdAt: string;
}

const inquiryStatusLabelMap: Record<InquiryStatus, string> = {
  WAITING: "답변 대기",
  IN_PROGRESS: "처리 중",
  ANSWERED: "답변 완료",
  CLOSED: "종료",
};

const initialInquiryItems: InquiryItem[] = [
  { inquiryId: 1, title: "이미지 업로드가 실패합니다", content: "3MB 이미지 업로드 시 오류가 발생합니다.", writerName: "일반 사용자", assignedManagerName: "팀 관리자", answerContent: null, status: "IN_PROGRESS", isSecret: false, createdAt: "2026-08-04" },
  { inquiryId: 2, title: "비밀 문의 테스트", content: "작성자와 관리자만 볼 수 있는 문의입니다.", writerName: "일반 사용자", assignedManagerName: null, answerContent: null, status: "WAITING", isSecret: true, createdAt: "2026-08-05" },
  { inquiryId: 3, title: "문서 복구 요청", content: "삭제한 문서를 복구하고 싶습니다.", writerName: "다른 사용자", assignedManagerName: "시스템 관리자", answerContent: "관리자 화면에서 복구했습니다.", status: "ANSWERED", isSecret: false, createdAt: "2026-08-06" },
];

export const InquiryPracticePage = () => {
  const [currentRole, setCurrentRole] = useState<UserRole>("USER");
  const [inquiryItems, setInquiryItems] = useState<InquiryItem[]>(initialInquiryItems);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSecret, setSecret] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryItem | null>(null);
  const [answerContent, setAnswerContent] = useState("");
  const [closeTargetInquiry, setCloseTargetInquiry] = useState<InquiryItem | null>(null);

  const visibleInquiryItems = useMemo(() => {
    const normalizedSearchKeyword = searchKeyword.trim().toLowerCase();
    return inquiryItems.filter((inquiryItem) => {
      const matchesSearch = inquiryItem.title.toLowerCase().includes(normalizedSearchKeyword) || inquiryItem.content.toLowerCase().includes(normalizedSearchKeyword);
      const canReadSecret = !inquiryItem.isSecret || currentRole !== "USER" || inquiryItem.writerName === "일반 사용자";
      return matchesSearch && canReadSecret;
    });
  }, [currentRole, inquiryItems, searchKeyword]);

  const createInquiry = (): void => {
    if (currentRole !== "USER") {
      applicationNotification.warning("문의 등록은 USER 역할 실습에서 진행해 주세요.");
      return;
    }
    if (!title.trim() || !content.trim()) {
      applicationNotification.warning("제목과 내용을 입력해 주세요.");
      return;
    }
    setInquiryItems((previousInquiryItems) => [{ inquiryId: Date.now(), title: title.trim(), content: content.trim(), writerName: "일반 사용자", assignedManagerName: null, answerContent: null, status: "WAITING", isSecret, createdAt: new Date().toISOString().slice(0, 10) }, ...previousInquiryItems]);
    setTitle("");
    setContent("");
    setSecret(false);
    setCreateModalOpen(false);
    applicationNotification.success("문의를 등록했습니다.");
  };

  const assignInquiry = (inquiryItem: InquiryItem): void => {
    if (currentRole === "USER") {
      applicationNotification.error("권한이 없습니다.", "403 Forbidden 상황을 화면에서 재현했습니다.");
      return;
    }
    setInquiryItems((previousInquiryItems) => previousInquiryItems.map((previousInquiryItem) => previousInquiryItem.inquiryId === inquiryItem.inquiryId ? { ...previousInquiryItem, assignedManagerName: currentRole === "ADMIN" ? "시스템 관리자" : "팀 관리자", status: "IN_PROGRESS" } : previousInquiryItem));
    setSelectedInquiry((previousSelectedInquiry) => previousSelectedInquiry?.inquiryId === inquiryItem.inquiryId ? { ...previousSelectedInquiry, assignedManagerName: currentRole === "ADMIN" ? "시스템 관리자" : "팀 관리자", status: "IN_PROGRESS" } : previousSelectedInquiry);
    applicationNotification.success("담당자를 배정했습니다.");
  };

  const saveAnswer = (): void => {
    if (!selectedInquiry || currentRole === "USER") {
      applicationNotification.error("답변 권한이 없습니다.");
      return;
    }
    if (!answerContent.trim()) {
      applicationNotification.warning("답변 내용을 입력해 주세요.");
      return;
    }
    const updatedInquiry: InquiryItem = { ...selectedInquiry, answerContent: answerContent.trim(), assignedManagerName: selectedInquiry.assignedManagerName ?? (currentRole === "ADMIN" ? "시스템 관리자" : "팀 관리자"), status: "ANSWERED" };
    setInquiryItems((previousInquiryItems) => previousInquiryItems.map((inquiryItem) => inquiryItem.inquiryId === updatedInquiry.inquiryId ? updatedInquiry : inquiryItem));
    setSelectedInquiry(updatedInquiry);
    setAnswerContent("");
    applicationNotification.success("답변을 저장했습니다.");
  };

  const closeInquiry = (): void => {
    if (!closeTargetInquiry) return;
    if (currentRole === "USER" && closeTargetInquiry.writerName !== "일반 사용자") {
      applicationNotification.error("다른 사용자의 문의를 종료할 수 없습니다.");
      setCloseTargetInquiry(null);
      return;
    }
    setInquiryItems((previousInquiryItems) => previousInquiryItems.map((inquiryItem) => inquiryItem.inquiryId === closeTargetInquiry.inquiryId ? { ...inquiryItem, status: "CLOSED" } : inquiryItem));
    if (selectedInquiry?.inquiryId === closeTargetInquiry.inquiryId) setSelectedInquiry({ ...selectedInquiry, status: "CLOSED" });
    setCloseTargetInquiry(null);
    applicationNotification.success("문의를 종료했습니다.");
  };

  return (
    <section>
      <div className="page-heading-row"><div><span className="level-badge level-고급">고급 · 난이도 8/10</span><h1>문의·답변 권한 CRUD</h1><p>현재 역할을 바꾸면서 작성자·담당자·관리자 권한과 상태 전이를 확인합니다.</p></div><button type="button" onClick={() => setCreateModalOpen(true)} disabled={currentRole !== "USER"}>문의 등록</button></div>
      <div className="list-toolbar inquiry-toolbar"><label>현재 역할<select value={currentRole} onChange={(event) => { setCurrentRole(event.target.value as UserRole); setSelectedInquiry(null); }}><option value="USER">USER · 일반 사용자</option><option value="MANAGER">MANAGER · 팀 관리자</option><option value="ADMIN">ADMIN · 시스템 관리자</option></select></label><label>문의 검색<input value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} placeholder="제목 또는 내용" /></label></div>
      <div className="inquiry-layout">
        <div className="inquiry-list">{visibleInquiryItems.map((inquiryItem) => <button type="button" key={inquiryItem.inquiryId} className={`inquiry-list-item${selectedInquiry?.inquiryId === inquiryItem.inquiryId ? " active" : ""}`} onClick={() => { setSelectedInquiry(inquiryItem); setAnswerContent(""); }}><div><strong>{inquiryItem.isSecret ? "🔒 " : ""}{inquiryItem.title}</strong><span>{inquiryItem.writerName} · {inquiryItem.createdAt}</span></div><span className={`inquiry-status status-${inquiryItem.status.toLowerCase()}`}>{inquiryStatusLabelMap[inquiryItem.status]}</span></button>)}</div>
        <article className="practice-card inquiry-detail-card">{selectedInquiry ? <><div className="inquiry-detail-heading"><div><h2>{selectedInquiry.title}</h2><p>{selectedInquiry.writerName} · 담당자 {selectedInquiry.assignedManagerName ?? "미배정"}</p></div><span className={`inquiry-status status-${selectedInquiry.status.toLowerCase()}`}>{inquiryStatusLabelMap[selectedInquiry.status]}</span></div><div className="inquiry-content-box"><strong>문의 내용</strong><p>{selectedInquiry.content}</p></div><div className="inquiry-content-box"><strong>답변</strong><p>{selectedInquiry.answerContent ?? "아직 등록된 답변이 없습니다."}</p></div>{currentRole !== "USER" && selectedInquiry.status !== "CLOSED" ? <><label>관리자 답변<textarea value={answerContent} onChange={(event) => setAnswerContent(event.target.value)} rows={5} /></label><div className="button-row"><button type="button" className="secondary-button" onClick={() => assignInquiry(selectedInquiry)}>내게 배정</button><button type="button" onClick={saveAnswer}>답변 저장</button><button type="button" className="danger-button" onClick={() => setCloseTargetInquiry(selectedInquiry)}>문의 종료</button></div></> : <div className="button-row">{selectedInquiry.status !== "CLOSED" ? <button type="button" className="danger-button" onClick={() => setCloseTargetInquiry(selectedInquiry)}>내 문의 종료</button> : null}</div>}</> : <div className="state-panel">왼쪽 목록에서 문의를 선택하세요.</div>}</article>
      </div>

      <ModalDialog isOpen={isCreateModalOpen} title="새 문의 등록" description="USER 역할에서 작성자 권한을 연습합니다." onRequestClose={() => setCreateModalOpen(false)} footer={<><button type="button" className="ghost-button" onClick={() => setCreateModalOpen(false)}>취소</button><button type="button" onClick={createInquiry}>문의 등록</button></>}><div className="modal-form-grid"><label>제목<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>내용<textarea rows={8} value={content} onChange={(event) => setContent(event.target.value)} /></label><label className="checkbox-label"><input type="checkbox" checked={isSecret} onChange={(event) => setSecret(event.target.checked)} />비밀 문의로 등록</label></div></ModalDialog>
      <ConfirmDialog isOpen={closeTargetInquiry !== null} title="문의 종료" description="종료된 문의는 더 이상 답변이나 상태를 변경할 수 없습니다." confirmButtonLabel="종료" onConfirm={closeInquiry} onCancel={() => setCloseTargetInquiry(null)} />
    </section>
  );
};
