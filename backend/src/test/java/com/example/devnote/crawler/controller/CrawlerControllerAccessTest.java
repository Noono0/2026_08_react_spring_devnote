package com.example.devnote.crawler.controller;

import com.example.devnote.common.config.SecurityConfiguration;
import com.example.devnote.crawler.dto.CrawlerBrowserStatusResponse;
import com.example.devnote.crawler.service.CrawlerBrowserSettings;
import com.example.devnote.crawler.service.CrawlerConfigurationService;
import com.example.devnote.crawler.service.CrawlerLiveViewStore;
import com.example.devnote.crawler.service.CrawlerService;
import com.example.devnote.crawler.service.CrawlerSessionStore;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.service.AuthenticationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 크롤러 API에 슈퍼관리자 문지기(CrawlerAccessInterceptor)가 실제로 연결돼 있는지,
 * 그리고 막혔을 때 401·403 응답으로 바뀌는지를 웹 계층만 띄워(@WebMvcTest) 확인한다.
 * DB·Playwright는 띄우지 않고, 필요한 Bean은 가짜(@MockitoBean)로 채운다.
 */
@WebMvcTest(CrawlerController.class)
// ★ 프로젝트 보안 설정(모든 요청 permitAll)을 함께 불러온다.
//   빼먹으면 Spring Security 기본값이 먼저 401을 내서, 우리 문지기가 동작하지 않아도 테스트가 통과해 버린다.
@Import(SecurityConfiguration.class)
class CrawlerControllerAccessTest {
    @Autowired private MockMvc mockMvc;

    @MockitoBean private AuthenticationService authenticationService;
    @MockitoBean private CrawlerService crawlerService;
    @MockitoBean private CrawlerSessionStore crawlerSessionStore;
    @MockitoBean private CrawlerConfigurationService crawlerConfigurationService;
    @MockitoBean private CrawlerLiveViewStore crawlerLiveViewStore;
    @MockitoBean private CrawlerBrowserSettings crawlerBrowserSettings;

    @Test
    void guestIsRejectedWith401BeforeControllerRuns() throws Exception {
        when(authenticationService.findAuthenticatedMember(any())).thenReturn(null);

        mockMvc.perform(get("/api/v1/utilities/crawler/browser-status"))
            .andExpect(status().isUnauthorized())
            // 우리 문지기가 낸 401인지 확인한다(Spring Security 기본 401은 이 오류 코드가 없다).
            .andExpect(jsonPath("$.errorCode").value("AUTHENTICATION_REQUIRED"));
    }

    @Test
    void nonSuperAdministratorIsRejectedWith403() throws Exception {
        MemberRow member = new MemberRow();
        member.setMemberRole("USER");
        when(authenticationService.findAuthenticatedMember(any())).thenReturn(member);

        mockMvc.perform(get("/api/v1/utilities/crawler/configurations"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));
    }

    @Test
    void superAdministratorReadsBrowserStatus() throws Exception {
        MemberRow member = new MemberRow();
        member.setMemberRole("SUPER_ADMIN");
        when(authenticationService.findAuthenticatedMember(any())).thenReturn(member);
        when(crawlerBrowserSettings.checkStatus()).thenReturn(
            new CrawlerBrowserStatusResponse("REMOTE", false, false, "원격 브라우저에 연결할 수 없습니다."));

        mockMvc.perform(get("/api/v1/utilities/crawler/browser-status"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.mode").value("REMOTE"))
            .andExpect(jsonPath("$.data.ready").value(false));
    }
}
