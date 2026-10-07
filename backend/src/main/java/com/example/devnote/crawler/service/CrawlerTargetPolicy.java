package com.example.devnote.crawler.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import org.springframework.stereotype.Component;

import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.UnknownHostException;
import java.util.Locale;

/**
 * 크롤러가 접속해도 되는 주소인지 검사합니다. (SSRF 방어)
 *
 * [SSRF란?] 서버가 대신 웹 요청을 보내는 기능을 악용해, 외부에서는 닿을 수 없는
 *   내부망 주소(127.0.0.1, 192.168.x.x, 클라우드 메타데이터 169.254.169.254 등)를 서버가 열게 만드는 공격.
 *
 * [허용 규칙]
 *   - http/https만, 기본 포트(80·443)만, 주소에 사용자 정보(user:pass@) 불가
 *   - 도메인이 가리키는 모든 IP가 공개 주소여야 함(사설·루프백·링크 로컬·멀티캐스트 등 차단)
 *   - 로그인·수집 중에는 처음 주소와 같은 사이트(origin) 안에서만 이동
 *     (예외: 네이버 카페 → 공식 네이버 로그인 nid.naver.com)
 */
@Component
public class CrawlerTargetPolicy {
    public URI requireAllowedHttpUrl(String rawUrl) {
        try {
            URI uri = new URI(rawUrl == null ? "" : rawUrl.trim());
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (scheme == null || host == null
                || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))
                || uri.getUserInfo() != null
                || !isStandardPort(uri)) {
                throw targetNotAllowed();
            }

            // 도메인을 실제 IP로 바꿔(DNS 조회) 하나라도 내부 주소면 거부한다. 이름은 공개처럼 보여도 내부 IP를 가리킬 수 있기 때문이다.
            for (InetAddress address : InetAddress.getAllByName(host)) {
                if (isPrivateOrSpecialAddress(address)) throw targetNotAllowed();
            }
            return uri;
        } catch (URISyntaxException | UnknownHostException exception) {
            throw targetNotAllowed();
        }
    }

    /** 이동한 주소가 처음 주소와 같은 origin(프로토콜+호스트+포트)인지 확인한다. */
    public void requireSameOrigin(URI expectedOrigin, String actualUrl) {
        URI actual = requireAllowedHttpUrl(actualUrl);
        if (!isSameOrigin(expectedOrigin, actual)) {
            throw new BusinessException(
                ErrorCode.CRAWLER_TARGET_NOT_ALLOWED,
                "로그인과 수집 중에는 처음 입력한 사이트의 주소 안에서만 이동할 수 있습니다."
            );
        }
    }

    public URI requireAllowedLoginUrl(URI startUri, String rawLoginUrl) {
        URI loginUri = requireAllowedHttpUrl(rawLoginUrl);
        if (isSameOrigin(startUri, loginUri) || isNaverCafeLogin(startUri, loginUri)) return loginUri;
        throw new BusinessException(
            ErrorCode.CRAWLER_TARGET_NOT_ALLOWED,
            "교차 도메인 로그인은 네이버 카페에서 공식 네이버 로그인(nid.naver.com)을 사용할 때만 허용됩니다."
        );
    }

    public void requireNaverCafeForSavedSession(URI startUri) {
        if (!isHttpsHost(startUri, "cafe.naver.com")) {
            throw new BusinessException(
                ErrorCode.CRAWLER_TARGET_NOT_ALLOWED,
                "저장된 네이버 로그인 세션은 https://cafe.naver.com 주소에서만 사용할 수 있습니다."
            );
        }
    }

    /** 아이디·비밀번호를 입력하기 직전, 화면이 여전히 로그인 페이지 사이트인지 확인한다(다른 사이트에 계정 정보를 넣지 않게). */
    public void requireAllowedCredentialPage(URI startUri, URI loginUri, String actualUrl) {
        URI actualUri = requireAllowedHttpUrl(actualUrl);
        if (isSameOrigin(loginUri, actualUri)) return;
        throw new BusinessException(
            ErrorCode.CRAWLER_TARGET_NOT_ALLOWED,
            "계정정보를 입력하기 전에 로그인 페이지가 허용된 주소를 벗어났습니다."
        );
    }

    /** 로그인 후 이동한 주소가 시작 사이트·로그인 사이트(네이버는 www.naver.com 포함) 중 하나인지 확인한다. */
    public void requireAllowedPostLoginPage(URI startUri, URI loginUri, String actualUrl) {
        URI actualUri = requireAllowedHttpUrl(actualUrl);
        if (isSameOrigin(startUri, actualUri) || isSameOrigin(loginUri, actualUri)) return;
        if (isNaverCafeLogin(startUri, loginUri)
            && isHttpsHost(actualUri, "www.naver.com")) return;
        throw new BusinessException(
            ErrorCode.CRAWLER_TARGET_NOT_ALLOWED,
            "로그인 완료 후 허용된 사이트가 아닌 주소로 이동했습니다."
        );
    }

    public boolean isHttpUrl(String value) {
        if (value == null) return false;
        String normalized = value.toLowerCase(Locale.ROOT);
        return normalized.startsWith("http://") || normalized.startsWith("https://");
    }

    private boolean isStandardPort(URI uri) {
        return uri.getPort() == -1 || uri.getPort() == 80 || uri.getPort() == 443;
    }

    /** 포트를 생략한 주소는 기본 포트(https 443, http 80)로 본다. 그래야 https://a.com과 https://a.com:443을 같은 곳으로 비교한다. */
    private int normalizedPort(URI uri) {
        if (uri.getPort() != -1) return uri.getPort();
        return "https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80;
    }

    private boolean isSameOrigin(URI left, URI right) {
        return left.getScheme().equalsIgnoreCase(right.getScheme())
            && left.getHost().equalsIgnoreCase(right.getHost())
            && normalizedPort(left) == normalizedPort(right);
    }

    private boolean isNaverCafeLogin(URI startUri, URI loginUri) {
        return isHttpsHost(startUri, "cafe.naver.com") && isHttpsHost(loginUri, "nid.naver.com");
    }

    private boolean isHttpsHost(URI uri, String host) {
        return "https".equalsIgnoreCase(uri.getScheme())
            && host.equalsIgnoreCase(uri.getHost())
            && normalizedPort(uri) == 443;
    }

    /**
     * 공개 인터넷 주소가 아니면 true.
     *   Java 기본 판별: 0.0.0.0(any), 127.x(루프백), 169.254.x(링크 로컬), 10.x·172.16~31.x·192.168.x(사설), 멀티캐스트
     *   추가 판별(IPv4): 0.x, 100.64~127.x(통신사 공유 주소), 224 이상(멀티캐스트·예약)
     *   추가 판별(IPv6): fc00::/7(사설에 해당하는 고유 로컬 주소)
     */
    private boolean isPrivateOrSpecialAddress(InetAddress address) {
        if (address.isAnyLocalAddress()
            || address.isLoopbackAddress()
            || address.isLinkLocalAddress()
            || address.isSiteLocalAddress()
            || address.isMulticastAddress()) {
            return true;
        }

        byte[] bytes = address.getAddress();
        if (bytes.length == 4) {
            int first = Byte.toUnsignedInt(bytes[0]);
            int second = Byte.toUnsignedInt(bytes[1]);
            return first == 0
                || first == 100 && second >= 64 && second <= 127
                || first >= 224;
        }
        return address instanceof Inet6Address && (bytes[0] & 0xFE) == 0xFC;
    }

    private BusinessException targetNotAllowed() {
        return new BusinessException(
            ErrorCode.CRAWLER_TARGET_NOT_ALLOWED,
            "HTTP(S) 공개 주소와 기본 포트(80·443)만 수집할 수 있으며 내부망·로컬 주소는 차단됩니다."
        );
    }
}
