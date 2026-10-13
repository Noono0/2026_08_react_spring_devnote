import type { PairSpec } from "@/features/games/puyo/puyoLogic";

/** 다음에 나올 쌍 미리보기. 위가 자식, 아래가 축(회전 0과 같다). */
export const PuyoPreview = ({ pair }: { pair: PairSpec | null }) => (
  <div className="puyo-preview" aria-hidden="true">
    <span className={pair ? `puyo-cell puyo-${pair.child.toLowerCase()}` : "puyo-cell"} />
    <span className={pair ? `puyo-cell puyo-${pair.axis.toLowerCase()}` : "puyo-cell"} />
  </div>
);
