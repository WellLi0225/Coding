# CarCompareLab 배포 방법

## 추천 방식

현재 CarCompareLab은 Vue로 만든 정적 사이트라서 AWS EC2보다 GitHub Pages가 더 적합합니다.

- 로그인, DB, API 서버가 없으면 GitHub Pages로 충분합니다.
- 친구에게 주소만 보내면 바로 접속할 수 있습니다.
- EC2나 Oracle Cloud는 나중에 백엔드 서버가 필요해질 때 쓰는 편이 좋습니다.

## 배포 주소

현재 GitHub 원격 저장소가 `WellLi0225/Coding`이므로 Pages 배포 주소는 다음 형태입니다.

```text
https://WellLi0225.github.io/Coding/
```

## 처음 한 번만 설정

GitHub 저장소에서 아래 설정을 확인합니다.

1. `Settings`로 이동
2. `Pages` 메뉴 선택
3. `Build and deployment`의 `Source`를 `GitHub Actions`로 선택

그 다음 `main` 브랜치에 push하면 `.github/workflows/carcomparelab-pages.yml`이 자동으로 실행되고, `CarCompareLab/frontend/dist` 결과물이 GitHub Pages에 올라갑니다.

## 로컬 확인

일반 로컬 개발은 그대로 실행합니다.

```bash
cd CarCompareLab/frontend
npm run dev
```

GitHub Pages 경로 기준으로 빌드가 되는지 확인하려면 아래처럼 실행합니다.

```bash
cd CarCompareLab/frontend
VITE_BASE_PATH=/Coding/ npm run build
```
