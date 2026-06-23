# 3주차: Backend API, DB, Data Ingestion

이번 단계의 목표는 프론트엔드가 직접 mock 파일만 읽는 구조에서 벗어나, 백엔드 API를 통해 차량 목록과 비교 데이터를 받는 흐름을 만드는 것입니다.

## 완료 기준

- `GET /api/vehicles`로 차량 목록을 조회할 수 있습니다.
- `GET /api/vehicles/compare?ids=...`로 선택 차량 비교 데이터를 조회할 수 있습니다.
- `POST /api/admin/ingestion/run`으로 수집 실행 기록을 만들 수 있습니다.
- `GET /api/admin/ingestion/runs`로 수집 이력을 조회할 수 있습니다.
- raw payload는 `backend/data/raw-payloads`에 보관됩니다.
- DB 초안은 `backend/db/schema.sql`에 정리되어 있습니다.

## 현재 구현 방식

로컬 PC에 Java와 Maven이 없어 Spring Boot를 바로 실행하기 어렵기 때문에, 우선 Node 내장 HTTP 서버로 같은 API 계약을 구현했습니다. 프론트엔드는 `/api/vehicles`를 먼저 호출하고, 백엔드가 꺼져 있으면 기존 mock 데이터로 fallback합니다.

## 실행 순서

터미널 1:

```bash
cd CarCompareLab/backend
npm run dev
```

터미널 2:

```bash
cd CarCompareLab/frontend
npm run dev
```

프론트 개발 서버는 `/api` 요청을 `http://localhost:8080`으로 프록시합니다.
