/**
 * ============================================================================
 * InquiryPracticePage.tsx — 【고급】 역할(권한)에 따라 달라지는 화면
 * ============================================================================
 *
 * 같은 화면인데 "누가 보느냐"에 따라 보이는 것과 할 수 있는 것이 달라진다.
 * 고객센터, 사내 시스템, 쇼핑몰 관리자 페이지가 전부 이런 구조다.
 *
 * [세 가지 역할]
 *   USER    일반 사용자 — 문의를 쓰고, 자기 문의만 보고 종료할 수 있다
 *   MANAGER 팀 관리자   — 모든 문의를 보고 담당 배정과 답변을 할 수 있다
 *   ADMIN   시스템 관리자 — MANAGER와 같지만 배정 시 이름이 다르다
 *
 * ★ 화면 위 드롭다운으로 역할을 바꿔 가며 무엇이 달라지는지 확인해 보자.
 *   실제 앱이라면 로그인한 사람의 역할이 자동으로 정해지지만,
 *   여기서는 연습을 위해 직접 바꿀 수 있게 만들었다.
 *
 * [권한을 다루는 세 가지 방식 — 이 페이지에 전부 나온다]
 *   1. 목록에서 아예 걸러내기 (비밀 문의 → 남에게 안 보임)
 *   2. 버튼을 비활성화하기   (USER는 문의 등록 버튼만 활성)
 *   3. 실행 시 막고 알리기   (권한 없이 배정 시도 → 403 오류 알림)
 *
 * ★★ 반드시 기억할 것: 프론트엔드의 권한 처리는 "보안"이 아니다!
 *   버튼을 숨겨도 개발자도구로 State를 바꾸거나 API를 직접 부를 수 있다.
 *   진짜 차단은 반드시 백엔드 서버가 해야 한다.
 *   프론트의 권한 처리는 "실수 방지 + 화면 정리"가 목적이다.
 */

import { useMemo, useState } from "react";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ModalDialog } from "@/shared/ui/ModalDialog";

type UserRole = "USER" | "MANAGER" | "ADMIN";

// 문의가 거치는 단계.
//   WAITING(대기) → IN_PROGRESS(처리 중) → ANSWERED(답변 완료) → CLOSED(종료)
// CLOSED는 최종 상태로, 여기서는 더 이상 아무것도 바꿀 수 없다.
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

  // ── 권한 처리 방식 (1): 목록에서 아예 걸러낸다 ──────────────────
  const visibleInquiryItems = useMemo(() => {
    const normalizedSearchKeyword = searchKeyword.trim().toLowerCase();
    return inquiryItems.filter((inquiryItem) => {
      // 조건 A: 검색어와 맞는가?
      const matchesSearch = inquiryItem.title.toLowerCase().includes(normalizedSearchKeyword) || inquiryItem.content.toLowerCase().includes(normalizedSearchKeyword);

      // 조건 B: 이 비밀 문의를 볼 자격이 있는가?
      //   `||`로 이어진 세 조건 중 하나만 맞으면 볼 수 있다.
      //     1) 애초에 비밀 문의가 아니다        → 누구나 본다
      //     2) 내가 일반 사용자가 아니다        → 관리자는 다 본다
      //     3) 내가 쓴 문의다                  → 작성자는 본다
      //
      //   ★ 이 프로젝트는 학습용이라 작성자 판단을 이름 문자열로 한다.
      //     실무에서는 로그인한 사람의 id와 문의의 writerId를 비교한다.
      //     이름은 겹칠 수 있으므로 절대 판단 기준으로 쓰면 안 된다.
      const canReadSecret = !inquiryItem.isSecret || currentRole !== "USER" || inquiryItem.writerName === "일반 사용자";

      // 두 조건을 모두 만족해야 목록에 보인다.
      return matchesSearch && canReadSecret;
    });
    // ★ currentRole이 의존성에 들어 있다.
    //   역할을 바꾸면 볼 수 있는 목록이 달라져야 하므로 다시 계산해야 한다.
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

  /**
   * 담당자를 자기 자신으로 배정한다.
   *
   * ── 권한 처리 방식 (3): 실행 시점에 막고 알린다 ──
   */
  const assignInquiry = (inquiryItem: InquiryItem): void => {
    // ★ 화면에서 이미 USER에게는 이 버튼을 안 보여준다.
    //   그런데도 왜 또 검사할까?
    //   화면 조건이 나중에 바뀌거나, 다른 경로로 이 함수가 불릴 수 있기 때문이다.
    //   "함수는 스스로를 지킨다"는 방어적 프로그래밍의 기본이다.
    //   (물론 진짜 방어선은 서버다. 여기 검사는 실수 방지용이다)
    if (currentRole === "USER") {
      applicationNotification.error("권한이 없습니다.", "403 Forbidden 상황을 화면에서 재현했습니다.");
      return;
    }

    // 목록 안의 해당 문의를 갱신한다.
    setInquiryItems((previousInquiryItems) => previousInquiryItems.map((previousInquiryItem) => previousInquiryItem.inquiryId === inquiryItem.inquiryId ? { ...previousInquiryItem, assignedManagerName: currentRole === "ADMIN" ? "시스템 관리자" : "팀 관리자", status: "IN_PROGRESS" } : previousInquiryItem));

    // ★★ 오른쪽 상세 패널의 State도 "따로" 갱신해야 한다. 놓치기 쉬운 부분이다.
    //
    //   왜 두 번 갱신하나?
    //     이 화면은 선택한 문의를 selectedInquiry State에 객체로 복사해 뒀다.
    //     목록만 갱신하면 상세 패널은 여전히 옛 사본을 보여준다.
    //     "배정했는데 오른쪽은 그대로 미배정"인 버그가 난다.
    //
    //   ★ 사실 이건 설계상의 약점이다.
    //     GeneralBoardPracticePage처럼 id만 저장하고 목록에서 찾아 쓰면
    //     이런 이중 갱신 자체가 필요 없다.
    //     "같은 데이터를 두 곳에 두면 반드시 어긋난다"는 교훈이다.
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
    // ★ `?? (조건 ? A : B)` 조합에 주목.
    //   담당자가 이미 있으면 그대로 두고, 없으면(null) 지금 답변하는 사람을 넣는다.
    //   "배정 없이 바로 답변"하는 흐름도 자연스럽게 처리된다.
    //   답변했는데 담당자가 비어 있으면 나중에 누가 처리했는지 알 수 없다.
    const updatedInquiry: InquiryItem = { ...selectedInquiry, answerContent: answerContent.trim(), assignedManagerName: selectedInquiry.assignedManagerName ?? (currentRole === "ADMIN" ? "시스템 관리자" : "팀 관리자"), status: "ANSWERED" };
    setInquiryItems((previousInquiryItems) => previousInquiryItems.map((inquiryItem) => inquiryItem.inquiryId === updatedInquiry.inquiryId ? updatedInquiry : inquiryItem));
    setSelectedInquiry(updatedInquiry);
    setAnswerContent("");
    applicationNotification.success("답변을 저장했습니다.");
  };

  /**
   * 문의를 종료한다.
   *
   * ★ 여기서 "소유권 검사"를 한다. 역할 검사와는 다른 개념이다.
   *     역할 검사  : 이 사람이 이 종류의 일을 할 수 있는가? (USER인가 ADMIN인가)
   *     소유권 검사: 이 사람이 "이 데이터"에 대해 그 일을 할 수 있는가?
   *
   *   USER는 문의를 종료할 수 있지만, "자기 문의만" 종료할 수 있다.
   *   역할만 확인하고 소유권을 빠뜨리면 남의 문의를 마음대로 종료하게 된다.
   *   실무에서 자주 터지는 보안 취약점이니 꼭 기억하자.
   */
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
      <div className="page-heading-row"><div><span className="level-badge level-고급">고급 · 난이도 8/10</span><h1>문의·답변 권한 CRUD</h1><p>현재 역할을 바꾸면서 작성자·담당자·관리자 권한과 상태 전이를 확인합니다.</p></div>{/* ── 권한 처리 방식 (2): 버튼을 비활성화한다 ──
          관리자는 문의를 "등록"할 일이 없으므로 잠근다.
          숨기지 않고 비활성화해서 "있긴 한데 내 역할로는 안 되는" 것임을 알린다. */}
<button type="button" onClick={() => setCreateModalOpen(true)} disabled={currentRole !== "USER"}>문의 등록</button></div>

      {/* ★ 역할을 바꾸면 selectedInquiry를 null로 비운다. 중요한 처리다.
            관리자로 비밀 문의를 열어 둔 채 USER로 바꾸면
            볼 권한이 없는 내용이 오른쪽에 그대로 남는다.
            "권한이 바뀌면 그 권한으로 본 것도 정리한다"가 안전하다. */}
      <div className="list-toolbar inquiry-toolbar"><label>현재 역할<select value={currentRole} onChange={(event) => { setCurrentRole(event.target.value as UserRole); setSelectedInquiry(null); }}><option value="USER">USER · 일반 사용자</option><option value="MANAGER">MANAGER · 팀 관리자</option><option value="ADMIN">ADMIN · 시스템 관리자</option></select></label><label>문의 검색<input value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} placeholder="제목 또는 내용" /></label></div>
      <div className="inquiry-layout">
        <div className="inquiry-list">{visibleInquiryItems.map((inquiryItem) => <button type="button" key={inquiryItem.inquiryId} className={`inquiry-list-item${selectedInquiry?.inquiryId === inquiryItem.inquiryId ? " active" : ""}`} onClick={() => { setSelectedInquiry(inquiryItem); setAnswerContent(""); }}><div><strong>{inquiryItem.isSecret ? "🔒 " : ""}{inquiryItem.title}</strong><span>{inquiryItem.writerName} · {inquiryItem.createdAt}</span></div><span className={`inquiry-status status-${inquiryItem.status.toLowerCase()}`}>{inquiryStatusLabelMap[inquiryItem.status]}</span></button>)}</div>
        {/* 오른쪽 상세 패널.
            아래 긴 JSX는 크게 두 갈래로 나뉜다:
              관리자 + 종료 안 됨 → 답변 입력창 + 배정/답변/종료 버튼
              그 외              → 자기 문의일 때 종료 버튼만
            선택한 문의가 없으면 안내 문구를 보여준다. */}
        <article className="practice-card inquiry-detail-card">{selectedInquiry ? <><div className="inquiry-detail-heading"><div><h2>{selectedInquiry.title}</h2><p>{selectedInquiry.writerName} · 담당자 {selectedInquiry.assignedManagerName ?? "미배정"}</p></div><span className={`inquiry-status status-${selectedInquiry.status.toLowerCase()}`}>{inquiryStatusLabelMap[selectedInquiry.status]}</span></div><div className="inquiry-content-box"><strong>문의 내용</strong><p>{selectedInquiry.content}</p></div><div className="inquiry-content-box"><strong>답변</strong><p>{selectedInquiry.answerContent ?? "아직 등록된 답변이 없습니다."}</p></div>{currentRole !== "USER" && selectedInquiry.status !== "CLOSED" ? <><label>관리자 답변<textarea value={answerContent} onChange={(event) => setAnswerContent(event.target.value)} rows={5} /></label><div className="button-row"><button type="button" className="secondary-button" onClick={() => assignInquiry(selectedInquiry)}>내게 배정</button><button type="button" onClick={saveAnswer}>답변 저장</button><button type="button" className="danger-button" onClick={() => setCloseTargetInquiry(selectedInquiry)}>문의 종료</button></div></> : <div className="button-row">{selectedInquiry.status !== "CLOSED" ? <button type="button" className="danger-button" onClick={() => setCloseTargetInquiry(selectedInquiry)}>내 문의 종료</button> : null}</div>}</> : <div className="state-panel">왼쪽 목록에서 문의를 선택하세요.</div>}</article>
      </div>

      <ModalDialog isOpen={isCreateModalOpen} title="새 문의 등록" description="USER 역할에서 작성자 권한을 연습합니다." onRequestClose={() => setCreateModalOpen(false)} footer={<><button type="button" className="ghost-button" onClick={() => setCreateModalOpen(false)}>취소</button><button type="button" onClick={createInquiry}>문의 등록</button></>}><div className="modal-form-grid"><label>제목<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>내용<textarea rows={8} value={content} onChange={(event) => setContent(event.target.value)} /></label><label className="checkbox-label"><input type="checkbox" checked={isSecret} onChange={(event) => setSecret(event.target.checked)} />비밀 문의로 등록</label></div></ModalDialog>
      <ConfirmDialog isOpen={closeTargetInquiry !== null} title="문의 종료" description="종료된 문의는 더 이상 답변이나 상태를 변경할 수 없습니다." confirmButtonLabel="종료" onConfirm={closeInquiry} onCancel={() => setCloseTargetInquiry(null)} />
    </section>
  );
};
