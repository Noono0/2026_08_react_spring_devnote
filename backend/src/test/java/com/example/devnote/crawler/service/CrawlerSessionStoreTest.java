package com.example.devnote.crawler.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class CrawlerSessionStoreTest {
    @Test
    void savesReadsAndDeletesNaverStorageState(@TempDir Path temporaryDirectory) {
        CrawlerSessionStore store = new CrawlerSessionStore(temporaryDirectory.toString());
        String storageState = "{\"cookies\":[{\"name\":\"NID_SES\",\"value\":\"secret\"}],\"origins\":[]}";

        store.saveNaverSession(storageState);

        assertThat(store.readNaverSession()).contains(storageState);
        assertThat(store.status().available()).isTrue();
        assertThat(store.status().updatedAt()).isNotNull();
        store.deleteNaverSession();
        assertThat(store.status().available()).isFalse();
    }
}
