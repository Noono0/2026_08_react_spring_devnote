import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { isCalendarDate, seoulDate } from "./calendarDates";
import { calendarHolidayApi, holidayKinds, holidayKindLabels, type CalendarHoliday, type CustomHoliday, type HolidayKind } from "./calendarHolidayApi";

export function CalendarHolidayManager({ month, holidays }: { month: string; holidays: CalendarHoliday[] }) {
  const queryClient = useQueryClient();
  const defaultDate = seoulDate().startsWith(month) ? seoulDate() : `${month}-01`;
  const [date, setDate] = useState(defaultDate);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<HolidayKind>("TEMPORARY");
  const [editing, setEditing] = useState<CustomHoliday>();
  const [deleting, setDeleting] = useState<CustomHoliday>();
  const [error, setError] = useState("");
  const dateReference = useRef<HTMLInputElement>(null);
  const nameReference = useRef<HTMLInputElement>(null);
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["board-lab", "holidays"] }); };
  const reset = () => { setEditing(undefined); setDate(defaultDate); setName(""); setKind("TEMPORARY"); setError(""); };
  const reportError = (failure: unknown) => { applicationNotification.apiError(convertRequestErrorToProblemDetails(failure)); refresh(); };
  const save = useMutation({ mutationFn: () => {
    const input = { date, name: name.trim(), kind };
    return editing ? calendarHolidayApi.update(editing.holidayId, { ...input, versionNumber: editing.versionNumber }) : calendarHolidayApi.create(input);
  }, onSuccess: () => { applicationNotification.success(editing ? "휴일을 수정했습니다." : "휴일을 추가했습니다."); reset(); refresh(); }, onError: reportError });
  const remove = useMutation({ mutationFn: () => {
    if (!deleting) throw new Error("삭제할 휴일을 선택해 주세요.");
    return calendarHolidayApi.delete(deleting.holidayId, deleting.versionNumber);
  }, onSuccess: () => { if (editing?.holidayId === deleting?.holidayId) reset(); setDeleting(undefined); refresh(); applicationNotification.success("휴일을 삭제했습니다."); },
  onError: (failure) => { setDeleting(undefined); reportError(failure); } });
  const pending = save.isPending || remove.isPending;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isCalendarDate(date)) { setError("1900~2100년의 올바른 휴일 날짜를 선택해 주세요."); dateReference.current?.focus(); return; }
    if (!name.trim()) { setError("휴일 이름을 입력해 주세요."); nameReference.current?.focus(); return; }
    setError(""); save.mutate();
  };
  return <details className="board-lab-holiday-manager"><summary>휴일 관리</summary>
    <p className="board-lab-hint">공식 공휴일은 원본을 유지합니다. 임시 지정 휴일·별도 대체공휴일·회사 휴무일을 추가할 수 있습니다.</p>
    <form onSubmit={submit} className="board-lab-holiday-form" noValidate>
      <label htmlFor="holiday-date">휴일 날짜 *</label><input ref={dateReference} id="holiday-date" type="date" min="1900-01-01" max="2100-12-31" value={date} disabled={pending} onChange={(event) => setDate(event.target.value)} />
      <label htmlFor="holiday-name">휴일 이름 *</label><input ref={nameReference} id="holiday-name" value={name} maxLength={80} disabled={pending} onChange={(event) => setName(event.target.value)} />
      <label htmlFor="holiday-kind">휴일 종류</label><select id="holiday-kind" value={kind} disabled={pending} onChange={(event) => {
        const next = holidayKinds.find((item) => item === event.target.value);
        if (next) setKind(next);
      }}>{holidayKinds.map((item) => <option key={item} value={item}>{holidayKindLabels[item]}</option>)}</select>
      {error ? <p role="alert" className="board-lab-error">{error}</p> : null}
      <div className="board-lab-actions"><button type="submit" disabled={pending}>{save.isPending ? "저장 중..." : editing ? "휴일 수정 저장" : "휴일 추가"}</button>
        {editing ? <button type="button" onClick={reset} disabled={pending}>수정 취소</button> : null}</div>
    </form>
    <h4>이 달에 직접 등록한 휴일</h4>
    {holidays.every((holiday) => holiday.official) ? <p className="board-lab-hint">직접 등록한 휴일이 없습니다.</p> : null}
    <ul className="board-lab-custom-holidays">{holidays.filter((holiday): holiday is CustomHoliday => !holiday.official).map((holiday) => <li key={holiday.holidayId}>
      <span>{holiday.date} · {holiday.name} ({holidayKindLabels[holiday.kind]})</span>
      <button type="button" disabled={pending} aria-label={`${holiday.name} 수정`} onClick={() => { setEditing(holiday); setDate(holiday.date); setName(holiday.name); setKind(holiday.kind); setError(""); nameReference.current?.focus(); }}>수정</button>
      <button type="button" disabled={pending} aria-label={`${holiday.name} 삭제`} onClick={() => setDeleting(holiday)}>삭제</button>
    </li>)}</ul>
    <ConfirmDialog isOpen={Boolean(deleting)} title="휴일 삭제" description={`${deleting?.name ?? ""} 휴일을 삭제하시겠습니까?`}
      isConfirming={remove.isPending} onConfirm={() => remove.mutate()} onCancel={() => setDeleting(undefined)} confirmButtonLabel="삭제하기" />
  </details>;
}
