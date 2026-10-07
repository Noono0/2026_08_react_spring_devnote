/**
 * "React, #배포 ,, react" 같은 쉼표 구분 입력을 ["React", "배포"]로 정리한다.
 *
 * - 앞뒤 공백과 빈 값을 지운다.
 * - stripLeadingHash가 true면 태그처럼 맨 앞의 #을 지운다.
 * - 대소문자만 다른 중복은 처음 입력한 것만 남긴다. (DB 정렬 규칙도 대소문자를 구분하지 않는다)
 * 서버도 같은 규칙으로 한 번 더 정리하므로, 여기서는 화면에 미리 보여 주고 요청을 깔끔하게 만드는 용도다.
 */
export const parseCommaSeparatedValues = (text: string, options: { stripLeadingHash?: boolean } = {}): string[] => {
  const uniqueValues = new Map<string, string>();
  text.split(",").forEach((rawValue) => {
    const value = (options.stripLeadingHash ? rawValue.trim().replace(/^#+/, "") : rawValue).trim();
    if (value && !uniqueValues.has(value.toLowerCase())) uniqueValues.set(value.toLowerCase(), value);
  });
  return [...uniqueValues.values()];
};
