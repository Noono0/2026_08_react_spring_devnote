import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { boardApi, type BoardPostSummary } from "./boardApi";

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

/** 같은 날짜의 여러 글을 묶어 한 달 전체를 그린다. 날짜 계산은 브라우저 현지 시간 기준이다. */
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
    const posts = byDate.get(post.eventDate) ?? [];
    posts.push(post);
    byDate.set(post.eventDate, posts);
  }
  return <section className="board-lab-panel">
    <div className="board-lab-heading"><div><h2>달력 게시판</h2><p>날짜별 글을 보고, 날짜를 선택해 새 글을 작성합니다.</p></div>
      {session.data?.authenticated ? <Link className="primary-link" to="/react/boards/calendar/new">글쓰기</Link> : null}</div>
    {!session.data?.authenticated && !session.isLoading ? <p className="board-lab-hint">글을 작성하려면 로그인해 주세요.</p> : null}
    <form className="board-lab-search" onSubmit={submitSearch} role="search"><label htmlFor="calendar-keyword">제목·내용 검색</label>
      <input id="calendar-keyword" value={draftKeyword} maxLength={100} onChange={(event) => setDraftKeyword(event.target.value)} placeholder="검색어" />
      <button type="submit">검색</button></form>
    <div className="board-lab-month-nav"><button type="button" onClick={() => changeMonth(monthOffset(month, -1))} disabled={month === "1900-01"} aria-label="이전 달">이전 달</button>
      <h3>{year}년 {monthNumber}월</h3><button type="button" onClick={() => changeMonth(monthOffset(month, 1))} disabled={month === "2100-12"} aria-label="다음 달">다음 달</button></div>
    {result.isPending ? <div className="state-panel" role="status">달력 글을 불러오는 중입니다.</div> : null}
    {result.isError ? <div className="state-panel error-state" role="alert">달력 글을 불러오지 못했습니다. <button type="button" onClick={() => void result.refetch()}>다시 시도</button></div> : null}
    {result.data ? <>
      <p className="board-lab-count">{result.data.content.length}건{result.data.truncated ? " · 결과가 500건을 넘어 일부만 표시됩니다. 검색어를 입력해 주세요." : ""}</p>
      {result.data.content.length === 0 ? <p className="board-lab-hint">이 달에 등록된 글이 없습니다.</p> : null}
      <div className="board-lab-calendar" role="region" aria-label={`${year}년 ${monthNumber}월 게시글 달력`}>
        {weekdays.map((day) => <div className="board-lab-weekday" key={day}>{day}</div>)}
        {Array.from({ length: cellCount }, (_, index) => {
          const day = index - startOffset + 1;
          if (day < 1 || day > daysInMonth) return <div className="board-lab-day board-lab-day-empty" key={`empty-${index}`} aria-hidden="true" />;
          const date = dateKey(year, monthNumber, day);
          const posts = byDate.get(date) ?? [];
          return <div className="board-lab-day" key={date} aria-label={`${monthNumber}월 ${day}일, 글 ${posts.length}건`}>
            <div className="board-lab-day-head"><strong>{day}</strong>{session.data?.authenticated ? <Link to={`/react/boards/calendar/new?date=${date}`} aria-label={`${monthNumber}월 ${day}일 글쓰기`}>+</Link> : null}</div>
            <ul>{posts.map((post) => <li key={post.postId}><Link to={`/react/boards/calendar/${post.postId}`} title={post.title}>{post.title}</Link></li>)}</ul>
          </div>;
        })}
      </div>
    </> : null}
  </section>;
}
