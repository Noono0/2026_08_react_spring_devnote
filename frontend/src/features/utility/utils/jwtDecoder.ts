export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  state: "VALID_TIME" | "EXPIRED" | "NOT_ACTIVE" | "NO_TIME_CLAIMS";
  timeClaims: Array<{ name: "iat" | "exp" | "nbf"; rawValue: number; date: string }>;
}

const decodeBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const parseJwtPart = (value: string, label: string): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(value));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`${label}를 JSON으로 디코딩하지 못했습니다.`);
  }
};

export const decodeJwt = (source: string, nowMilliseconds = Date.now()): DecodedJwt => {
  const token = source.trim().replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) throw new Error("JWT는 Header.Payload.Signature 세 부분이어야 합니다.");
  const header = parseJwtPart(parts[0] ?? "", "Header");
  const payload = parseJwtPart(parts[1] ?? "", "Payload");
  const claimNames = ["iat", "exp", "nbf"] as const;
  const timeClaims = claimNames.flatMap((name) => typeof payload[name] === "number"
    ? [{ name, rawValue: payload[name], date: new Date(payload[name] * 1000).toLocaleString("ko-KR") }]
    : []);
  const nowSeconds = Math.floor(nowMilliseconds / 1000);
  const state = typeof payload.exp === "number" && payload.exp <= nowSeconds
    ? "EXPIRED"
    : typeof payload.nbf === "number" && payload.nbf > nowSeconds
      ? "NOT_ACTIVE"
      : timeClaims.length > 0 ? "VALID_TIME" : "NO_TIME_CLAIMS";
  return { header, payload, signature: parts[2] ?? "", state, timeClaims };
};

