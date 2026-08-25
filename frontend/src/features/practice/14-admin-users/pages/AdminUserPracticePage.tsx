/**
 * ============================================================================
 * AdminUserPracticePage.tsx — 【고급】 다중 선택 + 일괄 처리 + Soft Delete
 * ============================================================================
 *
 * 회원 관리 화면의 표준 기능들을 모아 놓은 페이지다.
 * 난이도가 가장 높지만, 지금까지 배운 것들의 조합일 뿐이다.
 *
 * [배울 개념 네 가지]
 *   1. 체크박스 다중 선택 — Set으로 선택 상태 관리
 *   2. 전체 선택/해제     — "전부 선택됐나?" 판단하기
 *   3. 일괄 처리          — 선택된 여러 건을 한 번에 바꾸기
 *   4. Soft Delete + 복구 — 지운 척만 하고 되살릴 수 있게 하기
 *   (+) 감사 로그         — 누가 무엇을 했는지 기록 남기기
 *
 * ★ Soft Delete를 쓰는 이유 (실무에서 매우 중요)
 *   회원 데이터를 진짜로 지우면 이런 문제가 생긴다.
 *     - 그 사람이 쓴 글, 주문, 결제 기록이 전부 주인 없는 데이터가 된다
 *     - 실수로 지웠을 때 되돌릴 방법이 없다
 *     - 법적으로 일정 기간 보관해야 하는 정보도 있다
 *   그래서 상태만 DELETED로 바꾸고 데이터는 남긴다.
 *   (댓글 페이지, 예약 페이지에서도 같은 개념이 나왔다)
 */

import { useMemo, useState } from "react";
import { LearningGuideTitle } from "@/features/curriculum/components/LearningGuideTitle";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ModalDialog } from "@/shared/ui/ModalDialog";

type AdminUserRole = "USER" | "MANAGER" | "ADMIN" | "READ_ONLY";
// DELETED는 "삭제됨" 상태일 뿐 실제로 사라진 게 아니다. (Soft Delete)
type AdminUserStatus = "ACTIVE" | "LOCKED" | "DORMANT" | "DELETED";

interface AdminUserItem {
  userId: number;
  userName: string;
  emailAddress: string;
  userRole: AdminUserRole;
  userStatus: AdminUserStatus;
  lastLoginAt: string;
  deletedAt: string | null;
}

interface AuditLogItem {
  auditLogId: number;
  actionName: string;
  targetDescription: string;
  createdAt: string;
}

const initialAdminUserItems: AdminUserItem[] = [
  { userId: 1, userName: "김리액트", emailAddress: "react@example.com", userRole: "USER", userStatus: "ACTIVE", lastLoginAt: "2026-08-06 21:10", deletedAt: null },
  { userId: 2, userName: "박스프링", emailAddress: "spring@example.com", userRole: "MANAGER", userStatus: "ACTIVE", lastLoginAt: "2026-08-06 20:45", deletedAt: null },
  { userId: 3, userName: "최도커", emailAddress: "docker@example.com", userRole: "READ_ONLY", userStatus: "LOCKED", lastLoginAt: "2026-08-01 09:20", deletedAt: null },
  { userId: 4, userName: "관리자", emailAddress: "admin@example.com", userRole: "ADMIN", userStatus: "ACTIVE", lastLoginAt: "2026-08-06 22:30", deletedAt: null },
  { userId: 5, userName: "삭제 사용자", emailAddress: "deleted@example.com", userRole: "USER", userStatus: "DELETED", lastLoginAt: "2026-07-10 10:00", deletedAt: "2026-08-02 15:10" },
];

const userRoleLabelMap: Record<AdminUserRole, string> = {
  USER: "일반 사용자",
  MANAGER: "관리자",
  ADMIN: "시스템 관리자",
  READ_ONLY: "조회 전용",
};

const userStatusLabelMap: Record<AdminUserStatus, string> = {
  ACTIVE: "활성",
  LOCKED: "잠금",
  DORMANT: "휴면",
  DELETED: "삭제",
};

export const AdminUserPracticePage = () => {
  const [adminUserItems, setAdminUserItems] = useState<AdminUserItem[]>(initialAdminUserItems);

  // ★ 선택된 사용자 id들을 Set으로 관리한다.
  //
  //   왜 배열(number[])이 아니라 Set일까?
  //     - has(id) 로 포함 여부를 즉시 확인할 수 있다 (배열의 includes보다 훨씬 빠르다)
  //     - 같은 id가 두 번 들어갈 수 없다 (중복 방지가 공짜)
  //     - .size 로 선택 개수를 바로 알 수 있다
  //   체크박스가 100개, 1000개로 늘어나면 이 차이가 크게 벌어진다.
  //
  //   (ApplicationSidebar.tsx에서 펼친 메뉴 그룹을 관리한 방식과 같다)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [searchKeyword, setSearchKeyword] = useState("");
  const [showDeletedUsers, setShowDeletedUsers] = useState(false);
  const [batchRole, setBatchRole] = useState<AdminUserRole>("USER");
  const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null);
  const [deleteTargetUser, setDeleteTargetUser] = useState<AdminUserItem | null>(null);
  const [auditLogItems, setAuditLogItems] = useState<AuditLogItem[]>([]);

  const visibleAdminUserItems = useMemo(() => {
    const normalizedSearchKeyword = searchKeyword.trim().toLowerCase();
    return adminUserItems.filter((adminUserItem) => {
      const matchesDeletedFilter = showDeletedUsers ? adminUserItem.userStatus === "DELETED" : adminUserItem.userStatus !== "DELETED";
      const matchesSearch = adminUserItem.userName.toLowerCase().includes(normalizedSearchKeyword) || adminUserItem.emailAddress.toLowerCase().includes(normalizedSearchKeyword);
      return matchesDeletedFilter && matchesSearch;
    });
  }, [adminUserItems, searchKeyword, showDeletedUsers]);

  /**
   * 감사 로그(audit log)를 남긴다.
   *
   * ★ 감사 로그란?
   *   "누가, 언제, 무엇을 바꿨는지"의 기록이다.
   *   회원 정보나 권한처럼 민감한 데이터를 다루는 시스템에는 반드시 있어야 한다.
   *   문제가 생겼을 때 원인을 추적하고, 부정 사용을 감시하는 근거가 된다.
   *
   * `.slice(0, 8)` → 최근 8건만 남기고 나머지는 버린다.
   *   화면 연습용이라 이렇게 잘라 냈다.
   *   실제 시스템에서는 절대 버리지 않고 서버 DB에 영구 저장한다.
   */
  const recordAuditLog = (actionName: string, targetDescription: string): void => {
    setAuditLogItems((previousAuditLogItems) => [{ auditLogId: Date.now(), actionName, targetDescription, createdAt: new Date().toLocaleString("ko-KR") }, ...previousAuditLogItems].slice(0, 8));
  };

  /** 체크박스 하나를 켜고 끈다. */
  const toggleUserSelection = (userId: number): void => {
    // ★ Set을 State로 다룰 때의 규칙: 원본을 고치지 말고 복사본을 만든다.
    //   `previousSelectedUserIds.add(id)` 처럼 원본을 직접 고치면
    //   주소가 그대로라 React가 변화를 못 알아채고 화면이 안 바뀐다.
    setSelectedUserIds((previousSelectedUserIds) => {
      const nextSelectedUserIds = new Set(previousSelectedUserIds);
      if (nextSelectedUserIds.has(userId)) nextSelectedUserIds.delete(userId);
      else nextSelectedUserIds.add(userId);
      return nextSelectedUserIds;
    });
  };

  /**
   * ★ 헤더의 "전체 선택" 체크박스. 선택 상태에 따라 전체 선택 ↔ 전체 해제로 동작한다.
   */
  const selectAllVisibleUsers = (): void => {
    // ★ "전체"의 범위가 중요하다.
    //   전체 사용자가 아니라 "지금 화면에 보이는(필터링된) 사용자"만 대상이다.
    //   검색으로 3명만 보이는데 전체 선택을 눌러서 숨겨진 50명까지 선택되면
    //   사용자는 그걸 모른 채 일괄 삭제를 눌러 큰 사고가 난다.
    //   "보이는 것만 조작한다"는 원칙을 지키자.
    const visibleUserIds = visibleAdminUserItems.map((adminUserItem) => adminUserItem.userId);

    // every(): 모든 원소가 조건을 만족하면 true.
    //
    // ★ `visibleUserIds.length > 0 &&` 를 앞에 붙인 이유
    //   자바스크립트의 함정: 빈 배열의 every()는 무조건 true다!
    //   ([].every(...) === true — "반례가 없으니 참"이라는 수학적 정의 때문)
    //   이 확인이 없으면 목록이 비었을 때 "전부 선택됨"으로 판단해
    //   체크박스가 켜진 것처럼 보인다.
    const areAllSelected = visibleUserIds.length > 0 && visibleUserIds.every((userId) => selectedUserIds.has(userId));

    // 이미 전부 선택돼 있으면 → 전체 해제 (빈 Set)
    // 아니면 → 보이는 것 전부 선택
    setSelectedUserIds(areAllSelected ? new Set() : new Set(visibleUserIds));
  };

  /**
   * ★ 일괄 처리 — 선택된 여러 명의 역할을 한 번에 바꾼다.
   *
   *   핵심은 map 한 번으로 끝난다는 점이다.
   *   반복문으로 하나씩 setState를 부르면 안 된다.
   *   화면이 선택 인원 수만큼 다시 그려지고, 중간에 값이 꼬일 수 있다.
   */
  const changeBatchRole = (): void => {
    if (selectedUserIds.size === 0) {
      applicationNotification.warning("역할을 변경할 사용자를 선택해 주세요.");
      return;
    }

    // 조건 두 개를 모두 만족하는 사용자만 바꾼다.
    //   1) 선택되어 있는가?
    //   2) 삭제된 사용자가 아닌가?  ← 삭제된 계정의 역할을 바꾸는 건 의미가 없다
    // 나머지는 원래 객체를 그대로 통과시킨다.
    setAdminUserItems((previousAdminUserItems) => previousAdminUserItems.map((adminUserItem) => selectedUserIds.has(adminUserItem.userId) && adminUserItem.userStatus !== "DELETED" ? { ...adminUserItem, userRole: batchRole } : adminUserItem));
    recordAuditLog("일괄 역할 변경", `${selectedUserIds.size}명을 ${userRoleLabelMap[batchRole]} 역할로 변경`);
    applicationNotification.success(`${selectedUserIds.size}명의 역할을 변경했습니다.`);
    // ★ 작업이 끝나면 선택을 해제한다.
    //   그대로 두면 사용자가 선택된 걸 잊고 다른 버튼을 눌러
    //   같은 사람들에게 또 다른 작업을 실행하는 사고가 난다.
    setSelectedUserIds(new Set());
  };

  const changeBatchStatus = (nextStatus: "ACTIVE" | "LOCKED" | "DORMANT"): void => {
    if (selectedUserIds.size === 0) {
      applicationNotification.warning("상태를 변경할 사용자를 선택해 주세요.");
      return;
    }
    setAdminUserItems((previousAdminUserItems) => previousAdminUserItems.map((adminUserItem) => selectedUserIds.has(adminUserItem.userId) && adminUserItem.userStatus !== "DELETED" ? { ...adminUserItem, userStatus: nextStatus } : adminUserItem));
    recordAuditLog("일괄 상태 변경", `${selectedUserIds.size}명을 ${userStatusLabelMap[nextStatus]} 상태로 변경`);
    applicationNotification.success(`${selectedUserIds.size}명의 상태를 변경했습니다.`);
    setSelectedUserIds(new Set());
  };

  /**
   * ★★ Soft Delete — 지운 척만 한다.
   *
   *   filter로 배열에서 빼지 않는다는 점이 핵심이다.
   *   상태를 DELETED로 바꾸고 삭제 시각만 기록한다.
   *   데이터는 그대로 남아 있으므로 아래 restoreUser로 되살릴 수 있다.
   *
   *   화면 목록에서 안 보이는 건 위 visibleAdminUserItems 필터가 걸러 주기 때문이다.
   *   "데이터에서 지우기"와 "화면에서 감추기"는 완전히 다른 일이다.
   */
  const softDeleteUser = (): void => {
    if (!deleteTargetUser) return;

    // 삭제 시각을 기록해 둔다. 나중에 "언제 지웠는지" 확인할 수 있어야 한다.
    const deletedAt = new Date().toLocaleString("ko-KR");
    setAdminUserItems((previousAdminUserItems) => previousAdminUserItems.map((adminUserItem) => adminUserItem.userId === deleteTargetUser.userId ? { ...adminUserItem, userStatus: "DELETED", deletedAt } : adminUserItem));
    recordAuditLog("사용자 Soft Delete", `${deleteTargetUser.userName} 계정을 삭제 상태로 변경`);
    setDeleteTargetUser(null);
    applicationNotification.success("사용자를 삭제 상태로 변경했습니다.");
  };

  /**
   * 삭제된 사용자를 되살린다.
   *
   * ★ 이 기능이 있다는 것 자체가 Soft Delete의 존재 이유다.
   *   진짜로 지웠다면 이런 함수를 만들 수조차 없다.
   *   deletedAt도 null로 되돌려 "삭제된 적 없는 상태"로 완전히 복원한다.
   */
  const restoreUser = (adminUserItem: AdminUserItem): void => {
    setAdminUserItems((previousAdminUserItems) => previousAdminUserItems.map((previousAdminUserItem) => previousAdminUserItem.userId === adminUserItem.userId ? { ...previousAdminUserItem, userStatus: "ACTIVE", deletedAt: null } : previousAdminUserItem));
    recordAuditLog("사용자 복구", `${adminUserItem.userName} 계정을 복구`);
    applicationNotification.success("사용자를 복구했습니다.");
  };

  return (
    <section>
      <div className="page-heading-row"><div><span className="level-badge level-고급">고급 · 난이도 9.5/10</span><LearningGuideTitle guideId="admin">관리자 사용자·일괄 처리 CRUD</LearningGuideTitle><p>다중 선택, 역할·상태 일괄 변경, Soft Delete와 복구, 감사 로그를 연습합니다.</p></div><button type="button" className="secondary-button" onClick={() => setShowDeletedUsers((previousShowDeletedUsers) => !previousShowDeletedUsers)}>{showDeletedUsers ? "활성 사용자 보기" : "삭제 사용자 보기"}</button></div>

      <div className="admin-filter-panel"><label>사용자 검색<input value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} placeholder="이름 또는 이메일" /></label>{!showDeletedUsers ? <><label>일괄 역할<select value={batchRole} onChange={(event) => setBatchRole(event.target.value as AdminUserRole)}>{(Object.keys(userRoleLabelMap) as AdminUserRole[]).map((userRole) => <option key={userRole} value={userRole}>{userRoleLabelMap[userRole]}</option>)}</select></label><button type="button" onClick={changeBatchRole}>선택 역할 변경</button><button type="button" className="secondary-button" onClick={() => changeBatchStatus("LOCKED")}>선택 잠금</button><button type="button" className="secondary-button" onClick={() => changeBatchStatus("ACTIVE")}>선택 잠금 해제</button><button type="button" className="ghost-button" onClick={() => changeBatchStatus("DORMANT")}>선택 휴면</button></> : null}</div>

      {/* ★ 헤더의 전체 선택 체크박스.
            checked 조건이 selectAllVisibleUsers 안의 areAllSelected와 똑같다.
            "보이는 것이 전부 선택됐을 때만 체크 표시"가 되도록 맞춘 것이다.
            여기서도 `length > 0 &&` 로 빈 배열의 every() 함정을 막는다.

            ※ 더 정교하게 하려면 "일부만 선택됨"을 나타내는
              indeterminate 상태를 쓸 수도 있다. (ref로 DOM 속성을 직접 설정해야 한다) */}
      <div className="table-wrapper"><table><thead><tr><th><input className="checkbox-input" type="checkbox" aria-label="현재 목록 전체 선택" checked={visibleAdminUserItems.length > 0 && visibleAdminUserItems.every((adminUserItem) => selectedUserIds.has(adminUserItem.userId))} onChange={selectAllVisibleUsers} /></th><th>사용자</th><th>역할</th><th>상태</th><th>최근 로그인</th><th>관리</th></tr></thead><tbody>{visibleAdminUserItems.map((adminUserItem) => <tr key={adminUserItem.userId}><td><input className="checkbox-input" type="checkbox" checked={selectedUserIds.has(adminUserItem.userId)} onChange={() => toggleUserSelection(adminUserItem.userId)} /></td><td><strong>{adminUserItem.userName}</strong><br /><small>{adminUserItem.emailAddress}</small></td><td>{userRoleLabelMap[adminUserItem.userRole]}</td><td><span className={`admin-status status-${adminUserItem.userStatus.toLowerCase()}`}>{userStatusLabelMap[adminUserItem.userStatus]}</span></td><td>{adminUserItem.lastLoginAt}</td><td>{adminUserItem.userStatus === "DELETED" ? <button type="button" onClick={() => restoreUser(adminUserItem)}>복구</button> : <div className="button-row compact-button-row"><button type="button" className="secondary-button" onClick={() => setSelectedUser(adminUserItem)}>상세</button>{/* ★ ADMIN 계정은 삭제 버튼을 잠근다.
                            관리자를 전부 지워 버리면 아무도 시스템에 못 들어간다.
                            이렇게 "시스템이 망가지는 것을 막는" 안전장치를
                            미리 넣어 두는 습관이 중요하다. */}
<button type="button" className="danger-button" onClick={() => setDeleteTargetUser(adminUserItem)} disabled={adminUserItem.userRole === "ADMIN"}>Soft Delete</button></div>}</td></tr>)}</tbody></table></div>
      {visibleAdminUserItems.length === 0 ? <div className="state-panel">표시할 사용자가 없습니다.</div> : null}

      <article className="learning-note-card"><h2>최근 감사 로그</h2>{auditLogItems.length === 0 ? <p>아직 변경 작업이 없습니다.</p> : <ul className="audit-log-list">{auditLogItems.map((auditLogItem) => <li key={auditLogItem.auditLogId}><strong>{auditLogItem.actionName}</strong><span>{auditLogItem.targetDescription}</span><small>{auditLogItem.createdAt}</small></li>)}</ul>}</article>

      <ModalDialog isOpen={selectedUser !== null} title={selectedUser?.userName ?? "사용자 상세"} description="사용자 상세 Drawer 대신 모달로 간단히 비교합니다." onRequestClose={() => setSelectedUser(null)} footer={<button type="button" onClick={() => setSelectedUser(null)}>닫기</button>}>{selectedUser ? <dl className="detail-definition-list"><dt>이메일</dt><dd>{selectedUser.emailAddress}</dd><dt>역할</dt><dd>{userRoleLabelMap[selectedUser.userRole]}</dd><dt>상태</dt><dd>{userStatusLabelMap[selectedUser.userStatus]}</dd><dt>최근 로그인</dt><dd>{selectedUser.lastLoginAt}</dd><dt>삭제 일시</dt><dd>{selectedUser.deletedAt ?? "해당 없음"}</dd></dl> : null}</ModalDialog>
      <ConfirmDialog isOpen={deleteTargetUser !== null} title="사용자 Soft Delete" description={`“${deleteTargetUser?.userName ?? ""}” 계정을 삭제 상태로 변경할까요? 데이터는 남아 있어 복구할 수 있습니다.`} confirmButtonLabel="삭제 상태로 변경" onConfirm={softDeleteUser} onCancel={() => setDeleteTargetUser(null)} />
    </section>
  );
};
