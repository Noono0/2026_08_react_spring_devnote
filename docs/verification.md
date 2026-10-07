# 검증 가이드

[문서 목록으로](../README.md)

## 준비

- 프론트엔드: Node.js 22.13 이상(Corepack 포함), `frontend/`에서 `pnpm-lock.yaml` 기준으로 설치한 의존성
- 백엔드: JDK 21과 실행 중인 Docker. `ArchitectureSmokeTest`는 독립적인 Testcontainers MySQL을 사용합니다.
- 정적 검사: Python 3.10 이상, PyYAML, Node.js, JDK 21, Bash. Windows에서는 Git for Windows의 Bash를 사용합니다.

`JAVA_HOME`과 `java -version`을 함께 확인하세요. 전역 JDK가 17이면 해당 터미널에서만 `JAVA_HOME`과 PATH를 JDK 21로 설정한 뒤 실행합니다. 검사 도구는 Windows의 WSL 실행기 `System32/bash.exe` 대신 Git Bash를 우선 선택합니다.

## 프론트엔드

```sh
cd frontend
corepack pnpm install --frozen-lockfile
npm run lint
npm run typecheck
npm run test
npm run build
```

린트·타입 검사·Vitest와 운영 번들 빌드는 서로 다른 오류를 확인하므로 모두 실행합니다. 첫 화면 용량은 `dist/index.html`이 참조하는 초기 JS와 그 정적 import를 기준으로 비교합니다. 편집기처럼 지연 로딩되는 파일의 크기만으로 첫 화면 용량을 판단하지 않습니다.

## 백엔드

```powershell
cd backend
.\gradlew.bat test
```

macOS/Linux에서는 `./gradlew test`를 사용합니다. 테스트는 MySQL 스키마 초기화·JPA 검증·MyBatis Bean 구성까지 확인합니다. 결과는 `backend/build/reports/tests/test/index.html`에 생성됩니다.

## 저장소 정적 검사

> **Python은 로컬 설치가 필수가 아닙니다.** 아래 검사는 GitHub Actions(`.github/workflows/continuous-integration.yml`)가 Python 3.12를 설치해 자동으로 실행합니다. 앱 실행·개발에는 Python이 쓰이지 않습니다.
>
> 자동 실행 시점은 `main`·`develop` 브랜치에 푸시할 때와 Pull Request를 열거나 갱신할 때입니다. 그 밖의 작업 브랜치에 푸시만 하면 실행되지 않으므로, 검사 결과가 필요하면 PR을 엽니다. 푸시 전에 직접 확인하고 싶을 때만 로컬에 Python을 설치해 아래 명령을 실행합니다.

로컬에서 실행할 때는 저장소 루트에서 실행합니다. macOS/Linux에서는 아래 `python`을 `python3`로 바꿔 사용할 수 있습니다.

```sh
python -m pip install -r scripts/requirements.txt
python scripts/verify-static.py
python -m unittest discover -s scripts -p "test_*.py"
```

검사 범위는 JSON·YAML·XML·셸·TypeScript·Java 문법, 로컬 import, DAO와 Mapper ID 연결, Gradle·Docker 필수 파일입니다. `node_modules`, 빌드 결과물, Gradle 캐시, `.local`의 세션 파일은 탐색하지 않습니다. 단순 화면 문구의 포함 여부를 기능 테스트로 취급하지 않습니다.

Windows의 `python`이 Microsoft Store 별칭이면 실제 Python을 설치하거나 설치된 Python의 절대 경로를 사용하세요. 도구 부재 또는 문법 오류는 실패로 보고하며, 정적 검사를 통과해도 실제 실행·단위 테스트를 대체하지 않습니다.

## 외부 크롤러 테스트

일반 테스트에서는 외부 사이트에 접속하는 `PlaywrightCrawlerExternalTest` 한 개를 건너뜁니다. Chromium이 설치된 환경에서 외부 접속을 직접 확인하려면 다음 명령을 별도로 실행합니다.

```powershell
cd backend
$env:RUN_CRAWLER_EXTERNAL_TEST = "true"
.\gradlew.bat test --tests '*PlaywrightCrawlerExternalTest'
Remove-Item Env:RUN_CRAWLER_EXTERNAL_TEST
```

이 테스트는 공개 예제 사이트의 렌더링과 수집을 확인합니다. 네이버 로그인·캡차 등 사용자 상호작용이 필요한 흐름은 [크롤러 가이드](crawler.md)에 따라 별도로 확인해야 합니다.
