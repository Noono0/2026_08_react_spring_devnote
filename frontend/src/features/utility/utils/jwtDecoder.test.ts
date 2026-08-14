import { decodeJwt } from "@/features/utility/utils/jwtDecoder";

const toBase64Url = (value: object): string => btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

it("Bearer JWT를 디코딩하고 만료 상태를 판단한다", () => {
  const token = `${toBase64Url({ alg: "none" })}.${toBase64Url({ sub: "1", exp: 100 })}.signature`;
  const decoded = decodeJwt(`Bearer ${token}`, 101_000);
  expect(decoded.payload.sub).toBe("1");
  expect(decoded.state).toBe("EXPIRED");
});

