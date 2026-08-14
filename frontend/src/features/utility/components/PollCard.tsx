import type { Poll, PollStatus } from "@/features/utility/types/pollTypes";
import { calculatePollPercentage, pollStatusLabels } from "@/features/utility/utils/pollRules";

interface PollCardProps {
  poll: Poll;
  selectedOptionIds: number[];
  votePending: boolean;
  statusPending: boolean;
  onSelectionChange: (poll: Poll, optionId: number, checked: boolean) => void;
  onVote: (poll: Poll) => void;
  onEdit: (poll: Poll) => void;
  onDelete?: (poll: Poll) => void;
  onStatusChange: (poll: Poll, status: Exclude<PollStatus, "OPEN">) => void;
}

const formatDateTime = (value: string): string => new Intl.DateTimeFormat("ko-KR", {
  month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
}).format(new Date(value));

export const PollCard = ({
  poll,
  selectedOptionIds,
  votePending,
  statusPending,
  onSelectionChange,
  onVote,
  onEdit,
  onDelete,
  onStatusChange,
}: PollCardProps) => {
  const effectiveSelectedOptionIds = poll.participated ? poll.selectedOptionIds : selectedOptionIds;
  const selectable = poll.status === "OPEN" && !poll.participated;

  return (
    <article className={`poll-topic-card poll-status-${poll.status.toLowerCase()}`}>
      <header className="poll-topic-header">
        <div>
          <div className="poll-topic-badges">
            <span className={`poll-status-badge ${poll.status.toLowerCase()}`}>{pollStatusLabels[poll.status]}</span>
            <span>{poll.allowMultiple ? `복수 선택 · 최대 ${poll.maxSelections}개` : "단일 선택"}</span>
            <span>{poll.realtimeResults ? "실시간 결과" : "종료 후 결과"}</span>
          </div>
          <h2>{poll.question}</h2>
          <p>{poll.creatorName} · {formatDateTime(poll.createdAt)} 생성 · {formatDateTime(poll.endsAt)} 종료</p>
        </div>
        {poll.manageableByCurrentUser ? <div className="poll-manager-actions">
          {poll.status === "OPEN" ? <button type="button" className="ghost-button" onClick={() => onEdit(poll)}>수정</button> : null}
          {poll.status === "OPEN" ? <button type="button" className="secondary-button" disabled={statusPending} onClick={() => onStatusChange(poll, "CLOSED")}>투표 종료</button> : null}
          {poll.status === "CLOSED" ? <button type="button" disabled={statusPending} onClick={() => onStatusChange(poll, "RESULTS_PUBLISHED")}>결과 공개</button> : null}
          {poll.deletableByCurrentUser && onDelete ? <button type="button" className="ghost-button danger-button" onClick={() => onDelete(poll)}>삭제</button> : null}
        </div> : null}
      </header>

      <div className="poll-topic-summary">
        <span><strong>{poll.participantCount}</strong>명 참여</span>
        <span><strong>{poll.options.length}</strong>개 문항</span>
        <span><strong>{poll.totalSelections ?? "—"}</strong>회 선택</span>
        <span>{poll.resultsVisible ? "결과 공개 중" : "결과 비공개"}</span>
      </div>

      <div className="poll-choice-list">
        {poll.options.map((option) => {
          const checked = effectiveSelectedOptionIds.includes(option.optionId);
          const percentage = calculatePollPercentage(option.votes, poll.participantCount);
          return (
            <label className={`poll-choice ${checked ? "selected" : ""} ${!selectable ? "disabled" : ""}`} key={option.optionId}>
              {poll.resultsVisible ? <span className="poll-choice-bar" style={{ width: `${percentage}%` }} /> : null}
              <span className="poll-choice-main">
                <input
                  type={poll.allowMultiple ? "checkbox" : "radio"}
                  name={`poll-${poll.pollId}`}
                  checked={checked}
                  disabled={!selectable}
                  onChange={(event) => onSelectionChange(poll, option.optionId, event.target.checked)}
                />
                <strong>{option.label}</strong>
              </span>
              {poll.resultsVisible ? <span className="poll-choice-result"><strong>{option.votes ?? 0}표</strong><small>{percentage}%</small></span> : <span className="poll-choice-hidden">결과 비공개</span>}
            </label>
          );
        })}
      </div>

      {!poll.resultsVisible ? <div className="poll-result-lock">
        <span>🔒</span>
        <p>{poll.status === "OPEN" ? "작성자가 실시간 공개를 사용하지 않았습니다. 투표 종료 후 결과 공개를 기다려 주세요." : "투표가 종료되었습니다. 작성자가 결과 공개를 누르면 막대그래프가 표시됩니다."}</p>
      </div> : null}

      <footer className="poll-topic-footer">
        <div>
          {poll.participated ? <strong>참여 완료 · {poll.selectedOptionIds.length}개 선택</strong> : poll.status === "OPEN" ? <><strong>{poll.allowMultiple ? `최대 ${poll.maxSelections}개 선택` : "한 문항 선택"}</strong><small>선택 후 투표하기를 눌러야 반영됩니다.</small></> : <strong>종료된 투표입니다.</strong>}
        </div>
        <button type="button" disabled={!selectable || selectedOptionIds.length === 0 || votePending} onClick={() => onVote(poll)}>
          {poll.participated ? "참여 완료" : poll.status === "OPEN" ? votePending ? "반영 중..." : "투표하기" : "투표 종료"}
        </button>
      </footer>
    </article>
  );
};
