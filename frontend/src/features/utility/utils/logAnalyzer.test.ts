import { analyzeLogs, createLogAnalysisMarkdown, redactLogSecrets } from "@/features/utility/utils/logAnalyzer";

const source = `2026-08-14 20:10:11 ERROR com.example.MemberService - 회원 조회 실패
java.lang.NullPointerException: member is null
  at com.example.MemberService.findMember(MemberService.java:42)
  at org.springframework.web.DispatcherServlet.doDispatch(DispatcherServlet.java:100)
Caused by: java.sql.SQLSyntaxErrorException: Unknown column 'member_name'
Authorization: Bearer abcdefghijkl.mnopqrstuvwx.yzABCDEFGHIJ
password=secret123`;

describe("logAnalyzer", () => {
  it("Exception, Root Cause, 애플리케이션 Stack과 SQL 오류를 찾는다", () => {
    const result = analyzeLogs(source);
    expect(result.rootCause?.type).toBe("java.sql.SQLSyntaxErrorException");
    expect(result.stackFrames[0]).toMatchObject({ sourceLine: 42, applicationFrame: true });
    expect(result.sqlSignals[0]).toContain("Unknown column");
    expect(createLogAnalysisMarkdown(result)).toContain("Root Cause");
  });

  it("토큰과 비밀번호를 마스킹한다", () => {
    const redacted = redactLogSecrets(source);
    expect(redacted.count).toBeGreaterThanOrEqual(2);
    expect(redacted.value).not.toContain("secret123");
  });
});
