/**
 * GameRankingSubmitPanel.tsx — 끝난 판의 기록을 랭킹에 올리는 작은 폼(혼자 하는 게임 4종이 함께 쓴다)
 *
 * [언제 보이나] 게임 화면이 "끝난 상태"일 때만 이 컴포넌트를 그린다.
 *   새 판을 시작하면 사라졌다가 다음 판이 끝나면 새로 만들어지므로, "이미 올렸는지" 같은 상태가 판마다
 *   저절로 처음으로 돌아간다(따로 초기화 코드가 필요 없다).
 * [누구 이름으로] 로그인했으면 회원 이름(서버가 정한다), 아니면 닉네임. 닉네임은 이 브라우저에 기억해
 *   온라인 대전 방과 같이 쓴다. 비회원 기록은 1주일 뒤 서버에서 지워진다.
 * [서버 상태] 등록은 useMutation. 성공하면 랭킹 캐시(rankingQueryKeys.all)를 무효화해 랭킹 화면이 새로 불러오게 한다.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { readGameRecord, writeGameRecord } from "@/features/games/shared/gameRecordStorage";
import { PLAYER_NICKNAME_KEY, playerNicknameSchema } from "@/features/games/shared/playerNickname";
import { recordSoloGame } from "../rankingApi";
import { rankingErrorMessage } from "../rankingErrorMessage";
import { rankingQueryKeys } from "../rankingQueryKeys";
import type { SoloGameCode } from "../rankingTypes";
import "../ranking.css";

interface GameRankingSubmitPanelProps {
  gameCode: SoloGameCode;
  /** 지뢰 찾기·카드 짝 맞추기만 */
  difficulty?: string;
  /** 이 게임이 쓰는 값만 채운다(2048·테트리스 score, 지뢰 찾기 elapsedSeconds, 카드 짝 맞추기 moves + elapsedSeconds) */
  record: { score?: number; elapsedSeconds?: number; moves?: number };
  /** 화면에 보여 줄 기록 요약(예: "1,234점") */
  summary: string;
}

export const GameRankingSubmitPanel = ({ gameCode, difficulty, record, summary }: GameRankingSubmitPanelProps) => {
  const sessionQuery = useAuthSessionQuery();
  const queryClient = useQueryClient();
  const [nickname, setNickname] = useState(() => readGameRecord(PLAYER_NICKNAME_KEY, playerNicknameSchema) ?? "");
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const submitMutation = useMutation({
    mutationFn: recordSoloGame,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rankingQueryKeys.all }),
  });

  const isLoggedIn = sessionQuery.data?.authenticated === true;
  const rankingSearch = new URLSearchParams({ game: `solo:${gameCode}`, ...(difficulty ? { difficulty } : {}) });
  const rankingLink = `/games/rankings?${rankingSearch.toString()}`;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    let guestNickname: string | undefined;
    if (!isLoggedIn) {
      const result = playerNicknameSchema.safeParse(nickname);
      if (!result.success) {
        setNicknameError("닉네임은 2~12자로 입력해 주세요.");
        return;
      }
      guestNickname = result.data;
      writeGameRecord(PLAYER_NICKNAME_KEY, result.data);
      setNicknameError(null);
    }
    submitMutation.mutate({ gameCode, difficulty, nickname: guestNickname, ...record });
  };

  if (submitMutation.isSuccess) {
    return (
      <div className="ranking-submit-panel" role="status">
        <p><strong>{submitMutation.data.playerName}</strong> 이름으로 랭킹에 올렸습니다.</p>
        <Link className="ranking-link" to={rankingLink}>랭킹 보기</Link>
      </div>
    );
  }

  return (
    <form className="ranking-submit-panel" aria-label="랭킹 등록" onSubmit={submit}>
      <p>이번 기록 <strong>{summary}</strong>을 랭킹에 올릴까요?</p>
      {sessionQuery.isPending ? <p>로그인 정보를 확인하는 중입니다.</p> : null}
      {!sessionQuery.isPending && isLoggedIn ? <p>{sessionQuery.data?.memberName} 이름으로 올립니다.</p> : null}
      {!sessionQuery.isPending && !isLoggedIn ? (
        <label>
          <span>닉네임 (2~12자 · 비회원 기록은 1주일 뒤 사라집니다)</span>
          <input
            value={nickname}
            maxLength={12}
            onChange={(event) => setNickname(event.target.value)}
            aria-invalid={nicknameError ? true : undefined}
          />
        </label>
      ) : null}
      {nicknameError ? <p className="field-error" role="alert">{nicknameError}</p> : null}
      {submitMutation.isError ? <p className="field-error" role="alert">올리지 못했습니다. {rankingErrorMessage(submitMutation.error)}</p> : null}
      <div className="button-row">
        <button type="submit" disabled={sessionQuery.isPending || submitMutation.isPending}>
          {submitMutation.isPending ? "올리는 중…" : "랭킹에 올리기"}
        </button>
        <Link className="ranking-link" to={rankingLink}>랭킹 보기</Link>
      </div>
    </form>
  );
};
