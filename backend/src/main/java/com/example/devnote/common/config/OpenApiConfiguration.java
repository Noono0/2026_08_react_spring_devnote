package com.example.devnote.common.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfiguration {
    @Bean
    OpenAPI devNoteOpenApi() {
        return new OpenAPI().info(new Info()
            .title("DevNote Practice API")
            .version("v1")
            .description("React와 Spring Boot 학습용 문서 관리 API"));
    }
}
