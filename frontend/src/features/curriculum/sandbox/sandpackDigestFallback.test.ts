import { afterEach, describe, expect, it, vi } from "vitest";
import { installSandpackDigestFallback, sha256ForSandpack } from "./sandpackDigestFallback";

const hex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");

const originalSubtle = Object.getOwnPropertyDescriptor(window.crypto, "subtle");

afterEach(() => {
  if (originalSubtle) Object.defineProperty(window.crypto, "subtle", originalSubtle);
  else Reflect.deleteProperty(window.crypto, "subtle");
});

describe("HTTP 운영 주소의 Sandpack 해시 대체", () => {
  it("SHA-256 표준 예제와 긴 입력을 정확히 계산한다", () => {
    expect(hex(sha256ForSandpack(new TextEncoder().encode("")))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(hex(sha256ForSandpack(new TextEncoder().encode("abc")))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(hex(sha256ForSandpack(new TextEncoder().encode("a".repeat(1000))))).toBe(
      "41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3",
    );
  });

  it("부분 배열의 시작 위치와 길이를 지킨다", () => {
    const bytes = new TextEncoder().encode("xabcy");
    expect(hex(sha256ForSandpack(bytes.subarray(1, 4)))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("subtle이 없는 브라우저에서는 Sandpack이 호출할 digest를 제공한다", async () => {
    Object.defineProperty(window.crypto, "subtle", { configurable: true, value: undefined });
    installSandpackDigestFallback();
    expect(hex(await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode("abc")))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    await expect(window.crypto.subtle.digest("SHA-1", new Uint8Array())).rejects.toMatchObject({ name: "NotSupportedError" });
  });

  it("이미 Web Crypto가 있으면 브라우저 구현을 유지한다", () => {
    const digest = vi.fn();
    Object.defineProperty(window.crypto, "subtle", { configurable: true, value: { digest } });
    installSandpackDigestFallback();
    expect(window.crypto.subtle).toHaveProperty("digest", digest);
  });
});
