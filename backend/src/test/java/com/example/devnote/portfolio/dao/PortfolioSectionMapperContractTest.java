package com.example.devnote.portfolio.dao;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PortfolioSectionMapperContractTest {
    private static final String MAPPER_RESOURCE = "mybatis/mapper/portfolio/PortfolioSectionMapper.xml";

    @Test
    void insertSectionExplicitlySetsActiveFlagForExistingDatabases() throws IOException {
        try (InputStream mapperStream = getClass().getClassLoader().getResourceAsStream(MAPPER_RESOURCE)) {
            assertNotNull(mapperStream, "포트폴리오 Mapper XML을 찾을 수 없습니다.");
            String mapperXml = new String(mapperStream.readAllBytes(), StandardCharsets.UTF_8)
                .replaceAll("\\s+", " ");

            int insertStart = mapperXml.indexOf("<insert id=\"insertSection\"");
            int insertEnd = mapperXml.indexOf("</insert>", insertStart);
            assertTrue(insertStart >= 0 && insertEnd > insertStart, "insertSection SQL을 찾을 수 없습니다.");

            String insertSql = mapperXml.substring(insertStart, insertEnd);
            assertTrue(insertSql.contains("visibility, use_yn"), "INSERT 컬럼에 use_yn이 필요합니다.");
            assertTrue(insertSql.contains("#{visibility}, 'Y'"), "새 포트폴리오 항목은 use_yn='Y'로 저장해야 합니다.");
        }
    }

    @Test
    void sectionQueriesOnlyReadSupportedBlockTypes() throws IOException {
        try (InputStream mapperStream = getClass().getClassLoader().getResourceAsStream(MAPPER_RESOURCE)) {
            assertNotNull(mapperStream, "포트폴리오 Mapper XML을 찾을 수 없습니다.");
            String mapperXml = new String(mapperStream.readAllBytes(), StandardCharsets.UTF_8)
                .replaceAll("\\s+", " ");

            assertTrue(mapperXml.contains("<sql id=\"supportedSectionTypes\">"), "지원하는 블록 타입 조건이 필요합니다.");
            assertTrue(mapperXml.contains("'PROFILE', 'RICH_TEXT', 'IMAGE', 'SKILL', 'EXPERIENCE', 'PROJECT', 'EDUCATION', 'CERTIFICATE', 'CONTACT'"));
            assertTrue(mapperXml.contains("<include refid=\"supportedSectionTypes\"/>"), "포트폴리오 조회에 지원 타입 조건을 적용해야 합니다.");
        }
    }
}
