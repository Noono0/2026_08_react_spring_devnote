import { useState } from "react";
import { Link } from "react-router-dom";
import { drawTarotCards, meaningFor, summarizeTarot, type TarotDraw } from "@/features/games/tarot/tarotCards";
import "@/features/games/tarot/tarot.css";

const positions = ["과거", "현재", "앞으로"] as const;

/**
 * 한 장/세 장 선택 → 무작위 뽑기 → 한 장씩 펼치기 → 해석 순서의 로컬 상태 전이.
 * 카드 정보와 섞기 규칙은 tarotCards.ts에 있어서 화면 없이도 테스트할 수 있다.
 */
export const TarotPage = () => {
  const [count, setCount] = useState<1 | 3>(1);
  const [draws, setDraws] = useState<TarotDraw[]>([]);
  const [revealedIndexes, setRevealedIndexes] = useState<number[]>([]);
  const allRevealed = draws.length > 0 && revealedIndexes.length === draws.length;

  const changeCount = (next: 1 | 3) => {
    setCount(next);
    setDraws([]);
    setRevealedIndexes([]);
  };

  const draw = () => {
    setDraws(drawTarotCards(count));
    setRevealedIndexes([]);
  };

  const reveal = (index: number) => {
    setRevealedIndexes((previous) => previous.includes(index) ? previous : [...previous, index]);
  };

  return <section className="site-page tarot-page">
    <div className="page-hero">
      <span className="page-kicker">Tarot</span>
      <h1>타로 카드 뽑기</h1>
      <p>메이저 아르카나 22장 중 카드를 뽑아 지금 생각할 주제를 살펴보세요.</p>
      <p><Link to="/games">← 게임 홈으로</Link></p>
    </div>

    <div className="tarot-table">
      <div className="tarot-controls">
        <fieldset>
          <legend>뽑을 카드 수</legend>
          <label><input type="radio" name="tarot-count" checked={count === 1} onChange={() => changeCount(1)} /> 한 장 · 오늘의 주제</label>
          <label><input type="radio" name="tarot-count" checked={count === 3} onChange={() => changeCount(3)} /> 세 장 · 과거 / 현재 / 앞으로</label>
        </fieldset>
        <button type="button" className="tarot-draw-button" onClick={draw}>{draws.length ? "다시 섞고 뽑기" : "카드 섞고 뽑기"}</button>
      </div>

      {draws.length === 0 ? <div className="tarot-empty"><span aria-hidden="true">✧</span><p>카드를 섞고 뽑으면 이곳에 뒷면이 놓입니다.</p></div> : <>
        <p className="tarot-instruction">카드를 눌러 한 장씩 펼쳐 보세요. 같은 카드가 두 번 나오지 않습니다.</p>
        <div className="tarot-spread">
          {draws.map((drawn, index) => {
            const isRevealed = revealedIndexes.includes(index);
            const position = count === 1 ? "오늘의 카드" : positions[index] ?? "카드";
            const meaning = meaningFor(drawn);
            return <div className="tarot-slot" key={drawn.card.number}>
              <h2>{position}</h2>
              <button type="button" className={`tarot-card ${isRevealed ? "tarot-card-revealed" : ""}`}
                aria-label={isRevealed ? `${position}: ${drawn.card.name} ${drawn.reversed ? "역방향" : "정방향"}` : `${position} 카드 펼치기`}
                aria-pressed={isRevealed} onClick={() => reveal(index)}>
                {isRevealed ? <span className="tarot-card-face">
                  <span className="tarot-card-number">{drawn.card.number.toString().padStart(2, "0")}</span>
                  <span className="tarot-card-symbol" aria-hidden="true">{drawn.card.symbol}</span>
                  <span className="tarot-card-name">{drawn.card.name}</span>
                  <span className="tarot-card-direction">{drawn.reversed ? "역방향" : "정방향"}</span>
                </span> : <span className="tarot-card-back" aria-hidden="true"><span>✧</span></span>}
              </button>
              {isRevealed ? <div className="tarot-meaning"><strong>{meaning.keyword}</strong><p>{meaning.meaning}</p></div> : <p className="tarot-placeholder">아직 펼치지 않았습니다.</p>}
            </div>;
          })}
        </div>
        {allRevealed ? <section className="tarot-summary" aria-live="polite"><h2>이번 카드의 이야기</h2><p>{summarizeTarot(draws)}</p></section>
          : <p className="tarot-progress" aria-live="polite">{revealedIndexes.length} / {draws.length}장 펼쳤습니다.</p>}
      </>}
      <details className="tarot-help"><summary>해석은 어떻게 만들어지나요?</summary><p>각 카드의 정방향·역방향에 미리 작성한 한국어 문장을 보여줍니다. 세 장은 과거·현재·앞으로 자리에 놓고 핵심 단어를 연결합니다. 브라우저에서만 처리하며 질문을 분석하거나 미래를 예측하지는 않습니다.</p></details>
    </div>
  </section>;
};
