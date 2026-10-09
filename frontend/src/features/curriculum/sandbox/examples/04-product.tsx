/**
 * 4단계 연습 — 상품 모달 CRUD: React Hook Form + Zod 검증과 모달
 *
 * 해 볼 것
 *  1. 가격이 0원이면 "무료 상품" 배지를 보여 주세요.
 *  2. 재고 칸만 목록에서 바로 고칠 수 있게 만들어 보세요.
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// 입력 규칙을 스키마 한곳에 적는다. 오류 문구도 여기서 정한다.
const productSchema = z.object({
  name: z.string().trim().min(1, "상품명은 필수입니다."),
  price: z.number({ error: "숫자를 입력하세요." }).min(0, "가격은 0 이상이어야 합니다."),
  stock: z.number({ error: "숫자를 입력하세요." }).int("재고는 정수여야 합니다.").min(0),
});
type ProductForm = z.infer<typeof productSchema>;
interface Product extends ProductForm { id: number; }

export default function App() {
  const [products, setProducts] = useState<Product[]>([{ id: 1, name: "기계식 키보드", price: 89000, stock: 13 }]);
  const [isOpen, setIsOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", price: 0, stock: 0 },
  });

  const openModal = () => { reset(); setIsOpen(true); };
  // handleSubmit은 검증을 통과했을 때만 이 함수를 부른다.
  const save = (values: ProductForm) => {
    setProducts((previous) => [...previous, { ...values, id: Date.now() }]);
    setIsOpen(false);
  };

  return (
    <main>
      <h1>상품 모달 CRUD</h1>
      <button onClick={openModal}>상품 추가</button>
      <table>
        <thead><tr><th>상품명</th><th>가격</th><th>재고</th><th>관리</th></tr></thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>{product.name}</td>
              <td>{product.price.toLocaleString()}원</td>
              <td>{product.stock}</td>
              <td><button className="danger" onClick={() => setProducts((previous) => previous.filter((item) => item.id !== product.id))}>삭제</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {isOpen ? (
        // 간단한 모달: 실제 프로젝트는 <dialog>와 포커스 처리를 갖춘 공통 ModalDialog를 쓴다.
        <div role="dialog" aria-modal="true" aria-labelledby="product-modal-title" className="card">
          <h2 id="product-modal-title">상품 추가</h2>
          <form onSubmit={(event) => void handleSubmit(save)(event)}>
            <label>상품명<input {...register("name")} /></label>
            {errors.name ? <span className="error">{errors.name.message}</span> : null}
            {/* valueAsNumber: 입력값을 문자열이 아니라 숫자로 받는다 */}
            <label>가격<input type="number" {...register("price", { valueAsNumber: true })} /></label>
            {errors.price ? <span className="error">{errors.price.message}</span> : null}
            <label>재고<input type="number" {...register("stock", { valueAsNumber: true })} /></label>
            {errors.stock ? <span className="error">{errors.stock.message}</span> : null}
            <div className="row">
              <button type="submit">저장</button>
              <button type="button" className="secondary" onClick={() => setIsOpen(false)}>취소</button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
