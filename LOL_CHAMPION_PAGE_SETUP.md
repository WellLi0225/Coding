# 롤 챔피언 페이지 초기 설정

이 문서는 롤 챔피언 웹페이지 작업을 시작하기 전에 진행한 환경 설정만 분리한 기록입니다.

## 설치 및 프로젝트 생성

- `C:\Coding` 루트에 Git 저장소를 초기화했습니다.
- Git for Windows를 설치했습니다.
- Node.js LTS를 설치했습니다.
- Vite 기반 `Vue + TypeScript` 프로젝트를 생성했습니다.
- 프로젝트 의존성을 설치했습니다.
- 개발 서버를 실행했습니다.

## 사용한 주요 경로

```text
C:\Coding
```

## 확인한 개발 서버 주소

```text
http://127.0.0.1:5173/
```

## PowerShell 실행 참고

PowerShell 환경에서는 `npm` 대신 아래처럼 `npm.cmd`를 사용했습니다.

```powershell
npm.cmd run build
npm.cmd run dev
```

## 초기 검증

- Vite 기본 프로젝트 생성 후 의존성 설치를 확인했습니다.
- `npm.cmd run build`로 기본 빌드가 성공하는 것을 확인했습니다.
- 브라우저에서 개발 서버 화면이 열리는 것을 확인했습니다.

