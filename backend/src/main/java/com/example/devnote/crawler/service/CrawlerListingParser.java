package com.example.devnote.crawler.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 부동산 글 제목에서 보증금·월세·방 수·면적·지하철역·도보 시간·층을 뽑아 칸으로 나눈다.
 * 예) "[LH가능] LH전세 가능 // 신림동 급행 구로역 도보14분 / 1억2000만원 월15만원 / 4층 / 남향 원룸"
 *   → 보증금 12000만원, 월세 15만원, 방 1개, 구로역, 도보 14분, 4층
 *
 * 카페 글마다 표기가 제각각이라 100% 정확할 수는 없다. 못 읽은 칸은 빈칸으로 두고,
 * 원본 제목·상세내용을 함께 남기므로 사람이 다시 확인할 수 있다.
 */
public final class CrawlerListingParser {
    public static final String DEPOSIT_FIELD = "보증금(만원)";
    public static final String MONTHLY_FIELD = "월세(만원)";
    public static final String ROOMS_FIELD = "방수";
    public static final String AREA_FIELD = "전용면적(㎡)";
    public static final String STATION_FIELD = "역";
    public static final String WALK_FIELD = "도보(분)";
    public static final String FLOOR_FIELD = "층";
    public static final String BASEMENT_FIELD = "반지하여부";

    /** 화면과 CSV에 나오는 칸 순서 */
    public static final List<String> FIELDS = List.of(
        DEPOSIT_FIELD, MONTHLY_FIELD, ROOMS_FIELD, AREA_FIELD, STATION_FIELD, WALK_FIELD, FLOOR_FIELD, BASEMENT_FIELD
    );

    /**
     * 단위가 분명한 금액: 1억2500 · 1억 2,800만원 · 1억8백 · 1.2억 · 2,500만원 · 15.000만원 · 9천만 · 70만원
     * '억' 뒤의 숫자는 단위(만·천·백)가 붙어 있거나 띄어쓰기 없이 이어진 3~4자리일 때만 금액으로 본다.
     * 그래야 "전세1.2억 3룸"의 '3'을 금액으로 잘못 읽지 않는다.
     */
    private static final String MONEY = "(?:\\d+(?:[.,]\\d+)?\\s*억(?:\\s*(?:\\d{1,3}(?:,\\d{3})+|\\d{1,4})\\s*(?:만\\s*원|만|천|백)|\\d{3,4}(?![\\d.]))?"
        + "|\\d{1,3}(?:[.,]\\d{3})+\\s*(?:만\\s*원|만)?"
        + "|\\d+(?:\\.\\d+)?\\s*(?:만\\s*원|만|천|백|원))";
    /** 7000/50 처럼 단위 없이 숫자만 쓴 금액까지 포함 */
    private static final String MONEY_LOOSE = "(?:" + MONEY + "|\\d{2,5})";
    // 보증금·월세라는 말이 앞에 있으면 '3000'처럼 단위 없는 숫자도 금액으로 본다.
    private static final Pattern DEPOSIT_LABEL = Pattern.compile("(?:보증금|전세금|전세|보증)\\s*[:：]?\\s*(" + MONEY_LOOSE + ")");
    private static final Pattern MONTHLY_LABEL = Pattern.compile("(?:월세|월임대료)\\s*[:：]?\\s*(무|없음|0|" + MONEY_LOOSE + ")");
    // 그냥 '월'만 붙은 경우(월15만원)는 '11월27일' 같은 날짜와 헷갈리지 않도록 단위가 있는 금액만 본다.
    private static final Pattern MONTHLY_SHORT = Pattern.compile("월\\s*(" + MONEY + ")");
    // 9500만원-15만원, 1억2000/월15처럼 '보증금 구분자 월세'로 쓴 표기
    private static final Pattern DEPOSIT_SLASH_MONTHLY = Pattern.compile(
        "(" + MONEY_LOOSE + ")\\s*[/／\\-–—~]\\s*(?:월\\s*)?(무|없음|" + MONEY_LOOSE + ")");
    /** 역 이름 앞에 자주 붙는 말: 잘라내야 '구로역'처럼 역 이름만 남는다. */
    private static final List<String> STATION_PREFIXES = List.of(
        "급행", "청년", "전세", "임대", "월세", "보증", "중기청", "가능", "입주", "지하철", "인근", "근처",
        "도보", "초역세권", "역세권", "바로", "앞", "신축", "리모델링");
    private static final Pattern AREA_SQUARE = Pattern.compile("(\\d+(?:\\.\\d+)?)\\s*(?:㎡|m2|m²|제곱미터)");
    private static final Pattern AREA_PYEONG = Pattern.compile("(\\d+(?:\\.\\d+)?)\\s*평");
    private static final Pattern STATION = Pattern.compile("([가-힣A-Za-z0-9]{1,10}역)(?![가-힣])");
    private static final Pattern WALK = Pattern.compile("(?:도보|걸어서)\\s*(?:약\\s*)?(\\d{1,3})(?:\\s*[~-]\\s*(\\d{1,3}))?\\s*분");
    private static final String FLOOR_VALUE = "(?:반지하|반지층|지층|반지(?![가-힣])|지하(?!철)\\s*\\d*층|옥탑(?:방)?|(?<![\\d.])\\d{1,2}(?:\\.5)?\\s*층|(?<![가-힣])(?:고층|중층|저층)(?![가-힣]))";
    private static final Pattern CURRENT_FLOOR = Pattern.compile("(?:해당\\s*층|현\\s*층|매물\\s*층)\\s*(?:[/／]\\s*(?:전체\\s*층|총\\s*층(?:수)?))?\\s*[:：]?\\s*(" + FLOOR_VALUE + ")");
    private static final Pattern FLOOR_THEN_TOTAL = Pattern.compile("층수\\s*[/／]\\s*(?:총\\s*층(?:수)?|전체\\s*층)\\s*[:：]?\\s*(" + FLOOR_VALUE + ")");
    private static final Pattern TOTAL_THEN_FLOOR_NUMBERS = Pattern.compile("(?:총\\s*층수|전체\\s*층)\\s*[/／]\\s*(?:해당\\s*층|층수)\\s*[:：]?\\s*\\d{1,2}\\s*[/／]\\s*(\\d{1,2})(?!\\d)");
    private static final Pattern TOTAL_THEN_CURRENT_FLOOR = Pattern.compile("(?:총\\s*층수|층수|전체\\s*층|총\\s*층)\\s*[:：]?\\s*(?:총\\s*)?" + FLOOR_VALUE + "\\s*(?:건물\\s*)?중\\s*(" + FLOOR_VALUE + ")");
    private static final Pattern BUILDING_THEN_FLOOR = Pattern.compile(FLOOR_VALUE + "\\s*(?:건물\\s*)?(?:중|에)\\s*(" + FLOOR_VALUE + ")");
    private static final Pattern FLOOR = Pattern.compile("(" + FLOOR_VALUE + ")");
    /** 반지하·반지층·지층·지하층 표기(지하철은 제외) */
    private static final Pattern BASEMENT = Pattern.compile("반지하|반지층|반지(?![가-힣])|지층(?![가-힣])|지하(?!철)\\s*\\d*\\s*층");
    private static final Pattern ROOMS = Pattern.compile("(원룸|투룸|쓰리룸|스리룸|포룸|[1-9](?:\\.5)?\\s*룸|방\\s*[1-9]\\s*개?)");

    // static 메서드만 있는 도구 클래스라 객체를 만들지 못하게 생성자를 private으로 막는다.
    private CrawlerListingParser() {
    }

    /** 제목 등에서 값을 뽑는다. 못 찾은 칸은 빈 문자열. */
    public static Map<String, String> parse(String text) {
        Map<String, String> result = new LinkedHashMap<>();
        FIELDS.forEach(field -> result.put(field, ""));
        if (text == null || text.isBlank()) return result;
        // 줄바꿈 없는 공백(NBSP)과 여러 칸 공백을 보통 공백 하나로 바꿔, 정규식이 공백 모양 차이로 실패하지 않게 한다.
        String normalized = text.replace(' ', ' ').replaceAll("\\s+", " ");

        parseMoney(normalized, result);
        parseRooms(normalized, result);
        parseArea(normalized, result);
        parseStationAndWalk(normalized, result);
        parseFloor(normalized, result);
        parseBasement(normalized, result);
        return result;
    }

    /** 이미 값이 있는 칸은 그대로 두고, 빈 칸만 새 글(상세내용 등)에서 채운다. */
    public static void fillMissing(Map<String, String> item, String text) {
        Map<String, String> parsed = parse(text);
        FIELDS.forEach(field -> {
            if (item.getOrDefault(field, "").isBlank() && !parsed.get(field).isBlank()) {
                item.put(field, parsed.get(field));
            }
        });
    }

    /**
     * 보증금·월세를 찾는다(단위: 만원). 시도 순서:
     *   1. "1억2000/15"처럼 "큰 금액/작은 금액" 표기
     *   2. "보증금 1000" 같은 라벨 → 3. "월세 50" 라벨, 단위가 붙은 "월15만원"
     *   4. 보증금만 있고 "전세"라고 적혀 있으면 월세 0
     *   5. 그래도 보증금이 없으면 300만원 이상인 첫 금액
     */
    private static void parseMoney(String text, Map<String, String> result) {
        Matcher slash = DEPOSIT_SLASH_MONTHLY.matcher(text);
        while (slash.find()) {
            Integer deposit = toManwon(slash.group(1));
            Integer monthly = toManwon(slash.group(2));
            // 1억2000/월15 처럼 '큰 금액 / 작은 금액'일 때만 보증금·월세로 본다(면적 15/20 같은 표기 제외).
            if (deposit != null && monthly != null && deposit >= 300 && monthly <= 500 && monthly <= deposit) {
                result.put(DEPOSIT_FIELD, String.valueOf(deposit));
                result.put(MONTHLY_FIELD, String.valueOf(monthly));
                break;
            }
        }
        Matcher depositLabel = DEPOSIT_LABEL.matcher(text);
        while (depositLabel.find()) {
            Integer deposit = toManwon(depositLabel.group(1));
            if (deposit != null && deposit >= 300) {
                result.put(DEPOSIT_FIELD, String.valueOf(deposit));
                break;
            }
        }
        if (result.get(MONTHLY_FIELD).isBlank()) readMonthly(MONTHLY_LABEL.matcher(text), result);
        if (result.get(MONTHLY_FIELD).isBlank()) readMonthly(MONTHLY_SHORT.matcher(text), result);
        // 보증금만 찾았고 '전세'라고 적혀 있으면 월세는 0으로 본다.
        if (!result.get(DEPOSIT_FIELD).isBlank() && result.get(MONTHLY_FIELD).isBlank() && text.contains("전세")) {
            result.put(MONTHLY_FIELD, "0");
        }
        // 라벨 없이 큰 금액 하나만 있는 경우(예: "1억5000만원 원룸")도 보증금으로 본다.
        if (result.get(DEPOSIT_FIELD).isBlank()) {
            Matcher any = Pattern.compile("(" + MONEY + ")").matcher(text);
            while (any.find()) {
                Integer deposit = toManwon(any.group(1));
                if (deposit != null && deposit >= 300) {
                    result.put(DEPOSIT_FIELD, String.valueOf(deposit));
                    break;
                }
            }
        }
    }

    /** 월세를 읽는다. 보증금을 잘못 읽는 것을 막으려고 500만원을 넘는 값은 건너뛴다. */
    private static void readMonthly(Matcher matcher, Map<String, String> result) {
        while (matcher.find()) {
            String raw = matcher.group(1).trim();
            Integer monthly = raw.equals("무") || raw.equals("없음") ? 0 : toManwon(raw);
            if (monthly != null && monthly <= 500) {
                result.put(MONTHLY_FIELD, String.valueOf(monthly));
                return;
            }
        }
    }

    /** 금액 표기를 '만원' 단위 숫자로 바꾼다. 읽지 못하면 null. */
    static Integer toManwon(String raw) {
        if (raw == null) return null;
        String value = raw.replace(" ", "");
        // 15.000만원처럼 점을 천 단위 구분자로 쓴 표기를 15000만원으로 읽는다.
        value = value.replaceAll("(\\d)[.,](\\d{3})(?![\\d.])", "$1$2").replace(",", "");
        if (value.isEmpty()) return null;
        if (value.equals("무") || value.equals("없음")) return 0;
        double total = 0;
        Matcher eok = Pattern.compile("(\\d+(?:\\.\\d+)?)억").matcher(value);
        boolean hasEok = false;
        if (eok.find()) {
            total += Double.parseDouble(eok.group(1)) * 10_000;
            hasEok = true;
            value = value.substring(eok.end());
        }
        Matcher rest = Pattern.compile("^(\\d+(?:\\.\\d+)?)\\s*(만원|만|천|백|원)?").matcher(value);
        if (rest.find() && !rest.group(1).isEmpty()) {
            double number = Double.parseDouble(rest.group(1));
            String unit = rest.group(2) == null ? "" : rest.group(2);
            if (unit.equals("천")) {
                total += number * 1_000;
            } else if (unit.equals("백")) {
                // 1억8백 = 1억 800만원
                total += number * 100;
            } else if (unit.equals("원") && !hasEok) {
                total += number / 10_000;
            } else {
                total += number;
            }
        } else if (!hasEok) {
            return null;
        }
        if (total <= 0) return hasEok ? null : 0;
        return (int) Math.round(total);
    }

    /** 방 수: 원룸·투룸·쓰리룸·포룸 → 1~4, "2룸"·"1.5룸"·"방 2개" → 숫자만. */
    private static void parseRooms(String text, Map<String, String> result) {
        Matcher matcher = ROOMS.matcher(text);
        if (!matcher.find()) return;
        String raw = matcher.group(1).replace(" ", "");
        String rooms = switch (raw) {
            case "원룸" -> "1";
            case "투룸" -> "2";
            case "쓰리룸", "스리룸" -> "3";
            case "포룸" -> "4";
            default -> raw.replaceAll("[^0-9.]", "");
        };
        if (!rooms.isBlank()) result.put(ROOMS_FIELD, rooms);
    }

    /** 면적: ㎡ 표기를 먼저 찾고, 없으면 평 표기를 ㎡로 바꾼다(1평 ≈ 3.3058㎡). */
    private static void parseArea(String text, Map<String, String> result) {
        Matcher square = AREA_SQUARE.matcher(text);
        if (square.find()) {
            result.put(AREA_FIELD, trimNumber(Double.parseDouble(square.group(1))));
            return;
        }
        Matcher pyeong = AREA_PYEONG.matcher(text);
        if (pyeong.find()) {
            result.put(AREA_FIELD, trimNumber(Double.parseDouble(pyeong.group(1)) * 3.3058));
        }
    }

    /** 역 이름(최대 3개, 중복 제거)과 도보 시간("도보 5~10분"이면 5~10)을 찾는다. */
    private static void parseStationAndWalk(String text, Map<String, String> result) {
        LinkedHashSet<String> stations = new LinkedHashSet<>();
        Matcher station = STATION.matcher(text);
        while (station.find() && stations.size() < 3) {
            String name = trimStationPrefix(station.group(1));
            if (name.length() >= 2) stations.add(name);
        }
        if (!stations.isEmpty()) result.put(STATION_FIELD, String.join(", ", stations));

        Matcher walk = WALK.matcher(text);
        if (walk.find()) {
            List<String> minutes = new ArrayList<>();
            minutes.add(walk.group(1));
            if (walk.group(2) != null) minutes.add(walk.group(2));
            result.put(WALK_FIELD, String.join("~", minutes));
        }
    }

    /** 'HUG청년구청역', '급행구로역'처럼 앞에 붙은 말을 떼어 역 이름만 남긴다. */
    static String trimStationPrefix(String rawName) {
        String name = rawName.replaceAll("^[A-Za-z0-9]+", "");
        boolean trimmed = true;
        while (trimmed && name.length() > 2) {
            trimmed = false;
            for (String prefix : STATION_PREFIXES) {
                if (name.startsWith(prefix) && name.length() - prefix.length() >= 2) {
                    name = name.substring(prefix.length());
                    trimmed = true;
                    break;
                }
            }
        }
        return name.isBlank() ? rawName : name;
    }

    /** 층: 여러 표기 규칙을 "현재 층을 정확히 가리킬 가능성이 높은 순서"로 시도하고 처음 맞는 것을 쓴다. */
    private static void parseFloor(String text, Map<String, String> result) {
        // 상세글의 "총 4층 중 3층"이나 "해당층/전체층: 고층/7층"에서 전체 층수를 고르지 않는다.
        for (Pattern pattern : List.of(CURRENT_FLOOR, FLOOR_THEN_TOTAL, TOTAL_THEN_FLOOR_NUMBERS,
            TOTAL_THEN_CURRENT_FLOOR, BUILDING_THEN_FLOOR, FLOOR)) {
            Matcher matcher = pattern.matcher(text);
            if (matcher.find()) {
                String floor = matcher.group(1).replaceAll("\\s+", "").replace("반지층", "반지하");
                if (pattern == TOTAL_THEN_FLOOR_NUMBERS) floor += "층";
                result.put(FLOOR_FIELD, floor);
                return;
            }
        }
    }

    /**
     * 반지하·반지층·지층이면 'Y'로 표시한다. 층 칸이 비어 있어도 반지하 제외 필터를 쓸 수 있게 하기 위한 칸이다.
     * '지하철'은 반지하로 보지 않는다.
     */
    private static void parseBasement(String text, Map<String, String> result) {
        if (BASEMENT.matcher(text).find() || result.get(FLOOR_FIELD).startsWith("반지하")) {
            result.put(BASEMENT_FIELD, "Y");
        }
    }

    /** 정수면 소수점 없이(33), 아니면 소수 둘째 자리까지(33.06) 글자로 만든다. */
    private static String trimNumber(double value) {
        return value == Math.rint(value) ? String.valueOf((long) value) : String.format(java.util.Locale.ROOT, "%.2f", value);
    }
}
