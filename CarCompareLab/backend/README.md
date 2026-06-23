# CarCompareLab Backend

3주차 학습용 로컬 API 서버입니다. 현재 프론트엔드에 저장된 차량 데이터를 읽어서 API 응답으로 내려주고, 수집 실행 이력을 파일로 남깁니다.

## 실행

```bash
cd CarCompareLab/backend
npm run dev
```

서버 주소는 `http://localhost:8080` 입니다.

## API

```text
GET  /api/health
GET  /api/vehicles
GET  /api/vehicles/compare?ids=...
POST /api/admin/ingestion/run
GET  /api/admin/ingestion/runs
```

## 데이터 저장 위치

```text
backend/data/source-runs.json
backend/data/raw-payloads/
backend/db/schema.sql
```

지금 단계에서는 실제 DB 대신 파일과 프론트엔드 seed 데이터를 사용합니다. 다음 단계에서 `backend/db/schema.sql`을 기준으로 H2, PostgreSQL, MySQL 같은 DB에 연결하면 됩니다.
