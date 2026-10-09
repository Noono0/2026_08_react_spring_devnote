/**
 * 16단계 연습 — 동적 견적서 폼: useFieldArray로 줄 추가·삭제, useWatch로 합계 계산, Zod 배열 검증
 *
 * 해 볼 것
 *  1. 품목을 바로 아래에 복제하는 버튼을 추가해 보세요. (insert 사용)
 *  2. 할인율 칸을 추가하고 합계에 반영해 보세요.
 */
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const itemSchema = z.object({
  name: z.string().trim().min(1, "품목명을 입력하세요."),
  quantity: z.number({ error: "숫자를 입력하세요." }).int().min(1, "1개 이상"),
  unitPrice: z.number({ error: "숫자를 입력하세요." }).min(0),
});
const quoteSchema = z.object({ items: z.array(itemSchema).min(1, "품목을 1개 이상 넣으세요.") });
type QuoteForm = z.infer<typeof quoteSchema>;

export default function App() {
  const [submittedTotal, setSubmittedTotal] = useState<number | null>(null);
  const { control, register, handleSubmit, formState: { errors } } = useForm<QuoteForm>({
    resolver: zodResolver(quoteSchema),
    defaultValues: { items: [{ name: "노트북", quantity: 1, unitPrice: 1200000 }] },
  });
  // fields: 화면에 그릴 줄 목록. field.id는 줄이 움직여도 바뀌지 않아 key로 쓰기 좋다.
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  // useWatch: 입력이 바뀔 때마다 최신 값을 받아 합계를 다시 계산한다.
  const watchedItems = useWatch({ control, name: "items" });
  const total = watchedItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);

  return (
    <main>
      <h1>동적 견적서</h1>
      <form onSubmit={(event) => void handleSubmit((values) => setSubmittedTotal(values.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)))(event)}>
        {fields.map((field, index) => (
          <div key={field.id} className="card row">
            <input {...register(`items.${index}.name`)} placeholder="품목명" aria-label={`${index + 1}번 품목명`} />
            <input type="number" {...register(`items.${index}.quantity`, { valueAsNumber: true })} aria-label={`${index + 1}번 수량`} style={{ width: 70 }} />
            <input type="number" {...register(`items.${index}.unitPrice`, { valueAsNumber: true })} aria-label={`${index + 1}번 단가`} style={{ width: 110 }} />
            <button type="button" className="danger" disabled={fields.length === 1} onClick={() => remove(index)}>삭제</button>
            {errors.items?.[index]?.name ? <span className="error">{errors.items[index].name.message}</span> : null}
          </div>
        ))}
        {errors.items?.root ? <p className="error">{errors.items.root.message}</p> : null}
        <div className="row">
          <button type="button" className="secondary" onClick={() => append({ name: "", quantity: 1, unitPrice: 0 })}>+ 품목 추가</button>
          <button type="submit">견적 확정</button>
        </div>
      </form>
      <p>합계: <strong>{total.toLocaleString()}원</strong></p>
      {submittedTotal !== null ? <p className="ok" role="status">확정된 금액: {submittedTotal.toLocaleString()}원</p> : null}
    </main>
  );
}
