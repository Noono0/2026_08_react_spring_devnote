import { parseCommaSeparatedValues } from "@/shared/lib/parseCommaSeparatedValues";

describe("parseCommaSeparatedValues", () => {
  it("공백·빈 값·대소문자 중복을 정리한다", () => {
    expect(parseCommaSeparatedValues(" React, spring boot ,, react ,Spring Boot")).toEqual(["React", "spring boot"]);
  });

  it("태그 모드에서는 맨 앞의 #을 지우고 #만 있는 값은 버린다", () => {
    expect(parseCommaSeparatedValues("#배포, ##Nginx, #, 배포", { stripLeadingHash: true })).toEqual(["배포", "Nginx"]);
  });
});
