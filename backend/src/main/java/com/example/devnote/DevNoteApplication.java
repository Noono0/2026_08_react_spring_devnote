package com.example.devnote;

import com.example.devnote.file.config.FileStorageProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(FileStorageProperties.class)
public class DevNoteApplication {
    public static void main(String[] arguments) {
        SpringApplication.run(DevNoteApplication.class, arguments);
    }
}
