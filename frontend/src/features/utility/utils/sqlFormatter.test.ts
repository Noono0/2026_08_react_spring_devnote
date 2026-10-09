import { describe, expect, it } from "vitest";
import { convertSqlOutput } from "@/features/utility/utils/sqlCodeOutput";
import { countDictionaryEntries, parseSqlCommentDictionary } from "@/features/utility/utils/sqlCommentDictionary";
import { formatSqlWithComments } from "@/features/utility/utils/sqlFormatter";

/** dpriver Instant SQL Formatter(기본 옵션)에 넣어 얻은 결과와 같은지 비교하는 예제 */
const dpriverSource = "Select u.id, u.name, Count(o.id) As orders_count, Sum(o.total) As revenue, case when u.age > 10 and u.vip = 1 then 'A' else 'B' end grade From users u Left Join orders o On o.user_id = u.id and o.del_yn='N' Where u.created_at > '2024-01-01' And u.status In ('active','trial') or exists (select 1 from bans b where b.uid = u.id) Group By u.id, u.name Having Count(o.id) > 5 Order By revenue Desc Limit 50; insert into t (a,b,c) values (1,2,3); update members set name='x', age=3 where id=1";

const dpriverResult = [
  "SELECT u.id,",
  "       u.name,",
  "       Count(o.id)  AS orders_count,",
  "       Sum(o.total) AS revenue,",
  "       CASE",
  "         WHEN u.age > 10",
  "              AND u.vip = 1 THEN 'A'",
  "         ELSE 'B'",
  "       END          grade",
  "FROM   users u",
  "       LEFT JOIN orders o",
  "              ON o.user_id = u.id",
  "                 AND o.del_yn = 'N'",
  "WHERE  u.created_at > '2024-01-01'",
  "       AND u.status IN ( 'active', 'trial' )",
  "        OR EXISTS (SELECT 1",
  "                   FROM   bans b",
  "                   WHERE  b.uid = u.id)",
  "GROUP  BY u.id,",
  "          u.name",
  "HAVING Count(o.id) > 5",
  "ORDER  BY revenue DESC",
  "LIMIT  50;",
  "",
  "INSERT INTO t",
  "            (a,",
  "             b,",
  "             c)",
  "VALUES      (1,",
  "             2,",
  "             3);",
  "",
  "UPDATE members",
  "SET    name = 'x',",
  "       age = 3",
  "WHERE  id = 1",
].join("\n");

describe("SQL 정리 — 키워드 정렬(dpriver 기본)", () => {
  it("dpriver 기본 출력과 같게 정리한다(별칭 열 맞춤·CASE·JOIN/ON·서브쿼리·INSERT·여러 문장)", () => {
    expect(formatSqlWithComments(dpriverSource).text).toBe(dpriverResult);
  });

  it("문자열 안의 키워드, BETWEEN의 AND, MyBatis 파라미터, 음수는 깨뜨리지 않는다", () => {
    expect(formatSqlWithComments("select 'from where' as label from t where age between 1 and -5 and id = #{id}").text).toBe([
      "SELECT 'from where' AS label",
      "FROM   t",
      "WHERE  age BETWEEN 1 AND -5",
      "       AND id = #{id}",
    ].join("\n"));
  });

  it("쉼표 앞 배치, AND/OR를 WHERE 아래에, 목록 한 줄 옵션을 따른다", () => {
    expect(formatSqlWithComments("select a, b as bb, c from t where x=1 and y=2 or z=3", { commaPosition: "BEFORE", logicalUnderKeyword: true }).text).toBe([
      "SELECT a",
      "      ,b AS bb",
      "      ,c",
      "FROM   t",
      "WHERE  x = 1",
      "AND    y = 2",
      "OR     z = 3",
    ].join("\n"));
    expect(formatSqlWithComments("select a, b as bb, c from t", { stackLists: false }).text).toBe("SELECT a, b AS bb, c\nFROM   t");
  });

  it("키워드·함수·이름 대소문자를 따로 바꾼다(점 뒤 이름과 따옴표 이름은 키워드로 보지 않는다)", () => {
    const { text } = formatSqlWithComments('SELECT COUNT(U.Id), u.order, "MixedName" FROM Users U', { keywordCase: "LOWER", functionCase: "UPPER", identifierCase: "LOWER", stackLists: false });
    expect(text).toBe('select COUNT(u.id), u.order, "MixedName"\nfrom   users u');
  });
});

describe("SQL 정리 — 들여쓰기 칸 수", () => {
  it("목록은 키워드 아래로 N칸, JOIN은 N칸, ON은 2N칸 들이고 1~10칸 안으로 맞춘다", () => {
    const source = "select u.id, u.name from users u join orders o on o.user_id = u.id where u.a = 1 and u.b = 2";
    expect(formatSqlWithComments(source, { layout: "INDENT", indentSize: 2 }).text).toBe([
      "SELECT",
      "  u.id,",
      "  u.name",
      "FROM users u",
      "  JOIN orders o",
      "    ON o.user_id = u.id",
      "WHERE u.a = 1",
      "  AND u.b = 2",
    ].join("\n"));
    expect(formatSqlWithComments("select a, b from t", { layout: "INDENT", indentSize: 30 }).text.split("\n")[1]).toBe(`${" ".repeat(10)}a,`);
    expect(formatSqlWithComments("select a, b from t", { layout: "INDENT", indentSize: 0 }).text.split("\n")[1]).toBe(" a,");
  });
});

describe("SQL 코멘트 주석", () => {
  const dictionary = parseSqlCommentDictionary(["users 유저테이블", "users.id 유저아이디", "users.name 유저이름", "orders 주문테이블", "orders_count 유저수"].join("\n"));

  it("별칭으로 테이블을 찾아 칼럼·테이블 줄 끝에 -- 주석을 한 열로 맞춰 붙인다", () => {
    const { text, addedCommentCount } = formatSqlWithComments(
      "select u.id, u.name, count(o.id) as orders_count from users u left join orders o on o.user_id = u.id",
      { dictionary },
    );
    // 주석 열 = 주석이 붙는 가장 긴 줄("       Count(o.id) AS orders_count", 34칸) + 1
    const withComment = (code: string, comment: string): string => `${code.padEnd(35)}-- ${comment}`;
    expect(text).toBe([
      withComment("SELECT u.id,", "유저아이디"),
      withComment("       u.name,", "유저이름"),
      withComment("       Count(o.id) AS orders_count", "유저수"),
      withComment("FROM   users u", "유저테이블"),
      withComment("       LEFT JOIN orders o", "주문테이블"),
      "              ON o.user_id = u.id",
    ].join("\n"));
    expect(addedCommentCount).toBe(5);
  });

  it("MyBatis 형식은 /* */로 붙이고, 코멘트 안의 */는 주석이 끝나지 않게 띄운다", () => {
    const mybatisDictionary = parseSqlCommentDictionary("members.id 회원 */ 아이디");
    expect(formatSqlWithComments("select m.id from members m", { commentStyle: "MYBATIS", dictionary: mybatisDictionary }).text)
      .toBe("SELECT m.id /* 회원 * / 아이디 */\nFROM   members m");
  });

  it("원래 있던 주석은 그 줄 끝에 두고 새 코멘트를 붙이지 않아, 다시 정리해도 두 번 붙지 않는다", () => {
    const first = formatSqlWithComments("select u.id, -- 내 주석\n u.name from users u", { dictionary });
    expect(first.text).toMatch(/u\.id,\s+-- 내 주석\n/);
    expect(first.text).toMatch(/u\.name\s+-- 유저이름\n/);
    expect(formatSqlWithComments(first.text, { dictionary }).text).toBe(first.text);
  });

  it("서브쿼리 안 칼럼도 그 서브쿼리의 별칭으로 찾는다", () => {
    const { text } = formatSqlWithComments("select u.id from users u where exists (select b.uid from bans b)", { dictionary: parseSqlCommentDictionary("bans.uid 차단유저") });
    expect(text).toContain("(SELECT b.uid -- 차단유저");
  });

  it("별칭 없는 칼럼은 쿼리의 테이블 중 그 칼럼을 가진 테이블이 하나일 때만 붙인다", () => {
    const twoTables = parseSqlCommentDictionary("a.id A아이디\nb.id B아이디\nb.title 제목");
    const lines = formatSqlWithComments("select id, title from a join b on a.id = b.a_id", { dictionary: twoTables }).text.split("\n");
    expect(lines[0]).toBe("SELECT id,");
    expect(lines[1]).toBe("       title -- 제목");
  });

  it("UPDATE SET의 왼쪽 칼럼에도 코멘트를 붙인다", () => {
    const memberDictionary = parseSqlCommentDictionary("members.name 회원이름\nmembers.use_yn 사용여부");
    expect(formatSqlWithComments("update members set name = #{name}, use_yn = 'Y' where id = #{id}", { dictionary: memberDictionary }).text).toBe([
      "UPDATE members",
      "SET    name = #{name}, -- 회원이름",
      "       use_yn = 'Y'    -- 사용여부",
      "WHERE  id = #{id}",
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

describe("Java 코드 출력", () => {
  it("줄마다 \\n을 붙인 Java 문자열과 StringBuilder로 바꾸고 따옴표·역슬래시를 escape한다", () => {
    const sql = 'SELECT "a\\b"\nFROM   t -- x';
    expect(convertSqlOutput(sql, "JAVA_STRING")).toBe('String sql = "SELECT \\"a\\\\b\\"\\n"\n           + "FROM   t -- x\\n";');
    expect(convertSqlOutput(sql, "JAVA_STRING_BUILDER")).toBe('StringBuilder sql = new StringBuilder();\nsql.append("SELECT \\"a\\\\b\\"\\n");\nsql.append("FROM   t -- x\\n");');
    expect(convertSqlOutput(sql, "SQL")).toBe(sql);
  });
});
