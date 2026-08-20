// ============================================================================
// 최고 관리자 초기 비밀번호 해시 생성기
//
// ★ 왜 필요한가
//   저장소의 기본 해시는 admin/admin1234 이며 .env.example 과 compose.yml 에
//   그대로 적혀 있다. 즉 이 저장소를 본 누구나 최고 관리자로 로그인할 수 있다.
//   배포 전에 반드시 새 값으로 바꿔야 한다.
//
// ★ 형식은 백엔드와 정확히 맞춘 것이다.
//   MemberPasswordService.java 참고 —
//   PBKDF2WithHmacSHA256 / 600,000회 / salt 16바이트 / 해시 256비트
//   결과 문자열: "반복횟수:base64(salt):base64(hash)"
//
// 사용법 (로컬 PC 에서. 서버에서 실행할 필요 없다)
//   node scripts/generate-admin-hash.mjs "새로운비밀번호"
//
// 출력된 한 줄을 .env.app 의 INITIAL_SUPER_ADMIN_PASSWORD_HASH 에 넣는다.
// ★ 비밀번호 자체는 어디에도 저장하지 않는다. 해시만 서버로 간다.
// ============================================================================
import { pbkdf2Sync, randomBytes } from "node:crypto";

const password = process.argv[2];

if (!password) {
  console.error("사용법: node scripts/generate-admin-hash.mjs \"새로운비밀번호\"");
  process.exit(1);
}

// 짧은 비밀번호는 반복횟수가 아무리 많아도 금방 뚫린다. 최소한의 방어선.
if (password.length < 12) {
  console.error("비밀번호는 12자 이상을 권장합니다. (현재 " + password.length + "자)");
  process.exit(1);
}

const ITERATIONS = 600_000;   // MemberPasswordService.ITERATIONS
const SALT_LENGTH = 16;       // MemberPasswordService.SALT_LENGTH
const HASH_LENGTH_BYTES = 32; // HASH_LENGTH_BITS(256) / 8

const salt = randomBytes(SALT_LENGTH);
const hash = pbkdf2Sync(password, salt, ITERATIONS, HASH_LENGTH_BYTES, "sha256");

const encoded = [
  ITERATIONS,
  salt.toString("base64"),
  hash.toString("base64"),
].join(":");

console.log(encoded);
