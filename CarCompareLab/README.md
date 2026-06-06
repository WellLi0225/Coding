# CarCompareLab

자동차 비교 사이트를 연습하기 위한 Vue 3 + TypeScript + Vite 프로젝트입니다.

## 실행

```bash
cd frontend
npm install
npm run dev
```

## 파일 구조

```text
CarCompareLab/
  frontend/
    scripts/
      updateRecallData.mjs
    src/
      App.vue
      data/
        mockVehicles.ts
      types/
        vehicle.ts
  docs/
    data-source-policy.md
  README.md
```

`frontend/src/main.ts`, `frontend/index.html`, `frontend/package.json` 같은 파일은 Vue 앱 실행에 필요한 기본 설정 파일입니다.

## 첫 화면 흐름

`frontend/index.html`의 `#app` 영역에 `frontend/src/main.ts`가 Vue 앱을 붙입니다.
그 다음 `frontend/src/App.vue`가 `frontend/src/data/mockVehicles.ts`의 mock vehicle data를 읽어서 검색, 필터, 비교용 차량 목록을 보여줍니다.

## Mock Vehicle 필드

```ts
type VehicleCompareItem = {
  id: string
  brand: string
  model: string
  year: number
  modelYearLabel: string | null
  modelYearSourceName: string | null
  modelYearSourceCheckedAt: string | null
  trim: string
  fuelType: string
  msrpUsd: number | null
  combinedKmPerLiter: number | null
  combinedEfficiencyValue: number | null
  combinedEfficiencyUnit: string | null
  efficiencySourceName: string | null
  efficiencySourceCheckedAt: string | null
  efficiencyStatus: string | null
  efficiencyOptions: VehicleEfficiencyOption[]
  domesticSalesRank: number | null
  domesticSalesVolume: number | null
  salesRankSourceName: string | null
  salesRankCheckedAt: string | null
  recallCount: number | null
  recallItems?: VehicleRecallItem[]
  recallSourceName?: string | null
  recallSourceCheckedAt?: string | null
  recallStatus?: string | null
  sourceName: string
  sourceCheckedAt: string
}
```

국산 브랜드 판매 순위는 다나와 자동차 `2026년 5월 국산 모델별 판매실적`, 해외 브랜드 판매 순위는 다나와 자동차 `2026년 4월 수입 모델별 판매실적`을 기준으로 입력했습니다.

## 리콜 데이터 갱신

자동차리콜센터 공개 리콜현황 페이지에서 모델명으로 리콜을 검색하고, 상세 페이지의 생산기간이 차량 연식 범위와 겹칠 때만 `recallCount`와 `recallItems`에 반영하는 스크립트를 준비했습니다.

```bash
cd frontend
npm run data:recalls
```

공공데이터포털의 `국토교통부_자동차 리콜정보 API 서비스`는 사전 협의형 LINK API라서, 정식 API 접근 권한이 없는 상태에서는 대량 호출이 제한될 수 있습니다.
