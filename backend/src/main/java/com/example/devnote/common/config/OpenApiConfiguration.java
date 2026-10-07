package com.example.devnote.common.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Swagger UI(API 설명서 화면)의 제목·버전·설명을 정합니다.
 * springdoc 의존성이 Controller를 읽어 API 목록을 자동으로 만들고, 여기 값은 그 화면 맨 위에 표시된다.
 * 브라우저에서 http://localhost:8080/swagger-ui.html 로 확인할 수 있다(운영 설정에서는 SWAGGER_UI_ENABLED로 켜지 않는 한 꺼져 있다).
 */
@Configuration
public class OpenApiConfiguration {
    // @Bean: 이 메서드가 돌려준 객체를 Spring이 보관해 두고 필요한 곳(springdoc)에 넣어 준다.
    @Bean
    OpenAPI devNoteOpenApi() {
        return new OpenAPI().info(new Info()
            .title("DevNote Practice API")
            .version("v1")
            .description("React와 Spring Boot 학습용 문서 관리 API"));
    }
}
