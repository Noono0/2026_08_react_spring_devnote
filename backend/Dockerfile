FROM gradle:8.14.4-jdk21 AS build
WORKDIR /home/gradle/project
COPY --chown=gradle:gradle . .
RUN gradle --no-daemon clean bootJar -x test

FROM eclipse-temurin:21-jre
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /application
RUN useradd --system --uid 10001 springuser && mkdir -p /application/storage && chown -R springuser:springuser /application
COPY --from=build /home/gradle/project/build/libs/devnote-backend-*.jar application.jar
USER springuser
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/application/application.jar"]
