import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// 비밀 키는 출력하지 않고 Git에서 제외된 파일에 최초 한 번만 쓴다.
// Write the private key once to an ignored file without printing it.
const destination = resolve(dirname(fileURLToPath(import.meta.url)), "../.local/web-push.env");
const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const publicJwk = publicKey.export({ format: "jwk" });
const privateJwk = privateKey.export({ format: "jwk" });
const encodedPublic = Buffer.concat([Buffer.from([4]), Buffer.from(publicJwk.x, "base64url"), Buffer.from(publicJwk.y, "base64url")]).toString("base64url");
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, `WEB_PUSH_PUBLIC_KEY=${encodedPublic}\nWEB_PUSH_PRIVATE_KEY=${privateJwk.d}\nWEB_PUSH_SUBJECT=mailto:replace-with-your-email@example.com\n`, { flag: "wx", mode: 0o600 });
console.log(`웹 푸시 키를 저장했습니다: ${destination}`);
console.log("WEB_PUSH_SUBJECT를 실제 운영 연락처로 바꾸고, 파일 내용을 서버 환경 변수에 적용하세요. 기존 키 파일은 덮어쓰지 않습니다.");
