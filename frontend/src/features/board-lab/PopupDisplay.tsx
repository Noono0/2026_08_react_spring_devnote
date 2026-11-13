import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { ModalDialog } from "@/shared/ui/ModalDialog";
import { sanitizeRichTextHtml } from "@/shared/lib/sanitizeRichTextHtml";
import { boardApi } from "./boardApi";
import { normalizePopupPath, seoulDate } from "./calendarDates";

function RoutePopups({ path }: { path: string }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [today, setToday] = useState(seoulDate);
  const normalizedPath = normalizePopupPath(path);
  const enabled = import.meta.env.VITE_DATA_SOURCE !== "mock" && Boolean(normalizedPath)
    && path !== "/react/boards/popup" && !path.startsWith("/react/boards/popup/");
  const result = useQuery({ queryKey: ["board-lab", "active-popups", normalizedPath, today],
    queryFn: ({ signal }) => boardApi.activePopups(normalizedPath ?? path, signal), enabled,
    refetchInterval: 60_000, retry: false });
  useEffect(() => {
    // 한국 시간 자정에 만료 팝업을 즉시 숨기고 새 날짜의 노출 목록을 조회한다.
    const nextMidnight = Date.parse(`${today}T00:00:00+09:00`) + 86_400_000;
    const timer = window.setTimeout(() => setToday(seoulDate()), Math.max(1, nextMidnight - Date.now() + 10));
    return () => window.clearTimeout(timer);
  }, [today]);
  if (!enabled) return null;
  if (result.isError) return <div role="status" className="board-popup-error">안내 팝업을 확인하지 못했습니다. <button type="button" onClick={() => void result.refetch()}>다시 확인</button></div>;
  const popups = (result.data ?? []).filter((popup) => popup.endDate >= today && !dismissed.includes(`${popup.postId}:${popup.versionNumber}`));
  const popup = popups[0];
  if (!popup) return null;
  const token = `${popup.postId}:${popup.versionNumber}`;
  const close = () => setDismissed((previous) => [...previous, token]);
  return <ModalDialog key={token} isOpen title={popup.title} onRequestClose={close}
    description={popups.length > 1 ? `안내 ${popups.length}개 중 첫 번째입니다. 닫으면 다음 안내를 표시합니다.` : undefined}
    footer={<button type="button" onClick={close}>닫기</button>}>
    <div className="rendered-document-content" dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(popup.contentHtml) }} />
  </ModalDialog>;
}

/** 메뉴 이동 시 닫기 상태를 초기화하고, 검색 조건만 바뀔 때는 같은 팝업을 다시 열지 않는다. */
export function PopupDisplay() {
  const { pathname } = useLocation();
  return <RoutePopups key={pathname} path={pathname} />;
}
