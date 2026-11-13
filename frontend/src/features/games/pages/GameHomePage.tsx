/**
 * GameHomePage.tsx — 게임 홈(/games)
 *
 * 게임 메뉴의 안내판이다. 온라인 대전·랭킹과 로컬 부루마블·미로·타로로 연결한다.
 * 게임 규칙을 직접 만들어 보는 편집기 연습은 React 연습(초급·중급)에 있다.
 * 카드 모양은 유틸리티 홈(utility-card)과 같은 스타일을 재사용한다.
 */
import { Link } from "react-router-dom";
import { gameExerciseList, gameExerciseRoute } from "@/features/curriculum/data/gameExercises";
import "@/features/games/shared/games.css";

export const GameHomePage = () => (
  <section className="site-page">
    <div className="page-hero">
      <span className="page-kicker">Games</span>
      <h1>게임</h1>
      <p>온라인 대전과 게임 랭킹을 둘러보거나, 컴퓨터와 부루마블·혼자 미로 탈출·타로 카드 뽑기를 즐겨보세요.</p>
    </div>

    <div className="utility-card-grid game-card-grid">
      <Link className="utility-card game-online-card" to="/games/online">
        <span>🌐</span>
        <h3>온라인 대전</h3>
        <p>방을 만들고 다른 사람과 실시간으로 겨룹니다. 오목·테트리스·뿌요뿌요·체스·스도쿠·2048·지뢰 찾기·3D 당구·올림픽·윷놀이·캐치마인드·장기·알까기·사과게임·수박게임·부루마블·미로게임 등 25종. 테트리스·뿌요뿌요·카드 짝 맞추기·2048·지뢰 찾기·스도쿠·올림픽·알까기·사과게임·수박게임·부루마블·미로게임 방에서는 기다리는 동안 혼자 연습할 수 있습니다.</p>
        <small className="utility-card-usecase">배우는 것 · WebSocket · 서버가 정답인 상태 · 방·자리 규칙</small>
      </Link>
      <Link className="utility-card" to="/games/rankings">
        <span>🏆</span>
        <h3>게임 랭킹</h3>
        <p>종목마다 순위를 봅니다. 이번 주·이번 달·전체 버튼이나 날짜로 기간을 고릅니다. 비회원 기록은 1주일 뒤 사라집니다.</p>
        <small className="utility-card-usecase">배우는 것 · 주소에 담는 화면 상태 · TanStack Query 조건별 캐시 · 서버 집계 SQL</small>
      </Link>
      <Link className="utility-card" to="/games/tarot">
        <span>✦</span>
        <h3>타로 카드 뽑기</h3>
        <p>메이저 아르카나 22장 중 한 장 또는 세 장을 뽑고 정방향·역방향의 의미를 읽습니다.</p>
        <small className="utility-card-usecase">배우는 것 · 배열 섞기 · React 상태 전이 · 조건부 렌더링</small>
      </Link>
      <Link className="utility-card" to="/games/marble"><span>🎲</span><h3>부루마블</h3><p>컴퓨터 1~3명과 주사위를 굴리고 도시를 매입·개발합니다. 통행료·행운 카드·무인도를 거쳐 가장 많은 자산을 모아보세요.</p><small className="utility-card-usecase">배우는 것 · 순수 리듀서 · 차례와 컴퓨터 행동 · 불변 갱신</small></Link>
      <Link className="utility-card" to="/games/maze"><span>🧭</span><h3>미로게임</h3><p>세 가지 난이도의 새로운 미로에서 출구를 찾습니다. 키보드와 화면 버튼으로 이동하고 개인 최고 시간에 도전하세요.</p><small className="utility-card-usecase">배우는 것 · DFS 미로 생성 · BFS 길 찾기 · 타이머 정리</small></Link>
    </div>

    <div className="utility-home-notice">
      <strong>게임 규칙을 직접 만들어 보고 싶다면</strong>
      <p>
        게임에서 쓰는 규칙 함수 하나를 사이트 안 편집기에서 완성하는 연습은 React 연습의 초급·중급 과정에 있습니다.
        편집기는 따로 실행되어 실제 게임에는 영향이 없습니다.
      </p>
      <ul className="game-home-exercises">
        {gameExerciseList.map((exercise) => (
          <li key={exercise.exerciseId}>
            <Link to={gameExerciseRoute(exercise)}>{exercise.title}</Link> ({exercise.level})
          </li>
        ))}
      </ul>
    </div>
  </section>
);
