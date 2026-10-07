package com.example.devnote.member.service;

import org.springframework.stereotype.Component;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * 비밀번호를 안전하게 저장(해시)하고 확인합니다. (PBKDF2-HMAC-SHA256, JDK 기본 기능만 사용)
 *
 * [왜 그냥 SHA-256 한 번이 아니라 PBKDF2인가?]
 *   해시 계산을 일부러 60만 번 반복해 느리게 만든다. 로그인 한 번에는 문제없지만,
 *   DB가 유출됐을 때 공격자가 수많은 비밀번호를 대입해 보는 속도를 크게 늦춘다.
 *
 * [솔트(salt)] 회원마다 다른 무작위 값을 섞는다. 같은 비밀번호라도 저장된 해시가 달라져
 *   "미리 계산해 둔 해시표"로 한 번에 찾아내는 공격을 막는다.
 *
 * [저장 형식] "반복횟수:솔트(Base64):해시(Base64)"  예) 600000:2519u3…==:LQjL…=
 *   반복횟수를 함께 저장해, 나중에 횟수를 늘려도 예전 해시를 그대로 확인할 수 있다.
 */
@Component
public class MemberPasswordService {
    private static final int ITERATIONS = 600_000;
    private static final int SALT_LENGTH = 16;
    private static final int HASH_LENGTH_BITS = 256;
    // SecureRandom: 예측하기 어려운 난수(보안용). 일반 Random은 다음 값을 추측할 수 있어 솔트에 쓰면 안 된다.
    private final SecureRandom secureRandom = new SecureRandom();

    /** 회원가입 때: 새 솔트를 만들어 해시 문자열을 돌려준다. */
    public String encode(String password) {
        byte[] salt = new byte[SALT_LENGTH];
        secureRandom.nextBytes(salt);
        return encode(password, salt, ITERATIONS);
    }

    /**
     * 로그인 때: 저장된 문자열에서 반복횟수·솔트를 꺼내, 입력한 비밀번호를 같은 방식으로 다시 해시해 비교한다.
     * 형식이 깨진 값(Base64 오류, 숫자 아님 등)은 예외 대신 false(불일치)로 처리한다.
     */
    public boolean matches(String password, String encodedPassword) {
        if (encodedPassword == null || encodedPassword.isBlank()) return false;
        try {
            String[] parts = encodedPassword.split(":", 3);
            if (parts.length != 3) return false;
            int iterations = Integer.parseInt(parts[0]);
            byte[] salt = Base64.getDecoder().decode(parts[1]);
            byte[] expectedHash = Base64.getDecoder().decode(parts[2]);
            byte[] actualHash = derive(password, salt, iterations, expectedHash.length * 8);
            // MessageDigest.isEqual: 앞에서 몇 글자가 맞았는지와 상관없이 항상 같은 시간에 비교한다.
            // (일반 비교는 다른 글자를 만나면 바로 멈춰서, 걸린 시간 차이로 정답을 추측하는 공격이 가능하다)
            return MessageDigest.isEqual(expectedHash, actualHash);
        } catch (RuntimeException exception) {
            return false;
        }
    }

    private String encode(String password, byte[] salt, int iterations) {
        byte[] hash = derive(password, salt, iterations, HASH_LENGTH_BITS);
        return iterations + ":" + Base64.getEncoder().encodeToString(salt) + ":" + Base64.getEncoder().encodeToString(hash);
    }

    private byte[] derive(String password, byte[] salt, int iterations, int hashLengthBits) {
        PBEKeySpec keySpec = new PBEKeySpec(password.toCharArray(), salt, iterations, hashLengthBits);
        try {
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(keySpec).getEncoded();
        } catch (Exception exception) {
            throw new IllegalStateException("비밀번호 해시를 생성할 수 없습니다.", exception);
        } finally {
            // 계산이 끝나면 메모리에 남은 비밀번호 글자 배열을 지운다.
            keySpec.clearPassword();
        }
    }
}
