import { shuffle, type RandomSource } from "@/features/games/shared/random";

/**
 * 메이저 아르카나 22장. 화면용 문장은 카드의 전통적인 주제를 참고해 직접 쓴 짧은 해석이다.
 * 카드 데이터와 뽑기 규칙을 분리해 같은 난수로 결과를 재현하며, 서버 요청은 하지 않는다.
 */
export interface TarotCard {
  number: number;
  name: string;
  symbol: string;
  upright: { keyword: string; meaning: string };
  reversed: { keyword: string; meaning: string };
}

export interface TarotDraw { card: TarotCard; reversed: boolean }

export const majorArcana: readonly TarotCard[] = [
  { number: 0, name: "바보", symbol: "✦", upright: { keyword: "새로운 시작", meaning: "아직 정해지지 않은 길에 호기심을 갖고 첫발을 내딛어 보세요." }, reversed: { keyword: "성급한 출발", meaning: "뛰어들기 전에 필요한 준비와 현실적인 위험을 한 번 더 살펴보세요." } },
  { number: 1, name: "마법사", symbol: "∞", upright: { keyword: "실행력", meaning: "이미 가진 도구와 능력을 모아 생각을 행동으로 옮길 때입니다." }, reversed: { keyword: "흩어진 힘", meaning: "할 수 있는 일이 많아도 우선순위를 좁혀야 힘이 모입니다." } },
  { number: 2, name: "여사제", symbol: "☽", upright: { keyword: "직관", meaning: "바깥의 소음보다 자신의 조용한 감각에 귀를 기울여 보세요." }, reversed: { keyword: "외면한 신호", meaning: "마음에 걸리는 일을 덮어 두고 있지 않은지 돌아보세요." } },
  { number: 3, name: "여황제", symbol: "❀", upright: { keyword: "성장", meaning: "돌보고 가꾸어 온 일이 천천히 결실을 맺을 수 있습니다." }, reversed: { keyword: "돌봄의 불균형", meaning: "다른 사람을 챙기는 만큼 자신의 에너지도 보살펴 주세요." } },
  { number: 4, name: "황제", symbol: "♜", upright: { keyword: "안정과 구조", meaning: "기준을 세우고 계획을 정리하면 상황을 더 단단하게 만들 수 있습니다." }, reversed: { keyword: "지나친 통제", meaning: "모든 것을 관리하려는 마음이 오히려 유연성을 막고 있는지 살펴보세요." } },
  { number: 5, name: "교황", symbol: "✥", upright: { keyword: "배움과 조언", meaning: "검증된 경험이나 믿을 만한 조언에서 힌트를 찾아보세요." }, reversed: { keyword: "익숙한 틀의 재검토", meaning: "남이 정한 정답이 지금의 나에게도 맞는지 질문해 보세요." } },
  { number: 6, name: "연인", symbol: "♡", upright: { keyword: "관계와 선택", meaning: "소중한 관계와 자신의 가치가 함께 가는 선택을 생각해 보세요." }, reversed: { keyword: "엇갈린 마음", meaning: "선택을 미루기보다 무엇을 중요하게 여기는지 솔직히 정리해 보세요." } },
  { number: 7, name: "전차", symbol: "➶", upright: { keyword: "전진", meaning: "방향을 정했다면 흔들림 속에서도 꾸준히 앞으로 나아가 보세요." }, reversed: { keyword: "방향 점검", meaning: "속도를 높이기 전에 목적지와 진행 방식을 다시 확인해 보세요." } },
  { number: 8, name: "힘", symbol: "∿", upright: { keyword: "차분한 용기", meaning: "억지로 밀어붙이기보다 인내와 부드러운 태도가 힘이 됩니다." }, reversed: { keyword: "자신감 회복", meaning: "스스로를 몰아세우지 말고 작은 성공에서 다시 힘을 얻어 보세요." } },
  { number: 9, name: "은둔자", symbol: "✧", upright: { keyword: "성찰", meaning: "잠시 거리를 두고 혼자 생각할 시간이 답을 선명하게 해줍니다." }, reversed: { keyword: "고립에서 나오기", meaning: "혼자 감당하는 일이 길어졌다면 믿을 만한 사람과 이야기해 보세요." } },
  { number: 10, name: "운명의 수레바퀴", symbol: "◉", upright: { keyword: "변화의 흐름", meaning: "바뀌는 상황을 받아들이고 지금 잡을 수 있는 기회를 살펴보세요." }, reversed: { keyword: "변화에 대한 저항", meaning: "되돌릴 수 없는 흐름보다 조정할 수 있는 부분에 집중해 보세요." } },
  { number: 11, name: "정의", symbol: "⚖", upright: { keyword: "균형과 책임", meaning: "사실을 차분히 확인하고 자신의 선택에 책임지는 태도가 필요합니다." }, reversed: { keyword: "불균형 바로잡기", meaning: "판단을 서두르기 전에 놓친 정보나 한쪽으로 기운 기준을 확인해 보세요." } },
  { number: 12, name: "매달린 사람", symbol: "◇", upright: { keyword: "관점 전환", meaning: "잠시 멈춰 다른 각도에서 보면 전에는 보이지 않던 길이 나타납니다." }, reversed: { keyword: "미뤄 둔 결정", meaning: "기다림이 도움이 되는지, 단지 결정을 피하는 중인지 구분해 보세요." } },
  { number: 13, name: "죽음", symbol: "✣", upright: { keyword: "마무리와 전환", meaning: "끝나야 새로 시작할 수 있는 것이 무엇인지 살펴보세요." }, reversed: { keyword: "놓아주기 어려움", meaning: "이미 달라진 일을 붙잡고 있다면 천천히 정리할 시간을 주세요." } },
  { number: 14, name: "절제", symbol: "≈", upright: { keyword: "조화", meaning: "극단보다 적절한 속도와 균형이 지금의 흐름을 돕습니다." }, reversed: { keyword: "리듬 조절", meaning: "무리하거나 한쪽에 치우친 생활을 조금씩 다시 맞춰 보세요." } },
  { number: 15, name: "악마", symbol: "⛓", upright: { keyword: "묶인 습관", meaning: "나를 붙잡는 욕구나 반복되는 선택을 알아차리는 것부터 시작하세요." }, reversed: { keyword: "속박에서 벗어나기", meaning: "익숙하지만 불편했던 패턴을 바꿀 여지가 생기고 있습니다." } },
  { number: 16, name: "탑", symbol: "⚡", upright: { keyword: "갑작스러운 재정비", meaning: "흔들린 기반을 인정하면 더 알맞은 구조를 다시 세울 수 있습니다." }, reversed: { keyword: "변화 대비", meaning: "작은 균열을 미리 살펴 큰 혼란을 줄일 방법을 찾아보세요." } },
  { number: 17, name: "별", symbol: "★", upright: { keyword: "희망과 회복", meaning: "지친 마음을 돌보며 길게 보고 다시 기대해도 좋습니다." }, reversed: { keyword: "희망을 되찾기", meaning: "결과가 늦어도 지금까지 나아온 작은 변화를 확인해 보세요." } },
  { number: 18, name: "달", symbol: "☾", upright: { keyword: "불확실성", meaning: "모든 것이 분명하지 않을 때는 느낌과 사실을 나누어 살펴보세요." }, reversed: { keyword: "안개 걷히기", meaning: "막연했던 걱정의 실체를 확인하면 다음 걸음이 쉬워집니다." } },
  { number: 19, name: "태양", symbol: "☼", upright: { keyword: "활력과 명료함", meaning: "잘되고 있는 것을 인정하고 그 기쁨을 주변과 나누어 보세요." }, reversed: { keyword: "잠시 가린 빛", meaning: "기대만큼 빠르지 않아도 이미 있는 성과를 놓치지 마세요." } },
  { number: 20, name: "심판", symbol: "✺", upright: { keyword: "되돌아보기", meaning: "지나온 선택을 이해하고 다음 단계로 넘어갈 준비를 해보세요." }, reversed: { keyword: "자기비판 내려놓기", meaning: "과거를 돌아보되 자신을 계속 벌주는 방식은 멈춰 보세요." } },
  { number: 21, name: "세계", symbol: "◎", upright: { keyword: "완성과 연결", meaning: "한 주기를 마무리하며 얻은 것을 정리하고 다음 길을 바라보세요." }, reversed: { keyword: "마지막 한 걸음", meaning: "거의 마친 일을 끝내기 위해 남은 작은 조각을 확인해 보세요." } },
];

/** 피셔–예이츠로 원본 덱을 섞어 중복 없이 뽑고, 각 카드의 방향을 따로 결정한다. */
export const drawTarotCards = (count: 1 | 3, random: RandomSource = Math.random): TarotDraw[] =>
  shuffle(majorArcana, random).slice(0, count).map((card) => ({ card, reversed: random() < 0.5 }));

export const meaningFor = ({ card, reversed }: TarotDraw) => reversed ? card.reversed : card.upright;

/** 카드가 모두 열린 뒤 보이는 짧은 종합 문장. 자유 입력 질문을 분석하는 척하지 않는다. */
export const summarizeTarot = (draws: readonly TarotDraw[]): string => {
  if (draws.length === 1 && draws[0]) return `오늘 살펴볼 주제는 ‘${meaningFor(draws[0]).keyword}’입니다. ${meaningFor(draws[0]).meaning}`;
  if (draws.length === 3 && draws[0] && draws[1] && draws[2]) {
    return `과거의 핵심은 ‘${meaningFor(draws[0]).keyword}’, 현재의 초점은 ‘${meaningFor(draws[1]).keyword}’입니다. 앞으로는 ‘${meaningFor(draws[2]).keyword}’에 주목해 보세요.`;
  }
  return "";
};
