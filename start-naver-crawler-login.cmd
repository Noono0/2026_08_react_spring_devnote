@echo off
setlocal
cd /d "%~dp0backend"
"C:\Program Files\Git\bin\bash.exe" ./gradlew crawlerSessionLogin --console=plain
echo.
if errorlevel 1 (
  echo 로그인 세션을 만들지 못했습니다. 위 오류를 확인해 주세요.
) else (
  echo 로그인 세션 준비가 끝났습니다. 크롤링 화면을 새로고침해 주세요.
)
pause
