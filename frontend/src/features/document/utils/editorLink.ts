const ALLOWED_EDITOR_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * 사용자가 입력한 링크를 에디터에 넣기 전에 안전한 형태로 정리한다.
 * 프로토콜을 생략한 주소에는 https://를 붙이고, javascript: 같은 위험한 주소는 거부한다.
 */
export const normalizeSafeEditorLink = (rawLink: string): string => {
  const trimmedLink = rawLink.trim();

  if (trimmedLink.startsWith("/") || trimmedLink.startsWith("#")) {
    return trimmedLink;
  }

  const linkWithProtocol = /^[a-z][a-z\d+.-]*:/i.test(trimmedLink)
    ? trimmedLink
    : `https://${trimmedLink}`;
  const parsedLink = new URL(linkWithProtocol);

  if (!ALLOWED_EDITOR_LINK_PROTOCOLS.has(parsedLink.protocol)) {
    throw new Error("지원하지 않는 링크 형식입니다.");
  }

  return linkWithProtocol;
};
