@echo off
setlocal
set "GRADLE_VERSION=8.14.4"
set "APP_HOME=%~dp0"
set "WRAPPER_HOME=%APP_HOME%.gradle-wrapper"
set "GRADLE_HOME=%WRAPPER_HOME%\gradle-%GRADLE_VERSION%"
set "ARCHIVE=%WRAPPER_HOME%\gradle-%GRADLE_VERSION%-bin.zip"
set "DISTRIBUTION_URL=https://services.gradle.org/distributions/gradle-%GRADLE_VERSION%-bin.zip"

if not exist "%GRADLE_HOME%\bin\gradle.bat" (
    if not exist "%WRAPPER_HOME%" mkdir "%WRAPPER_HOME%"
    echo Gradle %GRADLE_VERSION% 다운로드: %DISTRIBUTION_URL%
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -Uri '%DISTRIBUTION_URL%' -OutFile '%ARCHIVE%'; Expand-Archive -Path '%ARCHIVE%' -DestinationPath '%WRAPPER_HOME%' -Force; Remove-Item '%ARCHIVE%' -Force"
    if errorlevel 1 exit /b 1
)

call "%GRADLE_HOME%\bin\gradle.bat" %*
endlocal
