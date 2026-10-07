/**
 * ============================================================================
 * DynamicQuoteFormPage.tsx — 【고급】 품목을 늘렸다 줄였다 하는 견적서 (useFieldArray)
 * ============================================================================
 *
 * 입력칸 개수가 정해져 있지 않은 폼이다. 사용자가 "품목 추가"를 누를 때마다 한 줄이 생긴다.
 *
 * [useFieldArray가 하는 일]
 *   fields  → 지금 있는 줄 목록. 각 줄에 React Hook Form이 만든 고유 id가 있다.
 *   append  → 맨 뒤에 한 줄 추가
 *   remove  → n번째 줄 삭제
 *   move    → 줄 순서 바꾸기
 *   입력칸 이름은 "items.0.itemName", "items.1.quantity"처럼 "배열이름.번호.칸이름"으로 등록한다.
 *
 * [흔한 실수]
 *   ❌ key={index} → 가운데 줄을 지우면 아래 줄들의 번호가 당겨져 입력값이 엉뚱한 줄에 붙는다.
 *   ✓ key={field.id} → useFieldArray가 준 id는 줄이 움직여도 그대로라 값이 따라간다.
 *   ❌ 숫자 칸을 그냥 register → 값이 "3" 같은 문자열로 들어와 합계가 "33"처럼 이어 붙는다.
 *   ✓ register(..., { valueAsNumber: true }) → 숫자로 받는다. 비우면 NaN이라 Zod에서 걸러진다.
 *
 * [합계는 State로 따로 만들지 않는다]
 *   useWatch로 지금 입력값을 읽어 렌더링할 때 계산한다.
 *   합계를 useState에 또 담으면 입력값과 합계가 어긋나는 순간이 생긴다. (같은 정보를 두 곳에 두지 않기)
 */

import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LearningGuideTitle } from "@/features/curriculum/components/LearningGuideTitle";
import { applicationNotification } from "@/shared/notification/applicationNotification";

// 품목 최대 개수. 스키마(max)와 "품목 추가" 버튼 비활성화에 같은 값을 써서 규칙이 어긋나지 않게 한다.
const MAX_ITEM_COUNT = 10;

const quoteItemSchema = z.object({
  itemName: z.string().trim().min(1, "품목명을 입력해 주세요.").max(40, "품목명은 40자 이하여야 합니다."),
  // 칸을 비우면 valueAsNumber 결과가 NaN이다. error 문구는 그때(숫자가 아닐 때) 보여 줄 말이다.
  quantity: z.number({ error: "수량을 숫자로 입력해 주세요." }).int("수량은 정수여야 합니다.").min(1, "수량은 1 이상이어야 합니다.").max(999, "수량은 999 이하여야 합니다."),
  unitPrice: z.number({ error: "단가를 숫자로 입력해 주세요." }).min(0, "단가는 0원 이상이어야 합니다.").max(100_000_000, "단가는 1억 원 이하여야 합니다."),
});

const quoteFormSchema = z.object({
  customerName: z.string().trim().min(1, "고객명을 입력해 주세요."),
  items: z.array(quoteItemSchema)
    .min(1, "품목을 1개 이상 추가해 주세요.")
    .max(MAX_ITEM_COUNT, `품목은 ${MAX_ITEM_COUNT}개까지 추가할 수 있습니다.`)
    // ★ 줄 하나만 봐서는 알 수 없는 규칙(줄끼리 비교)은 배열 전체에 superRefine으로 건다.
    //   path에 줄 번호를 넣으면 그 줄의 품목명 칸 아래에 오류가 표시된다.
    //   ※ 어느 줄이든 기본 규칙(빈 수량 등)에 걸리면 Zod는 이 검사를 건너뛴다.
    //     그래서 중복 오류는 각 줄의 입력 오류를 먼저 고친 뒤에 나타난다.
    .superRefine((items, context) => {
      const seenNames = new Set<string>();
      items.forEach((item, index) => {
        const normalizedName = item.itemName.trim();
        if (seenNames.has(normalizedName)) {
          context.addIssue({ code: "custom", path: [index, "itemName"], message: "같은 품목명이 이미 있습니다." });
        }
        seenNames.add(normalizedName);
      });
    }),
});

// z.infer: 스키마에서 TypeScript 타입을 뽑아낸다. 스키마와 타입을 따로 적지 않아도 항상 일치한다.
type QuoteFormValues = z.infer<typeof quoteFormSchema>;

// QuoteFormValues["items"][number] = items 배열 "한 칸"의 타입. 새 줄의 기본값을 만든다.
const createEmptyItem = (): QuoteFormValues["items"][number] => ({ itemName: "", quantity: 1, unitPrice: 0 });

/** NaN(빈 칸)도 0으로 보고 계산한다. 입력 도중에도 합계가 "NaN원"으로 보이지 않게 하기 위해서다. */
const safeNumber = (value: number | undefined): number => (Number.isFinite(value) ? Number(value) : 0);
const formatWon = (value: number): string => `${value.toLocaleString("ko-KR")}원`;

export const DynamicQuoteFormPage = () => {
  // 검증을 통과해 제출된 결과(오른쪽 카드에 표시). 처음에는 undefined.
  const [submittedQuote, setSubmittedQuote] = useState<{ values: QuoteFormValues; total: number }>();
  // zodResolver: 제출할 때 Zod 스키마로 검사하고, 오류를 errors 객체의 같은 경로(items.0.quantity 등)에 넣어 준다.
  const { control, register, handleSubmit, reset, formState: { errors } } = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: { customerName: "", items: [createEmptyItem()] },
  });

  // name: "items" → 폼 값의 items 배열을 줄 목록으로 다룬다.
  const { fields, append, remove, move } = useFieldArray({ control, name: "items" });
  // 입력이 바뀔 때마다 items 값을 읽어 합계를 다시 계산한다.
  const watchedItems = useWatch({ control, name: "items" });
  const totalAmount = watchedItems.reduce((sum, item) => sum + safeNumber(item.quantity) * safeNumber(item.unitPrice), 0);

  const submitQuote = (values: QuoteFormValues): void => {
    // 여기 오는 values는 검증을 통과한 값이라 수량·단가가 확실히 숫자다(NaN 걱정 없음).
    const total = values.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    setSubmittedQuote({ values, total });
    applicationNotification.success("견적서를 작성했습니다.");
  };

  return (
    <section>
      <div className="page-heading-row">
        <div>
          <span className="level-badge level-고급">고급</span>
          <LearningGuideTitle guideId="dynamic-form">동적 견적서 폼</LearningGuideTitle>
          <p>useFieldArray로 품목 줄을 추가·삭제·이동하고, Zod로 줄 단위·배열 전체 검증을 함께 처리합니다.</p>
        </div>
      </div>

      <div className="split-practice-layout practice-quote-layout">
        {/* noValidate: 브라우저 기본 검사 말풍선을 끄고 Zod 검사 결과만 보여 준다. handleSubmit은 검증을 통과했을 때만 submitQuote를 부른다. */}
        <form className="practice-card" noValidate onSubmit={(submitEvent) => void handleSubmit(submitQuote)(submitEvent)}>
          <h2>견적서 작성</h2>
          <label>고객명
            <input {...register("customerName")} aria-invalid={errors.customerName ? true : undefined} />
            {errors.customerName ? <span className="field-error">{errors.customerName.message}</span> : null}
          </label>

          <fieldset className="practice-quote-items">
            <legend>품목 ({fields.length}/{MAX_ITEM_COUNT})</legend>
            {fields.map((field, index) => {
              const itemErrors = errors.items?.[index];
              const lineNumber = index + 1;
              return (
                // ★ key는 index가 아니라 field.id
                <div className="practice-quote-row" key={field.id} role="group" aria-label={`${lineNumber}번 품목`}>
                  <label>품목명
                    <input {...register(`items.${index}.itemName`)} aria-invalid={itemErrors?.itemName ? true : undefined} />
                    {itemErrors?.itemName ? <span className="field-error">{itemErrors.itemName.message}</span> : null}
                  </label>
                  <label>수량
                    <input type="number" min={1} {...register(`items.${index}.quantity`, { valueAsNumber: true })} aria-invalid={itemErrors?.quantity ? true : undefined} />
                    {itemErrors?.quantity ? <span className="field-error">{itemErrors.quantity.message}</span> : null}
                  </label>
                  <label>단가(원)
                    <input type="number" min={0} {...register(`items.${index}.unitPrice`, { valueAsNumber: true })} aria-invalid={itemErrors?.unitPrice ? true : undefined} />
                    {itemErrors?.unitPrice ? <span className="field-error">{itemErrors.unitPrice.message}</span> : null}
                  </label>
                  {/* <output>: 계산 결과를 나타내는 시맨틱 태그. 값을 상태로 저장하지 않고 렌더링 중에 바로 계산한다. */}
                  <output aria-label={`${lineNumber}번 품목 금액`}>
                    {formatWon(safeNumber(watchedItems[index]?.quantity) * safeNumber(watchedItems[index]?.unitPrice))}
                  </output>
                  <div className="button-row">
                    {/* 첫 줄은 위로, 마지막 줄은 아래로 옮길 수 없게 버튼을 비활성화한다. */}
                    <button type="button" className="ghost-button" aria-label={`${lineNumber}번 품목 위로`} disabled={index === 0} onClick={() => move(index, index - 1)}>↑</button>
                    <button type="button" className="ghost-button" aria-label={`${lineNumber}번 품목 아래로`} disabled={index === fields.length - 1} onClick={() => move(index, index + 1)}>↓</button>
                    {/* 마지막 한 줄은 지우지 못하게 막는다. 스키마의 min(1)과 같은 규칙을 화면에서도 미리 알려 준다. */}
                    <button type="button" className="danger-button" aria-label={`${lineNumber}번 품목 삭제`} disabled={fields.length === 1} onClick={() => remove(index)}>삭제</button>
                  </div>
                </div>
              );
            })}
            {/* 배열 전체에 걸린 오류(min·max)는 root에 들어온다. */}
            {errors.items?.root?.message ?? errors.items?.message ? (
              <span className="field-error" role="alert">{errors.items?.root?.message ?? errors.items?.message}</span>
            ) : null}
          </fieldset>

          <div className="button-row">
            <button type="button" className="secondary-button" disabled={fields.length >= MAX_ITEM_COUNT} onClick={() => append(createEmptyItem())}>+ 품목 추가</button>
            <strong aria-live="polite">합계 {formatWon(totalAmount)}</strong>
          </div>
          <div className="button-row">
            <button type="submit">견적서 작성</button>
            {/* reset(): 폼을 defaultValues로 되돌린다(줄 개수도 처음처럼 1줄). 제출 결과도 함께 지운다. */}
            <button type="button" className="ghost-button" onClick={() => { reset(); setSubmittedQuote(undefined); }}>초기화</button>
          </div>
        </form>

        <article className="practice-card" aria-live="polite">
          <h2>작성 결과</h2>
          {submittedQuote ? (
            <>
              <p><strong>{submittedQuote.values.customerName}</strong> 고객 견적 · 총 {formatWon(submittedQuote.total)}</p>
              <ul>
                {/* 품목명은 스키마에서 중복을 막았으므로 key로 써도 겹치지 않는다. */}
                {submittedQuote.values.items.map((item) => (
                  <li key={item.itemName}>{item.itemName} × {item.quantity} = {formatWon(item.quantity * item.unitPrice)}</li>
                ))}
              </ul>
            </>
          ) : <p>왼쪽 폼을 작성하면 검증을 통과한 값만 이곳에 표시됩니다.</p>}
        </article>
      </div>
    </section>
  );
};
