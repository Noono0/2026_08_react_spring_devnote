import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { applicationLogger } from "@/shared/logging/applicationLogger";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ModalDialog } from "@/shared/ui/ModalDialog";

const productFormSchema = z.object({
  productName: z.string().trim().min(1, "상품명을 입력해 주세요.").max(80, "상품명은 80자 이하여야 합니다."),
  categoryName: z.string().trim().min(1, "카테고리를 입력해 주세요."),
  productPrice: z.number().min(0, "가격은 0원 이상이어야 합니다."),
  stockQuantity: z.number().int("재고는 정수여야 합니다.").min(0, "재고는 0개 이상이어야 합니다."),
  saleStatus: z.enum(["ON_SALE", "SOLD_OUT", "HIDDEN"]),
});

type ProductFormValues = z.infer<typeof productFormSchema>;
type ProductSaleStatus = ProductFormValues["saleStatus"];
type ProductFormMode = "CREATE" | "UPDATE";

interface ProductItem extends ProductFormValues {
  productId: number;
  updatedAt: string;
}

const initialProductItems: ProductItem[] = [
  {
    productId: 1,
    productName: "React 입문 교재",
    categoryName: "도서",
    productPrice: 28000,
    stockQuantity: 13,
    saleStatus: "ON_SALE",
    updatedAt: "2026-08-06 20:10",
  },
  {
    productId: 2,
    productName: "기계식 키보드",
    categoryName: "주변기기",
    productPrice: 89000,
    stockQuantity: 0,
    saleStatus: "SOLD_OUT",
    updatedAt: "2026-08-06 21:25",
  },
  {
    productId: 3,
    productName: "Spring Boot 실습 노트",
    categoryName: "문구",
    productPrice: 12000,
    stockQuantity: 40,
    saleStatus: "HIDDEN",
    updatedAt: "2026-08-06 22:05",
  },
];

const saleStatusLabelMap: Record<ProductSaleStatus, string> = {
  ON_SALE: "판매 중",
  SOLD_OUT: "품절",
  HIDDEN: "숨김",
};

const defaultProductFormValues: ProductFormValues = {
  productName: "",
  categoryName: "",
  productPrice: 0,
  stockQuantity: 0,
  saleStatus: "ON_SALE",
};

const createDisplayDateTime = (): string => new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(new Date());

/**
 * 생성·수정·삭제를 모두 모달에서 처리하는 CRUD 학습 화면입니다.
 *
 * 기존 할 일 CRUD의 인라인 편집 방식과 비교해 다음을 연습합니다.
 * - 공통 ModalDialog 재사용
 * - 생성/수정 폼 하나로 통합
 * - 모달을 열 때 React Hook Form 초기값 reset
 * - 삭제 전 ConfirmDialog로 재확인
 * - 검색 결과와 원본 State 분리
 */
export const ProductModalCrudPage = () => {
  const [productItems, setProductItems] = useState<ProductItem[]>(initialProductItems);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [productFormMode, setProductFormMode] = useState<ProductFormMode | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [deleteTargetProduct, setDeleteTargetProduct] = useState<ProductItem | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: defaultProductFormValues,
  });

  const filteredProductItems = useMemo(() => {
    const normalizedSearchKeyword = searchKeyword.trim().toLowerCase();
    if (!normalizedSearchKeyword) {
      return productItems;
    }

    return productItems.filter((productItem) => (
      productItem.productName.toLowerCase().includes(normalizedSearchKeyword)
      || productItem.categoryName.toLowerCase().includes(normalizedSearchKeyword)
    ));
  }, [productItems, searchKeyword]);

  const openCreateModal = (): void => {
    applicationLogger.info("[ProductModalCrudPage] 상품 추가 모달 열기");
    setSelectedProductId(null);
    reset(defaultProductFormValues);
    setProductFormMode("CREATE");
  };

  const openUpdateModal = (productItem: ProductItem): void => {
    applicationLogger.info("[ProductModalCrudPage] 상품 수정 모달 열기", { productId: productItem.productId });
    setSelectedProductId(productItem.productId);
    reset({
      productName: productItem.productName,
      categoryName: productItem.categoryName,
      productPrice: productItem.productPrice,
      stockQuantity: productItem.stockQuantity,
      saleStatus: productItem.saleStatus,
    });
    setProductFormMode("UPDATE");
  };

  const closeProductFormModal = (): void => {
    if (isSubmitting) {
      return;
    }

    setProductFormMode(null);
    setSelectedProductId(null);
    reset(defaultProductFormValues);
  };

  const saveProduct = (productFormValues: ProductFormValues): void => {
    const normalizedProductFormValues: ProductFormValues = {
      ...productFormValues,
      productName: productFormValues.productName.trim(),
      categoryName: productFormValues.categoryName.trim(),
    };

    if (productFormMode === "UPDATE" && selectedProductId !== null) {
      setProductItems((previousProductItems) => previousProductItems.map((productItem) => (
        productItem.productId === selectedProductId
          ? {
              ...productItem,
              ...normalizedProductFormValues,
              updatedAt: createDisplayDateTime(),
            }
          : productItem
      )));

      applicationLogger.info("[ProductModalCrudPage] 상품 수정 완료", {
        productId: selectedProductId,
        normalizedProductFormValues,
      });
      applicationNotification.success("상품을 수정했습니다.");
      closeProductFormModal();
      return;
    }

    const createdProductItem: ProductItem = {
      productId: Date.now(),
      ...normalizedProductFormValues,
      updatedAt: createDisplayDateTime(),
    };

    setProductItems((previousProductItems) => [createdProductItem, ...previousProductItems]);
    applicationLogger.info("[ProductModalCrudPage] 상품 추가 완료", { createdProductItem });
    applicationNotification.success("상품을 추가했습니다.");
    closeProductFormModal();
  };

  const deleteProduct = (): void => {
    if (!deleteTargetProduct) {
      return;
    }

    setProductItems((previousProductItems) => previousProductItems.filter(
      (productItem) => productItem.productId !== deleteTargetProduct.productId,
    ));
    applicationLogger.info("[ProductModalCrudPage] 상품 삭제 완료", {
      productId: deleteTargetProduct.productId,
      productName: deleteTargetProduct.productName,
    });
    applicationNotification.success("상품을 삭제했습니다.");
    setDeleteTargetProduct(null);
  };

  return (
    <section>
      <div className="page-heading-row">
        <div>
          <span className="level-badge level-중급">중급</span>
          <h1>상품 관리 모달 CRUD</h1>
          <p>추가·수정 폼과 삭제 확인을 별도의 모달로 열어 인라인 CRUD와 차이를 비교합니다.</p>
        </div>
        <button type="button" onClick={openCreateModal}>상품 추가 모달</button>
      </div>

      <div className="modal-crud-toolbar">
        <label className="search-field">
          상품 검색
          <input
            value={searchKeyword}
            onChange={(changeEvent) => setSearchKeyword(changeEvent.target.value)}
            placeholder="상품명 또는 카테고리"
          />
        </label>
        <span>총 {filteredProductItems.length}개</span>
      </div>

      <div className="responsive-table-wrapper">
        <table className="data-table modal-crud-table">
          <thead>
            <tr>
              <th>상품명</th>
              <th>카테고리</th>
              <th>가격</th>
              <th>재고</th>
              <th>상태</th>
              <th>수정일</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredProductItems.map((productItem) => (
              <tr key={productItem.productId}>
                <td><strong>{productItem.productName}</strong></td>
                <td>{productItem.categoryName}</td>
                <td>{productItem.productPrice.toLocaleString("ko-KR")}원</td>
                <td>{productItem.stockQuantity.toLocaleString("ko-KR")}개</td>
                <td><span className={`product-status-badge status-${productItem.saleStatus.toLowerCase()}`}>{saleStatusLabelMap[productItem.saleStatus]}</span></td>
                <td>{productItem.updatedAt}</td>
                <td>
                  <div className="button-row compact-button-row">
                    <button type="button" className="secondary-button" onClick={() => openUpdateModal(productItem)}>수정 모달</button>
                    <button type="button" className="danger-button" onClick={() => setDeleteTargetProduct(productItem)}>삭제 모달</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredProductItems.length === 0 ? (
        <div className="state-panel">검색 조건에 맞는 상품이 없습니다.</div>
      ) : null}

      <div className="learning-note-grid">
        <article className="learning-note-card">
          <h2>인라인 CRUD와 비교</h2>
          <p>할 일 화면은 목록 안에서 바로 수정하고, 이 화면은 별도 모달에서 수정합니다. 데이터 양과 입력 필드 수에 따라 어떤 방식이 읽기 좋은지 비교합니다.</p>
        </article>
        <article className="learning-note-card">
          <h2>모달을 열 때 reset</h2>
          <p>추가 모달에는 빈 기본값을, 수정 모달에는 선택한 상품값을 넣습니다. 이전 입력이 다음 모달에 남지 않도록 닫을 때도 폼을 초기화합니다.</p>
        </article>
        <article className="learning-note-card">
          <h2>삭제 확인이 필요한 이유</h2>
          <p>삭제는 되돌리기 어려우므로 즉시 실행하지 않고 상품명과 작업 내용을 확인한 뒤 실행합니다.</p>
        </article>
      </div>

      <ModalDialog
        isOpen={productFormMode !== null}
        title={productFormMode === "UPDATE" ? "상품 수정" : "상품 추가"}
        description={productFormMode === "UPDATE" ? "선택한 상품 정보를 변경합니다." : "새 상품 정보를 입력합니다."}
        onRequestClose={closeProductFormModal}
        closeOnBackdropClick={!isSubmitting}
        footer={(
          <>
            <button type="button" className="ghost-button" onClick={closeProductFormModal} disabled={isSubmitting}>취소</button>
            <button type="submit" form="product-modal-form" disabled={isSubmitting}>
              {productFormMode === "UPDATE" ? "수정 저장" : "상품 추가"}
            </button>
          </>
        )}
      >
        <form id="product-modal-form" className="modal-form-grid" onSubmit={(event) => void handleSubmit(saveProduct)(event)}>
          <label>
            상품명
            <input autoFocus {...register("productName")} placeholder="예: React 실습 교재" />
            {errors.productName ? <span className="field-error">{errors.productName.message}</span> : null}
          </label>
          <label>
            카테고리
            <input {...register("categoryName")} placeholder="예: 도서" />
            {errors.categoryName ? <span className="field-error">{errors.categoryName.message}</span> : null}
          </label>
          <div className="modal-form-two-columns">
            <label>
              가격
              <input type="number" min={0} {...register("productPrice", { valueAsNumber: true })} />
              {errors.productPrice ? <span className="field-error">{errors.productPrice.message}</span> : null}
            </label>
            <label>
              재고
              <input type="number" min={0} {...register("stockQuantity", { valueAsNumber: true })} />
              {errors.stockQuantity ? <span className="field-error">{errors.stockQuantity.message}</span> : null}
            </label>
          </div>
          <label>
            판매 상태
            <select {...register("saleStatus")}>
              <option value="ON_SALE">판매 중</option>
              <option value="SOLD_OUT">품절</option>
              <option value="HIDDEN">숨김</option>
            </select>
          </label>
        </form>
      </ModalDialog>

      <ConfirmDialog
        isOpen={deleteTargetProduct !== null}
        title="상품 삭제"
        description={deleteTargetProduct ? `“${deleteTargetProduct.productName}” 상품을 삭제하시겠습니까?` : "선택한 상품을 삭제하시겠습니까?"}
        confirmButtonLabel="삭제"
        onConfirm={deleteProduct}
        onCancel={() => setDeleteTargetProduct(null)}
      />
    </section>
  );
};
