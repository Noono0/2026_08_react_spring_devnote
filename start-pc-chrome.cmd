@echo off
chcp 65001 > nul
setlocal
rem Docker 백엔드가 'PC에 새 창' 모드에서 조종할 Chrome을 원격 디버깅 포트 9222로 엽니다.
rem 평소 쓰는 Chrome과 섞이지 않도록 전용 프로필(.local\pc-chrome-profile)을 사용합니다.
set "PROFILE=%~dp0.local\pc-chrome-profile"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%CHROME%" goto notfound

start "" "%CHROME%" --remote-debugging-port=9222 --remote-allow-origins=* --user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check about:blank
echo 크롤링용 Chrome 창을 열었습니다.
echo 크롤러 화면에서 '내 PC에 새 창으로 열기'를 선택하고 실행하면 이 Chrome에 새 창이 열립니다.
echo 크롤링이 끝날 때까지 이 Chrome을 닫지 마세요.
pause
exit /b 0

:notfound
echo Chrome 또는 Edge 실행 파일을 찾지 못했습니다. Chrome을 설치한 뒤 다시 실행해 주세요.
pause
exit /b 1
