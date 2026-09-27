@echo off
chcp 65001 > nul
setlocal
cd /d "%~dp0"
rem 백엔드를 PC에서 직접 실행합니다. '내 PC에 새 창으로 열기'를 고르면 Chromium 창이 이 PC 화면에 바로 뜹니다.
if not exist .env copy .env.example .env

echo [0/3] Docker Desktop 실행 상태를 확인합니다.
docker info > nul 2>&1
if not errorlevel 1 goto docker_ready
echo Docker Desktop이 꺼져 있어 실행합니다. 준비될 때까지 최대 3분 기다립니다...
if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
  start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
) else (
  echo Docker Desktop 실행 파일을 찾지 못했습니다. Docker Desktop을 직접 실행한 뒤 이 파일을 다시 실행해 주세요.
  pause
  exit /b 1
)
set /a DOCKER_WAIT=0
:wait_docker
timeout /t 5 /nobreak > nul
docker info > nul 2>&1
if not errorlevel 1 goto docker_ready
set /a DOCKER_WAIT+=5
if %DOCKER_WAIT% GEQ 180 (
  echo 3분이 지나도 Docker Desktop이 준비되지 않았습니다. Docker Desktop 창에서 오류가 없는지 확인한 뒤 다시 실행해 주세요.
  pause
  exit /b 1
)
echo   Docker 준비 중... %DOCKER_WAIT%초
goto wait_docker
:docker_ready
echo Docker Desktop 준비 완료.

echo [1/3] 포트가 겹치지 않도록 Docker 전체 실행(docker compose)을 종료하고 MySQL만 실행합니다.
docker compose down
rem 3306은 PC에 설치된 MariaDB 등이 쓸 수 있고, 3307 같은 포트는 Windows(Hyper-V)가 예약해 막을 수 있습니다.
rem 그래서 아래 후보 포트를 차례로 시도해 MySQL이 처음으로 뜬 포트를 사용합니다.
set "MYSQL_PORT="
for %%P in (13306 23306 33306 43306 53306) do (
  if not defined MYSQL_PORT (
    echo   MySQL 포트 %%P 시도...
    set "MYSQL_PORT=%%P"
    docker compose -f compose.dev.yml up -d --wait
    if errorlevel 1 (
      set "MYSQL_PORT="
      docker compose -f compose.dev.yml down > nul 2>&1
    )
  )
)
if not defined MYSQL_PORT (
  echo MySQL을 시작하지 못했습니다. 후보 포트 13306/23306/33306/43306/53306이 모두 막혀 있습니다.
  echo 관리자 명령 프롬프트에서 "netsh interface ipv4 show excludedportrange protocol=tcp" 결과를 보내 주세요.
  pause
  exit /b 1
)
echo MySQL 준비 완료: localhost:%MYSQL_PORT%
set "DATABASE_URL=jdbc:p6spy:mysql://localhost:%MYSQL_PORT%/devnote?useUnicode=true&characterEncoding=UTF-8&serverTimezone=UTC&allowPublicKeyRetrieval=true&useSSL=false"

echo [2/3] 백엔드(Spring Boot)를 새 창에서 실행합니다. 출력은 .local\logs\backend.log에도 저장됩니다.
if not exist .local\logs mkdir .local\logs
start "devnote-backend" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-Location '%~dp0backend'; cmd /c 'gradlew.bat bootRun 2>&1' | Tee-Object -FilePath '%~dp0.local\logs\backend.log'"

echo [3/3] 프론트엔드(Vite)를 새 창에서 실행합니다.
if not exist frontend\node_modules (
  pushd frontend
  call npm install
  popd
)
start "devnote-frontend" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-Location '%~dp0frontend'; cmd /c 'npm run dev 2>&1' | Tee-Object -FilePath '%~dp0.local\logs\frontend.log'"

echo.
echo 백엔드가 뜨면 브라우저에서 http://localhost:5173 을 열어 주세요.
pause
