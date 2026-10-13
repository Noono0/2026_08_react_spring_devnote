/**
 * GameRankingPage.tsx — 게임 랭킹(/games/rankings)
 *
 * [화면 상태는 어디에 두나]
 *   - 종목·난이도: 주소(?game=solo:MINESWEEPER&difficulty=EXPERT)에 둔다.
 *       게임 화면의 "랭킹 보기" 링크로 바로 열 수 있고, 새로고침·뒤로 가기에도 남는다.
 *       주소는 누구나 고쳐 칠 수 있으므로 목록에 있는 값인지 확인하고, 아니면 기본값을 쓴다.
 *   - 기간: 이 화면에서만 쓰는 값이라 useState. 기본은 이번 달.
 *   - 랭킹 목록: 서버 상태라 표 컴포넌트의 useQuery가 맡는다(RankingTables.tsx).
 *
 * [기간] 이번 주·이번 달·전체 버튼을 누르면 바로 바뀌고, 시작일·종료일을 직접 고를 수도 있다.
 *   날짜는 한국 날짜로 보내고, 서버가 그날 0시 ~ 마지막 날 24시로 바꿔 찾는다.
 */
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { defaultRankingGame, findRankingGame, onlineRankingGames, soloRankingGames } from "./rankingGames";
import { isPeriodOrdered, matchingPreset, periodForPreset, rankingPeriodPresets } from "./rankingPeriod";
import type { RankingPeriod } from "./rankingTypes";
import { OnlineRankingTable, SoloRankingTable } from "./components/RankingTables";
import "@/features/games/shared/games.css";
import "./ranking.css";

export const GameRankingPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const game = findRankingGame(searchParams.get("game")) ?? defaultRankingGame;
  // 난이도가 있는 게임은 주소의 값이 목록에 있으면 그것, 없으면 첫 난이도
  const difficulty = game.kind === "SOLO"
    ? (game.difficulties.find((option) => option.value === searchParams.get("difficulty")) ?? game.difficulties[0])?.value ?? ""
    : "";
  const [period, setPeriod] = useState<RankingPeriod>(() => periodForPreset("MONTH"));
  const activePreset = matchingPreset(period);
  const periodOrdered = isPeriodOrdered(period);

  // replace: 종목을 여러 번 바꿔도 뒤로 가기 기록이 쌓이지 않게 한다
  const selectGame = (gameId: string) => setSearchParams({ game: gameId }, { replace: true });
  const selectDifficulty = (value: string) => setSearchParams({ game: game.id, difficulty: value }, { replace: true });

  return (
    <section className="site-page ranking-page">
      <div className="page-hero">
        <span className="page-kicker">Game · Ranking</span>
        <h1>게임 랭킹</h1>
        <p>종목마다 순위를 봅니다. 온라인 대전은 승수, 혼자 하는 게임은 사람마다 가장 좋은 기록 하나로 줄 세웁니다.</p>
      </div>

      <div className="utility-home-notice">
        <strong>기록은 어떻게 모이나요?</strong>
        <p>
          온라인 대전은 게임이 끝나면 서버가 승패를 바로 저장합니다(2명 이상 겨룬 판만). 혼자 하는 게임은 온라인 대전 방에서
          기다리는 동안 연습한 뒤, 끝난 화면에서 <strong>연습 기록 올리기</strong>를 눌러야 저장됩니다. 비회원은 닉네임으로 묶이고, 비회원 기록은 1주일 뒤 사라집니다.
        </p>
      </div>

      <div className="game-panel">
        <div className="ranking-filters">
          <label>
            <span>종목</span>
            <select value={game.id} onChange={(event) => selectGame(event.target.value)}>
              <optgroup label="온라인 대전">
                {onlineRankingGames.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </optgroup>
              <optgroup label="혼자 하는 게임">
                {soloRankingGames.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </optgroup>
            </select>
          </label>

          {game.kind === "SOLO" && game.difficulties.length > 0 ? (
            <div className="ranking-filter-group">
              <span id="ranking-difficulty-label">난이도</span>
              <div className="segmented-buttons" role="group" aria-labelledby="ranking-difficulty-label">
                {game.difficulties.map((option) => (
                  <button key={option.value} type="button" className={option.value === difficulty ? "active" : ""} aria-pressed={option.value === difficulty} onClick={() => selectDifficulty(option.value)}>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="ranking-filters">
          <div className="ranking-filter-group">
            <span id="ranking-period-label">기간</span>
            <div className="segmented-buttons" role="group" aria-labelledby="ranking-period-label">
              {rankingPeriodPresets.map((preset) => (
                <button key={preset.value} type="button" className={preset.value === activePreset ? "active" : ""} aria-pressed={preset.value === activePreset} onClick={() => setPeriod(periodForPreset(preset.value))}>
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <label>
            <span>시작일</span>
            <input type="date" value={period.from ?? ""} onChange={(event) => {
              const from = event.target.value || null;
              setPeriod((previous) => ({ ...previous, from }));
            }} />
          </label>
          <label>
            <span>종료일</span>
            <input type="date" value={period.to ?? ""} onChange={(event) => {
              const to = event.target.value || null;
              setPeriod((previous) => ({ ...previous, to }));
            }} />
          </label>
        </div>

        {periodOrdered ? null : <p className="field-error" role="alert">시작일은 종료일보다 늦을 수 없습니다.</p>}

        {/* 기간이 거꾸로면 서버에 묻지 않는다(서버도 같은 규칙으로 거절한다) */}
        {periodOrdered && game.kind === "ONLINE" ? <OnlineRankingTable game={game} period={period} /> : null}
        {periodOrdered && game.kind === "SOLO" ? <SoloRankingTable game={game} difficulty={difficulty} period={period} /> : null}

        <Link className="ranking-link" to={game.playRoute}>{game.label} 하러 가기</Link>
      </div>
    </section>
  );
};
