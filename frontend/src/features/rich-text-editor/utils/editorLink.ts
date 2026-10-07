// 허용할 링크 종류. javascript: 같은 주소는 누르는 순간 코드가 실행될 수 있어 막는다.
const ALLOWED_EDITOR_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * 사용자가 입력한 링크를 에디터에 넣기 전에 안전한 형태로 정리한다.
 * 프로토콜을 생략한 주소에는 https://를 붙이고, javascript: 같은 위험한 주소는 거부한다.
 */
export const normalizeSafeEditorLink = (rawLink: string): string => {
  const trimmedLink = rawLink.trim();

  // 사이트 안 주소(/history)나 페이지 안 위치(#section)는 그대로 둔다.
  if (trimmedLink.startsWith("/") || trimmedLink.startsWith("#")) {
    return trimmedLink;
  }

  // "영문자로 시작하고 :가 붙은" 모양이면 이미 프로토콜이 있는 것으로 보고, 없으면 https://를 붙인다(example.com → https://example.com).
  const linkWithProtocol = /^[a-z][a-z\d+.-]*:/i.test(trimmedLink)
    ? trimmedLink
    : `https://${trimmedLink}`;
  // URL로 해석해 프로토콜을 확인한다. 주소 형식이 틀리면 여기서 예외가 난다(호출한 쪽이 오류로 안내).
  const parsedLink = new URL(linkWithProtocol);

  if (!ALLOWED_EDITOR_LINK_PROTOCOLS.has(parsedLink.protocol)) {
    throw new Error("지원하지 않는 링크 형식입니다.");
  }

  return linkWithProtocol;
};
