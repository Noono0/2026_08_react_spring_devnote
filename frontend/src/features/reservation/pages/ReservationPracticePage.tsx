import { useMemo, useState } from "react";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ModalDialog } from "@/shared/ui/ModalDialog";

type ReservationStatus = "REQUESTED" | "CONFIRMED" | "CANCELLED" | "COMPLETED";

interface ReservationItem {
  reservationId: number;
  resourceName: string;
  reserverName: string;
  reservationDate: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
  note: string;
}

const initialReservationItems: ReservationItem[] = [
  { reservationId: 1, resourceName: "회의실 A", reserverName: "김리액트", reservationDate: "2026-08-07", startTime: "10:00", endTime: "11:00", status: "CONFIRMED", note: "React 스터디" },
  { reservationId: 2, resourceName: "회의실 B", reserverName: "박스프링", reservationDate: "2026-08-07", startTime: "13:00", endTime: "14:30", status: "REQUESTED", note: "API 설계 회의" },
  { reservationId: 3, resourceName: "상담실 1", reserverName: "최도커", reservationDate: "2026-08-08", startTime: "15:00", endTime: "16:00", status: "COMPLETED", note: "Docker 실행 점검" },
];

const reservationStatusLabelMap: Record<ReservationStatus, string> = {
  REQUESTED: "승인 대기",
  CONFIRMED: "예약 확정",
  CANCELLED: "취소",
  COMPLETED: "완료",
};

const emptyReservationForm = {
  resourceName: "회의실 A",
  reserverName: "학습자",
  reservationDate: "2026-08-07",
  startTime: "09:00",
  endTime: "10:00",
  status: "REQUESTED" as ReservationStatus,
  note: "",
};

export const ReservationPracticePage = () => {
  const [reservationItems, setReservationItems] = useState<ReservationItem[]>(initialReservationItems);
  const [selectedDate, setSelectedDate] = useState("");
  const [isFormModalOpen, setFormModalOpen] = useState(false);
  const [editingReservationId, setEditingReservationId] = useState<number | null>(null);
  const [formValues, setFormValues] = useState(emptyReservationForm);
  const [cancelTargetReservation, setCancelTargetReservation] = useState<ReservationItem | null>(null);

  const visibleReservationItems = useMemo(() => [...reservationItems]
    .filter((reservationItem) => !selectedDate || reservationItem.reservationDate === selectedDate)
    .sort((firstReservation, secondReservation) => `${firstReservation.reservationDate}${firstReservation.startTime}`.localeCompare(`${secondReservation.reservationDate}${secondReservation.startTime}`)), [reservationItems, selectedDate]);

  const openCreateModal = (): void => {
    setEditingReservationId(null);
    setFormValues({ ...emptyReservationForm, reservationDate: selectedDate || emptyReservationForm.reservationDate });
    setFormModalOpen(true);
  };

  const openUpdateModal = (reservationItem: ReservationItem): void => {
    setEditingReservationId(reservationItem.reservationId);
    setFormValues({
      resourceName: reservationItem.resourceName,
      reserverName: reservationItem.reserverName,
      reservationDate: reservationItem.reservationDate,
      startTime: reservationItem.startTime,
      endTime: reservationItem.endTime,
      status: reservationItem.status,
      note: reservationItem.note,
    });
    setFormModalOpen(true);
  };

  const saveReservation = (): void => {
    if (!formValues.resourceName.trim() || !formValues.reserverName.trim() || !formValues.reservationDate) {
      applicationNotification.warning("예약 자원, 예약자, 날짜를 입력해 주세요.");
      return;
    }
    if (formValues.startTime >= formValues.endTime) {
      applicationNotification.warning("종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }
    const hasConflict = reservationItems.some((reservationItem) => (
      reservationItem.reservationId !== editingReservationId
      && reservationItem.resourceName === formValues.resourceName
      && reservationItem.reservationDate === formValues.reservationDate
      && reservationItem.status !== "CANCELLED"
      && formValues.startTime < reservationItem.endTime
      && formValues.endTime > reservationItem.startTime
    ));
    if (hasConflict) {
      applicationNotification.error("예약 시간이 중복됩니다.", "409 Conflict 업무 규칙을 화면에서 재현했습니다.");
      return;
    }

    if (editingReservationId === null) {
      setReservationItems((previousReservationItems) => [...previousReservationItems, { reservationId: Date.now(), ...formValues }]);
      applicationNotification.success("예약을 등록했습니다.");
    } else {
      setReservationItems((previousReservationItems) => previousReservationItems.map((reservationItem) => reservationItem.reservationId === editingReservationId ? { ...reservationItem, ...formValues } : reservationItem));
      applicationNotification.success("예약을 수정했습니다.");
    }
    setFormModalOpen(false);
  };

  const cancelReservation = (): void => {
    if (!cancelTargetReservation) return;
    setReservationItems((previousReservationItems) => previousReservationItems.map((reservationItem) => reservationItem.reservationId === cancelTargetReservation.reservationId ? { ...reservationItem, status: "CANCELLED" } : reservationItem));
    applicationNotification.success("예약을 취소했습니다.");
    setCancelTargetReservation(null);
  };

  return (
    <section>
      <div className="page-heading-row"><div><span className="level-badge level-중급">중급 · 난이도 7/10</span><h1>회의실·상담 예약 CRUD</h1><p>시간 중복, 상태 전이, 취소 확인처럼 실제 업무 규칙이 있는 CRUD를 연습합니다.</p></div><button type="button" onClick={openCreateModal}>예약 추가</button></div>
      <div className="list-toolbar reservation-toolbar"><label>날짜 필터<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label><button type="button" className="ghost-button" onClick={() => setSelectedDate("")}>전체 날짜</button></div>
      <div className="reservation-grid">{visibleReservationItems.map((reservationItem) => <article className="reservation-card" key={reservationItem.reservationId}><div className="reservation-card-heading"><div><strong>{reservationItem.resourceName}</strong><span>{reservationItem.reservationDate} · {reservationItem.startTime}~{reservationItem.endTime}</span></div><span className={`reservation-status status-${reservationItem.status.toLowerCase()}`}>{reservationStatusLabelMap[reservationItem.status]}</span></div><dl><dt>예약자</dt><dd>{reservationItem.reserverName}</dd><dt>메모</dt><dd>{reservationItem.note || "없음"}</dd></dl><div className="button-row compact-button-row"><button type="button" className="secondary-button" onClick={() => openUpdateModal(reservationItem)} disabled={reservationItem.status === "CANCELLED" || reservationItem.status === "COMPLETED"}>수정</button><button type="button" className="danger-button" onClick={() => setCancelTargetReservation(reservationItem)} disabled={reservationItem.status === "CANCELLED" || reservationItem.status === "COMPLETED"}>예약 취소</button></div></article>)}</div>
      {visibleReservationItems.length === 0 ? <div className="state-panel">선택한 날짜에 예약이 없습니다.</div> : null}

      <ModalDialog isOpen={isFormModalOpen} title={editingReservationId ? "예약 수정" : "예약 추가"} description="같은 자원과 시간이 겹치면 저장할 수 없습니다." onRequestClose={() => setFormModalOpen(false)} footer={<><button type="button" className="ghost-button" onClick={() => setFormModalOpen(false)}>취소</button><button type="button" onClick={saveReservation}>{editingReservationId ? "수정 저장" : "예약 등록"}</button></>}>
        <div className="modal-form-grid"><label>예약 자원<select value={formValues.resourceName} onChange={(event) => setFormValues((previousFormValues) => ({ ...previousFormValues, resourceName: event.target.value }))}><option>회의실 A</option><option>회의실 B</option><option>상담실 1</option></select></label><label>예약자<input value={formValues.reserverName} onChange={(event) => setFormValues((previousFormValues) => ({ ...previousFormValues, reserverName: event.target.value }))} /></label><label>예약 날짜<input type="date" value={formValues.reservationDate} onChange={(event) => setFormValues((previousFormValues) => ({ ...previousFormValues, reservationDate: event.target.value }))} /></label><div className="modal-form-two-columns"><label>시작 시간<input type="time" value={formValues.startTime} onChange={(event) => setFormValues((previousFormValues) => ({ ...previousFormValues, startTime: event.target.value }))} /></label><label>종료 시간<input type="time" value={formValues.endTime} onChange={(event) => setFormValues((previousFormValues) => ({ ...previousFormValues, endTime: event.target.value }))} /></label></div><label>상태<select value={formValues.status} onChange={(event) => setFormValues((previousFormValues) => ({ ...previousFormValues, status: event.target.value as ReservationStatus }))}>{(Object.keys(reservationStatusLabelMap) as ReservationStatus[]).map((reservationStatus) => <option key={reservationStatus} value={reservationStatus}>{reservationStatusLabelMap[reservationStatus]}</option>)}</select></label><label>메모<textarea rows={4} value={formValues.note} onChange={(event) => setFormValues((previousFormValues) => ({ ...previousFormValues, note: event.target.value }))} /></label></div>
      </ModalDialog>
      <ConfirmDialog isOpen={cancelTargetReservation !== null} title="예약 취소" description={`${cancelTargetReservation?.resourceName ?? ""} ${cancelTargetReservation?.reservationDate ?? ""} 예약을 취소할까요?`} confirmButtonLabel="예약 취소" onConfirm={cancelReservation} onCancel={() => setCancelTargetReservation(null)} />
    </section>
  );
};
