package com.example.devnote.crawler.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 크롤러 API 경로에 슈퍼관리자 문지기(CrawlerAccessInterceptor)를 붙인다.
 *
 * addPathPatterns("/api/v1/utilities/crawler/**"): "**"는 그 아래 모든 하위 경로를 뜻한다.
 *   /run, /configurations/3/runs, /browser-status ... 가 전부 해당된다.
 *   크롤러 Controller에 새 API를 추가해도 같은 경로 아래라면 자동으로 보호된다.
 */
@Configuration
@RequiredArgsConstructor
public class CrawlerWebConfiguration implements WebMvcConfigurer {
    private final CrawlerAccessInterceptor crawlerAccessInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(crawlerAccessInterceptor).addPathPatterns("/api/v1/utilities/crawler/**");
    }
}
