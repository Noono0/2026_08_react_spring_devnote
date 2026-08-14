import type { Poll } from "@/features/utility/types/pollTypes";
import { pollStatusLabels } from "@/features/utility/utils/pollRules";

interface PollListViewProps {
  polls: Poll[];
  onDetailOpen: (poll: Poll) => void;
  onDelete: (poll: Poll) => void;
}

const formatEndsAt = (endsAt: string): string => new Intl.DateTimeFormat("ko-KR", {
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
}).format(new Date(endsAt));

export const PollListView = ({ polls, onDetailOpen, onDelete }: PollListViewProps) => (
  <div className="poll-compact-list">
    <div className="poll-compact-heading" aria-hidden="true">
      <span>상태·토픽</span><span>문항</span><span>참여</span><span>투표됨</span><span>종료 시간</span><span>관리</span>
    </div>
    {polls.map((poll) => (
      <article className="poll-compact-row" key={poll.pollId}>
        <div className="poll-compact-title">
          <span className={`poll-status-badge ${poll.status.toLowerCase()}`}>{pollStatusLabels[poll.status]}</span>
          <button type="button" onClick={() => onDetailOpen(poll)}>{poll.question}</button>
          <small>{poll.creatorName} · {poll.allowMultiple ? `최대 ${poll.maxSelections}개 복수 선택` : "단일 선택"}</small>
        </div>
        <span data-label="문항"><strong>{poll.options.length}</strong>개 문항</span>
        <span data-label="참여"><strong>{poll.participantCount}</strong>명 참여</span>
        <span data-label="투표됨"><strong>{poll.totalSelections ?? "—"}</strong>{poll.totalSelections === null ? "비공개" : "개 투표됨"}</span>
        <time data-label="종료 시간" dateTime={poll.endsAt}>{formatEndsAt(poll.endsAt)}</time>
        <div className="poll-compact-actions">
          <button type="button" className="ghost-button" onClick={() => onDetailOpen(poll)}>상세보기</button>
          {poll.deletableByCurrentUser ? <button type="button" className="ghost-button danger-button" onClick={() => onDelete(poll)}>삭제</button> : null}
        </div>
      </article>
    ))}
  </div>
);
