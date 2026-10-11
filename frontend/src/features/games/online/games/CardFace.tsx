// CardFace.tsx — 트럼프 카드 한 장 그림(원카드·블랙잭·포커 공용). code가 없으면 뒷면.
import { parseCard, SUIT_SYMBOLS } from "@/features/games/online/games/playingCards";

interface CardFaceProperties {
  code?: string | null;
  small?: boolean;
}

export const CardFace = ({ code, small = false }: CardFaceProperties) => {
  if (!code) return <span className={`playing-card back${small ? " small" : ""}`} role="img" aria-label="뒷면 카드" />;
  const card = parseCard(code);
  return (
    <span className={`playing-card${card.red ? " red" : ""}${card.joker ? " joker" : ""}${small ? " small" : ""}`} role="img" aria-label={card.name}>
      <span className="playing-card-rank" aria-hidden="true">{card.label}</span>
      <span className="playing-card-suit" aria-hidden="true">{card.joker ? "★" : SUIT_SYMBOLS[card.suit]}</span>
    </span>
  );
};
