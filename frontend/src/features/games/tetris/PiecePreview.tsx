// PiecePreview.tsx — 다음·보관 칸에 보여 줄 작은 블록(혼자 하기·온라인 대전 공용). 모양 행렬에서 빈 줄을 빼고 그린다.
import { TETROMINO_SHAPES, type TetrominoType } from "@/features/games/tetris/tetrisLogic";

export const PiecePreview = ({ type, dimmed = false }: { type: TetrominoType | null; dimmed?: boolean }) => {
  if (!type) return <div className="tetris-preview-piece empty" aria-label="비어 있음" />;
  const rows = TETROMINO_SHAPES[type].filter((row) => row.some(Boolean));
  return (
    <div className={`tetris-preview-piece${dimmed ? " dimmed" : ""}`} role="img" aria-label={`${type} 블록`}>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="tetris-preview-row">
          {row.map((filled, colIndex) => <span key={colIndex} className={filled ? `tetris-cell piece-${type.toLowerCase()}` : "tetris-cell blank"} />)}
        </div>
      ))}
    </div>
  );
};
