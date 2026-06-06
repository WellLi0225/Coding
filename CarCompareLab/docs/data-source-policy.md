# CarCompareLab 데이터 출처 정책

CarCompareLab은 현재 화면 개발과 비교 기능 연습을 위해 mock 차량 데이터를 사용합니다.

## 현재 데이터

- 소스 파일: `frontend/src/data/mockVehicles.ts`
- 데이터 타입: `VehicleCompareItem`
- 기본 차량 목록 출처: 다나와 자동차 신차검색
- 모델 연식 표기 출처: 다나와 자동차 상세 페이지
- 확인일: `2026-06-03`
- 목적: 초기 UI 레이아웃, 필터링, 비교 화면 개발

현재 데이터셋은 다나와 자동차 신차검색에서 수집한 모델 단위 목록입니다. 트림별 공식 카탈로그가 아니며, 구매 판단용 확정 데이터로 사용하면 안 됩니다.

## 판매 순위 출처

- 국산 브랜드 차량 판매 순위: 다나와 자동차 모델별 판매실적, 국산, `2026-05`
  - `https://auto.danawa.com/newcar/?Work=record&Tab=Model&Nation=domestic&Month=2026-05-00`
- 해외 브랜드 차량 판매 순위: 다나와 자동차 모델별 판매실적, 수입, `2026-04`
  - `https://auto.danawa.com/newcar/?Work=record&Tab=Model&Nation=export&Month=2026-04-00`

다나와 판매실적 페이지는 국산차 판매량은 한국자동차모빌리티산업협회(KAMA), 수입차 판매량은 한국수입자동차협회(KAIDA) 자료 기준으로 표시합니다.

판매실적 표에 없거나 모델명이 정확히 매칭되지 않은 차량은 `domesticSalesRank`, `domesticSalesVolume`, `salesRankSourceName`, `salesRankCheckedAt`을 `null`로 둡니다.

## 입력 규칙

- 모르는 값은 추정하지 않고 `null`로 둡니다.
- `sourceName`에는 차량 목록을 확인한 출처를 적습니다.
- `sourceCheckedAt`에는 차량 목록 출처 확인일을 적습니다.
- `modelYearLabel`에는 다나와 상세 페이지에서 확인한 `2026년형` 같은 모델 연식 표기를 저장합니다.
- 상세 페이지에서 연식 표기를 찾지 못한 모델은 기존 mock 연도 기반 대체값을 사용하고 `modelYearSourceName`에 이를 표시합니다.
- 한국 판매 가격은 아직 USD 환산 정책이 없으므로 `msrpUsd`를 `null`로 둡니다.
- 복합 연비/전비는 `combinedEfficiencyValue`와 `combinedEfficiencyUnit`에 나누어 저장합니다.
  - 내연기관/하이브리드: `km/L`
  - 전기차: `km/kWh`
  - 수소전기차: `km/kg`
- 기존 `combinedKmPerLiter`는 이전 mock 데이터 호환용으로 남겨둘 수 있지만, 화면 표시는 `combinedEfficiencyValue`와 `combinedEfficiencyUnit`을 우선 사용합니다.
- `efficiencySourceName`과 `efficiencySourceCheckedAt`에는 복합 연비/전비 값을 확인한 출처와 확인일을 저장합니다.
- 다나와 상세 페이지에서 트림별 연비/전비를 찾을 수 있는 모델은 `efficiencyOptions`에 연료, 구동방식, 값, 단위, 트림명을 저장합니다.
- 다나와 상세 페이지가 숫자 대신 `연비인증中` 또는 `전비인증中`을 표시하는 모델은 `efficiencyStatus`에 `인증 중`을 저장합니다.
- 화면에서 연료 필터가 `전체`일 때는 하이브리드 2WD 최고 복합 연비를 우선 표시하고, 없으면 2WD 최고 효율, 그마저 없으면 전체 트림 중 최고 효율을 표시합니다.
- 화면에서 특정 연료를 선택하면 해당 연료 트림 중 최고 복합 연비/전비를 표시합니다.
- 판매 순위는 `domesticSalesRank`, 판매량은 `domesticSalesVolume`에 저장합니다.

## 리콜 정보 출처

- 리콜 정보 공식 출처: 자동차리콜센터 리콜현황
  - `https://www.car.go.kr/ri/stat/list.do`
- 공공데이터포털 안내 페이지: 국토교통부_자동차 리콜정보 API 서비스
  - `https://www.data.go.kr/data/15089863/openapi.do`

리콜 정보는 `frontend/scripts/updateRecallData.mjs`로 갱신합니다. 스크립트는 모델명으로 자동차리콜센터 리콜현황을 검색한 뒤, 상세 페이지의 `생산기간` 또는 결함내용 안의 모델별 생산기간이 해당 차량의 연식 범위와 겹칠 때만 `recallCount`와 `recallItems`에 반영합니다.

연식 범위는 현재 `year - 1`년 1월 1일부터 `year`년 12월 31일까지로 잡습니다. 예를 들어 `2026년형` 차량은 `2025-01-01 ~ 2026-12-31` 생산기간 리콜과 겹칠 때 매칭합니다.

공공데이터포털의 해당 리콜 API는 자동차리콜센터와 사전 협의를 거쳐 제공되는 방식으로 안내되어 있습니다. 정식 API 접근 권한이 없을 때는 공개 페이지 연속 조회가 `403` 또는 `429`로 제한될 수 있으므로, 이 경우 임의 값을 입력하지 않고 `recallCount`를 기존 값 또는 `null`로 둡니다.
