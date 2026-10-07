package com.example.devnote.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Spring Security 설정입니다. (spring-boot-starter-security를 넣으면 기본으로 모든 요청에 로그인을 요구하므로, 여기서 규칙을 직접 정한다)
 *
 * [이 프로젝트의 인증·권한 방식]
 *   Spring Security의 로그인 기능은 쓰지 않는다. 대신 AuthenticationService가 HttpSession에 회원 id를 저장하고,
 *   각 Service가 "로그인했는가 / 슈퍼관리자인가"를 직접 확인한다(AdminService.requireAdministrator 등).
 *   그래서 여기서는 모든 요청을 통과(permitAll)시키고, 실제 권한 검사는 Service 계층이 맡는다.
 *   ★ 권한 검사를 빠뜨리면 그 API는 누구나 호출할 수 있다는 뜻이다. 공개 전 점검 목록은 docs/deployment.md 12번 절에 있다.
 */
@Configuration
public class SecurityConfiguration {
    /**
     * 요청이 Controller에 닿기 전에 거치는 보안 필터 묶음을 만든다.
     *
     * csrf 비활성화: CSRF는 "다른 사이트가 내 쿠키를 이용해 몰래 요청을 보내는" 공격이다.
     *   이 프로젝트는 세션 쿠키를 SameSite=Strict로 보내(AuthenticationService.buildSessionCookie)
     *   다른 사이트에서 시작한 요청에는 브라우저가 쿠키를 붙이지 않는다. 그 위에서 CSRF 토큰 검사를 생략했다.
     * OPTIONS 허용: 브라우저가 CORS 요청 전에 보내는 "사전 확인(preflight)" 요청이 막히지 않게 한다.
     */
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity httpSecurity) throws Exception {
        return httpSecurity
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .authorizeHttpRequests(authorize -> authorize
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/actuator/health/**").permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .anyRequest().permitAll()
            )
            .build();
    }

    /**
     * CORS: 다른 주소(origin)의 웹 페이지가 이 API를 호출해도 되는지 브라우저에게 알려 주는 규칙.
     *
     * ★ 평소에는 이 규칙이 거의 쓰이지 않는다.
     *   Vite 개발 서버(5173)는 /api를 8080으로 대신 전달(proxy)하고, Docker에서는 Nginx가 같은 주소로 전달하므로
     *   브라우저 입장에서는 "같은 주소" 요청이다. 프론트가 http://localhost:8080을 직접 부를 때만 필요하다.
     *
     * allowCredentials(true): 쿠키(로그인 세션)를 함께 보내도 된다. 이때는 허용 주소에 *를 쓸 수 없어 목록을 정확히 적었다.
     * allowedHeaders: 프론트가 보내는 직접 만든 헤더(X-Request-Id 추적 번호, X-Member-Id 학습용 회원 전환, X-Portfolio-Editor 편집 표시).
     * exposedHeaders: 브라우저 JavaScript가 응답에서 읽어도 되는 헤더(다운로드 파일 이름이 담긴 Content-Disposition 등).
     */
    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(
            "http://localhost:5173", "http://localhost:3000",
            "http://127.0.0.1:5173", "http://127.0.0.1:3000"
        ));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Content-Type", "Authorization", "X-Request-Id", "X-Member-Id", "X-Portfolio-Editor"));
        configuration.setExposedHeaders(List.of("X-Request-Id", "Content-Disposition"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
