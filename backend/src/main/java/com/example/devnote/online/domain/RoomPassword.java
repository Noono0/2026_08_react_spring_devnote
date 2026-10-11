package com.example.devnote.online.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;

/**
 * 방 비밀번호. 원문은 저장하지 않고 "솔트 + SHA-256 해시"만 메모리에 둔다.
 *
 * [회원 비밀번호(MemberPasswordService, PBKDF2 60만 번)와 다른 이유]
 *   방 비밀번호는 방이 사라지면 함께 사라지는 짧은 수명의 값이고, 입장할 때마다 확인한다.
 *   60만 번 반복 해시는 한 번에 수백 ms가 걸려, 입장 시도가 몰리면 서버 부담이 커진다.
 *   대신 틀린 시도를 연결마다 5번으로 제한한다(OnlineRoomService).
 *
 * MessageDigest.isEqual: 앞 글자부터 비교하다 틀리면 바로 멈추는 비교는 걸린 시간으로 정답을 추측할 수 있다.
 *   isEqual은 길이가 같으면 끝까지 비교해 시간이 일정하다.
 */
public final class RoomPassword {
    public static final int MIN_LENGTH = 4;
    public static final int MAX_LENGTH = 20;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final byte[] salt;
    private final byte[] hash;

    private RoomPassword(byte[] salt, byte[] hash) {
        this.salt = salt;
        this.hash = hash;
    }

    public static boolean isValidLength(String password) {
        return password != null && password.length() >= MIN_LENGTH && password.length() <= MAX_LENGTH;
    }

    public static RoomPassword create(String password) {
        byte[] salt = new byte[16];
        SECURE_RANDOM.nextBytes(salt);
        return new RoomPassword(salt, digest(salt, password));
    }

    public boolean matches(String password) {
        return password != null && MessageDigest.isEqual(hash, digest(salt, password));
    }

    private static byte[] digest(byte[] salt, String password) {
        try {
            MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");
            messageDigest.update(salt);
            return messageDigest.digest(password.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException exception) {
            // 모든 Java 실행 환경은 SHA-256을 반드시 제공한다. 여기 오면 실행 환경 자체가 잘못된 것이다.
            throw new IllegalStateException("SHA-256을 사용할 수 없습니다.", exception);
        }
    }
}
