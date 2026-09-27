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

            for (InetAddress address : InetAddress.getAllByName(host)) {
                if (isPrivateOrSpecialAddress(address)) throw targetNotAllowed();
            }
            return uri;
        } catch (URISyntaxException | UnknownHostException exception) {
            throw targetNotAllowed();
        }
    }

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

    public void requireAllowedCredentialPage(URI startUri, URI loginUri, String actualUrl) {
        URI actualUri = requireAllowedHttpUrl(actualUrl);
        if (isSameOrigin(loginUri, actualUri)) return;
        throw new BusinessException(
            ErrorCode.CRAWLER_TARGET_NOT_ALLOWED,
            "계정정보를 입력하기 전에 로그인 페이지가 허용된 주소를 벗어났습니다."
        );
    }

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
