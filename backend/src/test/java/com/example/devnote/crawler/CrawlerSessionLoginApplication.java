package com.example.devnote.crawler;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.options.WaitUntilState;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.time.Instant;

/** 아이디나 비밀번호를 받지 않고, 보이는 브라우저에서 완료된 인증 세션만 저장합니다. */
public final class CrawlerSessionLoginApplication {
    private static final Duration LOGIN_TIMEOUT = Duration.ofMinutes(10);

    private CrawlerSessionLoginApplication() {
    }

    public static void main(String[] arguments) throws Exception {
        Path outputFile = Path.of(System.getProperty(
            "crawler.session.file", "../.local/crawler-sessions/naver.json"
        )).toAbsolutePath().normalize();
        Files.createDirectories(outputFile.getParent());

        System.out.println("네이버 로그인 창을 열었습니다. 브라우저에서 로그인·캡차·2단계 인증을 완료해 주세요.");
        System.out.println("아이디와 비밀번호는 이 프로그램이나 터미널에 입력하지 않습니다.");

        try (Playwright playwright = Playwright.create()) {
            Browser browser = playwright.chromium().launch(new BrowserType.LaunchOptions()
                .setHeadless(false)
                .setSlowMo(50));
            BrowserContext context = browser.newContext(new Browser.NewContextOptions().setLocale("ko-KR"));
            Page page = context.newPage();
            page.navigate("https://nid.naver.com/nidlogin.login?mode=form", new Page.NavigateOptions()
                .setWaitUntil(WaitUntilState.DOMCONTENTLOADED));

            Instant deadline = Instant.now().plus(LOGIN_TIMEOUT);
            while (Instant.now().isBefore(deadline)) {
                boolean authenticated = context.cookies().stream().anyMatch(cookie -> "NID_SES".equals(cookie.name));
                if (authenticated) {
                    Path temporaryFile = Files.createTempFile(outputFile.getParent(), "naver-", ".tmp");
                    Files.writeString(temporaryFile, context.storageState(), StandardCharsets.UTF_8);
                    Files.move(temporaryFile, outputFile, StandardCopyOption.REPLACE_EXISTING);
                    System.out.println("로그인 세션을 저장했습니다. 이제 크롤링 화면에서 자동 세션을 사용할 수 있습니다.");
                    browser.close();
                    return;
                }
                page.waitForTimeout(1_000);
            }
            browser.close();
        }
        throw new IllegalStateException("10분 안에 로그인이 완료되지 않아 세션을 저장하지 않았습니다.");
    }
}
