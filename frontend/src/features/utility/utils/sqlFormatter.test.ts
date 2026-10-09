import { describe, expect, it } from "vitest";
import { countDictionaryEntries, parseSqlCommentDictionary } from "@/features/utility/utils/sqlCommentDictionary";
import { formatSqlWithComments } from "@/features/utility/utils/sqlFormatter";

const userOrderQuery = `Select u.id,
       u.name,
       Count(o.id)  As orders_count,
       Sum(o.total) As revenue
From   users u
       Left Join orders o
              On o.user_id = u.id
Where  u.created_at > '2024-01-01'
       And u.status In ( 'active', 'trial' )
Group  By u.id,
          u.name
Having Count(o.id) > 5
Order  By revenue Desc
Limit  50;`;

const userOrderComments = parseSqlCommentDictionary([
  "users 유저테이블",
  "users.id 유저아이디",
  "users.name 유저이름",
  "orders 주문테이블",
  "orders_count 유저수",
  "revenue 수익",
].join("\n"));

describe("SQL 정리(들여쓰기)", () => {
  it("SELECT 목록·JOIN·ON·AND를 정한 칸 수로 들여쓰고, 한 항목뿐인 절은 한 줄로 둔다", () => {
    const { text } = formatSqlWithComments(userOrderQuery, { indentSize: 2, uppercase: true, commentStyle: "SQL" });
    expect(text).toBe([
      "SELECT",
      "  u.id,",
      "  u.name,",
      "  Count(o.id) AS orders_count,",
      "  Sum(o.total) AS revenue",
      "FROM users u",
      "  LEFT JOIN orders o",
      "    ON o.user_id = u.id",
      "WHERE u.created_at > '2024-01-01'",
      "  AND u.status IN ('active', 'trial')",
      "GROUP BY",
      "  u.id,",
      "  u.name",
      "HAVING Count(o.id) > 5",
      "ORDER BY revenue DESC",
      "LIMIT 50;",
    ].join("\n"));
  });

  it("들여쓰기는 1~10칸 안으로 맞춘다", () => {
    const tenSpaces = formatSqlWithComments("select a, b from t", { indentSize: 30, uppercase: true, commentStyle: "SQL" }).text;
    expect(tenSpaces.split("\n")[1]).toBe(`${" ".repeat(10)}a,`);
    const oneSpace = formatSqlWithComments("select a, b from t", { indentSize: 0, uppercase: true, commentStyle: "SQL" }).text;
    expect(oneSpace.split("\n")[1]).toBe(" a,");
  });

  it("문자열 안의 키워드, BETWEEN의 AND, MyBatis 파라미터, 음수는 깨뜨리지 않는다", () => {
    const { text } = formatSqlWithComments(
      "select 'from where' as label from t where age between 1 and -5 and id = #{id}",
      { indentSize: 4, uppercase: true, commentStyle: "SQL" },
    );
    expect(text).toBe([
      "SELECT 'from where' AS label",
      "FROM t",
      "WHERE age BETWEEN 1 AND -5",
      "    AND id = #{id}",
    ].join("\n"));
  });
});

describe("SQL 코멘트 주석", () => {
  it("별칭으로 테이블을 찾아 칼럼·테이블 줄 끝에 -- 주석을 한 열로 맞춰 붙인다", () => {
    const { text, addedCommentCount } = formatSqlWithComments(userOrderQuery, { indentSize: 4, uppercase: true, commentStyle: "SQL", dictionary: userOrderComments });
    expect(text.split("\n").slice(0, 8)).toEqual([
      "SELECT",
      "    u.id,                        -- 유저아이디",
      "    u.name,                      -- 유저이름",
      "    Count(o.id) AS orders_count, -- 유저수",
      "    Sum(o.total) AS revenue      -- 수익",
      "FROM users u                     -- 유저테이블",
      "    LEFT JOIN orders o           -- 주문테이블",
      "        ON o.user_id = u.id",
    ]);
    expect(addedCommentCount).toBe(6);
  });

  it("MyBatis 형식은 /* */로 붙이고, 코멘트 안의 */는 주석이 끝나지 않게 띄운다", () => {
    const dictionary = parseSqlCommentDictionary("members.id 회원 */ 아이디");
    const { text } = formatSqlWithComments("select m.id from members m", { indentSize: 4, uppercase: true, commentStyle: "MYBATIS", dictionary });
    expect(text).toBe("SELECT m.id /* 회원 * / 아이디 */\nFROM members m");
  });

  it("원래 있던 주석은 그 줄 끝에 두고 새 코멘트를 붙이지 않아, 다시 정리해도 두 번 붙지 않는다", () => {
    const options = { indentSize: 4, uppercase: true, commentStyle: "SQL" as const, dictionary: userOrderComments };
    const first = formatSqlWithComments("select u.id, -- 내 주석\n u.name from users u", options);
    expect(first.text).toMatch(/u\.id,\s+-- 내 주석\n/);
    expect(first.text).toMatch(/u\.name\s+-- 유저이름\n/);
    expect(formatSqlWithComments(first.text, options).text).toBe(first.text);
  });

  it("별칭 없는 칼럼은 쿼리의 테이블 중 그 칼럼을 가진 테이블이 하나일 때만 붙인다", () => {
    const dictionary = parseSqlCommentDictionary("a.id A아이디\nb.id B아이디\nb.title 제목");
    const { text } = formatSqlWithComments("select id, title from a join b on a.id = b.a_id", { indentSize: 2, uppercase: true, commentStyle: "SQL", dictionary });
    expect(text.split("\n")[1]).toBe("  id,");
    expect(text.split("\n")[2]).toBe("  title -- 제목");
  });

  it("UPDATE SET의 왼쪽 칼럼에도 코멘트를 붙인다", () => {
    const dictionary = parseSqlCommentDictionary("members.name 회원이름\nmembers.use_yn 사용여부");
    const { text } = formatSqlWithComments("update members set name = #{name}, use_yn = 'Y' where id = #{id}", { indentSize: 2, uppercase: true, commentStyle: "SQL", dictionary });
    expect(text).toBe([
      "UPDATE members",
      "SET",
      "  name = #{name}, -- 회원이름",
      "  use_yn = 'Y'    -- 사용여부",
      "WHERE id = #{id}",
    ].join("\n"));
  });
});

describe("테이블·칼럼 코멘트 입력 읽기", () => {
  it("공백·탭 한 줄 형식과 DB 도구의 탭 3칸(테이블 ⇥ 칼럼 ⇥ 코멘트)을 읽는다", () => {
    const dictionary = parseSqlCommentDictionary("# 메모 줄\nusers 유저 테이블\nusers.id\t유저아이디\norders\tuser_id\t주문 유저\n\n");
    expect(dictionary.names.get("users")).toBe("유저 테이블");
    expect(dictionary.columns.get("users")?.get("id")).toBe("유저아이디");
    expect(dictionary.columns.get("orders")?.get("user_id")).toBe("주문 유저");
    expect(countDictionaryEntries(dictionary)).toBe(3);
  });

  it("MySQL CREATE TABLE의 칼럼·테이블 COMMENT를 읽는다(DECIMAL(10,2)의 쉼표, 제약 조건 줄은 건너뜀)", () => {
    const dictionary = parseSqlCommentDictionary(`CREATE TABLE IF NOT EXISTS \`Users\` (
      \`id\` BIGINT NOT NULL AUTO_INCREMENT COMMENT '유저아이디',
      price DECIMAL(10,2) COMMENT '가격, 원',
      PRIMARY KEY (id)
    ) ENGINE=InnoDB COMMENT='유저테이블';`);
    expect(dictionary.columns.get("users")?.get("id")).toBe("유저아이디");
    expect(dictionary.columns.get("users")?.get("price")).toBe("가격, 원");
    expect(dictionary.names.get("users")).toBe("유저테이블");
    expect(countDictionaryEntries(dictionary)).toBe(3);
  });

  it("COMMENT ON TABLE / COLUMN ... IS '...'를 읽는다", () => {
    const dictionary = parseSqlCommentDictionary("COMMENT ON TABLE app.orders IS '주문';\nCOMMENT ON COLUMN app.orders.total IS '주문 ''합계''';");
    expect(dictionary.names.get("orders")).toBe("주문");
    expect(dictionary.columns.get("orders")?.get("total")).toBe("주문 '합계'");
  });
});
