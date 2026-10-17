// sutdaRules.ts — 섯다: 서버 화면 상태의 모양(zod), 화투 카드 이름·그림, 족보표
//
// ★ 족보 "판정"은 서버(SutdaGame.java)만 한다. 이 파일의 족보표(jokboRows)는 설명용 글과 그림이고,
//   지금 내 패가 무엇인지는 서버가 보내 준 이름(myHandName)으로 표에서 찾아 강조만 한다.
import { z } from "zod";

/** 화투 코드: 월(1~10) + G(광)·Y(열끗)·A(그 밖의 그림패)·B(피). 예: "3G" 3월 광, "7Y" 7월 열끗 */
const hwatuSchema = z.string().regex(/^(?:[1-9]|10)[GYAB]$/);

export const sutdaSchema = z.object({
  /** 방 옵션: 2장 섯다(TWO)·3장 섯다(THREE) */
  mode: z.enum(["TWO", "THREE"]),
  /** CHOOSE = 3장 섯다에서 보여 줄 두 장을 고르는 중 */
  phase: z.enum(["BETTING", "CHOOSE", "FINISHED"]),
  round: z.number().int(),
  maxRounds: z.number().int(),
  mySeat: z.number().int().nullish(),
  myCards: z.array(hwatuSchema),
  /** 3장 섯다에서 내가 고른 두 장의 위치(myCards 안). 아직 안 골랐으면 null */
  myChosen: z.array(z.number().int()).nullish(),
  /** 서버가 계산한 지금 내 두 장의 족보 이름(3장 섯다는 고른 뒤에만) */
  myHandName: z.string().nullish(),
  /** 3장 섯다: 세 장으로 만들 수 있는 세 가지 조합과 족보 이름 */
  myCombos: z.array(z.object({ cards: z.array(z.number().int()), name: z.string() })),
  /** 자리마다 두 장을 골랐는지(무엇을 골랐는지는 오지 않는다) */
  chosen: z.array(z.boolean()),
  /** 자리마다 들고 있는 패의 장수(남의 패 뒷면을 몇 장 그릴지) */
  cardCounts: z.array(z.number().int()),
  chips: z.array(z.number().int()),
  inHand: z.array(z.boolean()),
  active: z.array(z.boolean()),
  pot: z.number().int(),
  currentBet: z.number().int(),
  contributed: z.array(z.number().int()),
  toCall: z.number().int(),
  minRaise: z.number().int(),
  maxRaise: z.number().int(),
  turnSeat: z.number().int().nullish(),
  dealerSeat: z.number().int(),
  lastRound: z.object({
    cards: z.array(z.array(hwatuSchema)),
    handNames: z.array(z.string().nullable()),
    winners: z.array(z.number().int()),
    pot: z.number().int(),
    replay: z.boolean(),
  }).nullish(),
  winners: z.array(z.number().int()),
});

export type SutdaView = z.infer<typeof sutdaSchema>;

const MONTH_NAMES = ["", "송학", "매조", "벚꽃", "흑싸리", "난초", "모란", "홍싸리", "공산", "국진", "단풍"];
/** 그림패(광이 아닌 특수 패)의 그림 이름. 4월 열끗(두견새)·9월 열끗(술잔)은 멍텅구리구사를 가르는 패라 이름에 그림을 적는다 */
const PICTURE_NAMES: Record<number, string> = { 2: "꾀꼬리", 4: "두견새", 5: "다리", 6: "나비", 7: "멧돼지", 9: "술잔", 10: "사슴" };

/**
 * 화투 그림 파일(frontend/public/images/hwatu/). 위키미디어 공용의 Mliu92 작품, CC BY-SA 4.0.
 * 섯다는 월마다 두 장(광·그림패 1장 + 피 1장)만 쓴다.
 */
const MONTH_FILE_NAMES = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October"];
const SPECIAL_FILE_SUFFIX: Record<number, string> = {
  1: "gwang", 2: "yul", 3: "gwang", 4: "yul", 5: "yul_ssang_pi", 6: "yul", 7: "yul", 8: "gwang", 9: "yul_ssang_pi", 10: "yul",
};

export const HWATU_CREDIT = {
  author: "Mliu92",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.ko",
  sourceUrl: "https://commons.wikimedia.org/wiki/Category:SVG_Hwatu_(with_Japanese-style_artwork)",
} as const;

export const describeHwatu = (code: string) => {
  const month = Number(code.slice(0, -1));
  const kind = code.slice(-1);
  const kindLabel = kind === "G" ? "광" : kind === "Y" ? "열끗" : kind === "A" ? "그림" : "";
  const picture = kind === "Y" || kind === "A" ? PICTURE_NAMES[month] : undefined;
  const name = `${month}월 ${MONTH_NAMES[month] ?? ""}${kindLabel && kind !== "A" ? ` ${kindLabel}` : ""}${picture ? `(${picture})` : ""}${kind === "B" ? " 피" : ""}`;
  const fileSuffix = kind === "B" ? "pi_1" : SPECIAL_FILE_SUFFIX[month] ?? "pi_1";
  const imageUrl = `/images/hwatu/Hwatu_${MONTH_FILE_NAMES[month] ?? "January"}_${fileSuffix}.svg`;
  return { month, kind, kindLabel, name, imageUrl };
};

export interface JokboRow {
  /** 표에 보일 이름 */
  title: string;
  /** 예시 패 두 장 */
  example: [string, string];
  description: string;
  /** 서버가 보내는 족보 이름 중 이 줄에 해당하는 것 */
  matches: (handName: string) => boolean;
  special?: boolean;
}

const isTtaeng = (name: string) => name === "장땡" || /^[1-9]땡$/.test(name);
const isKkeut = (name: string) => name === "갑오" || name === "망통" || /^[1-8]끗$/.test(name);

/** 섯다 족보(높은 순) + 특수 패. 서버 SutdaGame.rank·describe의 이름과 같아야 강조가 맞는다 */
export const jokboRows: JokboRow[] = [
  { title: "38광땡", example: ["3G", "8G"], description: "3월 광 + 8월 광. 가장 높은 패", matches: (name) => name === "38광땡" },
  { title: "광땡(13·18)", example: ["1G", "8G"], description: "1월 광 + 3월 광 또는 8월 광", matches: (name) => name === "13광땡" || name === "18광땡" },
  { title: "장땡 ~ 1땡", example: ["10A", "10B"], description: "같은 월 두 장. 10땡(장땡)이 가장 높고 1땡이 가장 낮음", matches: isTtaeng },
  { title: "알리", example: ["1G", "2B"], description: "1월 + 2월", matches: (name) => name === "알리" },
  { title: "독사", example: ["1G", "4B"], description: "1월 + 4월", matches: (name) => name === "독사" },
  { title: "구삥", example: ["1G", "9B"], description: "1월 + 9월", matches: (name) => name === "구삥" },
  { title: "장삥", example: ["1G", "10B"], description: "1월 + 10월", matches: (name) => name === "장삥" },
  { title: "장사", example: ["10B", "4B"], description: "10월 + 4월", matches: (name) => name === "장사" },
  { title: "세륙", example: ["4B", "6B"], description: "4월 + 6월", matches: (name) => name === "세륙" },
  { title: "끗(갑오 ~ 망통)", example: ["4B", "5B"], description: "두 장 합의 끝자리. 9끗(갑오)이 가장 높고 0끗(망통)이 가장 낮음", matches: isKkeut },
  {
    title: "암행어사", example: ["4Y", "7Y"], special: true,
    description: "4월 열끗(두견새) + 7월 열끗(멧돼지). 평소 1끗, 상대에 13·18광땡이 있으면 잡는다", matches: (name) => name === "암행어사",
  },
  {
    title: "땡잡이", example: ["3G", "7Y"], special: true,
    description: "3월 광 + 7월 열끗. 평소 망통, 상대 최고가 1~9땡이면 잡는다", matches: (name) => name === "땡잡이",
  },
  {
    title: "구사", example: ["4B", "9B"], special: true,
    description: "4월 + 9월(두 장이 모두 열끗은 아님). 상대 최고가 알리 이하면 다시 한다", matches: (name) => name === "구사",
  },
  {
    title: "멍텅구리구사", example: ["4Y", "9Y"], special: true,
    description: "4월 열끗(두견새) + 9월 열끗(술잔). 상대 최고가 9땡 이하면 다시 한다", matches: (name) => name === "멍텅구리구사",
  },
];

/** 서버가 보낸 족보 이름이 족보표의 몇 번째 줄인지(없으면 -1) */
export const findJokboRow = (handName: string | null | undefined) =>
  handName ? jokboRows.findIndex((row) => row.matches(handName)) : -1;
