# 공통 데이터 그리드 분석

[문서 목록으로](../README.md) · [사용설명서](user-guide.md)

회원 목록은 무료 AG Grid Community에서 정렬·검색·열 필터·페이지네이션을 사용합니다. 그룹핑·피벗·집계·차트는 AG Grid Enterprise 기능을 사용하지 않고 `frontend/src/shared/grid/`에서 원본 행 배열을 계산해 표시합니다. 따라서 다른 목록도 같은 분석 부품을 사용할 수 있습니다.

## 화면에서 사용하기

1. 회원관리에서 회원 이름을 누르면 상세 화면이 열립니다.
2. 열 제목을 누르면 정렬되고, 열 필터와 상단 회원 검색으로 결과를 줄일 수 있습니다.
3. `그룹 · 피벗 · 집계 · 차트`를 펼칩니다. 그리드에서 필터로 남은 행만 분석합니다.
4. 첫 번째·두 번째 그룹을 고르면 행 그룹과 집계값이 보입니다. 그룹 제목을 누르면 하위 그룹을 펼칠 수 있습니다.
5. 피벗의 행·열 기준을 골라 교차표를 만들고, 인라인 차트에서 첫 번째 그룹의 집계값을 확인합니다.

회원 데이터에는 숫자 측정값이 없어서 `건수`만 선택할 수 있습니다. 금액 같은 숫자 필드가 있는 화면에서는 `합계`·`평균`·`최솟값`·`최댓값`도 선택할 수 있습니다. 평균·최솟값·최댓값의 전체 값은 교차 셀의 값을 더하지 않고 원본 행에서 다시 계산합니다.

## 다른 목록에 붙이기

`GridAnalysisPanel<Row>`에는 분석할 `rows`와 필드 목록을 넘깁니다. 범주 필드는 `dimension`, 숫자 필드는 `measure`입니다.

```tsx
const fields: GridAnalysisField<Order>[] = [
  { key: "region", label: "지역", kind: "dimension", value: (row) => row.region },
  { key: "amount", label: "금액", kind: "measure", value: (row) => row.amount },
];

<GridAnalysisPanel rows={filteredOrders} fields={fields} />
```

`gridAnalysis.ts`의 `groupRows`·`pivotRows`·`aggregateRows`는 React나 AG Grid에 의존하지 않는 순수 함수입니다. 빈 값은 `(빈 값)` 그룹으로 묶고, 숫자 집계에서는 `null`과 유효하지 않은 숫자를 제외합니다. 대량 데이터에서는 전체 행을 브라우저로 받기 전에 서버 집계를 고려하세요.
