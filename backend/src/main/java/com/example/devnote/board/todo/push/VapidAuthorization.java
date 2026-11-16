package com.example.devnote.board.todo.push;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigInteger;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.Map;

/** RFC 8292: JDK의 ES256 서명으로 발신 서버를 인증한다. / Authenticate the sender using JDK ES256. */
public final class VapidAuthorization {
    private final String publicKey;
    private final PrivateKey privateKey;
    private final String subject;
    private final ObjectMapper json;
    private static final Base64.Encoder BASE64 = Base64.getUrlEncoder().withoutPadding();

    public VapidAuthorization(String publicKey, String privateKey, String subject, ObjectMapper json) {
        try {
            byte[] publicBytes = Base64.getUrlDecoder().decode(publicKey);
            byte[] privateBytes = Base64.getUrlDecoder().decode(privateKey);
            var contact = URI.create(subject);
            if (publicBytes.length != 65 || publicBytes[0] != 4 || privateBytes.length != 32
                || !("mailto".equals(contact.getScheme()) && contact.getSchemeSpecificPart().contains("@")
                    || "https".equals(contact.getScheme()) && contact.getHost() != null && !"localhost".equals(contact.getHost()))) {
                throw new IllegalArgumentException();
            }
            var parameters = AlgorithmParameters.getInstance("EC");
            parameters.init(new ECGenParameterSpec("secp256r1"));
            var curve = parameters.getParameterSpec(ECParameterSpec.class);
            var factory = KeyFactory.getInstance("EC");
            this.privateKey = factory.generatePrivate(new ECPrivateKeySpec(new BigInteger(1, privateBytes), curve));
            var point = new ECPoint(new BigInteger(1, Arrays.copyOfRange(publicBytes, 1, 33)), new BigInteger(1, Arrays.copyOfRange(publicBytes, 33, 65)));
            var verificationKey = factory.generatePublic(new ECPublicKeySpec(point, curve));
            var signature = Signature.getInstance("SHA256withECDSAinP1363Format");
            signature.initSign(this.privateKey); signature.update(new byte[]{1});
            byte[] proof = signature.sign();
            signature.initVerify(verificationKey); signature.update(new byte[]{1});
            if (!signature.verify(proof)) throw new IllegalArgumentException();
            this.publicKey = BASE64.encodeToString(publicBytes); this.subject = subject; this.json = json;
        } catch (Exception exception) {
            // 구성 값과 비밀 키를 예외에 포함하지 않는다. / Configuration errors never expose key material.
            throw new IllegalStateException("WEB_PUSH 공개·비밀 키 쌍과 운영 연락처 설정을 확인해 주세요.");
        }
    }
    public String publicKey() { return publicKey; }

    public String header(URI endpoint, Instant now) throws Exception {
        String header = BASE64.encodeToString("{\"typ\":\"JWT\",\"alg\":\"ES256\"}".getBytes(StandardCharsets.UTF_8));
        String audience = endpoint.getScheme() + "://" + endpoint.getHost();
        String claims = BASE64.encodeToString(json.writeValueAsBytes(Map.of("aud", audience, "exp", now.plusSeconds(43200).getEpochSecond(), "sub", subject)));
        String signingInput = header + "." + claims;
        var signer = Signature.getInstance("SHA256withECDSAinP1363Format");
        signer.initSign(privateKey); signer.update(signingInput.getBytes(StandardCharsets.US_ASCII));
        return "vapid t=" + signingInput + "." + BASE64.encodeToString(signer.sign()) + ", k=" + publicKey;
    }
}
