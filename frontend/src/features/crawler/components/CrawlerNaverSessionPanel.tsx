import { useDeleteNaverCrawlerSession, useNaverCrawlerSessionStatus } from "@/features/crawler/hooks/useWebCrawler";

interface CrawlerNaverSessionPanelProps {
  preferSavedSession: boolean;
  onPreferSavedSessionChange: (preferSavedSession: boolean) => void;
}

export const CrawlerNaverSessionPanel = ({ preferSavedSession, onPreferSavedSessionChange }: CrawlerNaverSessionPanelProps) => {
  const sessionQuery = useNaverCrawlerSessionStatus(true);
  const deleteSessionMutation = useDeleteNaverCrawlerSession();
  const sessionAvailable = sessionQuery.data?.available === true;

  return (
    <div className="crawler-session-panel">
      <div>
        <strong>{sessionAvailable ? "저장된 네이버 로그인 세션 있음" : "저장된 네이버 로그인 세션 없음"}</strong>
        <p>{sessionAvailable
          ? `마지막 저장: ${new Date(sessionQuery.data?.updatedAt ?? "").toLocaleString("ko-KR")}`
          : "프로젝트의 start-naver-crawler-login.cmd를 한 번 실행해 브라우저에서 직접 로그인하면 이후 자동 사용됩니다."}</p>
      </div>
      <div className="crawler-session-actions">
        <button type="button" className="secondary-button" onClick={() => void sessionQuery.refetch()} disabled={sessionQuery.isFetching}>상태 새로고침</button>
        {sessionAvailable ? <button type="button" className="danger-button" onClick={() => deleteSessionMutation.mutate()} disabled={deleteSessionMutation.isPending}>저장 세션 삭제</button> : null}
      </div>
      <label className="checkbox-label crawler-login-toggle"><input type="checkbox" checked={preferSavedSession} disabled={!sessionAvailable} onChange={(event) => onPreferSavedSessionChange(event.target.checked)} /><span><strong>저장된 세션 자동 사용</strong><small>아이디와 비밀번호를 다시 입력하지 않습니다.</small></span></label>
    </div>
  );
};
