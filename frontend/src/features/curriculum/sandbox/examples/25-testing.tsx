/**
 * 25단계 연습 — 테스트 작성: 순수 함수와 경계값 테스트
 *
 * 실제 프로젝트는 Vitest로 테스트를 돌린다. 이 편집기에서는 같은 생각을 작은 test() 함수로 보여 준다.
 *
 * 해 볼 것
 *  1. "VIP" 쿠폰(20% 할인) 규칙을 추가하기 전에 테스트부터 적어 보세요(처음엔 실패해야 정상).
 *  2. 무료 배송 기준을 일부러 틀리게(>= 를 >로) 바꾸고, 어떤 테스트가 잡는지 확인해 보세요.
 */

// ── 테스트할 대상: 화면과 떨어진 순수 함수(같은 입력 → 같은 출력) ──
interface Price { discount: number; shipping: number; total: number; }
const FREE_SHIPPING_FROM = 50000;
const SHIPPING_FEE = 3000;

function calculatePrice(subtotal: number, coupon: string): Price {
  const discount = coupon.trim().toUpperCase() === "WELCOME10" ? Math.floor(subtotal * 0.1) : 0;
  const afterDiscount = subtotal - discount;
  const shipping = afterDiscount >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;
  return { discount, shipping, total: afterDiscount + shipping };
}

// ── 아주 작은 테스트 도구 ──
interface TestResult { name: string; passed: boolean; detail: string; }
const results: TestResult[] = [];
const test = (name: string, run: () => void) => {
  try { run(); results.push({ name, passed: true, detail: "" }); }
  catch (error) { results.push({ name, passed: false, detail: error instanceof Error ? error.message : String(error) }); }
};
const expectEqual = (actual: unknown, expected: unknown) => {
  if (actual !== expected) throw new Error(`기대값 ${String(expected)}, 실제값 ${String(actual)}`);
};

// ── 테스트: 경계값(딱 그 기준, 바로 아래)을 꼭 넣는다 ──
test("쿠폰이 없으면 할인이 없다", () => expectEqual(calculatePrice(10000, "").discount, 0));
test("WELCOME10은 10% 할인(대소문자·공백 무시)", () => expectEqual(calculatePrice(20000, " welcome10 ").discount, 2000));
test("할인 후 50,000원이면 무료 배송(경계값)", () => expectEqual(calculatePrice(50000, "").shipping, 0));
test("49,999원이면 배송비 3,000원(경계 바로 아래)", () => expectEqual(calculatePrice(49999, "").shipping, 3000));

export default function App() {
  const passedCount = results.filter((result) => result.passed).length;
  return (
    <main>
      <h1>테스트 결과 {passedCount} / {results.length}</h1>
      <ul className="list">
        {results.map((result) => (
          <li key={result.name}>
            <span className={result.passed ? "ok" : "error"}>{result.passed ? "✓ 통과" : "✗ 실패"}</span>
            <span>{result.name}</span>
            {result.detail ? <span className="muted">{result.detail}</span> : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
