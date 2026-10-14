FROM maven:3.9-eclipse-temurin-21-alpine AS build

WORKDIR /workspace
COPY backend/pom.xml ./pom.xml
COPY backend/src ./src
RUN mvn --batch-mode --no-transfer-progress -DskipTests package

FROM eclipse-temurin:21-jre-alpine

RUN addgroup -S beez && adduser -S beez -G beez
WORKDIR /app
COPY --from=build --chown=beez:beez /workspace/target/beez-backend-*.jar /app/beez-backend.jar
USER beez
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/beez-backend.jar"]
