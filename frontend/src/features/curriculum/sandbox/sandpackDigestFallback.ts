/**
 * Sandpack 2.20.0은 미리보기용 9글자 ID를 만들 때 crypto.subtle.digest("SHA-256")를 사용한다.
 * 공개 HTTP IP에서는 브라우저가 subtle을 제공하지 않으므로, 이 ID 계산에 필요한 digest만 채운다.
 * HTTPS에서는 브라우저 기본 구현을 그대로 사용한다. 전송 보안을 제공하는 코드는 아니다.
 */
const ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const INITIAL_HASH = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

const rotateRight = (value: number, count: number): number => (value >>> count) | (value << (32 - count));
const readNumber = (values: ArrayLike<number>, index: number): number => {
  const value = values[index];
  if (value === undefined) throw new RangeError(`SHA-256 값이 없습니다: ${index}`);
  return value;
};

/** Web Crypto와 같은 SHA-256 바이트 순서의 ArrayBuffer를 반환한다. */
export function sha256ForSandpack(input: BufferSource): ArrayBuffer {
  const bytes = ArrayBuffer.isView(input)
    ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
    : new Uint8Array(input);
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bitLength = bytes.length * 8;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  const hash = [...INITIAL_HASH];
  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4);
    for (let index = 16; index < 64; index += 1) {
      const left = readNumber(words, index - 15);
      const right = readNumber(words, index - 2);
      const small0 = rotateRight(left, 7) ^ rotateRight(left, 18) ^ (left >>> 3);
      const small1 = rotateRight(right, 17) ^ rotateRight(right, 19) ^ (right >>> 10);
      words[index] = (readNumber(words, index - 16) + small0 + readNumber(words, index - 7) + small1) >>> 0;
    }

    let a = readNumber(hash, 0), b = readNumber(hash, 1), c = readNumber(hash, 2), d = readNumber(hash, 3);
    let e = readNumber(hash, 4), f = readNumber(hash, 5), g = readNumber(hash, 6), h = readNumber(hash, 7);
    for (let index = 0; index < 64; index += 1) {
      const big1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const first = (h + big1 + choose + readNumber(ROUND_CONSTANTS, index) + readNumber(words, index)) >>> 0;
      const big0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const second = (big0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d + first) >>> 0;
      d = c; c = b; b = a; a = (first + second) >>> 0;
    }
    for (const [index, value] of [a, b, c, d, e, f, g, h].entries()) hash[index] = (readNumber(hash, index) + value) >>> 0;
  }

  const result = new ArrayBuffer(32);
  const resultView = new DataView(result);
  hash.forEach((value, index) => resultView.setUint32(index * 4, value));
  return result;
}

export function installSandpackDigestFallback(): void {
  if (typeof window === "undefined" || window.crypto?.subtle) return;
  Object.defineProperty(window.crypto, "subtle", {
    configurable: true,
    value: {
      digest: (algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer> => {
        if (algorithm !== "SHA-256") return Promise.reject(new DOMException("지원하지 않는 해시 알고리즘입니다.", "NotSupportedError"));
        return Promise.resolve(sha256ForSandpack(data));
      },
    },
  });
}
