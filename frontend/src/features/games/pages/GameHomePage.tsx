/**
 * GameHomePage.tsx — 게임 목록(/games)
 *
 * 혼자 하는 게임은 브라우저 안에서만 계산하고, 내 최고 기록은 이 브라우저(localStorage)에 저장한다.
 * 다른 사람과 겨루고 싶으면 끝난 화면에서 "랭킹에 올리기"를 눌러 서버 랭킹(/games/rankings)에 올린다.
 * 카드 모양은 유틸리티 홈(utility-card)과 같은 스타일을 재사용한다.
 */
import { Link } from "react-router-dom";
import "@/features/games/shared/games.css";

interface GameCard {
  to: string;
  symbol: string;
  title: string;
  description: string;
  concepts: string;
  practice: string;
}

const gameCards: GameCard[] = [
  {
    to: "/games/memory",
    symbol: "🃏",
    title: "카드 짝 맞추기",
    description: "뒤집힌 카드 두 장을 골라 같은 그림을 찾습니다. 쉬움·보통·어려움.",
    concepts: "useReducer · setTimeout·setInterval 정리 · 피셔–예이츠 섞기",
    practice: "카드 섞기(shuffle)",
  },
  {
    to: "/games/2048",
    symbol: "2048",
    title: "2048",
    description: "타일을 밀어 같은 숫자를 합쳐 2048을 만듭니다. 방향키·버튼·스와이프.",
    concepts: "2차원 배열 · 전치·뒤집기 · 키보드·Pointer 이벤트",
    practice: "한 줄 밀기(slideRow)",
  },
  {
    to: "/games/minesweeper",
    symbol: "💣",
    title: "지뢰 찾기",
    description: "숫자 힌트로 지뢰를 피해 모든 칸을 엽니다. 첫 클릭은 항상 안전합니다.",
    concepts: "BFS 연쇄 열기 · 불변 2차원 배열 · 로빙 탭인덱스",
    practice: "빈 칸 연쇄 열기(revealArea)",
  },
  {
    to: "/games/tetris",
    symbol: "▦",
    title: "테트리스",
    description: "블록을 돌리고 옮겨 줄을 지웁니다. 보관·고스트·7-bag·레벨 속도.",
    concepts: "행렬 회전·충돌 · 타이머 + 리듀서 · 포커스 관리",
    practice: "줄 지우기(clearLines)",
  },
];

export const GameHomePage = () => (
  <section className="site-page">
    <div className="page-hero">
      <span className="page-kicker">Mini Games</span>
      <h1>React로 만든 작은 게임</h1>
      <p>
        서버 없이 브라우저에서만 동작합니다. 게임마다 화면 아래 <strong>직접 만들어 보기</strong> 편집기에서
        핵심 규칙 함수 하나를 직접 완성해 보고, 채점표로 바로 확인할 수 있습니다.
      </p>
    </div>

    <div className="utility-home-notice">
      <strong>기록은 어디에 저장되나요?</strong>
      <p>
        내 최고 기록은 지금 브라우저의 localStorage에 저장되어 다른 기기와 공유되지 않습니다. 게임이 끝난 화면에서
        <strong> 랭킹에 올리기</strong>를 누르면 서버 랭킹에도 남습니다. 온라인 대전 승패는 서버가 자동으로 기록합니다.
      </p>
    </div>

    <Link className="utility-card game-online-card" to="/games/rankings">
      <span>🏆</span>
      <h3>게임 랭킹</h3>
      <p>종목마다 순위를 봅니다. 이번 주·이번 달·전체 버튼이나 날짜로 기간을 고릅니다. 비회원 기록은 1주일 뒤 사라집니다.</p>
      <small className="utility-card-usecase">배우는 것 · 주소에 담는 화면 상태 · TanStack Query 조건별 캐시 · 서버 집계 SQL</small>
    </Link>

    <Link className="utility-card game-online-card" to="/games/online">
      <span>🌐</span>
      <h3>온라인 대전</h3>
      <p>방을 만들고 다른 사람과 실시간으로 겨룹니다. 플레이어·관전자·채팅·비밀번호·로그인 유저만 참가. 지금은 오목, 다른 게임은 차례로 추가합니다.</p>
      <small className="utility-card-usecase">배우는 것 · WebSocket · 서버가 정답인 상태 · 방·자리 규칙</small>
    </Link>

    <div className="utility-card-grid game-card-grid">
      {gameCards.map((card) => (
        <Link className="utility-card" key={card.to} to={card.to}>
          <span>{card.symbol}</span>
          <h3>{card.title}</h3>
          <p>{card.description}</p>
          <small className="utility-card-usecase">배우는 것 · {card.concepts}</small>
          <small className="utility-card-usecase">직접 만들기 · {card.practice}</small>
        </Link>
      ))}
    </div>
  </section>
);
