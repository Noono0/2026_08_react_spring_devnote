import { decodeBase64Unicode, encodeBase64Unicode, generateSafePassword, hexToRgb, rgbToHsl, sha256Hex } from "@/features/utility/utils/quickTools";

describe("quickTools", () => {
  it("한글을 Base64로 왕복 변환한다", () => {
    expect(decodeBase64Unicode(encodeBase64Unicode("안녕하세요 DevNote"))).toBe("안녕하세요 DevNote");
  });

  it("SHA-256과 색상 변환 결과를 계산한다", async () => {
    await expect(sha256Hex("abc")).resolves.toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(hexToRgb("#6366f1")).toEqual({ red: 99, green: 102, blue: 241 });
    expect(rgbToHsl(255, 0, 0)).toEqual({ hue: 0, saturation: 100, lightness: 50 });
  });

  it("각 문자 그룹을 포함하는 안전한 비밀번호를 만든다", () => {
    const password = generateSafePassword(20);
    expect(password).toHaveLength(20);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[!@#$%^&*_+=-]/);
  });
});
