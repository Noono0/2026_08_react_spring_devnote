package com.example.devnote;

import com.example.devnote.file.config.FileStorageProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 백엔드 프로그램의 시작점입니다. (main 메서드를 실행하면 내장 Tomcat 서버가 8080 포트로 뜬다)
 *
 * @SpringBootApplication = 아래 세 가지를 한 번에 켠다.
 *   1. @Configuration        : 이 클래스도 설정 클래스로 쓴다.
 *   2. @EnableAutoConfiguration: 의존성(MyBatis, Security, Web …)을 보고 기본 설정을 자동으로 만든다.
 *   3. @ComponentScan        : 이 패키지(com.example.devnote) 아래의 @Controller·@Service·@Repository·@Component를 찾아 객체(Bean)로 등록한다.
 *
 * @EnableConfigurationProperties: application.yml의 file.storage.* 값을 FileStorageProperties 객체로 읽어 온다.
 */
@SpringBootApplication
@EnableConfigurationProperties(FileStorageProperties.class)
// 미사용 임시 업로드 파일 정리(TemporaryFileCleanupService) 같은 예약 작업을 켭니다.
@EnableScheduling
public class DevNoteApplication {
    // ./gradlew bootRun 또는 IDE의 실행 버튼이 이 메서드를 부른다. Spring이 Bean을 모두 만들고 서버를 띄울 때까지 여기서 기다린다.
    public static void main(String[] arguments) {
        SpringApplication.run(DevNoteApplication.class, arguments);
    }
}
