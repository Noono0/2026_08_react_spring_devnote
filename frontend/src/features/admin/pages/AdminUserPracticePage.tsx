import { useMemo, useState } from "react";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ModalDialog } from "@/shared/ui/ModalDialog";

type AdminUserRole = "USER" | "MANAGER" | "ADMIN" | "READ_ONLY";
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

  const recordAuditLog = (actionName: string, targetDescription: string): void => {
    setAuditLogItems((previousAuditLogItems) => [{ auditLogId: Date.now(), actionName, targetDescription, createdAt: new Date().toLocaleString("ko-KR") }, ...previousAuditLogItems].slice(0, 8));
  };

  const toggleUserSelection = (userId: number): void => {
    setSelectedUserIds((previousSelectedUserIds) => {
      const nextSelectedUserIds = new Set(previousSelectedUserIds);
      if (nextSelectedUserIds.has(userId)) nextSelectedUserIds.delete(userId);
      else nextSelectedUserIds.add(userId);
      return nextSelectedUserIds;
    });
  };

  const selectAllVisibleUsers = (): void => {
    const visibleUserIds = visibleAdminUserItems.map((adminUserItem) => adminUserItem.userId);
    const areAllSelected = visibleUserIds.length > 0 && visibleUserIds.every((userId) => selectedUserIds.has(userId));
    setSelectedUserIds(areAllSelected ? new Set() : new Set(visibleUserIds));
  };

  const changeBatchRole = (): void => {
    if (selectedUserIds.size === 0) {
      applicationNotification.warning("역할을 변경할 사용자를 선택해 주세요.");
      return;
    }
    setAdminUserItems((previousAdminUserItems) => previousAdminUserItems.map((adminUserItem) => selectedUserIds.has(adminUserItem.userId) && adminUserItem.userStatus !== "DELETED" ? { ...adminUserItem, userRole: batchRole } : adminUserItem));
    recordAuditLog("일괄 역할 변경", `${selectedUserIds.size}명을 ${userRoleLabelMap[batchRole]} 역할로 변경`);
    applicationNotification.success(`${selectedUserIds.size}명의 역할을 변경했습니다.`);
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

  const softDeleteUser = (): void => {
    if (!deleteTargetUser) return;
    const deletedAt = new Date().toLocaleString("ko-KR");
    setAdminUserItems((previousAdminUserItems) => previousAdminUserItems.map((adminUserItem) => adminUserItem.userId === deleteTargetUser.userId ? { ...adminUserItem, userStatus: "DELETED", deletedAt } : adminUserItem));
    recordAuditLog("사용자 Soft Delete", `${deleteTargetUser.userName} 계정을 삭제 상태로 변경`);
    setDeleteTargetUser(null);
    applicationNotification.success("사용자를 삭제 상태로 변경했습니다.");
  };

  const restoreUser = (adminUserItem: AdminUserItem): void => {
    setAdminUserItems((previousAdminUserItems) => previousAdminUserItems.map((previousAdminUserItem) => previousAdminUserItem.userId === adminUserItem.userId ? { ...previousAdminUserItem, userStatus: "ACTIVE", deletedAt: null } : previousAdminUserItem));
    recordAuditLog("사용자 복구", `${adminUserItem.userName} 계정을 복구`);
    applicationNotification.success("사용자를 복구했습니다.");
  };

  return (
    <section>
      <div className="page-heading-row"><div><span className="level-badge level-고급">고급 · 난이도 9.5/10</span><h1>관리자 사용자·일괄 처리 CRUD</h1><p>다중 선택, 역할·상태 일괄 변경, Soft Delete와 복구, 감사 로그를 연습합니다.</p></div><button type="button" className="secondary-button" onClick={() => setShowDeletedUsers((previousShowDeletedUsers) => !previousShowDeletedUsers)}>{showDeletedUsers ? "활성 사용자 보기" : "삭제 사용자 보기"}</button></div>

      <div className="admin-filter-panel"><label>사용자 검색<input value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} placeholder="이름 또는 이메일" /></label>{!showDeletedUsers ? <><label>일괄 역할<select value={batchRole} onChange={(event) => setBatchRole(event.target.value as AdminUserRole)}>{(Object.keys(userRoleLabelMap) as AdminUserRole[]).map((userRole) => <option key={userRole} value={userRole}>{userRoleLabelMap[userRole]}</option>)}</select></label><button type="button" onClick={changeBatchRole}>선택 역할 변경</button><button type="button" className="secondary-button" onClick={() => changeBatchStatus("LOCKED")}>선택 잠금</button><button type="button" className="secondary-button" onClick={() => changeBatchStatus("ACTIVE")}>선택 잠금 해제</button><button type="button" className="ghost-button" onClick={() => changeBatchStatus("DORMANT")}>선택 휴면</button></> : null}</div>

      <div className="table-wrapper"><table><thead><tr><th><input className="checkbox-input" type="checkbox" aria-label="현재 목록 전체 선택" checked={visibleAdminUserItems.length > 0 && visibleAdminUserItems.every((adminUserItem) => selectedUserIds.has(adminUserItem.userId))} onChange={selectAllVisibleUsers} /></th><th>사용자</th><th>역할</th><th>상태</th><th>최근 로그인</th><th>관리</th></tr></thead><tbody>{visibleAdminUserItems.map((adminUserItem) => <tr key={adminUserItem.userId}><td><input className="checkbox-input" type="checkbox" checked={selectedUserIds.has(adminUserItem.userId)} onChange={() => toggleUserSelection(adminUserItem.userId)} /></td><td><strong>{adminUserItem.userName}</strong><br /><small>{adminUserItem.emailAddress}</small></td><td>{userRoleLabelMap[adminUserItem.userRole]}</td><td><span className={`admin-status status-${adminUserItem.userStatus.toLowerCase()}`}>{userStatusLabelMap[adminUserItem.userStatus]}</span></td><td>{adminUserItem.lastLoginAt}</td><td>{adminUserItem.userStatus === "DELETED" ? <button type="button" onClick={() => restoreUser(adminUserItem)}>복구</button> : <div className="button-row compact-button-row"><button type="button" className="secondary-button" onClick={() => setSelectedUser(adminUserItem)}>상세</button><button type="button" className="danger-button" onClick={() => setDeleteTargetUser(adminUserItem)} disabled={adminUserItem.userRole === "ADMIN"}>Soft Delete</button></div>}</td></tr>)}</tbody></table></div>
      {visibleAdminUserItems.length === 0 ? <div className="state-panel">표시할 사용자가 없습니다.</div> : null}

      <article className="learning-note-card"><h2>최근 감사 로그</h2>{auditLogItems.length === 0 ? <p>아직 변경 작업이 없습니다.</p> : <ul className="audit-log-list">{auditLogItems.map((auditLogItem) => <li key={auditLogItem.auditLogId}><strong>{auditLogItem.actionName}</strong><span>{auditLogItem.targetDescription}</span><small>{auditLogItem.createdAt}</small></li>)}</ul>}</article>

      <ModalDialog isOpen={selectedUser !== null} title={selectedUser?.userName ?? "사용자 상세"} description="사용자 상세 Drawer 대신 모달로 간단히 비교합니다." onRequestClose={() => setSelectedUser(null)} footer={<button type="button" onClick={() => setSelectedUser(null)}>닫기</button>}>{selectedUser ? <dl className="detail-definition-list"><dt>이메일</dt><dd>{selectedUser.emailAddress}</dd><dt>역할</dt><dd>{userRoleLabelMap[selectedUser.userRole]}</dd><dt>상태</dt><dd>{userStatusLabelMap[selectedUser.userStatus]}</dd><dt>최근 로그인</dt><dd>{selectedUser.lastLoginAt}</dd><dt>삭제 일시</dt><dd>{selectedUser.deletedAt ?? "해당 없음"}</dd></dl> : null}</ModalDialog>
      <ConfirmDialog isOpen={deleteTargetUser !== null} title="사용자 Soft Delete" description={`“${deleteTargetUser?.userName ?? ""}” 계정을 삭제 상태로 변경할까요? 데이터는 남아 있어 복구할 수 있습니다.`} confirmButtonLabel="삭제 상태로 변경" onConfirm={softDeleteUser} onCancel={() => setDeleteTargetUser(null)} />
    </section>
  );
};
