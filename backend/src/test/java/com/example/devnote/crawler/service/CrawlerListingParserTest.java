package com.example.devnote.crawler.service;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** 실제 네이버 카페 글 제목 표기를 기준으로 확인한다. */
class CrawlerListingParserTest {
    @Test
    void readsDepositAndMonthlyAndStationFromTitle() {
        Map<String, String> parsed = CrawlerListingParser.parse(
            "[LH가능] LH전세 가능 // 시흥동 급행구로역 도보14분 / 1억2000만원 월15만원 / 4층 / 남향 원룸 / 11월27일 입주");

        assertThat(parsed.get("보증금(만원)")).isEqualTo("12000");
        assertThat(parsed.get("월세(만원)")).isEqualTo("15");
        assertThat(parsed.get("역")).isEqualTo("구로역");
        assertThat(parsed.get("도보(분)")).isEqualTo("14");
        assertThat(parsed.get("층")).isEqualTo("4층");
        assertThat(parsed.get("방수")).isEqualTo("1");
    }

    @Test
    void readsBracketStyleDepositAndRoomCount() {
        Map<String, String> parsed = CrawlerListingParser.parse(
            "[보증금1억2500만원/월세20만원]<<[화곡역18분][2룸거실] 2012년 · 평지 위치 · 2층 거실빌라");

        assertThat(parsed.get("보증금(만원)")).isEqualTo("12500");
        assertThat(parsed.get("월세(만원)")).isEqualTo("20");
        assertThat(parsed.get("역")).isEqualTo("화곡역");
        assertThat(parsed.get("방수")).isEqualTo("2");
        assertThat(parsed.get("층")).isEqualTo("2층");
    }

    @Test
    void readsJeonseAsZeroMonthlyAndReadsArea() {
        Map<String, String> parsed = CrawlerListingParser.parse(
            "[청년전세임대] LH 전세 1억2천 구합니다! 성북구 동대문역 도보 5분 전용 22.75㎡ 쓰리룸");

        assertThat(parsed.get("보증금(만원)")).isEqualTo("12000");
        assertThat(parsed.get("월세(만원)")).isEqualTo("0");
        assertThat(parsed.get("전용면적(㎡)")).isEqualTo("22.75");
        assertThat(parsed.get("방수")).isEqualTo("3");
    }

    @Test
    void readsWalkRangeAndSlashPriceWithoutUnits() {
        assertThat(CrawlerListingParser.parse("가산디지털단지역 도보11~12분 1억5000만원 월7만원 11층").get("도보(분)"))
            .isEqualTo("11~12");
        Map<String, String> slash = CrawlerListingParser.parse("[중기청가능] HUG청년구청역 이용 / 7000/50 / 6층 전용25.2㎡ 큰 원룸");
        assertThat(slash.get("보증금(만원)")).isEqualTo("7000");
        assertThat(slash.get("월세(만원)")).isEqualTo("50");
        assertThat(slash.get("역")).isEqualTo("구청역");
    }

    @Test
    void leavesUnknownValuesEmptyAndConvertsPyeong() {
        Map<String, String> parsed = CrawlerListingParser.parse("깨끗한 7평 반지하 투룸 문의주세요");

        assertThat(parsed.get("전용면적(㎡)")).isEqualTo("23.14");
        assertThat(parsed.get("층")).isEqualTo("반지하");
        assertThat(parsed.get("보증금(만원)")).isEmpty();
        assertThat(parsed.get("월세(만원)")).isEmpty();
    }

    @Test
    void readsEokWithCommaAndHundredUnit() {
        // CSV 검토에서 1억 2,800만원이 10002로, 1억8백이 10008로 읽히던 문제
        assertThat(CrawlerListingParser.parse("보증금 1억 2,800만원 월세 20만원").get("보증금(만원)")).isEqualTo("12800");
        assertThat(CrawlerListingParser.parse("전세 2억 2,400만원 쓰리룸").get("보증금(만원)")).isEqualTo("22400");
        assertThat(CrawlerListingParser.parse("1억6,500만 / 월 30만원").get("보증금(만원)")).isEqualTo("16500");
        assertThat(CrawlerListingParser.parse("보증금 1억8백 월세 25만원").get("보증금(만원)")).isEqualTo("10800");
        assertThat(CrawlerListingParser.parse("보증금 15.000만원 월세 무").get("보증금(만원)")).isEqualTo("15000");
    }

    @Test
    void doesNotReadRoomCountAsPartOfPrice() {
        // "전세1.2억 3룸"의 3을 금액으로 붙여 12003으로 읽던 문제
        Map<String, String> parsed = CrawlerListingParser.parse("전세1.2억 3룸");

        assertThat(parsed.get("보증금(만원)")).isEqualTo("12000");
        assertThat(parsed.get("방수")).isEqualTo("3");
        assertThat(CrawlerListingParser.parse("전세2억 3룸").get("보증금(만원)")).isEqualTo("20000");
    }

    @Test
    void readsHyphenSeparatedDepositAndMonthly() {
        Map<String, String> parsed = CrawlerListingParser.parse("9500만원-15만원 신림역 도보 5분");

        assertThat(parsed.get("보증금(만원)")).isEqualTo("9500");
        assertThat(parsed.get("월세(만원)")).isEqualTo("15");
    }

    @Test
    void readsDepositWhenMonthlyLabelComesFirst() {
        Map<String, String> parsed = CrawlerListingParser.parse("월세 1억3,400만/30만");

        assertThat(parsed.get("보증금(만원)")).isEqualTo("13400");
        assertThat(parsed.get("월세(만원)")).isEqualTo("30");
    }

    @Test
    void marksBasementListingsAndIgnoresSubwayWord() {
        Map<String, String> basement = CrawlerListingParser.parse("[LH가능] 반지층 투룸 보증금 3000 월세 40만원");
        assertThat(basement.get("반지하여부")).isEqualTo("Y");
        assertThat(basement.get("층")).isEqualTo("반지하");

        Map<String, String> ground = CrawlerListingParser.parse("지하철 2호선 신림역 도보 5분 3층 원룸 전세 1억");
        assertThat(ground.get("반지하여부")).isEmpty();
        assertThat(ground.get("층")).isEqualTo("3층");
    }

    @Test
    void convertsMoneyWordsToManwon() {
        assertThat(CrawlerListingParser.toManwon("1억2500")).isEqualTo(12500);
        assertThat(CrawlerListingParser.toManwon("1.2억")).isEqualTo(12000);
        assertThat(CrawlerListingParser.toManwon("2,500만원")).isEqualTo(2500);
        assertThat(CrawlerListingParser.toManwon("9천")).isEqualTo(9000);
        assertThat(CrawlerListingParser.toManwon("70만")).isEqualTo(70);
        assertThat(CrawlerListingParser.toManwon("무")).isZero();
    }

    @Test
    void keepsCommaSeparatedRemainderAfterEokInDeposit() {
        Map<String, String> spaced = CrawlerListingParser.parse(
            "LH전세 보증금 2억 2,400만원 / 월세 27만원 고층뷰");
        assertThat(spaced.get("보증금(만원)")).isEqualTo("22400");
        assertThat(spaced.get("월세(만원)")).isEqualTo("27");
        assertThat(CrawlerListingParser.parse("월세 2억2,000만/20만").get("보증금(만원)"))
            .isEqualTo("22000");
    }

    @Test
    void prefersUnitFloorOverTotalFloorAndDoesNotSplitDecimalFloor() {
        assertThat(CrawlerListingParser.parse("해당층/전체층 : 고층/7층").get("층")).isEqualTo("고층");
        assertThat(CrawlerListingParser.parse("총 층수:총4층 중 3층").get("층")).isEqualTo("3층");
        assertThat(CrawlerListingParser.parse("층수 : 5층 중 2층").get("층")).isEqualTo("2층");
        assertThat(CrawlerListingParser.parse("층수 : 3층 건물 중 반지층").get("층")).isEqualTo("반지하");
        assertThat(CrawlerListingParser.parse("도시형생활주택5층중4층").get("층")).isEqualTo("4층");
        assertThat(CrawlerListingParser.parse("10층에 3층 양촌역 도보10분").get("층")).isEqualTo("3층");
        assertThat(CrawlerListingParser.parse("층수/총층수 : 1층/4층").get("층")).isEqualTo("1층");
        assertThat(CrawlerListingParser.parse("총층수 / 층수 : 10/3").get("층")).isEqualTo("3층");
        assertThat(CrawlerListingParser.parse("쌍용빌라 반지층").get("층")).isEqualTo("반지하");
        assertThat(CrawlerListingParser.parse("올라가는 1.5층").get("층")).isEqualTo("1.5층");
    }

    @Test
    void trimsWordsStuckBeforeStationName() {
        assertThat(CrawlerListingParser.trimStationPrefix("급행구로역")).isEqualTo("구로역");
        assertThat(CrawlerListingParser.trimStationPrefix("HUG청년구청역")).isEqualTo("구청역");
        assertThat(CrawlerListingParser.trimStationPrefix("가산디지털단지역")).isEqualTo("가산디지털단지역");
    }

    @Test
    void fillsOnlyEmptyFieldsFromDetailText() {
        Map<String, String> item = new LinkedHashMap<>(CrawlerListingParser.parse("신림역 도보 3분 투룸"));
        CrawlerListingParser.fillMissing(item, "보증금 1억원 월세 50만원 신대방역 도보 10분");

        assertThat(item.get("역")).isEqualTo("신림역");
        assertThat(item.get("도보(분)")).isEqualTo("3");
        assertThat(item.get("보증금(만원)")).isEqualTo("10000");
        assertThat(item.get("월세(만원)")).isEqualTo("50");
    }
}
