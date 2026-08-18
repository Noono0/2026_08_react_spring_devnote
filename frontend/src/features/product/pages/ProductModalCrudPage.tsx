/**
 * ============================================================================
 * ProductModalCrudPage.tsx — 【중급】 모달 + 폼 라이브러리 + 검증 CRUD
 * ============================================================================
 *
 * Todo(인라인 수정) → Contact(Reducer) 다음 단계다.
 * 입력 항목이 많아졌을 때 실무에서 실제로 쓰는 방식을 연습한다.
 *
 * [Todo 페이지와 무엇이 달라졌나]
 *   ┌────────────┬─────────────────────┬──────────────────────────────┐
 *   │            │ Todo 페이지          │ 이 페이지                     │
 *   ├────────────┼─────────────────────┼──────────────────────────────┤
 *   │ 수정 방식   │ 목록 안에서 인라인    │ 별도 모달 창                  │
 *   │ 입력 관리   │ useState를 항목마다  │ React Hook Form이 통째로 관리  │
 *   │ 검증       │ if로 직접 확인       │ Zod 스키마로 선언             │
 *   │ 삭제       │ 바로 삭제            │ 확인 창을 한 번 거침           │
 *   └────────────┴─────────────────────┴──────────────────────────────┘
 *
 * [왜 입력이 많아지면 useState로는 버거운가?]
 *   항목 5개면 useState가 5개, 오류 메시지 State가 또 5개, 제출 중 State까지…
 *   금세 20줄이 넘어간다. 게다가 글자를 하나 칠 때마다 화면 전체가 다시 그려진다.
 *   React Hook Form은 이걸 훅 하나로 대신해 주고 리렌더링도 최소화한다.
 *
 * [배울 개념]
 *   Zod 스키마 / z.infer 타입 추론 / React Hook Form(register, handleSubmit, reset)
 *   / 모달로 폼 열기 / 삭제 재확인 / "무엇을 하는 중인가"를 State로 표현하기
 */

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { applicationLogger } from "@/shared/logging/applicationLogger";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ModalDialog } from "@/shared/ui/ModalDialog";

/**
 * ★ 폼 검증 규칙을 Zod로 "선언"한다.
 *
 * if문으로 직접 검사하는 것과 비교해 보자.
 *
 *   [직접 검사]
 *     if (!productName.trim()) { setError("상품명을 입력해 주세요."); return; }
 *     if (productName.length > 80) { ... }
 *     if (productPrice < 0) { ... }        ← 검사할 때마다 코드가 늘어난다
 *
 *   [Zod]
 *     규칙과 오류 문구를 한 줄에 같이 적는다.
 *     검사 실행, 오류 수집, 화면 표시는 라이브러리가 알아서 한다.
 *     그리고 아래에서 보듯 타입까지 공짜로 만들어 준다.
 *
 * 메서드를 점(.)으로 계속 이어 붙이는 걸 "체이닝"이라고 한다.
 * 각 메서드의 두 번째 인자가 그 규칙을 어겼을 때 보여줄 문구다.
 */
const productFormSchema = z.object({
  // trim() → 앞뒤 공백을 먼저 제거한 뒤 검사한다.
  //   이게 있어서 스페이스만 잔뜩 입력한 것도 min(1)에서 걸러진다.
  productName: z.string().trim().min(1, "상품명을 입력해 주세요.").max(80, "상품명은 80자 이하여야 합니다."),
  categoryName: z.string().trim().min(1, "카테고리를 입력해 주세요."),
  productPrice: z.number().min(0, "가격은 0원 이상이어야 합니다."),
  // int() → 소수점을 막는다. 재고 1.5개는 말이 안 되기 때문이다.
  stockQuantity: z.number().int("재고는 정수여야 합니다.").min(0, "재고는 0개 이상이어야 합니다."),
  saleStatus: z.enum(["ON_SALE", "SOLD_OUT", "HIDDEN"]),
});

/**
 * ★★ z.infer — Zod의 가장 강력한 기능.
 *
 * 위 스키마를 보고 TypeScript 타입을 자동으로 만들어 준다.
 * 결과는 이것과 똑같다:
 *   { productName: string; categoryName: string; productPrice: number;
 *     stockQuantity: number; saleStatus: "ON_SALE" | "SOLD_OUT" | "HIDDEN"; }
 *
 * 왜 좋은가? 진실의 출처가 하나가 되기 때문이다.
 *   스키마와 타입을 따로 적으면, 스키마에 항목을 추가하고 타입에는 안 적는
 *   불일치가 반드시 생긴다. z.infer를 쓰면 스키마만 고치면 타입이 따라온다.
 *
 * `typeof productFormSchema` 는 "변수의 타입을 가져온다"는 뜻이다.
 * (JavaScript의 typeof 연산자와 이름만 같고 하는 일이 다르다)
 */
type ProductFormValues = z.infer<typeof productFormSchema>;

// 타입 안에서 속성 하나의 타입만 꺼내는 문법. 객체에서 값 꺼내듯이 대괄호를 쓴다.
// 결과: "ON_SALE" | "SOLD_OUT" | "HIDDEN"
// 이렇게 하면 판매 상태 목록이 바뀌어도 이 타입이 자동으로 따라간다.
type ProductSaleStatus = ProductFormValues["saleStatus"];

// 모달이 "추가용"인지 "수정용"인지 구분하는 값.
type ProductFormMode = "CREATE" | "UPDATE";

/**
 * 실제로 목록에 저장되는 상품의 모양.
 *
 * `extends`로 폼 값 타입을 상속받고 두 가지를 더했다.
 *
 * ★ 왜 productId와 updatedAt은 폼 스키마에 없을까?
 *   사용자가 입력하는 값이 아니라 시스템이 만들어 붙이는 값이기 때문이다.
 *   "사용자가 채우는 것"과 "저장되는 것"을 구분하는 습관은
 *   나중에 서버 API를 다룰 때 그대로 이어진다.
 *   (요청에는 id가 없고, 응답에는 id가 있는 것과 같은 이치다)
 */
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

/**
 * 코드값 → 한국어 라벨 변환표.
 *
 * ★ `Record<ProductSaleStatus, string>` 타입이 아주 유용하다.
 *   그냥 Record<string, string>이 아니라 정확한 유니온 타입을 썼기 때문에,
 *   나중에 "예약중(RESERVED)" 상태를 추가하면
 *   여기에 라벨을 안 적었다고 TypeScript가 바로 알려 준다.
 *   번역을 빠뜨려서 화면에 "RESERVED"가 그대로 노출되는 사고를 막아 준다.
 */
const saleStatusLabelMap: Record<ProductSaleStatus, string> = {
  ON_SALE: "판매 중",
  SOLD_OUT: "품절",
  HIDDEN: "숨김",
};

/**
 * "추가" 모달을 열 때 폼에 채울 빈 값.
 *
 * ★ 이걸 상수로 빼 둔 이유
 *   추가 모달을 열 때, 모달을 닫을 때, 폼 초기 설정 때 총 세 번 쓰인다.
 *   객체를 매번 새로 적으면 한 곳만 고치는 실수가 생긴다.
 *
 * 숫자 항목의 초기값을 빈 문자열이 아니라 0으로 둔 점에도 주목하자.
 * 타입이 number라고 선언했으므로 처음부터 number를 넣어야 일관성이 유지된다.
 */
const defaultProductFormValues: ProductFormValues = {
  productName: "",
  categoryName: "",
  productPrice: 0,
  stockQuantity: 0,
  saleStatus: "ON_SALE",
};

/**
 * 현재 시각을 "2026. 08. 15. 14:30" 형태의 한국식 문자열로 만든다.
 *
 * Intl.DateTimeFormat: 브라우저에 내장된 국제화(i18n) 날짜 형식 변환기.
 *
 * ★ 왜 직접 만들지 않을까?
 *   `${date.getFullYear()}-${date.getMonth() + 1}...` 이렇게 짜면
 *     - getMonth()가 0부터 시작해서 +1을 빠뜨리는 실수를 하기 쉽고
 *     - 한 자리 수를 "01"로 채우는 처리를 직접 해야 하고
 *     - 나라마다 다른 표기 순서를 지원할 수 없다
 *   브라우저가 정확하게 해 주는 일을 굳이 직접 할 이유가 없다.
 *
 *   "2-digit" → 한 자리면 앞에 0을 붙인다 (8월 → "08")
 *   hour12: false → 24시간제 (오후 2시 → 14시)
 */
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

  // ★ "모달이 열렸는가"를 boolean이 아니라 모드 값으로 표현했다. 아주 좋은 습관이다.
  //
  //   [흔한 방식]  isModalOpen(boolean) + isEditMode(boolean)
  //     → 둘 다 true, 둘 다 false 같은 말이 안 되는 조합이 생길 수 있다
  //   [이 방식]    null | "CREATE" | "UPDATE"
  //     → 가능한 상태가 정확히 세 가지뿐이라 모순이 아예 불가능하다
  //
  //   이런 설계를 "불가능한 상태를 표현할 수 없게 만든다"고 한다.
  //   State가 늘어날수록 이 방식의 가치가 커진다.
  const [productFormMode, setProductFormMode] = useState<ProductFormMode | null>(null);

  // 수정 중인 상품의 id. 추가 모드면 null.
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  // 삭제 확인 창의 대상 상품.
  //
  // ★ id만 저장하지 않고 상품 객체를 통째로 저장한 이유
  //   확인 창에 "「기계식 키보드」를 삭제할까요?" 처럼 이름을 보여주려면
  //   이름이 필요한데, id만 있으면 목록에서 다시 찾아야 한다.
  //   객체를 들고 있으면 바로 쓸 수 있다.
  //   그리고 "null이 아니다 = 창이 열려 있다"는 뜻이 되어 State 하나로 두 역할을 한다.
  const [deleteTargetProduct, setDeleteTargetProduct] = useState<ProductItem | null>(null);

  // ── React Hook Form 설정 ────────────────────────────────────────
  //
  // 구조 분해로 필요한 도구들을 꺼낸다. 각각의 역할:
  //   register     : input 하나를 폼에 등록한다 (아래 JSX에서 {...register("이름")})
  //   handleSubmit : 제출 시 검증을 먼저 돌리고, 통과했을 때만 내 함수를 부른다
  //   reset        : 폼 값을 통째로 갈아 끼운다 (모달 열 때 초기값 채우기에 필수)
  //   formState    : 폼의 현재 상태 모음
  //     ├ errors       : 검증에 걸린 항목별 오류 메시지
  //     └ isSubmitting : 지금 제출 처리 중인지 (버튼 잠금에 쓴다)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    // ★ resolver: 위에서 만든 Zod 스키마를 폼 검증기로 연결하는 다리.
    //   이 한 줄 덕분에 스키마에 적은 규칙과 오류 문구가
    //   그대로 폼 검증에 적용된다. 검증 코드를 따로 쓸 필요가 없다.
    resolver: zodResolver(productFormSchema),
    defaultValues: defaultProductFormValues,
  });

  // ── 검색 필터링 ─────────────────────────────────────────────────
  const filteredProductItems = useMemo(() => {
    const normalizedSearchKeyword = searchKeyword.trim().toLowerCase();

    // ★ 검색어가 비었으면 필터링 없이 원본을 그대로 돌려준다.
    //   Contact 페이지에서는 이 처리가 없었다. includes("")가 항상 true라
    //   결과는 같기 때문이다. 다만 여기서는 필요 없는 순회 자체를 건너뛴다.
    //   덤으로 원본 배열을 그대로 반환하므로 참조가 유지되는 이점도 있다.
    if (!normalizedSearchKeyword) {
      return productItems;
    }

    return productItems.filter((productItem) => (
      productItem.productName.toLowerCase().includes(normalizedSearchKeyword)
      || productItem.categoryName.toLowerCase().includes(normalizedSearchKeyword)
    ));
  }, [productItems, searchKeyword]);

  /** 【Create】 빈 폼으로 추가 모달을 연다. */
  const openCreateModal = (): void => {
    applicationLogger.info("[ProductModalCrudPage] 상품 추가 모달 열기");
    setSelectedProductId(null);

    // ★★ reset()이 왜 꼭 필요한가? — 이 페이지에서 가장 중요한 부분이다.
    //
    //   폼은 컴포넌트가 살아 있는 내내 같은 것을 재사용한다.
    //   그래서 이전에 수정 모달을 열어 값을 채워 뒀다면 그 값이 그대로 남아 있다.
    //   reset을 안 하면 "추가" 모달을 열었는데 이전 상품 정보가 들어 있는
    //   황당한 상황이 벌어진다.
    //
    //   즉 "모달을 열 때 폼을 원하는 상태로 맞춘다"가 규칙이다.
    reset(defaultProductFormValues);

    // 이 State를 바꾸는 순간 모달이 열린다. (isOpen={productFormMode !== null})
    // ★ 순서에 주목: 폼을 먼저 채우고 마지막에 연다.
    //   반대로 하면 아주 짧은 순간 이전 값이 보일 수 있다.
    setProductFormMode("CREATE");
  };

  /** 【Update】 선택한 상품 값을 폼에 채워 수정 모달을 연다. */
  const openUpdateModal = (productItem: ProductItem): void => {
    applicationLogger.info("[ProductModalCrudPage] 상품 수정 모달 열기", { productId: productItem.productId });
    setSelectedProductId(productItem.productId);

    // 폼에 기존 값을 채운다.
    //
    // ★ `reset(productItem)` 이라고 통째로 넘기지 않고 하나씩 적은 이유
    //   productItem에는 productId와 updatedAt이 들어 있는데,
    //   이 둘은 폼에 없는 항목이다. 통째로 넘기면 폼에 엉뚱한 값이 섞인다.
    //   "폼이 아는 항목만 넘긴다"는 원칙을 지키는 것이다.
    reset({
      productName: productItem.productName,
      categoryName: productItem.categoryName,
      productPrice: productItem.productPrice,
      stockQuantity: productItem.stockQuantity,
      saleStatus: productItem.saleStatus,
    });
    setProductFormMode("UPDATE");
  };

  /** 폼 모달을 닫고 뒷정리를 한다. */
  const closeProductFormModal = (): void => {
    // ★ 저장 처리 중이면 닫지 않는다.
    //   저장 요청을 보내는 도중에 모달이 사라지면
    //   사용자는 저장이 됐는지 안 됐는지 알 수 없다.
    //   "처리 중에는 흐름을 끊지 않는다"는 원칙이다.
    if (isSubmitting) {
      return;
    }

    setProductFormMode(null);
    setSelectedProductId(null);
    // 닫을 때도 폼을 비운다. 열 때 비우는데 왜 또?
    // 다음에 열 때까지 이전 값이 메모리에 남아 있는 게 찜찜하고,
    // 혹시 reset을 빠뜨린 경로가 생겨도 안전하도록 이중으로 막아 두는 것이다.
    reset(defaultProductFormValues);
  };

  /**
   * 【Create + Update】 폼 제출 처리.
   *
   * ★ 이 함수는 "검증을 통과했을 때만" 호출된다.
   *   handleSubmit(saveProduct) 형태로 감싸 뒀기 때문이다.
   *   그래서 이 안에서는 "값이 비었나?" 같은 검사를 할 필요가 전혀 없다.
   *   검증은 Zod가, 실행 여부는 handleSubmit이 책임진다.
   *   덕분에 이 함수는 "저장한다"는 본래 일에만 집중할 수 있다.
   *
   * 매개변수 productFormValues에는 검증을 통과한 폼 값이 담겨 들어온다.
   */
  const saveProduct = (productFormValues: ProductFormValues): void => {
    // 문자열 항목의 공백을 한 번 더 정리한다.
    // (Zod의 trim()은 검증용이라, 실제 저장할 값도 다듬어 주는 게 확실하다)
    const normalizedProductFormValues: ProductFormValues = {
      ...productFormValues,
      productName: productFormValues.productName.trim(),
      categoryName: productFormValues.categoryName.trim(),
    };

    // ── 수정인 경우 ──
    // `&& selectedProductId !== null` 을 함께 확인하는 이유:
    //   논리적으로는 UPDATE 모드면 id가 반드시 있지만,
    //   TypeScript는 그걸 모르기 때문에 아래에서 id를 쓰려면 확인이 필요하다.
    //   이런 걸 "타입 좁히기(narrowing)"라고 한다.
    if (productFormMode === "UPDATE" && selectedProductId !== null) {
      setProductItems((previousProductItems) => previousProductItems.map((productItem) => (
        productItem.productId === selectedProductId
          ? {
              // ★ 전개 연산자를 겹쳐 쓰는 순서에 의미가 있다.
              //   1) ...productItem              기존 값 전부 (productId, updatedAt 포함)
              //   2) ...normalizedProductFormValues  폼에서 온 값으로 덮어쓰기
              //   3) updatedAt: 지금시각          수정 시각만 새로 덮어쓰기
              //
              //   뒤에 오는 것이 앞의 것을 이긴다.
              //   덕분에 productId는 1번에서 온 값이 그대로 살아남고,
              //   폼에 있는 항목들은 2번 값으로 갈아 끼워진다.
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
      // ★ 여기서 return 하지 않으면 아래 "추가" 코드까지 이어서 실행된다.
      //   수정했는데 똑같은 상품이 하나 더 생기는 버그가 난다. 빠뜨리기 쉬운 실수다.
      return;
    }

    // ── 추가인 경우 ──
    const createdProductItem: ProductItem = {
      productId: Date.now(),
      ...normalizedProductFormValues,
      updatedAt: createDisplayDateTime(),
    };

    // ★ 새 항목을 앞에 붙였다. `[새것, ...기존것들]`
    //   Todo 페이지에서는 `[...기존것들, 새것]`으로 뒤에 붙였다.
    //   어느 쪽이 맞는 게 아니라 화면 성격에 따라 고르면 된다.
    //     할 일 목록 → 추가한 순서대로 뒤에 쌓이는 게 자연스럽다
    //     상품 관리 → 방금 등록한 게 맨 위에 보여야 확인하기 편하다
    setProductItems((previousProductItems) => [createdProductItem, ...previousProductItems]);
    applicationLogger.info("[ProductModalCrudPage] 상품 추가 완료", { createdProductItem });
    applicationNotification.success("상품을 추가했습니다.");
    closeProductFormModal();
  };

  /** 【Delete】 확인 창에서 "삭제"를 눌렀을 때 실행된다. */
  const deleteProduct = (): void => {
    // 대상이 없으면 아무것도 안 한다.
    // 논리적으로는 일어나기 어렵지만, 이 검사가 있어야
    // 아래에서 deleteTargetProduct.productId 를 안전하게 쓸 수 있다.
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
    // null로 되돌리면 확인 창이 닫힌다.
    // ("창을 닫아라"가 아니라 "대상을 없앤다"고 표현한 점이 이 설계의 특징이다)
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
                {/* toLocaleString("ko-KR"): 숫자에 천 단위 쉼표를 넣어 준다.
                    28000 → "28,000". 직접 정규식으로 만드는 것보다 훨씬 간단하고 정확하다. */}
                <td>{productItem.productPrice.toLocaleString("ko-KR")}원</td>
                <td>{productItem.stockQuantity.toLocaleString("ko-KR")}개</td>
                {/* 상태에 따라 CSS 클래스를 다르게 만들어 색을 바꾼다.
                    "ON_SALE" → toLowerCase() → "status-on_sale"
                    그리고 라벨 변환표로 한국어 문구를 꺼내 보여준다. */}
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

      {/* ★ "빈 상태(empty state)" 처리.
          검색 결과가 없는데 아무것도 안 보여주면 사용자는
          "고장 났나? 로딩 중인가?" 하고 헷갈린다.
          결과가 없다는 사실도 하나의 정보이므로 분명히 알려 줘야 한다.
          로딩/오류/빈 결과 세 가지 상태를 챙기는 것이 좋은 화면의 기본이다. */}
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

      {/* ── 추가/수정 폼 모달 ────────────────────────────────────────
          모달은 목록 아래쪽에 한 번만 두고, State로 열고 닫는다.
          목록 항목마다 모달을 만들면 상품이 100개일 때 모달도 100개가 된다. */}
      <ModalDialog
        // 모드 값이 null이 아니면 열린다.
        isOpen={productFormMode !== null}
        // 제목과 설명도 모드에 따라 바꿔서 사용자가 뭘 하는 중인지 분명히 알린다.
        title={productFormMode === "UPDATE" ? "상품 수정" : "상품 추가"}
        description={productFormMode === "UPDATE" ? "선택한 상품 정보를 변경합니다." : "새 상품 정보를 입력합니다."}
        onRequestClose={closeProductFormModal}
        closeOnBackdropClick={!isSubmitting}
        footer={(
          <>
            <button type="button" className="ghost-button" onClick={closeProductFormModal} disabled={isSubmitting}>취소</button>
            {/* ★★ 이 버튼의 두 속성이 이 파일에서 가장 알아 두면 좋은 요령이다.
                  type="submit"           → 폼을 제출하는 버튼
                  form="product-modal-form" → 어느 폼을 제출할지 id로 지목

                왜 이렇게 하나?
                  버튼은 모달의 footer 영역에 있고, <form>은 모달 본문 안에 있다.
                  즉 버튼이 폼 바깥에 있어서 그냥은 제출 버튼 역할을 못 한다.
                  form 속성으로 id를 가리키면 떨어져 있어도 연결된다.

                이 방식의 이점:
                  - Enter 키를 눌러도 제출된다 (진짜 submit 버튼이므로)
                  - 브라우저 기본 폼 동작을 그대로 활용할 수 있다
                  - onClick으로 억지로 submit을 흉내 낼 필요가 없다 */}
            <button type="submit" form="product-modal-form" disabled={isSubmitting}>
              {productFormMode === "UPDATE" ? "수정 저장" : "상품 추가"}
            </button>
          </>
        )}
      >
        {/* onSubmit 부분을 뜯어보자.
              handleSubmit(saveProduct)  → 검증을 돌리고 통과 시 saveProduct를 부르는 새 함수를 만든다
              (event)                    → 그 함수에 이벤트를 넘겨 실행한다
              void                       → 반환된 Promise를 안 쓴다고 명시 (린트 경고 방지)

            handleSubmit이 preventDefault()도 알아서 해 준다.
            (기본 폼 제출은 페이지를 새로고침시켜서 React 앱이 통째로 다시 시작된다) */}
        <form id="product-modal-form" className="modal-form-grid" onSubmit={(event) => void handleSubmit(saveProduct)(event)}>
          <label>
            상품명
            {/* ★ {...register("productName")} 이 한 줄이 하는 일
                  register가 { name, onChange, onBlur, ref } 를 담은 객체를 돌려주고,
                  전개 연산자로 그걸 input의 속성으로 한꺼번에 붙인다.

                useState 방식과 비교해 보자:
                  [useState]  value={x} onChange={(e) => setX(e.target.value)}
                  [RHF]       {...register("x")}

                게다가 RHF는 글자를 칠 때마다 화면을 다시 그리지 않는다.
                내부적으로 ref로 DOM 값을 직접 읽기 때문이다. 항목이 많을수록 유리하다. */}
            <input autoFocus {...register("productName")} placeholder="예: React 실습 교재" />
            {/* 오류가 있을 때만 빨간 글씨를 보여준다.
                메시지는 위 Zod 스키마에 적어 둔 그 문구가 그대로 나온다.
                검증 규칙과 오류 문구가 한곳에 있으니 서로 어긋날 일이 없다. */}
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
              {/* ★★ { valueAsNumber: true } 를 빠뜨리면 반드시 버그가 난다.
                    HTML input은 type="number"라도 값을 "문자열"로 돌려준다.
                    "28000"이라는 문자열이 넘어오면
                    Zod의 z.number() 검사에서 "숫자가 아니다"라며 걸린다.
                    이 옵션이 숫자로 변환해 준다.

                    min={0}은 브라우저 차원의 1차 방어일 뿐이다.
                    개발자도구로 얼마든지 뚫을 수 있으므로 Zod 검증이 진짜 방어선이다. */}
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

      {/* ── 삭제 확인 창 ─────────────────────────────────────────────
          ★ 삭제는 되돌릴 수 없으니 반드시 한 번 더 물어본다.
            Todo/Contact 페이지에서는 바로 삭제했지만, 실무에서는 이렇게 해야 한다. */}
      <ConfirmDialog
        isOpen={deleteTargetProduct !== null}
        title="상품 삭제"
        // ★ 삭제할 대상의 "이름"을 문구에 넣는 게 중요하다.
        //   "정말 삭제할까요?"라고만 물으면 사용자는 자기가 뭘 골랐는지 확신할 수 없다.
        //   이름을 보여주면 실수로 다른 걸 눌렀을 때 여기서 알아챌 수 있다.
        //
        //   뒤의 `: "선택한 상품을..."` 은 대체 문구다.
        //   창이 닫히는 짧은 순간 deleteTargetProduct가 null이 되는데,
        //   그때 화면이 깨지지 않도록 준비해 둔 것이다.
        description={deleteTargetProduct ? `“${deleteTargetProduct.productName}” 상품을 삭제하시겠습니까?` : "선택한 상품을 삭제하시겠습니까?"}
        // 버튼 문구를 "확인"이 아니라 "삭제"로 바꿨다.
        // 무슨 일이 일어날지 버튼에 그대로 적어 주는 게 안전하다.
        confirmButtonLabel="삭제"
        onConfirm={deleteProduct}
        onCancel={() => setDeleteTargetProduct(null)}
      />
    </section>
  );
};
