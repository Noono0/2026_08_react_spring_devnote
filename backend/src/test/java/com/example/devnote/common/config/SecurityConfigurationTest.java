package com.example.devnote.common.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.filter.CorsFilter;

import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityConfigurationTest {
    @Test
    void acceptsBrowserOriginsThroughProxyAndRejectsUnlistedOrigin() throws Exception {
        CorsFilter filter = new CorsFilter(new SecurityConfiguration().corsConfigurationSource());
        for (String origin : new String[] {
            "http://127.0.0.1:3000", "http://127.0.0.1:5173",
            "http://localhost:3000", "http://localhost:5173", "https://unlisted.example"
        }) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/utilities/crawler/run");
            request.setServerName("backend");
            request.setServerPort(8080);
            request.addHeader("Origin", origin);
            MockHttpServletResponse response = new MockHttpServletResponse();
            AtomicBoolean reachedController = new AtomicBoolean();
            filter.doFilter(request, response, (req, res) -> reachedController.set(true));
            boolean allowed = !origin.equals("https://unlisted.example");
            assertThat(reachedController.get()).as(origin).isEqualTo(allowed);
            assertThat(response.getStatus()).isEqualTo(allowed ? 200 : 403);
        }
    }
}
