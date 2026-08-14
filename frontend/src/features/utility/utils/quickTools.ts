export const encodeBase64Unicode = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};

export const decodeBase64Unicode = (value: string): string => {
  const binary = atob(value.trim());
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
};

export const sha256Hex = async (value: string | ArrayBuffer): Promise<string> => {
  const data = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const hexToRgb = (hex: string): { red: number; green: number; blue: number } => {
  const normalized = hex.trim().replace(/^#/, "");
  const expanded = normalized.length === 3 ? [...normalized].map((character) => character.repeat(2)).join("") : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) throw new Error("HEX 색상은 #6366f1 또는 #63f 형식으로 입력해 주세요.");
  return { red: parseInt(expanded.slice(0, 2), 16), green: parseInt(expanded.slice(2, 4), 16), blue: parseInt(expanded.slice(4, 6), 16) };
};

export const rgbToHsl = (red: number, green: number, blue: number): { hue: number; saturation: number; lightness: number } => {
  const [normalizedRed, normalizedGreen, normalizedBlue] = [red, green, blue].map((value) => value / 255);
  const maximum = Math.max(normalizedRed ?? 0, normalizedGreen ?? 0, normalizedBlue ?? 0);
  const minimum = Math.min(normalizedRed ?? 0, normalizedGreen ?? 0, normalizedBlue ?? 0);
  const lightness = (maximum + minimum) / 2;
  if (maximum === minimum) return { hue: 0, saturation: 0, lightness: Math.round(lightness * 100) };
  const difference = maximum - minimum;
  const saturation = lightness > 0.5 ? difference / (2 - maximum - minimum) : difference / (maximum + minimum);
  let hue = maximum === normalizedRed ? ((normalizedGreen ?? 0) - (normalizedBlue ?? 0)) / difference + ((normalizedGreen ?? 0) < (normalizedBlue ?? 0) ? 6 : 0)
    : maximum === normalizedGreen ? ((normalizedBlue ?? 0) - (normalizedRed ?? 0)) / difference + 2
      : ((normalizedRed ?? 0) - (normalizedGreen ?? 0)) / difference + 4;
  hue /= 6;
  return { hue: Math.round(hue * 360), saturation: Math.round(saturation * 100), lightness: Math.round(lightness * 100) };
};

export const generateSafePassword = (length: number): string => {
  if (length < 12 || length > 128) throw new Error("비밀번호 길이는 12~128자로 설정해 주세요.");
  const groups = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%^&*_-+="];
  const randomCharacter = (characters: string): string => {
    const values = new Uint32Array(1); crypto.getRandomValues(values); return characters[(values[0] ?? 0) % characters.length] ?? "A";
  };
  const characters = groups.map(randomCharacter);
  const allCharacters = groups.join("");
  while (characters.length < length) characters.push(randomCharacter(allCharacters));
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const values = new Uint32Array(1); crypto.getRandomValues(values); const swapIndex = (values[0] ?? 0) % (index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex] ?? "A", characters[index] ?? "A"];
  }
  return characters.join("");
};

export const httpStatuses = [
  { code: 200, name: "OK", meaning: "요청이 정상 처리됨" }, { code: 201, name: "Created", meaning: "새 리소스 생성 완료" },
  { code: 204, name: "No Content", meaning: "응답 본문 없이 성공" }, { code: 400, name: "Bad Request", meaning: "요청값 또는 문법 오류" },
  { code: 401, name: "Unauthorized", meaning: "인증이 필요함" }, { code: 403, name: "Forbidden", meaning: "인증됐지만 권한 없음" },
  { code: 404, name: "Not Found", meaning: "리소스를 찾을 수 없음" }, { code: 409, name: "Conflict", meaning: "현재 상태와 요청이 충돌" },
  { code: 422, name: "Unprocessable Content", meaning: "문법은 맞지만 처리할 수 없는 값" }, { code: 429, name: "Too Many Requests", meaning: "요청 횟수 제한 초과" },
  { code: 500, name: "Internal Server Error", meaning: "서버 내부 오류" }, { code: 503, name: "Service Unavailable", meaning: "일시적으로 서비스를 사용할 수 없음" },
];

