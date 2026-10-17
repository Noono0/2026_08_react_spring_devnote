import { boardNodes, boardPoint, FINISHED_NODE, nodeLabel, pieceStacks, WAITING_NODE } from "@/features/games/online/games/yutnoriRules";

describe("yutnoriRules", () => {
  it("모서리·가운데 칸을 판의 네 귀퉁이와 한가운데에 놓는다", () => {
    expect(boardPoint(20)).toEqual({ x: 90, y: 90 }); // 출발점 = 오른쪽 아래
    expect(boardPoint(5)).toEqual({ x: 90, y: 10 });
    expect(boardPoint(10)).toEqual({ x: 10, y: 10 });
    expect(boardPoint(15)).toEqual({ x: 10, y: 90 });
    expect(boardPoint(23)).toEqual({ x: 50, y: 50 });
    expect(boardPoint(WAITING_NODE)).toBeNull();
    expect(boardPoint(FINISHED_NODE)).toBeNull();
  });

  it("판 위 29칸은 모두 다른 자리에 그린다", () => {
    const keys = boardNodes.map((node) => {
      const point = boardPoint(node);
      return point ? `${point.x.toFixed(1)},${point.y.toFixed(1)}` : "없음";
    });
    expect(new Set(keys).size).toBe(29);
    expect(keys).not.toContain("없음");
  });

  it("같은 자리·같은 칸의 말을 한 묶음(업힘)으로 센다", () => {
    expect(pieceStacks([[3, 3, 0, 30], [7, 0, 0, 0]])).toEqual([
      { seat: 0, node: 3, count: 2 },
      { seat: 1, node: 7, count: 1 },
    ]);
  });

  it("칸 번호를 사람이 읽는 이름으로 바꾼다", () => {
    expect(nodeLabel(0)).toBe("대기");
    expect(nodeLabel(30)).toBe("났음");
    expect(nodeLabel(23)).toBe("가운데 방(23번 칸)");
    expect(nodeLabel(7)).toBe("7번 칸");
  });
});
