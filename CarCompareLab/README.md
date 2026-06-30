# CarCompareLab

자동차 비교 사이트를 연습하기 위한 Vue 3 + TypeScript + Vite 프로젝트입니다.

## 실행

```bash
cd frontend
npm install
npm run dev
```

## 3주차 Backend API 실행

```bash
cd backend
npm run dev
```

백엔드는 `http://localhost:8080`에서 실행됩니다. 프론트 개발 서버는 `/api` 요청을 백엔드로 프록시하므로, 백엔드와 프론트를 같이 켜면 차량 목록을 `GET /api/vehicles` 응답으로 불러옵니다.

주요 API:

```text
GET  /api/health
GET  /api/vehicles
GET  /api/vehicles/compare?ids=...
POST /api/admin/ingestion/run
GET  /api/admin/ingestion/runs
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

## 신규 차량 자동 동기화

다나와 자동차 신차검색에서 신규 모델을 확인하고, 기존 차량은 유지한 채 새 모델만 `mockVehicles.ts`에 추가합니다.

```bash
cd frontend
npm run data:vehicles:sync
```

GitHub Actions의 `Daily Vehicle Data Sync` 워크플로가 매일 오전 9시 20분(KST)에 이 스크립트를 실행합니다. 신규 차량이 있으면 데이터를 커밋하고 GitHub Pages 배포까지 진행하며, 신규 차량이 없으면 변경 없이 종료됩니다.
