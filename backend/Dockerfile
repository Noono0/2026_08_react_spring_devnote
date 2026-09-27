FROM gradle:8.14.4-jdk21 AS build
WORKDIR /home/gradle/project
COPY --chown=gradle:gradle . .
RUN gradle --no-daemon clean bootJar -x test

FROM mcr.microsoft.com/playwright/java:v1.63.0-noble
USER root
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /application
RUN mkdir -p /application/storage && chown -R pwuser:pwuser /application
COPY --chown=pwuser:pwuser --from=build /home/gradle/project/build/libs/devnote-backend-*.jar application.jar
USER pwuser
# 컨테이너의 Xvfb 창은 사용자 화면에 보이지 않으므로 웹 화면의 원격 조작을 사용한다.
ENV CRAWLER_DIRECT_WINDOW=false
EXPOSE 8080
ENTRYPOINT ["xvfb-run", "-a", "-s", "-screen 0 1280x800x24 -nolisten tcp", "java", "-jar", "/application/application.jar"]
