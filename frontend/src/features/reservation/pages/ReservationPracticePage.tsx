/**
 * ============================================================================
 * ReservationPracticePage.tsx — 【중급】 업무 규칙이 있는 CRUD
 * ============================================================================
 *
 * 지금까지의 CRUD는 "입력한 대로 저장"이 전부였다.
 * 여기서는 실제 업무에 있는 "규칙"을 코드로 옮겨 본다.
 *
 * [이 화면이 지키는 세 가지 규칙]
 *   1. 종료 시간은 시작 시간보다 늦어야 한다
 *   2. 같은 회의실의 같은 시간대에 두 예약이 겹칠 수 없다  ← 가장 중요
 *   3. 취소/완료된 예약은 더 이상 수정할 수 없다
 *
 * ★ 규칙 2번은 실무에서 서버가 409 Conflict로 막는 대표적인 경우다.
 *   여기서는 그 판정 로직을 화면에서 직접 구현해 원리를 익힌다.
 *
 * [이 페이지의 또 다른 특징: 폼 State를 객체 하나로 묶기]
 *   지금까지는 입력칸마다 useState를 따로 만들었다.
 *   여기서는 항목이 7개나 되어 그러면 너무 길어진다.
 *   그래서 객체 하나에 담고 전개 연산자로 일부만 바꾸는 방식을 쓴다.
 */

import { useMemo, useState } from "react";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ModalDialog } from "@/shared/ui/ModalDialog";

// 예약이 거칠 수 있는 상태들. 이런 걸 "상태 기계(state machine)"라고 부른다.
//   REQUESTED(신청) → CONFIRMED(확정) → COMPLETED(완료)
//                  ↘ CANCELLED(취소)
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

/**
 * 폼의 초기값.
 *
 * ★ 빈 문자열이 아니라 그럴듯한 기본값을 넣은 점에 주목.
 *   예약 화면에서 자주 쓰는 값을 미리 채워 두면
 *   사용자가 손댈 곳이 줄어든다. 좋은 폼 설계의 기본이다.
 *
 * ★ `"REQUESTED" as ReservationStatus` 에서 as가 필요한 이유
 *   as를 안 쓰면 TypeScript가 이 값의 타입을 그냥 `string`으로 추론한다.
 *   그러면 나중에 ReservationStatus를 요구하는 곳에 넣을 때 타입 에러가 난다.
 *   "이건 그냥 문자열이 아니라 정해진 상태값 중 하나"라고 알려 주는 것이다.
 */
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
  // ★ 폼 값 7개를 객체 하나로 관리한다.
  //   useState 7개를 만드는 대신 이렇게 묶으면 코드가 훨씬 짧아진다.
  //   대신 값을 바꿀 때 규칙이 하나 있다:
  //     setFormValues((prev) => ({ ...prev, 바꿀항목: 새값 }))
  //   ...prev로 나머지를 그대로 복사해야 한다.
  //   이걸 빠뜨리고 setFormValues({ note: "..." }) 라고 하면
  //   나머지 6개 항목이 통째로 사라진다! 아주 흔한 실수다.
  const [formValues, setFormValues] = useState(emptyReservationForm);

  const [cancelTargetReservation, setCancelTargetReservation] = useState<ReservationItem | null>(null);

  // ── 날짜 필터 + 시간순 정렬 ─────────────────────────────────────
  const visibleReservationItems = useMemo(() => [...reservationItems]
    // `!selectedDate ||` 부분이 요령이다.
    //   날짜를 안 골랐으면(빈 문자열) 첫 조건이 true라서 전부 통과한다.
    //   골랐으면 그 날짜와 같은 것만 통과한다.
    //   if로 나눠 쓰지 않고 한 줄로 "필터 없음"을 표현한 것이다.
    .filter((reservationItem) => !selectedDate || reservationItem.reservationDate === selectedDate)

    // ★ 날짜와 시간을 이어 붙인 문자열로 정렬하는 요령.
    //   "2026-08-07" + "10:00" → "2026-08-0710:00"
    //   이 형식은 글자순으로 정렬해도 시간순과 정확히 일치한다.
    //   (연-월-일이 큰 단위부터 오고, 한 자리도 0으로 채워져 있기 때문)
    //   그래서 Date 객체로 바꾸는 복잡한 처리 없이 문자열 비교만으로 끝난다.
    //
    //   localeCompare: 문자열 두 개를 비교해 -1/0/1을 돌려준다.
    //   ★ 위에서 [...reservationItems]로 복사한 이유를 기억하자.
    //     sort는 원본을 직접 바꾸므로 State 배열에 직접 쓰면 안 된다.
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

  /** 【Create + Update】 예약을 저장한다. 세 가지 규칙을 순서대로 검사한다. */
  const saveReservation = (): void => {
    // ── 규칙 1: 필수 항목 확인 ──
    if (!formValues.resourceName.trim() || !formValues.reserverName.trim() || !formValues.reservationDate) {
      applicationNotification.warning("예약 자원, 예약자, 날짜를 입력해 주세요.");
      return;
    }

    // ── 규칙 2: 시간 순서 확인 ──
    // ★ 시간 문자열을 그대로 비교할 수 있는 이유
    //   "09:00" < "10:00" 처럼 글자순 비교가 시간순과 일치한다.
    //   HH:mm 형식이고 한 자리도 0으로 채워져 있기 때문이다.
    //   ("9:00"처럼 0을 안 채우면 "9:00" > "10:00"이 되어 깨진다!)
    //
    //   `>=` 로 같은 경우도 막는다. 시작과 끝이 같으면 길이 0인 예약이 된다.
    if (formValues.startTime >= formValues.endTime) {
      applicationNotification.warning("종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }

    // ── 규칙 3: 시간 겹침 확인 ★★ 이 페이지의 핵심 로직 ──
    //
    // [두 구간이 겹치는지 판별하는 공식]
    //   구간 A(내가 예약하려는 것)와 구간 B(기존 예약)가 겹치려면
    //     A.시작 < B.끝  AND  A.끝 > B.시작
    //   이 두 조건을 동시에 만족해야 한다.
    //
    // [왜 이 공식이 맞는지 그림으로 보자]
    //   기존 예약 B:        10:00 ─────── 11:00
    //
    //   (1) A: 09:00~09:30  → A.끝(09:30) > B.시작(10:00)? 거짓 → 안 겹침 ✓
    //   (2) A: 11:00~12:00  → A.시작(11:00) < B.끝(11:00)? 거짓 → 안 겹침 ✓
    //                         (딱 붙어 있는 건 겹치는 게 아니다. 이어서 쓸 수 있다)
    //   (3) A: 10:30~11:30  → 10:30 < 11:00 참, 11:30 > 10:00 참 → 겹침! ✗
    //   (4) A: 09:00~12:00  → 09:00 < 11:00 참, 12:00 > 10:00 참 → 겹침! ✗
    //                         (기존 예약을 통째로 감싸는 경우도 잡아낸다)
    //
    // ★ 이 공식은 실무에서 자주 쓰인다. 회의실, 숙박, 장비 대여 등
    //   "기간이 겹치면 안 되는" 모든 곳에 똑같이 적용된다. 외워 두면 좋다.
    const hasConflict = reservationItems.some((reservationItem) => (
      // 자기 자신은 검사에서 제외한다.
      // ★ 이게 없으면 수정할 때 "나 자신과 겹친다"며 저장이 막힌다. 필수 조건이다.
      reservationItem.reservationId !== editingReservationId
      // 다른 회의실이면 시간이 겹쳐도 상관없다.
      && reservationItem.resourceName === formValues.resourceName
      // 다른 날짜면 역시 상관없다.
      && reservationItem.reservationDate === formValues.reservationDate
      // 취소된 예약은 자리를 차지하지 않는다.
      && reservationItem.status !== "CANCELLED"
      // 위에서 설명한 겹침 판정 공식.
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

  /**
   * 【Delete 대신 상태 변경】 예약을 취소한다.
   *
   * ★ filter로 지우지 않고 status만 "CANCELLED"로 바꾼 점에 주목.
   *   실제 예약 시스템에서는 취소 기록을 절대 지우지 않는다.
   *     - 누가 언제 취소했는지 추적해야 한다
   *     - 취소 통계를 내야 한다
   *     - 분쟁이 생기면 근거가 필요하다
   *   이런 방식을 soft delete(논리 삭제)라고 하며, 실무의 기본이다.
   *   (댓글 페이지에서도 같은 개념이 나왔다)
   */
  const cancelReservation = (): void => {
    if (!cancelTargetReservation) return;
    setReservationItems((previousReservationItems) => previousReservationItems.map((reservationItem) => reservationItem.reservationId === cancelTargetReservation.reservationId ? { ...reservationItem, status: "CANCELLED" } : reservationItem));
    applicationNotification.success("예약을 취소했습니다.");
    setCancelTargetReservation(null);
  };

  return (
    <section>
      <div className="page-heading-row"><div><span className="level-badge level-중급">중급 · 난이도 7/10</span><h1>회의실·상담 예약 CRUD</h1><p>시간 중복, 상태 전이, 취소 확인처럼 실제 업무 규칙이 있는 CRUD를 연습합니다.</p></div><button type="button" onClick={openCreateModal}>예약 추가</button></div>
      {/* type="date": 브라우저가 달력 UI를 공짜로 그려 준다.
          값은 항상 "2026-08-07" 형식의 문자열로 들어온다.
          ★ 직접 달력을 만들면 수백 줄이 든다. 기본 기능으로 되는 건 그걸 쓰자.

          "전체 날짜" 버튼은 필터를 빈 문자열로 되돌려 해제한다.
          필터를 걸었으면 푸는 방법도 반드시 제공해야 한다. */}
      <div className="list-toolbar reservation-toolbar"><label>날짜 필터<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label><button type="button" className="ghost-button" onClick={() => setSelectedDate("")}>전체 날짜</button></div>
      {/* ★ 아래 카드의 두 버튼에 붙은 disabled 조건을 눈여겨보자.
              disabled={status === "CANCELLED" || status === "COMPLETED"}

            이것이 "규칙 3: 끝난 예약은 수정할 수 없다"의 구현이다.
            이미 취소했거나 완료된 예약을 다시 수정하거나 취소하는 건 말이 안 된다.

            ★ 버튼을 숨기지(null) 않고 비활성화(disabled)한 이유
              숨기면 사용자는 "왜 나만 수정 버튼이 없지?" 하고 혼란스러워한다.
              회색으로 비활성화해 두면 "있긴 한데 지금은 안 되는구나"를 알 수 있다.
              상태에 따라 일시적으로 못 하는 것은 disabled,
              권한이 아예 없어 영원히 못 하는 것은 숨기기 — 이렇게 구분하면 좋다. */}
      <div className="reservation-grid">{visibleReservationItems.map((reservationItem) => <article className="reservation-card" key={reservationItem.reservationId}><div className="reservation-card-heading"><div><strong>{reservationItem.resourceName}</strong><span>{reservationItem.reservationDate} · {reservationItem.startTime}~{reservationItem.endTime}</span></div><span className={`reservation-status status-${reservationItem.status.toLowerCase()}`}>{reservationStatusLabelMap[reservationItem.status]}</span></div><dl><dt>예약자</dt><dd>{reservationItem.reserverName}</dd><dt>메모</dt><dd>{reservationItem.note || "없음"}</dd></dl><div className="button-row compact-button-row"><button type="button" className="secondary-button" onClick={() => openUpdateModal(reservationItem)} disabled={reservationItem.status === "CANCELLED" || reservationItem.status === "COMPLETED"}>수정</button><button type="button" className="danger-button" onClick={() => setCancelTargetReservation(reservationItem)} disabled={reservationItem.status === "CANCELLED" || reservationItem.status === "COMPLETED"}>예약 취소</button></div></article>)}</div>
      {visibleReservationItems.length === 0 ? <div className="state-panel">선택한 날짜에 예약이 없습니다.</div> : null}

      <ModalDialog isOpen={isFormModalOpen} title={editingReservationId ? "예약 수정" : "예약 추가"} description="같은 자원과 시간이 겹치면 저장할 수 없습니다." onRequestClose={() => setFormModalOpen(false)} footer={<><button type="button" className="ghost-button" onClick={() => setFormModalOpen(false)}>취소</button><button type="button" onClick={saveReservation}>{editingReservationId ? "수정 저장" : "예약 등록"}</button></>}>
        {/* ★★ 폼 State를 객체로 관리할 때의 갱신 패턴이 여기 반복해서 나온다.
                setFormValues((prev) => ({ ...prev, 바꿀항목: 새값 }))

              읽는 법:
                ...prev          → 기존 7개 항목을 전부 복사하고
                resourceName: X  → 그중 하나만 새 값으로 덮어쓴다

              `=> ({ ... })` 처럼 소괄호로 감싼 것도 잊지 말자.
              소괄호가 없으면 JavaScript가 중괄호를 함수 본문으로 오해한다.

              ★ 아래 <select>의 상태 목록은 Object.keys로 만들어진다.
                라벨 변환표의 키를 그대로 쓰므로, 상태를 추가하면
                선택 목록에도 자동으로 나타난다. 손댈 곳이 하나 줄어든다. */}
        <div className="modal-form-grid"><label>예약 자원<select value={formValues.resourceName} onChange={(event) => setFormValues((previousFormValues) => ({ ...previousFormValues, resourceName: event.target.value }))}><option>회의실 A</option><option>회의실 B</option><option>상담실 1</option></select></label><label>예약자<input value={formValues.reserverName} onChange={(event) => setFormValues((previousFormValues) => ({ ...previousFormValues, reserverName: event.target.value }))} /></label><label>예약 날짜<input type="date" value={formValues.reservationDate} onChange={(event) => setFormValues((previousFormValues) => ({ ...previousFormValues, reservationDate: event.target.value }))} /></label><div className="modal-form-two-columns"><label>시작 시간<input type="time" value={formValues.startTime} onChange={(event) => setFormValues((previousFormValues) => ({ ...previousFormValues, startTime: event.target.value }))} /></label><label>종료 시간<input type="time" value={formValues.endTime} onChange={(event) => setFormValues((previousFormValues) => ({ ...previousFormValues, endTime: event.target.value }))} /></label></div><label>상태<select value={formValues.status} onChange={(event) => setFormValues((previousFormValues) => ({ ...previousFormValues, status: event.target.value as ReservationStatus }))}>{(Object.keys(reservationStatusLabelMap) as ReservationStatus[]).map((reservationStatus) => <option key={reservationStatus} value={reservationStatus}>{reservationStatusLabelMap[reservationStatus]}</option>)}</select></label><label>메모<textarea rows={4} value={formValues.note} onChange={(event) => setFormValues((previousFormValues) => ({ ...previousFormValues, note: event.target.value }))} /></label></div>
      </ModalDialog>
      <ConfirmDialog isOpen={cancelTargetReservation !== null} title="예약 취소" description={`${cancelTargetReservation?.resourceName ?? ""} ${cancelTargetReservation?.reservationDate ?? ""} 예약을 취소할까요?`} confirmButtonLabel="예약 취소" onConfirm={cancelReservation} onCancel={() => setCancelTargetReservation(null)} />
    </section>
  );
};
