#!/bin/sh
set -eu

# 운영의 원격 브라우저 모드는 서버에서 Chromium을 실행하지 않아 화면 서버가 필요 없다.
if [ "${CRAWLER_BROWSER_MODE:-local}" = "remote" ]; then
  exec java -jar /application/application.jar
fi

# 로컬 브라우저 모드에서는 headed Chromium을 위한 가상 화면을 유지한다.
exec xvfb-run -a -s "-screen 0 1280x800x24 -nolisten tcp" java -jar /application/application.jar
