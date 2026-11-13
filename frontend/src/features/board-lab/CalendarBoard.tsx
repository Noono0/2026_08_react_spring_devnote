import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { boardApi, boardDescriptions, type BoardPostSummary } from "./boardApi";
import { calendarHolidayApi, holidayKindLabels } from "./calendarHolidayApi";
import { CalendarHolidayManager } from "./CalendarHolidayManager";

const monthPattern = /^(19\d\d|20\d\d|2100)-(0[1-9]|1[0-2])$/;
const dateKey = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const currentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};
const monthOffset = (value: string, offset: number) => {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const next = new Date(year, month - 1 + offset, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
};
const weekdays = ["월", "화", "수", "목", "금", "토", "일"];
const holidaySourceLabels = { API: "공공데이터 최신 자료", CACHE: "공공데이터 저장 자료", SNAPSHOT: "기본 포함 자료", UNAVAILABLE: "자료 없음" };

/** 기간과 겹치는 날짜마다 글을 표시한다. 반복 범위는 현재 월의 날짜로 제한한다. */
export function CalendarBoard() {
  const [searchParameters, setSearchParameters] = useSearchParams();
  const requestedMonth = searchParameters.get("month") ?? "";
  const month = monthPattern.test(requestedMonth) ? requestedMonth : currentMonth();
  const keyword = searchParameters.get("keyword")?.slice(0, 100) ?? "";
  const [draftKeyword, setDraftKeyword] = useState(keyword);
  useEffect(() => setDraftKeyword(keyword), [keyword]);
  const session = useAuthSessionQuery();
  const result = useQuery({ queryKey: ["board-lab", "calendar", month, keyword],
    queryFn: ({ signal }) => boardApi.calendarMonth(month, keyword, signal) });
  const holidays = useQuery({ queryKey: ["board-lab", "holidays", month],
    queryFn: ({ signal }) => calendarHolidayApi.month(month, signal), staleTime: 60_000 });
  const changeMonth = (next: string) => setSearchParameters({ month: next, ...(keyword ? { keyword } : {}) });
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchParameters({ month, ...(draftKeyword.trim() ? { keyword: draftKeyword.trim().slice(0, 100) } : {}) });
  };
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const startOffset = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const cellCount = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const byDate = new Map<string, BoardPostSummary[]>();
  for (const post of result.data?.content ?? []) {
    if (!post.eventDate) continue;
    const endDate = post.eventEndDate ?? post.eventDate;
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = dateKey(year, monthNumber, day);
      if (date < post.eventDate || date > endDate) continue;
      const posts = byDate.get(date) ?? [];
      posts.push(post);
      byDate.set(date, posts);
    }
  }
  return <section className="board-lab-panel">
    <div className="board-lab-heading"><div><h2>달력 게시판</h2><p>{boardDescriptions.CALENDAR}</p></div>
      {session.data?.authenticated ? <Link className="primary-link" to="/react/boards/calendar/new">글쓰기</Link> : null}</div>
    {!session.data?.authenticated && !session.isLoading ? <p className="board-lab-hint">글을 작성하려면 로그인해 주세요.</p> : null}
    <form className="board-lab-search" onSubmit={submitSearch} role="search"><label htmlFor="calendar-keyword">제목·내용 검색</label>
      <input id="calendar-keyword" value={draftKeyword} maxLength={100} onChange={(event) => setDraftKeyword(event.target.value)} placeholder="검색어" />
      <button type="submit">검색</button></form>
    <div className="board-lab-month-nav"><button type="button" onClick={() => changeMonth(monthOffset(month, -1))} disabled={month === "1900-01"} aria-label="이전 달">이전 달</button>
      <h3>{year}년 {monthNumber}월</h3><button type="button" onClick={() => changeMonth(monthOffset(month, 1))} disabled={month === "2100-12"} aria-label="다음 달">다음 달</button></div>
    {holidays.isPending ? <p role="status">공휴일 정보를 불러오는 중입니다.</p> : null}
    {holidays.isError ? <div role="alert" className="state-panel error-state">공휴일 정보를 불러오지 못했습니다. <button type="button" onClick={() => void holidays.refetch()}>공휴일 다시 시도</button></div> : null}
    {holidays.data?.warning ? <p role="status" className="board-lab-hint">{holidays.data.warning}</p> : null}
    {holidays.data && !holidays.data.officialDataAvailable ? <p role="status" className="board-lab-hint">{year}년 공식 공휴일 자료가 아직 등록되지 않았습니다. 직접 등록한 휴일만 표시합니다. 지원 연도: {holidays.data.supportedYears.join(", ")}</p> : null}
    {session.data?.administrator && holidays.data ? <CalendarHolidayManager key={month} month={month} holidays={holidays.data.content} /> : null}
    {result.isPending ? <div className="state-panel" role="status">달력 글을 불러오는 중입니다.</div> : null}
    {result.isError ? <div className="state-panel error-state" role="alert">달력 글을 불러오지 못했습니다. <button type="button" onClick={() => void result.refetch()}>다시 시도</button></div> : null}
    <>
      {result.data ? <p className="board-lab-count">{result.data.content.length}건{result.data.truncated ? " · 결과가 500건을 넘어 일부만 표시됩니다. 검색어를 입력해 주세요." : ""}</p> : null}
      {result.data?.content.length === 0 ? <p className="board-lab-hint">이 달에 등록된 글이 없습니다.</p> : null}
      <div className="board-lab-calendar" role="region" aria-label={`${year}년 ${monthNumber}월 게시글 달력`}>
        {weekdays.map((day, index) => <div className="board-lab-weekday" data-weekday={index} key={day}>{day}</div>)}
        {Array.from({ length: cellCount }, (_, index) => {
          const day = index - startOffset + 1;
          if (day < 1 || day > daysInMonth) return <div className="board-lab-day board-lab-day-empty" key={`empty-${index}`} aria-hidden="true" />;
          const date = dateKey(year, monthNumber, day);
          const posts = byDate.get(date) ?? [];
          const dayHolidays = holidays.data?.content.filter((holiday) => holiday.date === date) ?? [];
          const publicHoliday = dayHolidays.some((holiday) => holiday.kind !== "COMPANY");
          return <div className={`board-lab-day${publicHoliday ? " board-lab-day-holiday" : ""}`} data-weekday={index % 7} key={date} aria-label={`${monthNumber}월 ${day}일, 글 ${posts.length}건${dayHolidays.length ? `, ${dayHolidays.map((holiday) => holiday.name).join(", ")}` : ""}`}>
            <div className="board-lab-day-head"><strong>{day}</strong>{session.data?.authenticated ? <Link to={`/react/boards/calendar/new?date=${date}`} aria-label={`${monthNumber}월 ${day}일 글쓰기`}>+</Link> : null}</div>
            {dayHolidays.map((holiday) => <p key={holiday.official ? `official-${holiday.date}-${holiday.name}` : holiday.holidayId}
              className={`board-lab-holiday-name${holiday.kind === "COMPANY" ? " board-lab-holiday-company" : ""}`} title={holidayKindLabels[holiday.kind]}>
              {holiday.kind === "COMPANY" ? "휴무 · " : ""}{holiday.name}</p>)}
            <ul>{posts.map((post) => <li key={post.postId}><Link to={`/react/boards/calendar/${post.postId}`} title={`${post.title} (${post.eventDate} ~ ${post.eventEndDate ?? post.eventDate})`}>{post.title}</Link></li>)}</ul>
          </div>;
        })}
      </div>
    </>
    {holidays.data?.officialDataAvailable ? <p className="board-lab-hint">{holidaySourceLabels[holidays.data.source ?? "SNAPSHOT"]} · 공휴일 자료 확인일: {holidays.data.verifiedAt} · {holidays.data.sourceUrls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer">공식 자료 {index + 1} </a>)}</p> : null}
  </section>;
}
