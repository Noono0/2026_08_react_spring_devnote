package com.example.devnote.member.service;

import org.springframework.stereotype.Component;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

@Component
public class MemberPasswordService {
    private static final int ITERATIONS = 600_000;
    private static final int SALT_LENGTH = 16;
    private static final int HASH_LENGTH_BITS = 256;
    private final SecureRandom secureRandom = new SecureRandom();

    public String encode(String password) {
        byte[] salt = new byte[SALT_LENGTH];
        secureRandom.nextBytes(salt);
        return encode(password, salt, ITERATIONS);
    }

    public boolean matches(String password, String encodedPassword) {
        if (encodedPassword == null || encodedPassword.isBlank()) return false;
        try {
            String[] parts = encodedPassword.split(":", 3);
            if (parts.length != 3) return false;
            int iterations = Integer.parseInt(parts[0]);
            byte[] salt = Base64.getDecoder().decode(parts[1]);
            byte[] expectedHash = Base64.getDecoder().decode(parts[2]);
            byte[] actualHash = derive(password, salt, iterations, expectedHash.length * 8);
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
            keySpec.clearPassword();
        }
    }
}
