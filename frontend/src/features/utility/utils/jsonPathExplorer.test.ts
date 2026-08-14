import { evaluateJsonPath, parseJsonPath } from "@/features/utility/utils/jsonPathExplorer";

const value = { store: { books: [{ title: "A", price: 8 }, { title: "B", price: 15 }, { title: "C", price: 20 }], owner: { name: "DevNote" } } };

describe("jsonPathExplorer", () => {
  it("자식·배열·Wildcard·재귀 경로를 평가한다", () => {
    expect(evaluateJsonPath(value, "$.store.books[0].title")[0]?.value).toBe("A");
    expect(evaluateJsonPath(value, "$.store.books[*].title").map((match) => match.value)).toEqual(["A", "B", "C"]);
    expect(evaluateJsonPath(value, "$..name")[0]?.value).toBe("DevNote");
  });

  it("Filter·Slice·Union을 평가한다", () => {
    expect(evaluateJsonPath(value, "$.store.books[?(@.price >= 15)].title").map((match) => match.value)).toEqual(["B", "C"]);
    expect(evaluateJsonPath(value, "$.store.books[0:2].title")).toHaveLength(2);
    expect(evaluateJsonPath(value, "$.store.books[0,2].title").map((match) => match.value)).toEqual(["A", "C"]);
  });

  it("잘못된 표현식을 설명한다", () => {
    expect(() => parseJsonPath("store.books")).toThrow("$");
    expect(() => parseJsonPath("$.books[::0]")).toThrow("step");
  });
});
