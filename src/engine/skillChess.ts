import { Chess, type PieceSymbol, type Square } from 'chess.js';
import type {
  AugmentDefinition,
  AugmentId,
  MoveRecord,
  PieceColor,
  PieceType,
  PlayerSkillState,
  SkillDefinition,
  SkillId,
  SkillMatchState,
} from '../types/chess.ts';

export const MAX_MANA = 10;
export const STARTING_MANA = 3;
export const DRAW_SKILL_COST = 3;
export const DEFAULT_HAND_LIMIT = 4;

export const SKILL_DEFINITIONS: Record<SkillId, SkillDefinition> = {
  march: {
    id: 'march',
    name: '강행군',
    manaCost: 2,
    category: 'mobility',
    shortDesc: '폰 2칸 전진 · 해당 폰만 이동',
    fullDesc: '이미 움직인 폰도 앞 2칸이 비어 있으면 2칸 전진합니다. 사용 후 그 폰만 움직일 수 있습니다.',
    targetMode: 'friendly_piece',
    turnBehavior: 'lock_piece_move',
  },
  leap: {
    id: 'leap',
    name: '도약 명령',
    manaCost: 3,
    category: 'mobility',
    shortDesc: '폰·비숍 L자 도약 · 해당 기물만',
    fullDesc: '내 폰 또는 비숍 1개가 기물을 뛰어넘어 나이트(L자) 빈 칸으로 이동합니다.',
    targetMode: 'friendly_piece',
    turnBehavior: 'lock_piece_move',
  },
  diagonal_rook: {
    id: 'diagonal_rook',
    name: '대각선 강타',
    manaCost: 3,
    category: 'offense',
    shortDesc: '룩 대각선으로만 이동/공격 · 해당 룩만',
    fullDesc: '이번 턴에 한해 내 룩 1개가 상하좌우 대신 비숍처럼 대각선으로만 이동하거나 적을 잡습니다.',
    targetMode: 'friendly_piece',
    turnBehavior: 'lock_piece_move',
  },
  retreat: {
    id: 'retreat',
    name: '후퇴 신호',
    manaCost: 2,
    category: 'defense',
    shortDesc: '기물 후방 1칸 후퇴 · 해당 기물만',
    fullDesc: '내 기물 1개(킹 제외)를 뒤쪽 빈 칸 1칸으로만 안전하게 물립니다.',
    targetMode: 'friendly_piece',
    turnBehavior: 'lock_piece_move',
  },
  shield: {
    id: 'shield',
    name: '철벽 수호',
    manaCost: 4,
    category: 'defense',
    shortDesc: '내 진영 4줄 철벽 소환 · 이동 전 무적',
    fullDesc: '내 진영 4줄(백 1~4줄·흑 5~8줄) 칸에 철벽 진지를 소환합니다. 아군 기물(킹 제외)이 들어가면 방패를 장착해 그 기물이 다시 이동할 때까지 절대 잡히지 않습니다.',
    targetMode: 'shield_zone',
    turnBehavior: 'continue_turn',
  },
  smoke: {
    id: 'smoke',
    name: '연막탄',
    manaCost: 3,
    category: 'defense',
    shortDesc: '빈 칸 1턴 봉쇄 · 일반 이동 유지',
    fullDesc: '빈 칸 1곳을 연막으로 막아 다음 상대 턴 동안 착지·통과를 차단합니다. (나이트는 도약 가능)',
    targetMode: 'empty_square',
    turnBehavior: 'continue_turn',
  },
  freeze: {
    id: 'freeze',
    name: '빙결',
    manaCost: 3,
    category: 'offense',
    shortDesc: '상대 기물 1턴 빙결 · 피격 불가',
    fullDesc: '상대 기물 1개(킹 제외)를 얼려 다음 상대 턴 동안 움직이지 못하게 합니다. 빙결된 적은 잡을 수 없습니다.',
    targetMode: 'enemy_piece',
    turnBehavior: 'continue_turn',
  },
  swap: {
    id: 'swap',
    name: '전술 교대',
    manaCost: 4,
    category: 'mobility',
    shortDesc: '폰·킹 제외 아군 2개 교환 · 턴 종료',
    fullDesc: '폰과 킹을 제외한 내 기물 2개의 자리를 서로 맞바꿉니다. (사용 시 내 킹이 체크되지 않아야 함)',
    targetMode: 'swap_two',
    turnBehavior: 'end_turn',
  },
  revive: {
    id: 'revive',
    name: '전선 복귀',
    manaCost: 6,
    category: 'defense',
    shortDesc: '나이트 부족 시 맨 아래줄 소환 · 턴 종료',
    fullDesc: '필드에 내 나이트가 2마리 미만일 때 아군 맨 아래줄(1줄·8줄) 빈 칸에 나이트 1기를 다시 소환합니다.',
    targetMode: 'revive_square',
    turnBehavior: 'end_turn',
  },
  snipe: {
    id: 'snipe',
    name: '정밀 저격',
    manaCost: 5,
    category: 'offense',
    shortDesc: '비숍 대각선 가장 가까운 적 제거',
    fullDesc: '내 비숍 1개를 선택한 뒤, 그 대각선에서 아군을 무시하고 가장 가까운 적 기물 1개(킹·보호막·빙결 제외)를 즉시 제거합니다.',
    targetMode: 'snipe_two',
    turnBehavior: 'end_turn',
  },
  bishop_shift: {
    id: 'bishop_shift',
    name: '위상 전환',
    manaCost: 2,
    category: 'mobility',
    shortDesc: '비숍 상하좌우 1칸 · 색상 전환',
    fullDesc: '내 비숍 1개를 상하좌우 인접한 빈 칸 1칸으로 이동시켜 공격 대각선 색상을 바꿉니다.',
    targetMode: 'friendly_piece',
    turnBehavior: 'lock_piece_move',
  },
  camel_jump: {
    id: 'camel_jump',
    name: '원거리 기습',
    manaCost: 3,
    category: 'offense',
    shortDesc: '나이트 3×1 장거리 도약 · 해당만',
    fullDesc: '내 나이트 1개가 이번 턴에 3×1 거리(카멜 점프)로 기물을 뛰어넘어 이동하거나 공격합니다.',
    targetMode: 'friendly_piece',
    turnBehavior: 'lock_piece_move',
  },
  disarm: {
    id: 'disarm',
    name: '무장 해제',
    manaCost: 3,
    category: 'defense',
    shortDesc: '상대 기물 2턴 공격 불가 · 유지',
    fullDesc: '상대 기물 1개(킹 제외)를 2턴 동안 무장해제시켜 기물을 잡지 못하게 합니다.',
    targetMode: 'enemy_piece',
    turnBehavior: 'continue_turn',
  },
  pawn_guard: {
    id: 'pawn_guard',
    name: '근위병 소집',
    manaCost: 4,
    category: 'defense',
    shortDesc: '킹 옆에 잡힌 폰 소환 · 턴 종료',
    fullDesc: '잡혔던 내 폰 1개를 내 킹 주변 8칸 중 비어 있는 안전한 칸에 즉시 소환합니다.',
    targetMode: 'revive_square',
    turnBehavior: 'end_turn',
  },
  phantom_step: {
    id: 'phantom_step',
    name: '유령 보법',
    manaCost: 3,
    category: 'mobility',
    shortDesc: '기물 1개 뛰어넘어 이동 · 해당만',
    fullDesc: '내 룩·비숍·퀸 1개가 경로상의 기물 딱 1개를 통과해 그 뒤 칸으로 이동하거나 잡습니다.',
    targetMode: 'friendly_piece',
    turnBehavior: 'lock_piece_move',
  },
  tactical_jam: {
    id: 'tactical_jam',
    name: '전술 교란',
    manaCost: 5,
    category: 'offense',
    shortDesc: '2턴간 아군 맨 아래줄 시야 차단',
    fullDesc: '즉시 발동해 상대가 2턴 동안 내 가장 아래줄(1줄/8줄)을 전혀 보지 못하게 가립니다. (일반 이동 유지)',
    targetMode: 'instant',
    turnBehavior: 'continue_turn',
  },
  great_attack: {
    id: 'great_attack',
    name: '위대한 공격',
    manaCost: 3,
    category: 'offense',
    shortDesc: '기본 행마 유지 · 전방 3칸 공격',
    fullDesc: '내 폰 1개의 기본 이동과 대각선 공격은 그대로 유지한 채, 바로 앞 1칸의 적도 공격할 수 있게 되어 전방 3칸(좌대각·정면·우대각)이 공격 범위가 됩니다.',
    targetMode: 'friendly_piece',
    turnBehavior: 'lock_piece_move',
  },
  straight_bishop: {
    id: 'straight_bishop',
    name: '직선 저격',
    manaCost: 3,
    category: 'offense',
    shortDesc: '비숍 상하좌우 일자 이동/공격',
    fullDesc: '이번 턴에 내 비숍 1개의 행마법이 대각선이 아닌 상하좌우 일자로 변경됩니다.',
    targetMode: 'friendly_piece',
    turnBehavior: 'lock_piece_move',
  },
  trojan_horse: {
    id: 'trojan_horse',
    name: '트로이의 목마',
    manaCost: 4,
    category: 'mobility',
    shortDesc: '나이트→룩 변신 · 상하좌우 1칸',
    fullDesc: '내 나이트 1개를 룩으로 바꿉니다. 이번 턴에는 바뀐 룩을 상하좌우 한 칸만 이동할 수 있습니다.',
    targetMode: 'friendly_piece',
    turnBehavior: 'lock_piece_move',
  },
  queens_gambit: {
    id: 'queens_gambit',
    name: '퀸즈 갬빗',
    manaCost: 4,
    category: 'offense',
    shortDesc: '퀸 나이트 행마 · 체크 시 사용 불가',
    fullDesc: '이번 턴에 내 퀸의 행마법을 나이트(L자)로 바꾸고 퀸만 움직입니다. 체크 상태에서는 사용할 수 없습니다.',
    targetMode: 'friendly_piece',
    turnBehavior: 'lock_piece_move',
  },
  pawn_surge: {
    id: 'pawn_surge',
    name: '전진 명령',
    manaCost: 2,
    category: 'mobility',
    shortDesc: '폰 대각선·좌우 빈 칸 이동 · 해당 폰만',
    fullDesc: '내 폰 1개가 이번 턴에 전방 대각선 빈 칸 1칸 또는 좌우 옆 빈 칸 1칸으로 추가 이동할 수 있습니다.',
    targetMode: 'friendly_piece',
    turnBehavior: 'lock_piece_move',
  },
  mana_drain: {
    id: 'mana_drain',
    name: '마나 강탈',
    manaCost: 2,
    category: 'offense',
    shortDesc: '상대 마나 최대 2 MP 흡수 · 일반 이동 유지',
    fullDesc: '상대 마나가 1 이상일 때 즉시 발동해 상대 마나를 최대 2 MP 빼앗아 내 마나로 흡수합니다.',
    targetMode: 'instant',
    turnBehavior: 'continue_turn',
  },
  shadow_bind: {
    id: 'shadow_bind',
    name: '그림자 속박',
    manaCost: 4,
    category: 'offense',
    shortDesc: '상대 기물 1턴간 1칸 이동 제한',
    fullDesc: '상대 기물 1개(킹 제외)를 속박해 다음 턴 동안 주변 1칸 이내로만 움직이게 제한합니다. (속박된 적은 공격 가능)',
    targetMode: 'enemy_piece',
    turnBehavior: 'continue_turn',
  },
  knight_sweep: {
    id: 'knight_sweep',
    name: '기사 일섬',
    manaCost: 4,
    category: 'offense',
    shortDesc: '나이트 주변 8칸 근접 공격/이동',
    fullDesc: '이번 턴에 내 나이트 1개의 행마법을 주변 8칸(상하좌우·대각선 1칸 이동 및 포획)으로 변경합니다.',
    targetMode: 'friendly_piece',
    turnBehavior: 'lock_piece_move',
  },
  field_promotion: {
    id: 'field_promotion',
    name: '야전 임관',
    manaCost: 5,
    category: 'offense',
    shortDesc: '전진한 폰 즉시 비숍 진급 · 턴 종료',
    fullDesc: '중앙선을 넘은(백 5~7줄·흑 4~2줄) 내 폰 1개를 제자리에서 즉시 비숍으로 승급시킵니다.',
    targetMode: 'friendly_piece',
    turnBehavior: 'end_turn',
  },
  arcane_tome: {
    id: 'arcane_tome',
    name: '마도서 해독',
    manaCost: 2,
    category: 'defense',
    shortDesc: '비밀 스킬 2장 즉시 보충 · 일반 이동 유지',
    fullDesc: '즉시 발동해 보유 한도까지 비밀 스킬 카드를 최대 2장 손으로 가져옵니다. (일반 이동 유지)',
    targetMode: 'instant',
    turnBehavior: 'continue_turn',
  },
  purify: {
    id: 'purify',
    name: '정화의 빛',
    manaCost: 2,
    category: 'defense',
    shortDesc: '아군 상태이상 해제 + 1턴 보호막 · 유지',
    fullDesc: '빙결·무장 해제·속박에 걸린 내 기물 1개의 모든 약화 효과를 풀고 1턴 철벽 보호막을 씌웁니다.',
    targetMode: 'friendly_piece',
    turnBehavior: 'continue_turn',
  },
  royal_dash: {
    id: 'royal_dash',
    name: '국왕 행차',
    manaCost: 3,
    category: 'mobility',
    shortDesc: '킹 2칸 안전 질주 가능 · 킹만 이동',
    fullDesc: '이번 턴에 내 킹이 상하좌우·대각선으로 빈 2칸을 안전하게 뛰어 이동할 수 있습니다. (포획은 1칸만 가능)',
    targetMode: 'friendly_piece',
    turnBehavior: 'lock_piece_move',
  },
  alfil_leap: {
    id: 'alfil_leap',
    name: '쌍대각 도약',
    manaCost: 3,
    category: 'offense',
    shortDesc: '나이트 대각 2칸 도약 추가 · 해당만',
    fullDesc: '이번 턴에 내 나이트 1개가 L자 도약 외에 대각선 정확히 2칸을 뛰어넘어 이동하거나 공격합니다.',
    targetMode: 'friendly_piece',
    turnBehavior: 'lock_piece_move',
  },
  vanguard_lance: {
    id: 'vanguard_lance',
    name: '창기병 돌파',
    manaCost: 3,
    category: 'offense',
    shortDesc: '폰 정면 1~2칸 관통 돌격 · 해당 폰만',
    fullDesc: '이번 턴에 내 폰 1개가 바로 앞 적 또는 1칸을 통과한 정면 2칸 앞의 적 기물을 찔러 잡을 수 있습니다.',
    targetMode: 'friendly_piece',
    turnBehavior: 'lock_piece_move',
  },
  center_drop: {
    id: 'center_drop',
    name: '중앙 강하',
    manaCost: 4,
    category: 'mobility',
    shortDesc: '비숍·나이트 중앙 4칸 순간이동 · 해당만',
    fullDesc: '내 비숍 또는 나이트 1개가 이번 턴에 비어 있는 중앙 4칸(d4·d5·e4·e5) 중 한 곳으로 즉시 이동할 수 있습니다.',
    targetMode: 'friendly_piece',
    turnBehavior: 'lock_piece_move',
  },
  royal_escape: {
    id: 'royal_escape',
    name: '어전 긴급 대피',
    manaCost: 4,
    category: 'defense',
    shortDesc: '킹↔룩 원거리 자리 교환 · 턴 종료',
    fullDesc: '내 킹과 아군 룩 1개의 위치를 맞바꿔 위기를 탈출합니다. 체크 중에도 사용 가능하며, 교환 후 킹이 안전해야 합니다.',
    targetMode: 'friendly_piece',
    turnBehavior: 'end_turn',
  },
};

export const AUGMENT_DEFINITIONS: Record<AugmentId, AugmentDefinition> = {
  double_pawn_march: {
    id: 'double_pawn_march',
    name: '이중 행군',
    tag: '폰 강화',
    shortDesc: '각 폰이 최대 2번까지 2칸 전진 가능',
    fullDesc: '게임 내내 내 모든 폰이 출발선뿐 아니라 3~4번째 줄에서도 한 번 더 2칸 전진할 수 있습니다.',
  },
  late_bloom: {
    id: 'late_bloom',
    name: '슬로우 스타터',
    tag: '후반 마나',
    shortDesc: '20수에 +1 MP, 50수 도달 시 +3 MP',
    fullDesc: '대국 전체 20수 도달 시 마나 +1, 50수 도달 시 즉시 마나 +3을 획득합니다.',
  },
  mana_well: {
    id: 'mana_well',
    name: '마나 샘물',
    tag: '초반 마나',
    shortDesc: '시작 마나 3 MP → 5 MP로 증가',
    fullDesc: '대국을 3 MP 대신 5 MP를 보유한 상태로 시작해 초반부터 강력한 스킬을 사용할 수 있습니다.',
  },
  recycle_pro: {
    id: 'recycle_pro',
    name: '재활용 달인',
    tag: '순환 보너스',
    shortDesc: '쓰레기통 버릴 때 +2 MP 획득',
    fullDesc: '카드를 쓰레기통에 끌어다 버릴 때 +1 MP 대신 +2 MP를 얻습니다.',
  },
  cheap_skills: {
    id: 'cheap_skills',
    name: '마나 효율화',
    tag: '뽑기 할인',
    shortDesc: '첫 스킬 뽑기 1 MP로 구매',
    fullDesc: '대국에서 처음 실행하는 스킬 뽑기 비용이 3 MP 대신 1 MP로 할인됩니다. (이후 뽑기는 3 MP)',
  },
  forward_aura: {
    id: 'forward_aura',
    name: '진격의 기세',
    tag: '전선 보너스',
    shortDesc: '폰이 중앙선을 넘을 때마다 +1 MP',
    fullDesc: '내 폰이 상대 진영(백 5줄, 흑 4줄)으로 처음 넘어갈 때마다 +1 MP를 획득합니다.',
  },
  knight_step: {
    id: 'knight_step',
    name: '메가나이트',
    tag: '나이트 각성',
    shortDesc: '나이트 1기 남을 때 상하좌우 1칸 추가',
    fullDesc: '필드에 내 나이트가 딱 1개만 남았을 때 활성화되어 L자 도약 외에 상하좌우 인접 빈 칸 1칸으로도 이동합니다.',
  },
  holy_bishop: {
    id: 'holy_bishop',
    name: '신성 강화',
    tag: '비숍 각성',
    shortDesc: '비숍 1기 남을 때 상하좌우 1칸 추가',
    fullDesc: '필드에 내 비숍이 딱 1개만 남았을 때 활성화되어 대각선 외에 상하좌우 인접 빈 칸 1칸으로도 이동합니다.',
  },
  castle_vault: {
    id: 'castle_vault',
    name: '왕실 금고',
    tag: '특수 보너스',
    shortDesc: '캐슬링 성공 시 즉시 +2 MP 획득',
    fullDesc: '킹사이드 또는 퀸사이드 캐슬링을 실행하면 왕실 금고가 열려 즉시 +2 MP를 얻습니다.',
  },
  check_press: {
    id: 'check_press',
    name: '체크 압박',
    tag: '공격 보너스',
    shortDesc: '상대에게 체크 걸 때마다 +1 MP (3회)',
    fullDesc: '일반 수나 스킬로 상대 킹에게 체크를 걸 때마다 +1 MP를 얻습니다. (대국당 최대 3회)',
  },
  large_hand: {
    id: 'large_hand',
    name: '넓은 전술안',
    tag: '손패 확장',
    shortDesc: '최대 보유 스킬 카드 4장 → 5장',
    fullDesc: '손에 들고 있을 수 있는 최대 스킬 카드 수가 4장에서 5장으로 늘어납니다.',
  },
  first_refund: {
    id: 'first_refund',
    name: '초동 지원',
    tag: '첫 스킬 환급',
    shortDesc: '첫 스킬 사용 시 마나 2 MP 반환',
    fullDesc: '대국에서 처음 스킬을 사용하면 소모한 마나 중 최대 2 MP를 즉시 돌려받습니다.',
  },
  opening_intel: {
    id: 'opening_intel',
    name: '초반 보급',
    tag: '첫 구매 선택',
    shortDesc: '첫 스킬 구매 시 3장 중 1장 선택',
    fullDesc: '처음 스킬 뽑기를 실행할 때 무작위 1장 대신 스킬 카드 3장을 확인해 원하는 1장을 직접 골라 가져옵니다.',
  },
  tactical_reserve: {
    id: 'tactical_reserve',
    name: '마나 비축',
    tag: '상한 확장',
    shortDesc: '최대 마나 12 MP 확장 · 시작 +1 MP',
    fullDesc: '최대 보유 가능 마나 상한이 10 MP에서 12 MP로 늘어나며, 선택 즉시 마나 +1 MP를 얻습니다.',
  },
  mana_siphon: {
    id: 'mana_siphon',
    name: '마나 흡수',
    tag: '처치 보너스',
    shortDesc: '적 기물 처치 시 +1 MP (최대 3회)',
    fullDesc: '내 수나 저격 스킬로 상대 기물을 잡을 때마다 마나 +1 MP를 추가로 획득합니다. (대국당 최대 3회)',
  },
  arcane_surge: {
    id: 'arcane_surge',
    name: '마력 역류',
    tag: '고비용 환급',
    shortDesc: '4 MP 이상 스킬 사용 시 +1 MP (3회)',
    fullDesc: '비용이 4 MP 이상인 스킬을 사용할 때마다 즉시 1 MP를 돌려받습니다. (대국당 최대 3회)',
  },
  royal_guard: {
    id: 'royal_guard',
    name: '왕실 호위',
    tag: '킹 기동',
    shortDesc: '킹이 직접 이동할 때마다 +1 MP (3회)',
    fullDesc: '내 킹이 캐슬링 외의 일반 수로 직접 이동할 때마다 마나 +1 MP를 얻습니다. (대국당 최대 3회)',
  },
  veteran_pawn: {
    id: 'veteran_pawn',
    name: '전선 돌파',
    tag: '깊은 진격',
    shortDesc: '7줄(2줄) 도달 시 +2 MP 및 카드 1장',
    fullDesc: '내 폰이 상대 끝 줄 바로 앞 칸(백 7줄, 흑 2줄)에 처음 도달하면 즉시 +2 MP와 스킬 카드 1장을 얻습니다. (1회)',
  },
  iron_castle: {
    id: 'iron_castle',
    name: '철옹성',
    tag: '룩 보호막',
    shortDesc: '룩 이동 시 1턴 철벽 보호막 (2회)',
    fullDesc: '내 룩이 이동하거나 캐슬링할 때 해당 룩에게 자동으로 1턴 철벽 보호막을 부여합니다. (대국당 최대 2회)',
  },
  swift_recovery: {
    id: 'swift_recovery',
    name: '신속한 정비',
    tag: '순환 드로우',
    shortDesc: '카드 3번 버릴 때마다 무료 1장 뽑기',
    fullDesc: '쓰레기통에 스킬 카드를 3번 버릴 때마다 마나 소모 없이 새 스킬 카드 1장을 손으로 가져옵니다.',
  },
};

export const SKILL_LIST: SkillDefinition[] = Object.values(SKILL_DEFINITIONS);
export const AUGMENT_LIST: AugmentDefinition[] = Object.values(AUGMENT_DEFINITIONS);

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

function parseSquare(sq: string): { f: number; r: number } {
  return { f: FILES.indexOf(sq[0]), r: RANKS.indexOf(sq[1]) };
}

function toSquare(f: number, r: number): Square | null {
  if (f < 0 || f > 7 || r < 0 || r > 7) return null;
  return `${FILES[f]}${RANKS[r]}` as Square;
}

export function countFriendlyPieces(
  chess: Chess,
  color: PieceColor,
  pieceType: PieceType
): number {
  const board = chess.board();
  let count = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color && p.type === pieceType) {
        count++;
      }
    }
  }
  return count;
}

export function isMegaKnightActive(
  chess: Chess,
  skillState: SkillMatchState | null,
  color: PieceColor
): boolean {
  if (!skillState || skillState[color].augment !== 'knight_step') return false;
  return countFriendlyPieces(chess, color, 'n') === 1;
}

export function isHolyBishopActive(
  chess: Chess,
  skillState: SkillMatchState | null,
  color: PieceColor
): boolean {
  if (!skillState || skillState[color].augment !== 'holy_bishop') return false;
  return countFriendlyPieces(chess, color, 'b') === 1;
}

export function getHandLimit(skillState: SkillMatchState | null, color: PieceColor): number {
  if (skillState && skillState[color].augment === 'large_hand') return 5;
  return DEFAULT_HAND_LIMIT;
}

export function getMaxMana(skillState: SkillMatchState | null, color: PieceColor): number {
  if (skillState && skillState[color].augment === 'tactical_reserve') return 12;
  return MAX_MANA;
}

export function getDrawSkillCost(
  skillState: SkillMatchState | null,
  color: PieceColor
): number {
  if (
    skillState &&
    skillState[color].augment === 'cheap_skills' &&
    !skillState[color].firstDrawDiscountUsed
  ) {
    return 1;
  }
  return DRAW_SKILL_COST;
}

export function getEffectiveSkillCost(
  _skillState: SkillMatchState | null,
  _color: PieceColor,
  skillId: SkillId
): number {
  return SKILL_DEFINITIONS[skillId].manaCost;
}

function buildShuffledDeck(): SkillId[] {
  const pool: SkillId[] = [];
  for (const id of Object.keys(SKILL_DEFINITIONS) as SkillId[]) {
    pool.push(id, id);
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function pickThreeAugments(): AugmentId[] {
  const all = Object.keys(AUGMENT_DEFINITIONS) as AugmentId[];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, 3);
}

let cardUidCounter = 1;
function drawOneIntoHand(player: PlayerSkillState, limit: number): boolean {
  if (player.hand.length >= limit) return false;
  if (player.deck.length === 0) {
    player.deck = buildShuffledDeck();
  }
  const nextId = player.deck.pop();
  if (!nextId) return false;
  player.hand.push({
    uid: `sc_${Date.now().toString(36)}_${cardUidCounter++}`,
    skillId: nextId,
  });
  return true;
}

function pickThreeDraftSkills(): SkillId[] {
  const all = Object.keys(SKILL_DEFINITIONS) as SkillId[];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, 3);
}

function createPlayerSkillState(): PlayerSkillState {
  return {
    mana: STARTING_MANA,
    hand: [],
    deck: buildShuffledDeck(),
    usedOrDiscardedThisTurn: false,
    augment: null,
    checkBonusUsed: 0,
    firstRefundUsed: false,
    firstDrawDiscountUsed: false,
    milestone20Claimed: false,
    milestone50Claimed: false,
    kingManaUsed: 0,
    siphonUsed: 0,
    surgeUsed: 0,
    veteranPawnClaimed: false,
    ironCastleUsed: 0,
    discardCycleCount: 0,
    openingIntelUsed: false,
    pendingSkillDraft: null,
  };
}

function emitAugmentFx(
  skillState: SkillMatchState,
  augmentId: AugmentId,
  color: PieceColor,
  label: string,
  square?: string
) {
  const seq = (skillState.lastAugmentFx?.seq || 0) + 1;
  skillState.lastAugmentFx = {
    seq,
    augmentId,
    color,
    label,
    square,
  };
}

export function createInitialSkillMatchState(): SkillMatchState {
  return {
    w: createPlayerSkillState(),
    b: createPlayerSkillState(),
    augmentPhase: true,
    offeredAugments: pickThreeAugments(),
    effects: {
      shielded: [],
      shieldZones: [],
      frozen: [],
      disarmed: [],
      smoke: [],
      bound: [],
      veiledRanks: [],
    },
    activeCast: null,
    lastVfx: null,
    lastCaptureMana: null,
    lastAugmentFx: null,
  };
}

export function cloneSkillState(state: SkillMatchState): SkillMatchState {
  return JSON.parse(JSON.stringify(state)) as SkillMatchState;
}

export function choosePlayerAugment(
  skillState: SkillMatchState,
  color: PieceColor,
  augmentId: AugmentId
): SkillMatchState | null {
  if (!skillState.augmentPhase) return null;
  if (!skillState.offeredAugments.includes(augmentId)) return null;
  if (skillState[color].augment !== null) return null;

  const next = cloneSkillState(skillState);
  next[color].augment = augmentId;

  const cap = getMaxMana(next, color);
  if (augmentId === 'mana_well') {
    next[color].mana = Math.min(cap, 5);
    emitAugmentFx(next, 'mana_well', color, '시작 마나 5 MP 적용');
  } else if (augmentId === 'tactical_reserve') {
    next[color].mana = Math.min(cap, next[color].mana + 1);
    emitAugmentFx(next, 'tactical_reserve', color, '마나 상한 12 MP · +1 MP');
  }

  if (next.w.augment !== null && next.b.augment !== null) {
    next.augmentPhase = false;
  }

  return next;
}

export function drawSkillCard(
  skillState: SkillMatchState,
  color: PieceColor
): SkillMatchState | null {
  if (skillState.augmentPhase || skillState.activeCast) return null;
  const player = skillState[color];
  if (player.pendingSkillDraft && player.pendingSkillDraft.length > 0) return null;
  const limit = getHandLimit(skillState, color);
  const drawCost = getDrawSkillCost(skillState, color);
  if (player.mana < drawCost || player.hand.length >= limit) {
    return null;
  }

  const next = cloneSkillState(skillState);
  next[color].mana -= drawCost;
  if (next[color].augment === 'cheap_skills' && !next[color].firstDrawDiscountUsed) {
    next[color].firstDrawDiscountUsed = true;
    emitAugmentFx(next, 'cheap_skills', color, '첫 뽑기 1 MP 할인 적용');
  }
  if (next[color].augment === 'opening_intel' && !next[color].openingIntelUsed) {
    next[color].openingIntelUsed = true;
    next[color].pendingSkillDraft = pickThreeDraftSkills();
    emitAugmentFx(next, 'opening_intel', color, '초반 보급 · 3장 선택 발동');
    return next;
  }
  if (!drawOneIntoHand(next[color], limit)) return null;
  return next;
}

export function chooseSkillDraftCard(
  skillState: SkillMatchState,
  color: PieceColor,
  chosenSkillId: SkillId
): SkillMatchState | null {
  if (skillState.augmentPhase) return null;
  const player = skillState[color];
  if (!player.pendingSkillDraft || !player.pendingSkillDraft.includes(chosenSkillId)) {
    return null;
  }
  const limit = getHandLimit(skillState, color);
  if (player.hand.length >= limit) return null;

  const next = cloneSkillState(skillState);
  next[color].pendingSkillDraft = null;
  next[color].hand.push({
    uid: `sc_${Date.now().toString(36)}_${cardUidCounter++}`,
    skillId: chosenSkillId,
  });
  return next;
}

function isKingSafeAfterBoardEdit(chess: Chess, color: PieceColor): boolean {
  const board = chess.board();
  let kingSq: Square | null = null;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === 'k' && p.color === color) {
        kingSq = `${FILES[c]}${RANKS[7 - r]}` as Square;
        break;
      }
    }
    if (kingSq) break;
  }
  if (!kingSq) return false;
  const enemy: PieceColor = color === 'w' ? 'b' : 'w';
  return !chess.isAttacked(kingSq, enemy);
}

function flipFenTurn(fen: string, nextTurn: PieceColor, resetEnPassant = true): string {
  const parts = fen.split(' ');
  parts[1] = nextTurn;
  if (resetEnPassant) parts[3] = '-';
  parts[4] = String(Number(parts[4] || 0) + 1);
  if (nextTurn === 'w') {
    parts[5] = String(Number(parts[5] || 1) + 1);
  }
  return parts.join(' ');
}

function stripCastlingRight(
  fen: string,
  from: string,
  to: string,
  color: PieceColor,
  pieceType: PieceType
): string {
  const parts = fen.split(' ');
  let castling = parts[2];
  if (castling === '-') return fen;

  if (pieceType === 'k') {
    castling = color === 'w' ? castling.replace(/[KQ]/g, '') : castling.replace(/[kq]/g, '');
  }
  if (from === 'h1' || to === 'h1') castling = castling.replace('K', '');
  if (from === 'a1' || to === 'a1') castling = castling.replace('Q', '');
  if (from === 'h8' || to === 'h8') castling = castling.replace('k', '');
  if (from === 'a8' || to === 'a8') castling = castling.replace('q', '');

  parts[2] = castling.length > 0 ? castling : '-';
  return parts.join(' ');
}

function isPathClearOfSmoke(
  from: string,
  to: string,
  pieceType: PieceType,
  smokeSet: Set<string>
): boolean {
  if (smokeSet.has(to)) return false;
  if (pieceType === 'n') return true;
  const a = parseSquare(from);
  const b = parseSquare(to);
  const df = Math.sign(b.f - a.f);
  const dr = Math.sign(b.r - a.r);

  let cf = a.f + df;
  let cr = a.r + dr;
  while (cf !== b.f || cr !== b.r) {
    const sq = toSquare(cf, cr);
    if (sq && smokeSet.has(sq)) return false;
    cf += df;
    cr += dr;
  }
  return true;
}

export interface AugmentedMove {
  from: string;
  to: string;
  san: string;
  captured?: PieceType;
  promotion?: PieceType;
  flags: string;
  isSkillAugmented: boolean;
}

export function getSkillAugmentedMovesForSquare(
  chess: Chess,
  skillState: SkillMatchState | null,
  square: Square
): AugmentedMove[] {
  if (skillState?.augmentPhase) return [];

  const turn = chess.turn() as PieceColor;
  const piece = chess.get(square);
  if (!piece || piece.color !== turn) return [];

  if (skillState?.activeCast?.lockedPieceSquare && skillState.activeCast.lockedPieceSquare !== square) {
    return [];
  }

  // Frozen friendly piece cannot move
  if (skillState?.effects.frozen.some((f) => f.square === square && f.color === turn)) {
    return [];
  }

  const isDisarmed = Boolean(
    skillState?.effects.disarmed.some((d) => d.square === square && d.color === turn)
  );
  const isBound = Boolean(
    skillState?.effects.bound?.some((b) => b.square === square && b.color === turn)
  );

  const smokeSet = new Set(skillState?.effects.smoke.map((s) => s.square) || []);
  const shieldedEnemySet = new Set(
    skillState?.effects.shielded
      .filter((s) => s.color !== turn)
      .map((s) => s.square) || []
  );
  const frozenEnemySet = new Set(
    skillState?.effects.frozen
      .filter((f) => f.color !== turn)
      .map((f) => f.square) || []
  );

  const activeSkillId =
    skillState?.activeCast?.lockedPieceSquare === square ? skillState.activeCast.skillId : null;

  const replaceStandardMoves =
    activeSkillId === 'diagonal_rook' ||
    activeSkillId === 'retreat' ||
    activeSkillId === 'straight_bishop' ||
    activeSkillId === 'trojan_horse' ||
    activeSkillId === 'queens_gambit' ||
    activeSkillId === 'knight_sweep';

  const results: AugmentedMove[] = [];

  // 1. Standard chess.js legal moves (unless active skill replaces the movement pattern)
  if (!replaceStandardMoves) {
    const stdMoves = chess.moves({ square, verbose: true });
    for (const m of stdMoves) {
      if (isDisarmed && m.captured) continue;

      let captureTargetSq: string = m.to;
      if (m.flags.includes('e')) {
        const f = m.to[0];
        const r = turn === 'w' ? String(Number(m.to[1]) - 1) : String(Number(m.to[1]) + 1);
        captureTargetSq = `${f}${r}`;
      }
      if (
        m.captured &&
        (shieldedEnemySet.has(captureTargetSq) || frozenEnemySet.has(captureTargetSq))
      ) {
        continue;
      }
      if (!isPathClearOfSmoke(m.from, m.to, m.piece as PieceType, smokeSet)) {
        continue;
      }
      if (m.flags.includes('k') || m.flags.includes('q')) {
        const rank = turn === 'w' ? '1' : '8';
        const rookFrom = m.flags.includes('k') ? `h${rank}` : `a${rank}`;
        const rookTo = m.flags.includes('k') ? `f${rank}` : `d${rank}`;
        if (!isPathClearOfSmoke(rookFrom, rookTo, 'r', smokeSet)) {
          continue;
        }
      }

      results.push({
        from: m.from,
        to: m.to,
        san: m.san,
        captured: m.captured as PieceType | undefined,
        promotion: m.promotion as PieceType | undefined,
        flags: m.flags,
        isSkillAugmented: false,
      });
    }
  }

  const existingTargets = new Set(results.map((r) => r.to));
  const { f, r } = parseSquare(square);

  const tryAddCustomMove = (targetSq: Square, canCapture: boolean) => {
    if (existingTargets.has(targetSq) || smokeSet.has(targetSq)) return;
    const targetPiece = chess.get(targetSq);
    if (targetPiece) {
      if (!canCapture || isDisarmed || targetPiece.color === turn) return;
      if (
        targetPiece.type === 'k' ||
        shieldedEnemySet.has(targetSq) ||
        frozenEnemySet.has(targetSq)
      ) {
        return;
      }
    }

    const temp = new Chess(chess.fen());
    temp.remove(square);
    const willPromote =
      piece.type === 'p' &&
      ((turn === 'w' && targetSq[1] === '8') || (turn === 'b' && targetSq[1] === '1'));
    temp.put({ type: willPromote ? 'q' : piece.type, color: turn }, targetSq);

    if (!isKingSafeAfterBoardEdit(temp, turn)) return;

    const captured = targetPiece ? (targetPiece.type as PieceType) : undefined;
    const pieceLabel = piece.type === 'p' ? '' : piece.type.toUpperCase();
    const san = `${pieceLabel}${captured ? 'x' : ''}${targetSq}${willPromote ? '=Q' : ''}*`;
    results.push({
      from: square,
      to: targetSq,
      san,
      captured,
      promotion: willPromote ? 'q' : undefined,
      flags: captured ? 'c' : 'n',
      isSkillAugmented: true,
    });
    existingTargets.add(targetSq);
  };

  // 2. Passive Augment Move Extensions (only when standard movement isn't replaced)
  const playerAugment = skillState ? skillState[turn].augment : null;

  if (!replaceStandardMoves) {
    // Double Pawn March Augment: pawn on rank 3/4 (w) or 6/5 (b) can push 2 squares again
    if (playerAugment === 'double_pawn_march' && piece.type === 'p') {
      const allowedRankIndices = turn === 'w' ? [2, 3] : [5, 4];
      if (allowedRankIndices.includes(r)) {
        const dir = turn === 'w' ? 1 : -1;
        const step1 = toSquare(f, r + dir);
        const step2 = toSquare(f, r + dir * 2);
        if (step1 && step2 && !chess.get(step1) && !chess.get(step2) && !smokeSet.has(step1)) {
          tryAddCustomMove(step2, false);
        }
      }
    }

    // Mega Knight Augment: active ONLY when exactly 1 friendly Knight remains on board
    if (piece.type === 'n' && isMegaKnightActive(chess, skillState, turn)) {
      const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (const [df, dr] of dirs) {
        const target = toSquare(f + df, r + dr);
        if (target && !chess.get(target)) {
          tryAddCustomMove(target, false);
        }
      }
    }

    // Holy Bishop Augment: active ONLY when exactly 1 friendly Bishop remains on board
    if (piece.type === 'b' && isHolyBishopActive(chess, skillState, turn)) {
      const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (const [df, dr] of dirs) {
        const target = toSquare(f + df, r + dr);
        if (target && !chess.get(target)) {
          tryAddCustomMove(target, false);
        }
      }
    }
  }

  // 3. Active Locked-Piece Skill Moves
  if (activeSkillId === 'march' && piece.type === 'p') {
    const dir = turn === 'w' ? 1 : -1;
    const step1 = toSquare(f, r + dir);
    const step2 = toSquare(f, r + dir * 2);
    if (step1 && step2 && !chess.get(step1) && !chess.get(step2) && !smokeSet.has(step1)) {
      tryAddCustomMove(step2, false);
    }
  } else if (activeSkillId === 'leap' && (piece.type === 'p' || piece.type === 'b')) {
    const offsets = [
      [1, 2],
      [2, 1],
      [-1, 2],
      [-2, 1],
      [1, -2],
      [2, -1],
      [-1, -2],
      [-2, -1],
    ];
    for (const [df, dr] of offsets) {
      const target = toSquare(f + df, r + dr);
      if (target && !chess.get(target)) {
        tryAddCustomMove(target, false);
      }
    }
  } else if (activeSkillId === 'diagonal_rook' && piece.type === 'r') {
    const dirs = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    for (const [df, dr] of dirs) {
      for (let dist = 1; dist < 8; dist++) {
        const target = toSquare(f + df * dist, r + dr * dist);
        if (!target || smokeSet.has(target)) break;
        const occupant = chess.get(target);
        if (!occupant) {
          tryAddCustomMove(target, false);
        } else {
          if (occupant.color !== turn) {
            tryAddCustomMove(target, true);
          }
          break;
        }
      }
    }
  } else if (activeSkillId === 'retreat' && piece.type !== 'k') {
    const backDir = turn === 'w' ? -1 : 1;
    for (const df of [-1, 0, 1]) {
      const target = toSquare(f + df, r + backDir);
      if (target && !chess.get(target)) {
        tryAddCustomMove(target, false);
      }
    }
  } else if (activeSkillId === 'bishop_shift' && piece.type === 'b') {
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [df, dr] of dirs) {
      const target = toSquare(f + df, r + dr);
      if (target && !chess.get(target)) {
        tryAddCustomMove(target, false);
      }
    }
  } else if (activeSkillId === 'camel_jump' && piece.type === 'n') {
    const offsets = [
      [1, 3],
      [3, 1],
      [-1, 3],
      [-3, 1],
      [1, -3],
      [3, -1],
      [-1, -3],
      [-3, -1],
    ];
    for (const [df, dr] of offsets) {
      const target = toSquare(f + df, r + dr);
      if (target) {
        tryAddCustomMove(target, true);
      }
    }
  } else if (
    activeSkillId === 'phantom_step' &&
    (piece.type === 'r' || piece.type === 'b' || piece.type === 'q')
  ) {
    const ortho = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    const diag = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    const dirs =
      piece.type === 'r' ? ortho : piece.type === 'b' ? diag : [...ortho, ...diag];

    for (const [df, dr] of dirs) {
      let jumpedCount = 0;
      for (let dist = 1; dist < 8; dist++) {
        const target = toSquare(f + df * dist, r + dr * dist);
        if (!target || smokeSet.has(target)) break;
        const occupant = chess.get(target);
        if (jumpedCount === 0) {
          if (occupant) jumpedCount = 1;
          continue;
        }
        if (!occupant) {
          tryAddCustomMove(target, false);
        } else {
          if (occupant.color !== turn) {
            tryAddCustomMove(target, true);
          }
          break;
        }
      }
    }
  } else if (activeSkillId === 'great_attack' && piece.type === 'p') {
    // Keep standard pawn moves + diagonal captures intact, and ADD straight forward 1-square attack!
    const dir = turn === 'w' ? 1 : -1;
    const atkSq = toSquare(f, r + dir);
    if (atkSq) {
      const occ = chess.get(atkSq);
      if (occ && occ.color !== turn) {
        tryAddCustomMove(atkSq, true);
      }
    }
  } else if (activeSkillId === 'straight_bishop' && piece.type === 'b') {
    const ortho = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [df, dr] of ortho) {
      for (let dist = 1; dist < 8; dist++) {
        const target = toSquare(f + df * dist, r + dr * dist);
        if (!target || smokeSet.has(target)) break;
        const occupant = chess.get(target);
        if (!occupant) {
          tryAddCustomMove(target, false);
        } else {
          if (occupant.color !== turn) {
            tryAddCustomMove(target, true);
          }
          break;
        }
      }
    }
  } else if (activeSkillId === 'trojan_horse' && piece.type === 'r') {
    // Newly transformed Rook can move 1 square orthogonally (quiet or capture)
    const ortho = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [df, dr] of ortho) {
      const target = toSquare(f + df, r + dr);
      if (target) {
        tryAddCustomMove(target, true);
      }
    }
  } else if (activeSkillId === 'queens_gambit' && piece.type === 'q') {
    // Queen uses Knight L-jump moves (quiet or capture)
    const offsets = [
      [1, 2],
      [2, 1],
      [-1, 2],
      [-2, 1],
      [1, -2],
      [2, -1],
      [-1, -2],
      [-2, -1],
    ];
    for (const [df, dr] of offsets) {
      const target = toSquare(f + df, r + dr);
      if (target) {
        tryAddCustomMove(target, true);
      }
    }
  } else if (activeSkillId === 'pawn_surge' && piece.type === 'p') {
    // Pawn gains 1-square diagonal forward empty moves + 1-square horizontal empty moves
    const dir = turn === 'w' ? 1 : -1;
    const extraSquares = [
      toSquare(f - 1, r + dir),
      toSquare(f + 1, r + dir),
      toSquare(f - 1, r),
      toSquare(f + 1, r),
    ];
    for (const target of extraSquares) {
      if (target && !chess.get(target)) {
        tryAddCustomMove(target, false);
      }
    }
  } else if (activeSkillId === 'knight_sweep' && piece.type === 'n') {
    // Knight moves/captures within all 8 surrounding 1-square neighbors
    for (let df = -1; df <= 1; df++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (df === 0 && dr === 0) continue;
        const target = toSquare(f + df, r + dr);
        if (target) {
          tryAddCustomMove(target, true);
        }
      }
    }
  } else if (activeSkillId === 'royal_dash' && piece.type === 'k') {
    // King gains 2-square dash onto empty square if intermediate 1-square step is empty & not smoked
    for (let df = -1; df <= 1; df++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (df === 0 && dr === 0) continue;
        const step1 = toSquare(f + df, r + dr);
        const step2 = toSquare(f + df * 2, r + dr * 2);
        if (
          step1 &&
          step2 &&
          !chess.get(step1) &&
          !smokeSet.has(step1) &&
          !chess.get(step2)
        ) {
          tryAddCustomMove(step2, false);
        }
      }
    }
  } else if (activeSkillId === 'alfil_leap' && piece.type === 'n') {
    // Knight gains Alfil 2-square diagonal leap (quiet or capture, jumping intermediate square)
    const offsets = [
      [2, 2],
      [2, -2],
      [-2, 2],
      [-2, -2],
    ];
    for (const [df, dr] of offsets) {
      const target = toSquare(f + df, r + dr);
      if (target) {
        tryAddCustomMove(target, true);
      }
    }
  } else if (activeSkillId === 'vanguard_lance' && piece.type === 'p') {
    // Pawn can pierce-capture enemy 1 square straight ahead, or 2 squares ahead if 1-sq step is clear
    const dir = turn === 'w' ? 1 : -1;
    const step1 = toSquare(f, r + dir);
    if (step1) {
      const occ1 = chess.get(step1);
      if (occ1) {
        if (occ1.color !== turn) {
          tryAddCustomMove(step1, true);
        }
      } else if (!smokeSet.has(step1)) {
        const step2 = toSquare(f, r + dir * 2);
        if (step2) {
          const occ2 = chess.get(step2);
          if (occ2 && occ2.color !== turn) {
            tryAddCustomMove(step2, true);
          }
        }
      }
    }
  } else if (activeSkillId === 'center_drop' && (piece.type === 'b' || piece.type === 'n')) {
    // Bishop or Knight can teleport to any empty central 4 square (d4, d5, e4, e5)
    for (const cSq of ['d4', 'd5', 'e4', 'e5'] as Square[]) {
      if (!chess.get(cSq)) {
        tryAddCustomMove(cSq, false);
      }
    }
  }

  if (isBound) {
    return results.filter((m) => {
      const tp = parseSquare(m.to);
      return Math.max(Math.abs(tp.f - f), Math.abs(tp.r - r)) <= 1;
    });
  }

  return results;
}

export function getAllLegalMovesWithSkills(
  chess: Chess,
  skillState: SkillMatchState | null
): AugmentedMove[] {
  const turn = chess.turn() as PieceColor;
  const board = chess.board();
  const all: AugmentedMove[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === turn) {
        const sq = `${FILES[c]}${RANKS[7 - r]}` as Square;
        all.push(...getSkillAugmentedMovesForSquare(chess, skillState, sq));
      }
    }
  }
  return all;
}

export function getRevivablePieceType(
  chess: Chess,
  color: PieceColor,
  pawnOnly = false
): PieceType | null {
  const board = chess.board();
  const alive: Record<PieceType, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color) alive[p.type]++;
    }
  }
  if (!pawnOnly) {
    if (alive.b < 2) return 'b';
    if (alive.n < 2) return 'n';
  }
  if (alive.p < 8) return 'p';
  return null;
}

function getSnipeTargetsFromBishop(
  chess: Chess,
  color: PieceColor,
  bishopSquare: Square,
  smokeSet: Set<string>,
  shieldedEnemySet: Set<string>,
  frozenEnemySet: Set<string>
): Square[] {
  const p = chess.get(bishopSquare);
  if (!p || p.color !== color || p.type !== 'b') return [];

  const found: Square[] = [];
  const pos = parseSquare(bishopSquare);
  const diag = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];

  for (const [df, dr] of diag) {
    for (let dist = 1; dist < 8; dist++) {
      const target = toSquare(pos.f + df * dist, pos.r + dr * dist);
      if (!target || smokeSet.has(target)) break;
      const occ = chess.get(target);
      if (!occ) continue;
      // Friendly pieces are ignored along the diagonal snipe ray!
      if (occ.color === color) continue;
      // Closest enemy piece along this diagonal
      if (
        occ.type !== 'k' &&
        !shieldedEnemySet.has(target) &&
        !frozenEnemySet.has(target)
      ) {
        found.push(target);
      }
      break;
    }
  }

  return found;
}

export function getEligibleSkillTargets(
  chess: Chess,
  skillState: SkillMatchState,
  skillId: SkillId,
  color: PieceColor,
  stepSquare: string | null = null
): Square[] {
  if (skillState.augmentPhase) return [];

  const board = chess.board();
  const smokeSet = new Set(skillState.effects.smoke.map((s) => s.square));
  const frozenSet = new Set(
    skillState.effects.frozen.filter((f) => f.color === color).map((f) => f.square)
  );
  const frozenEnemySet = new Set(
    skillState.effects.frozen.filter((f) => f.color !== color).map((f) => f.square)
  );
  const shieldedEnemySet = new Set(
    skillState.effects.shielded.filter((s) => s.color !== color).map((s) => s.square)
  );
  const targets: Square[] = [];

  if (skillId === 'tactical_jam' || skillId === 'arcane_tome') {
    // Allow clicking any square on own bottom-most rank (or instant button)
    const homeRank = color === 'w' ? '1' : '8';
    return FILES.map((file) => `${file}${homeRank}` as Square);
  }

  if (skillId === 'mana_drain') {
    const enemyColor: PieceColor = color === 'w' ? 'b' : 'w';
    if (skillState[enemyColor].mana < 1) return [];
    const homeRank = color === 'w' ? '1' : '8';
    return FILES.map((file) => `${file}${homeRank}` as Square);
  }

  if (skillId === 'purify') {
    const disarmedSet = new Set(
      skillState.effects.disarmed.filter((d) => d.color === color).map((d) => d.square)
    );
    const boundOwnSet = new Set(
      (skillState.effects.bound || []).filter((b) => b.color === color).map((b) => b.square)
    );
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p || p.color !== color) continue;
        const sq = `${FILES[c]}${RANKS[7 - r]}` as Square;
        if (frozenSet.has(sq) || disarmedSet.has(sq) || boundOwnSet.has(sq)) {
          targets.push(sq);
        }
      }
    }
    return targets;
  }

  if (skillId === 'royal_escape') {
    let kingSq: Square | null = null;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.color === color && p.type === 'k') {
          kingSq = `${FILES[c]}${RANKS[7 - r]}` as Square;
        }
      }
    }
    if (!kingSq || frozenSet.has(kingSq)) return [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.color === color && p.type === 'r') {
          const rookSq = `${FILES[c]}${RANKS[7 - r]}` as Square;
          if (frozenSet.has(rookSq)) continue;
          const temp = new Chess(chess.fen());
          temp.put({ type: 'r', color }, kingSq);
          temp.put({ type: 'k', color }, rookSq);
          if (isKingSafeAfterBoardEdit(temp, color)) {
            targets.push(rookSq);
          }
        }
      }
    }
    return targets;
  }

  if (skillId === 'shield') {
    const allowedRanks = color === 'w' ? ['1', '2', '3', '4'] : ['5', '6', '7', '8'];
    const ownZoneSet = new Set(
      (skillState.effects.shieldZones || [])
        .filter((z) => z.color === color)
        .map((z) => z.square)
    );
    const ownUntilMovedShieldSet = new Set(
      skillState.effects.shielded
        .filter((s) => s.color === color && Boolean(s.untilMoved))
        .map((s) => s.square)
    );
    for (const rank of allowedRanks) {
      for (const file of FILES) {
        const sq = `${file}${rank}` as Square;
        if (smokeSet.has(sq) || ownZoneSet.has(sq)) continue;
        const occ = chess.get(sq);
        if (occ && occ.color !== color) continue;
        if (occ && occ.color === color && occ.type === 'k') continue;
        if (ownUntilMovedShieldSet.has(sq)) continue;
        targets.push(sq);
      }
    }
    return targets;
  }

  if (skillId === 'smoke') {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (!board[r][c]) {
          const sq = `${FILES[c]}${RANKS[7 - r]}` as Square;
          if (!smokeSet.has(sq)) targets.push(sq);
        }
      }
    }
    return targets;
  }

  if (skillId === 'revive') {
    if (countFriendlyPieces(chess, color, 'n') >= 2) return [];
    // Bottom-most rank ONLY (rank '1' for White, '8' for Black)
    const homeRank = color === 'w' ? '1' : '8';
    for (const file of FILES) {
      const sq = `${file}${homeRank}` as Square;
      if (!chess.get(sq) && !smokeSet.has(sq)) {
        targets.push(sq);
      }
    }
    return targets;
  }

  if (skillId === 'pawn_guard') {
    const revivable = getRevivablePieceType(chess, color, true);
    if (!revivable) return [];
    let kingSq: Square | null = null;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.color === color && p.type === 'k') {
          kingSq = `${FILES[c]}${RANKS[7 - r]}` as Square;
        }
      }
    }
    if (!kingSq) return [];
    const kp = parseSquare(kingSq);
    for (let df = -1; df <= 1; df++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (df === 0 && dr === 0) continue;
        const sq = toSquare(kp.f + df, kp.r + dr);
        if (sq && !chess.get(sq) && !smokeSet.has(sq)) {
          targets.push(sq);
        }
      }
    }
    return targets;
  }

  if (skillId === 'snipe') {
    if (!stepSquare) {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c];
          if (p && p.color === color && p.type === 'b') {
            const sq = `${FILES[c]}${RANKS[7 - r]}` as Square;
            if (frozenSet.has(sq)) continue;
            const enemies = getSnipeTargetsFromBishop(
              chess,
              color,
              sq,
              smokeSet,
              shieldedEnemySet,
              frozenEnemySet
            );
            if (enemies.length > 0) {
              targets.push(sq);
            }
          }
        }
      }
      return targets;
    }
    return getSnipeTargetsFromBishop(
      chess,
      color,
      stepSquare as Square,
      smokeSet,
      shieldedEnemySet,
      frozenEnemySet
    );
  }

  if (skillId === 'freeze' || skillId === 'disarm' || skillId === 'shadow_bind') {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.color !== color && p.type !== 'k') {
          targets.push(`${FILES[c]}${RANKS[7 - r]}` as Square);
        }
      }
    }
    return targets;
  }

  if (skillId === 'field_promotion') {
    const allowedRanks = color === 'w' ? ['5', '6', '7'] : ['4', '3', '2'];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p || p.color !== color || p.type !== 'p') continue;
        const sq = `${FILES[c]}${RANKS[7 - r]}` as Square;
        if (!allowedRanks.includes(sq[1]) || frozenSet.has(sq)) continue;
        const temp = new Chess(chess.fen());
        temp.put({ type: 'b', color }, sq);
        if (isKingSafeAfterBoardEdit(temp, color)) {
          targets.push(sq);
        }
      }
    }
    return targets;
  }

  if (skillId === 'swap') {
    // Only non-Pawn, non-King friendly pieces (q, r, b, n)
    const eligiblePieces: Square[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.color === color && p.type !== 'k' && p.type !== 'p') {
          const sq = `${FILES[c]}${RANKS[7 - r]}` as Square;
          if (!frozenSet.has(sq)) eligiblePieces.push(sq);
        }
      }
    }
    if (!stepSquare) {
      return eligiblePieces.length >= 2 ? eligiblePieces : [];
    }
    const p1 = chess.get(stepSquare as Square);
    if (!p1 || p1.type === 'p' || p1.type === 'k') return [];
    for (const sq2 of eligiblePieces) {
      if (sq2 === stepSquare) continue;
      const p2 = chess.get(sq2);
      if (!p2) continue;
      const temp = new Chess(chess.fen());
      temp.put({ type: p2.type, color }, stepSquare as Square);
      temp.put({ type: p1.type, color }, sq2);
      if (isKingSafeAfterBoardEdit(temp, color)) {
        targets.push(sq2);
      }
    }
    return targets;
  }

  if (skillId === 'queens_gambit' && chess.inCheck()) {
    return [];
  }

  // Piece-buff / movement-replacement skills
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== color) continue;
      const sq = `${FILES[c]}${RANKS[7 - r]}` as Square;
      if (frozenSet.has(sq)) continue;

      if ((skillId === 'march' || skillId === 'great_attack' || skillId === 'pawn_surge' || skillId === 'vanguard_lance') && p.type !== 'p') continue;
      if (skillId === 'leap' && p.type !== 'p' && p.type !== 'b') continue;
      if (skillId === 'diagonal_rook' && p.type !== 'r') continue;
      if ((skillId === 'bishop_shift' || skillId === 'straight_bishop') && p.type !== 'b') continue;
      if ((skillId === 'camel_jump' || skillId === 'trojan_horse' || skillId === 'knight_sweep' || skillId === 'alfil_leap') && p.type !== 'n') continue;
      if (skillId === 'center_drop' && p.type !== 'b' && p.type !== 'n') continue;
      if (skillId === 'phantom_step' && p.type !== 'r' && p.type !== 'b' && p.type !== 'q') continue;
      if (skillId === 'queens_gambit' && p.type !== 'q') continue;
      if (skillId === 'royal_dash' && p.type !== 'k') continue;
      if (skillId === 'retreat' && p.type === 'k') continue;

      const simChess = new Chess(chess.fen());
      if (skillId === 'trojan_horse') {
        simChess.put({ type: 'r', color }, sq);
      }

      const simulatedState: SkillMatchState = {
        ...skillState,
        activeCast: {
          skillId,
          cardUid: 'preview',
          lockedPieceSquare: sq,
          swapFirstSquare: null,
          snipeBishopSquare: null,
        },
      };
      const moves = getSkillAugmentedMovesForSquare(simChess, simulatedState, sq);
      if (moves.length > 0) {
        targets.push(sq);
      }
    }
  }

  return targets;
}

function advanceTurnSkillBookkeeping(
  skillState: SkillMatchState,
  endedTurnOf: PieceColor,
  nextTurn: PieceColor,
  totalMovesAfter: number
) {
  skillState.effects.shielded = skillState.effects.shielded.filter(
    (s) => Boolean(s.untilMoved) || s.expiresAfterTurnOf !== endedTurnOf
  );
  skillState.effects.frozen = skillState.effects.frozen.filter(
    (f) => f.expiresAfterTurnOf !== endedTurnOf
  );
  skillState.effects.smoke = skillState.effects.smoke.filter(
    (s) => s.expiresAfterTurnOf !== endedTurnOf
  );
  skillState.effects.bound = (skillState.effects.bound || []).filter(
    (b) => b.expiresAfterTurnOf !== endedTurnOf
  );

  // Disarm lasts 2 turns of the disarmed piece's owner
  skillState.effects.disarmed = skillState.effects.disarmed
    .map((d) =>
      d.color === endedTurnOf ? { ...d, remainingTurns: d.remainingTurns - 1 } : d
    )
    .filter((d) => d.remainingTurns > 0);

  // Tactical Jam veils the caster's back rank for 2 opponent turns
  skillState.effects.veiledRanks = (skillState.effects.veiledRanks || [])
    .map((v) =>
      v.ownerColor !== endedTurnOf ? { ...v, remainingTurns: v.remainingTurns - 1 } : v
    )
    .filter((v) => v.remainingTurns > 0);

  // Slow Starter Augment milestones (20 ply & 50 ply) for BOTH players
  for (const col of ['w', 'b'] as PieceColor[]) {
    if (skillState[col].augment === 'late_bloom') {
      const cap = getMaxMana(skillState, col);
      if (totalMovesAfter >= 20 && !skillState[col].milestone20Claimed) {
        skillState[col].milestone20Claimed = true;
        skillState[col].mana = Math.min(cap, skillState[col].mana + 1);
        emitAugmentFx(skillState, 'late_bloom', col, '20수 도달 · +1 MP');
      }
      if (totalMovesAfter >= 50 && !skillState[col].milestone50Claimed) {
        skillState[col].milestone50Claimed = true;
        skillState[col].mana = Math.min(cap, skillState[col].mana + 3);
        emitAugmentFx(skillState, 'late_bloom', col, '50수 도달 · +3 MP');
      }
    }
  }

  skillState.activeCast = null;
  skillState[endedTurnOf].usedOrDiscardedThisTurn = false;
  skillState[nextTurn].usedOrDiscardedThisTurn = false;

  if (totalMovesAfter >= 2) {
    skillState[nextTurn].mana = Math.min(
      getMaxMana(skillState, nextTurn),
      skillState[nextTurn].mana + 1
    );
  }
}

export function applyBoardMoveWithSkills(
  chess: Chess,
  skillState: SkillMatchState | null,
  from: string,
  to: string,
  promotion: PieceType | undefined,
  currentMoveCount: number
): { moveRecord: MoveRecord; nextSkillState: SkillMatchState | null } | null {
  if (skillState?.augmentPhase) return null;

  const turn = chess.turn() as PieceColor;
  if (skillState?.[turn]?.pendingSkillDraft && skillState[turn].pendingSkillDraft!.length > 0) {
    return null;
  }
  const fromSq = from as Square;
  const toSq = to as Square;
  const legal = getSkillAugmentedMovesForSquare(chess, skillState, fromSq);
  const matched = legal.find(
    (m) =>
      m.to === to &&
      (m.isSkillAugmented || !m.promotion || !promotion || m.promotion === promotion)
  );
  if (!matched) return null;

  const movingPieceBefore = chess.get(fromSq);
  const usedSkillId = skillState?.activeCast?.skillId;
  let capturedPiece: PieceType | undefined = matched.captured;
  let san = matched.san;
  let flags = matched.flags;
  let actualPromotion = matched.promotion;

  if (!matched.isSkillAugmented) {
    const executed = chess.move({
      from: fromSq,
      to: toSq,
      promotion: promotion as PieceSymbol | undefined,
    });
    if (!executed) return null;
    capturedPiece = executed.captured as PieceType | undefined;
    san = executed.san;
    flags = executed.flags;
    actualPromotion = executed.promotion as PieceType | undefined;
  } else {
    if (!movingPieceBefore) return null;
    const willPromote =
      movingPieceBefore.type === 'p' &&
      ((turn === 'w' && to[1] === '8') || (turn === 'b' && to[1] === '1'));
    const nextType: PieceSymbol = willPromote
      ? ((promotion || 'q') as PieceSymbol)
      : movingPieceBefore.type;
    actualPromotion = willPromote ? ((promotion || 'q') as PieceType) : undefined;
    if (willPromote) {
      san = san.replace('=Q', `=${nextType.toUpperCase()}`);
    }

    chess.remove(fromSq);
    chess.put({ type: nextType, color: turn }, toSq);
    let nextFen = stripCastlingRight(
      chess.fen(),
      from,
      to,
      turn,
      movingPieceBefore.type as PieceType
    );
    const nextTurn: PieceColor = turn === 'w' ? 'b' : 'w';
    nextFen = flipFenTurn(nextFen, nextTurn, true);
    chess.load(nextFen);
    if (chess.inCheck() && !san.includes('+')) {
      san = chess.isCheckmate() ? `${san}#` : `${san}+`;
    }
  }

  let nextSkillState: SkillMatchState | null = null;
  if (skillState) {
    nextSkillState = cloneSkillState(skillState);
    // Until-moved shields expire as soon as that shielded piece itself moves; temporary 1-turn shields move with piece
    nextSkillState.effects.shielded = nextSkillState.effects.shielded.filter(
      (sh) => !(sh.square === from && sh.color === turn && sh.untilMoved)
    );
    for (const sh of nextSkillState.effects.shielded) {
      if (sh.square === from && sh.color === turn) {
        sh.square = to;
      }
    }
    // Check if a friendly non-King piece entered a friendly Shield Zone!
    if (movingPieceBefore?.type !== 'k' && nextSkillState.effects.shieldZones) {
      const zoneIdx = nextSkillState.effects.shieldZones.findIndex(
        (z) => z.square === to && z.color === turn
      );
      if (zoneIdx >= 0) {
        nextSkillState.effects.shieldZones.splice(zoneIdx, 1);
        nextSkillState.effects.shielded = nextSkillState.effects.shielded.filter(
          (sh) => !(sh.square === to && sh.color === turn)
        );
        nextSkillState.effects.shielded.push({
          square: to,
          color: turn,
          expiresAfterTurnOf: turn === 'w' ? 'b' : 'w',
          untilMoved: true,
        });
        const vfxSeq = (nextSkillState.lastVfx?.seq || 0) + 1;
        nextSkillState.lastVfx = {
          seq: vfxSeq,
          skillId: 'shield',
          square: to,
          color: turn,
        };
      }
    }
    for (const d of nextSkillState.effects.disarmed) {
      if (d.square === from && d.color === turn) {
        d.square = to;
      }
    }
    for (const b of nextSkillState.effects.bound || []) {
      if (b.square === from && b.color === turn) {
        b.square = to;
      }
    }

    const aug = nextSkillState[turn].augment;
    const myMaxMana = getMaxMana(nextSkillState, turn);

    // Passive augment move VFX (double_pawn_march, knight_step, holy_bishop)
    if (matched.isSkillAugmented && !usedSkillId) {
      if (aug === 'double_pawn_march' && movingPieceBefore?.type === 'p') {
        emitAugmentFx(nextSkillState, 'double_pawn_march', turn, '이중 행군 · 2칸 전진', to);
      } else if (aug === 'knight_step' && movingPieceBefore?.type === 'n') {
        emitAugmentFx(nextSkillState, 'knight_step', turn, '메가나이트 · 상하좌우 이동', to);
      } else if (aug === 'holy_bishop' && movingPieceBefore?.type === 'b') {
        emitAugmentFx(nextSkillState, 'holy_bishop', turn, '신성 강화 · 상하좌우 이동', to);
      }
    }

    // Defender gains +1 MP when their piece is captured
    if (capturedPiece) {
      const victim: PieceColor = turn === 'w' ? 'b' : 'w';
      const capSq = flags.includes('e')
        ? `${to[0]}${turn === 'w' ? String(Number(to[1]) - 1) : String(Number(to[1]) + 1)}`
        : to;
      nextSkillState.effects.disarmed = nextSkillState.effects.disarmed.filter(
        (d) => !(d.square === capSq && d.color === victim)
      );
      if (nextSkillState.effects.bound) {
        nextSkillState.effects.bound = nextSkillState.effects.bound.filter(
          (b) => !(b.square === capSq && b.color === victim)
        );
      }
      nextSkillState[victim].mana = Math.min(
        getMaxMana(nextSkillState, victim),
        nextSkillState[victim].mana + 1
      );
      const manaSeq = (nextSkillState.lastCaptureMana?.seq || 0) + 1;
      nextSkillState.lastCaptureMana = {
        seq: manaSeq,
        square: to,
        color: victim,
        amount: 1,
      };

      // Mana Siphon augment (+1 MP on capturing enemy piece, max 3 times)
      if (aug === 'mana_siphon' && (nextSkillState[turn].siphonUsed || 0) < 3) {
        nextSkillState[turn].siphonUsed = (nextSkillState[turn].siphonUsed || 0) + 1;
        nextSkillState[turn].mana = Math.min(myMaxMana, nextSkillState[turn].mana + 1);
        emitAugmentFx(
          nextSkillState,
          'mana_siphon',
          turn,
          `처치 마나 흡수 +1 MP (${nextSkillState[turn].siphonUsed}/3)`,
          to
        );
      }
    }

    // Castle Vault augment (+2 MP on castling)
    if (aug === 'castle_vault' && (flags.includes('k') || flags.includes('q'))) {
      nextSkillState[turn].mana = Math.min(myMaxMana, nextSkillState[turn].mana + 2);
      emitAugmentFx(nextSkillState, 'castle_vault', turn, '캐슬링 금고 개방 · +2 MP', to);
    }

    // Forward Aura augment (+1 MP when pawn first crosses center line)
    if (aug === 'forward_aura' && movingPieceBefore?.type === 'p') {
      const fromRank = Number(from[1]);
      const toRank = Number(to[1]);
      const crossed =
        (turn === 'w' && fromRank <= 4 && toRank >= 5) ||
        (turn === 'b' && fromRank >= 5 && toRank <= 4);
      if (crossed) {
        nextSkillState[turn].mana = Math.min(myMaxMana, nextSkillState[turn].mana + 1);
        emitAugmentFx(nextSkillState, 'forward_aura', turn, '중앙선 돌파 · +1 MP', to);
      }
    }

    // Veteran Pawn augment (+2 MP & draw 1 card once on reaching rank 7/2)
    if (
      aug === 'veteran_pawn' &&
      movingPieceBefore?.type === 'p' &&
      !nextSkillState[turn].veteranPawnClaimed
    ) {
      const targetRank = turn === 'w' ? '7' : '2';
      if (to[1] === targetRank) {
        nextSkillState[turn].veteranPawnClaimed = true;
        nextSkillState[turn].mana = Math.min(myMaxMana, nextSkillState[turn].mana + 2);
        drawOneIntoHand(nextSkillState[turn], getHandLimit(nextSkillState, turn));
        emitAugmentFx(nextSkillState, 'veteran_pawn', turn, '전선 돌파 · +2 MP & 카드 +1', to);
      }
    }

    // Royal Guard augment (+1 MP on manual non-castling King move, max 3 times)
    if (
      aug === 'royal_guard' &&
      movingPieceBefore?.type === 'k' &&
      !flags.includes('k') &&
      !flags.includes('q') &&
      (nextSkillState[turn].kingManaUsed || 0) < 3
    ) {
      nextSkillState[turn].kingManaUsed = (nextSkillState[turn].kingManaUsed || 0) + 1;
      nextSkillState[turn].mana = Math.min(myMaxMana, nextSkillState[turn].mana + 1);
      emitAugmentFx(
        nextSkillState,
        'royal_guard',
        turn,
        `왕실 호위 +1 MP (${nextSkillState[turn].kingManaUsed}/3)`,
        to
      );
    }

    // Iron Castle augment (shield Rook on move/castling, max 2 times)
    if (aug === 'iron_castle' && (nextSkillState[turn].ironCastleUsed || 0) < 2) {
      const isCastling = flags.includes('k') || flags.includes('q');
      const rookSq =
        movingPieceBefore?.type === 'r'
          ? to
          : isCastling
          ? `${flags.includes('k') ? 'f' : 'd'}${turn === 'w' ? '1' : '8'}`
          : null;
      if (rookSq) {
        nextSkillState[turn].ironCastleUsed = (nextSkillState[turn].ironCastleUsed || 0) + 1;
        nextSkillState.effects.shielded.push({
          square: rookSq,
          color: turn,
          expiresAfterTurnOf: turn === 'w' ? 'b' : 'w',
        });
        emitAugmentFx(
          nextSkillState,
          'iron_castle',
          turn,
          `철옹성 보호막 부여 (${nextSkillState[turn].ironCastleUsed}/2)`,
          rookSq
        );
      }
    }

    // Check Press augment (+1 MP on check, up to 3 times)
    if (aug === 'check_press' && chess.inCheck() && nextSkillState[turn].checkBonusUsed < 3) {
      nextSkillState[turn].checkBonusUsed++;
      nextSkillState[turn].mana = Math.min(myMaxMana, nextSkillState[turn].mana + 1);
      emitAugmentFx(
        nextSkillState,
        'check_press',
        turn,
        `체크 압박 +1 MP (${nextSkillState[turn].checkBonusUsed}/3)`,
        to
      );
    }

    const nextTurn = chess.turn() as PieceColor;
    advanceTurnSkillBookkeeping(nextSkillState, turn, nextTurn, currentMoveCount + 1);
  }

  const ply = currentMoveCount + 1;
  const moveRecord: MoveRecord = {
    ply,
    moveNumber: Math.ceil(ply / 2),
    color: turn,
    san,
    from,
    to,
    captured: capturedPiece,
    promotion: actualPromotion,
    flags,
    skillUsed: usedSkillId,
  };

  return { moveRecord, nextSkillState };
}

export function discardSkillCardToTrash(
  skillState: SkillMatchState,
  color: PieceColor,
  cardUid: string
): SkillMatchState | null {
  if (skillState.augmentPhase) return null;
  const player = skillState[color];
  if (player.pendingSkillDraft && player.pendingSkillDraft.length > 0) return null;
  if (player.usedOrDiscardedThisTurn || skillState.activeCast) return null;
  const idx = player.hand.findIndex((c) => c.uid === cardUid);
  if (idx === -1) return null;

  const next = cloneSkillState(skillState);
  next[color].hand.splice(idx, 1);
  const gain = next[color].augment === 'recycle_pro' ? 2 : 1;
  next[color].mana = Math.min(getMaxMana(next, color), next[color].mana + gain);
  next[color].usedOrDiscardedThisTurn = true;
  if (next[color].augment === 'recycle_pro') {
    emitAugmentFx(next, 'recycle_pro', color, '재활용 달인 · +2 MP 획득');
  }

  // Swift Recovery augment: every 3rd discard draws 1 free skill card
  if (next[color].augment === 'swift_recovery') {
    const nextCount = (next[color].discardCycleCount || 0) + 1;
    next[color].discardCycleCount = nextCount;
    if (nextCount % 3 === 0) {
      const drew = drawOneIntoHand(next[color], getHandLimit(next, color));
      if (drew) {
        emitAugmentFx(next, 'swift_recovery', color, '신속한 정비 · 무료 스킬 1장 획득');
      }
    }
  }

  return next;
}

export function applySkillTargetAction(
  chess: Chess,
  skillState: SkillMatchState,
  color: PieceColor,
  cardUid: string,
  targetSquare: string,
  currentMoveCount: number
): {
  nextSkillState: SkillMatchState;
  endedTurn: boolean;
  moveRecord?: MoveRecord;
} | null {
  if (skillState.augmentPhase) return null;
  const player = skillState[color];
  if (player.pendingSkillDraft && player.pendingSkillDraft.length > 0) return null;
  if (player.usedOrDiscardedThisTurn || skillState.activeCast) return null;

  const cardIdx = player.hand.findIndex((c) => c.uid === cardUid);
  if (cardIdx === -1) return null;
  const card = player.hand[cardIdx];
  const def = SKILL_DEFINITIONS[card.skillId];
  const cost = getEffectiveSkillCost(skillState, color, def.id);
  if (player.mana < cost) return null;

  if (def.id === 'queens_gambit' && chess.inCheck()) return null;

  const eligible = getEligibleSkillTargets(chess, skillState, def.id, color, null);
  if (!eligible.includes(targetSquare as Square)) return null;

  const next = cloneSkillState(skillState);
  const vfxSeq = (next.lastVfx?.seq || 0) + 1;

  if (def.id === 'swap') {
    next.activeCast = {
      skillId: 'swap',
      cardUid,
      lockedPieceSquare: null,
      swapFirstSquare: targetSquare,
      snipeBishopSquare: null,
    };
    return { nextSkillState: next, endedTurn: false };
  }

  if (def.id === 'snipe') {
    next.activeCast = {
      skillId: 'snipe',
      cardUid,
      lockedPieceSquare: null,
      swapFirstSquare: null,
      snipeBishopSquare: targetSquare,
    };
    return { nextSkillState: next, endedTurn: false };
  }

  // Consume card and mana (+ First Refund / Arcane Surge augment check)
  const capMana = getMaxMana(next, color);
  next[color].mana -= cost;
  if (next[color].augment === 'first_refund' && !next[color].firstRefundUsed) {
    next[color].firstRefundUsed = true;
    const refunded = Math.min(2, cost);
    next[color].mana = Math.min(capMana, next[color].mana + refunded);
    emitAugmentFx(next, 'first_refund', color, `첫 스킬 마나 +${refunded} MP 환급`, targetSquare);
  }
  if (
    next[color].augment === 'arcane_surge' &&
    cost >= 4 &&
    (next[color].surgeUsed || 0) < 3
  ) {
    next[color].surgeUsed = (next[color].surgeUsed || 0) + 1;
    next[color].mana = Math.min(capMana, next[color].mana + 1);
    emitAugmentFx(
      next,
      'arcane_surge',
      color,
      `마력 역류 +1 MP (${next[color].surgeUsed}/3)`,
      targetSquare
    );
  }
  next[color].hand.splice(cardIdx, 1);
  next[color].usedOrDiscardedThisTurn = true;
  const enemy: PieceColor = color === 'w' ? 'b' : 'w';

  if (def.turnBehavior === 'lock_piece_move') {
    if (def.id === 'trojan_horse') {
      const targetPiece = chess.get(targetSquare as Square);
      if (!targetPiece || targetPiece.color !== color || targetPiece.type !== 'n') return null;
      chess.put({ type: 'r', color }, targetSquare as Square);
    }
    next.activeCast = {
      skillId: def.id,
      cardUid,
      lockedPieceSquare: targetSquare,
      swapFirstSquare: null,
      snipeBishopSquare: null,
    };
    next.lastVfx = { seq: vfxSeq, skillId: def.id, square: targetSquare, color };
    return { nextSkillState: next, endedTurn: false };
  }

  if (def.id === 'shield') {
    const occ = chess.get(targetSquare as Square);
    if (occ && occ.color === color && occ.type !== 'k') {
      next.effects.shielded = next.effects.shielded.filter(
        (s) => !(s.square === targetSquare && s.color === color)
      );
      next.effects.shielded.push({
        square: targetSquare,
        color,
        expiresAfterTurnOf: enemy,
        untilMoved: true,
      });
    } else {
      if (!next.effects.shieldZones) next.effects.shieldZones = [];
      next.effects.shieldZones.push({
        square: targetSquare,
        color,
      });
    }
    next.lastVfx = { seq: vfxSeq, skillId: 'shield', square: targetSquare, color };
    return { nextSkillState: next, endedTurn: false };
  }

  if (def.id === 'smoke') {
    next.effects.smoke.push({
      square: targetSquare,
      expiresAfterTurnOf: enemy,
    });
    next.lastVfx = { seq: vfxSeq, skillId: 'smoke', square: targetSquare, color };
    return { nextSkillState: next, endedTurn: false };
  }

  if (def.id === 'freeze') {
    next.effects.frozen.push({
      square: targetSquare,
      color: enemy,
      expiresAfterTurnOf: enemy,
    });
    next.lastVfx = { seq: vfxSeq, skillId: 'freeze', square: targetSquare, color };
    return { nextSkillState: next, endedTurn: false };
  }

  if (def.id === 'shadow_bind') {
    if (!next.effects.bound) next.effects.bound = [];
    next.effects.bound.push({
      square: targetSquare,
      color: enemy,
      expiresAfterTurnOf: enemy,
    });
    next.lastVfx = { seq: vfxSeq, skillId: 'shadow_bind', square: targetSquare, color };
    return { nextSkillState: next, endedTurn: false };
  }

  if (def.id === 'disarm') {
    next.effects.disarmed.push({
      square: targetSquare,
      color: enemy,
      remainingTurns: 2,
    });
    next.lastVfx = { seq: vfxSeq, skillId: 'disarm', square: targetSquare, color };
    return { nextSkillState: next, endedTurn: false };
  }

  if (def.id === 'mana_drain') {
    const drainAmount = Math.min(2, next[enemy].mana);
    next[enemy].mana = Math.max(0, next[enemy].mana - drainAmount);
    next[color].mana = Math.min(capMana, next[color].mana + drainAmount);
    const homeRank: '1' | '8' = color === 'w' ? '1' : '8';
    next.lastVfx = {
      seq: vfxSeq,
      skillId: 'mana_drain',
      square: `e${homeRank}`,
      color,
    };
    return { nextSkillState: next, endedTurn: false };
  }

  if (def.id === 'tactical_jam') {
    const homeRank: '1' | '8' = color === 'w' ? '1' : '8';
    const existing = next.effects.veiledRanks.findIndex(
      (v) => v.rank === homeRank && v.ownerColor === color
    );
    if (existing >= 0) {
      next.effects.veiledRanks[existing].remainingTurns = 2;
    } else {
      next.effects.veiledRanks.push({
        rank: homeRank,
        ownerColor: color,
        remainingTurns: 2,
      });
    }
    next.lastVfx = {
      seq: vfxSeq,
      skillId: 'tactical_jam',
      square: `e${homeRank}`,
      color,
    };
    return { nextSkillState: next, endedTurn: false };
  }

  if (def.id === 'field_promotion') {
    const p = chess.get(targetSquare as Square);
    if (!p || p.color !== color || p.type !== 'p') return null;
    chess.put({ type: 'b', color }, targetSquare as Square);
    const nextFen = flipFenTurn(chess.fen(), enemy, true);
    chess.load(nextFen);

    if (
      next[color].augment === 'check_press' &&
      chess.inCheck() &&
      next[color].checkBonusUsed < 3
    ) {
      next[color].checkBonusUsed++;
      next[color].mana = Math.min(capMana, next[color].mana + 1);
      emitAugmentFx(
        next,
        'check_press',
        color,
        `체크 압박 +1 MP (${next[color].checkBonusUsed}/3)`,
        targetSquare
      );
    }

    next.lastVfx = { seq: vfxSeq, skillId: 'field_promotion', square: targetSquare, color };
    advanceTurnSkillBookkeeping(next, color, enemy, currentMoveCount + 1);

    const ply = currentMoveCount + 1;
    return {
      nextSkillState: next,
      endedTurn: true,
      moveRecord: {
        ply,
        moveNumber: Math.ceil(ply / 2),
        color,
        san: `★임관 ${targetSquare}=B${chess.inCheck() ? '+' : ''}`,
        from: targetSquare,
        to: targetSquare,
        promotion: 'b',
        flags: 'skill',
        skillUsed: 'field_promotion',
      },
    };
  }

  if (def.id === 'revive' || def.id === 'pawn_guard') {
    const revType: PieceType | null =
      def.id === 'revive'
        ? countFriendlyPieces(chess, color, 'n') < 2
          ? 'n'
          : null
        : getRevivablePieceType(chess, color, true);
    if (!revType) return null;
    chess.put({ type: revType as PieceSymbol, color }, targetSquare as Square);
    const nextFen = flipFenTurn(chess.fen(), enemy, true);
    chess.load(nextFen);

    next.lastVfx = { seq: vfxSeq, skillId: def.id, square: targetSquare, color };
    advanceTurnSkillBookkeeping(next, color, enemy, currentMoveCount + 1);

    const ply = currentMoveCount + 1;
    const label = revType === 'b' ? 'B' : revType === 'n' ? 'N' : 'P';
    return {
      nextSkillState: next,
      endedTurn: true,
      moveRecord: {
        ply,
        moveNumber: Math.ceil(ply / 2),
        color,
        san: `★소환 ${label}${targetSquare}`,
        from: targetSquare,
        to: targetSquare,
        flags: 'skill',
        skillUsed: def.id,
      },
    };
  }

  if (def.id === 'arcane_tome') {
    const limit = getHandLimit(next, color);
    drawOneIntoHand(next[color], limit);
    drawOneIntoHand(next[color], limit);
    const homeRank: '1' | '8' = color === 'w' ? '1' : '8';
    next.lastVfx = {
      seq: vfxSeq,
      skillId: 'arcane_tome',
      square: `e${homeRank}`,
      color,
    };
    return { nextSkillState: next, endedTurn: false };
  }

  if (def.id === 'purify') {
    next.effects.frozen = next.effects.frozen.filter(
      (f) => !(f.square === targetSquare && f.color === color)
    );
    next.effects.disarmed = next.effects.disarmed.filter(
      (d) => !(d.square === targetSquare && d.color === color)
    );
    if (next.effects.bound) {
      next.effects.bound = next.effects.bound.filter(
        (b) => !(b.square === targetSquare && b.color === color)
      );
    }
    const alreadyShielded = next.effects.shielded.some(
      (s) => s.square === targetSquare && s.color === color
    );
    if (!alreadyShielded) {
      next.effects.shielded.push({
        square: targetSquare,
        color,
        expiresAfterTurnOf: enemy,
      });
    }
    next.lastVfx = { seq: vfxSeq, skillId: 'purify', square: targetSquare, color };
    return { nextSkillState: next, endedTurn: false };
  }

  if (def.id === 'royal_escape') {
    const board = chess.board();
    let kingSq: Square | null = null;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.color === color && p.type === 'k') {
          kingSq = `${FILES[c]}${RANKS[7 - r]}` as Square;
        }
      }
    }
    const rookPiece = chess.get(targetSquare as Square);
    if (!kingSq || !rookPiece || rookPiece.color !== color || rookPiece.type !== 'r') return null;

    chess.put({ type: 'r', color }, kingSq);
    chess.put({ type: 'k', color }, targetSquare as Square);
    const strippedFen = stripCastlingRight(
      stripCastlingRight(chess.fen(), kingSq, targetSquare, color, 'k'),
      targetSquare,
      kingSq,
      color,
      'r'
    );
    chess.load(flipFenTurn(strippedFen, enemy, true));

    for (const sh of next.effects.shielded) {
      if (sh.square === kingSq && sh.color === color) sh.square = targetSquare;
      else if (sh.square === targetSquare && sh.color === color) sh.square = kingSq;
    }
    for (const d of next.effects.disarmed) {
      if (d.square === kingSq && d.color === color) d.square = targetSquare;
      else if (d.square === targetSquare && d.color === color) d.square = kingSq;
    }
    for (const b of next.effects.bound || []) {
      if (b.square === kingSq && b.color === color) b.square = targetSquare;
      else if (b.square === targetSquare && b.color === color) b.square = kingSq;
    }

    if (
      next[color].augment === 'check_press' &&
      chess.inCheck() &&
      next[color].checkBonusUsed < 3
    ) {
      next[color].checkBonusUsed++;
      next[color].mana = Math.min(capMana, next[color].mana + 1);
      emitAugmentFx(
        next,
        'check_press',
        color,
        `체크 압박 +1 MP (${next[color].checkBonusUsed}/3)`,
        targetSquare
      );
    }

    next.lastVfx = {
      seq: vfxSeq,
      skillId: 'royal_escape',
      square: targetSquare,
      secondarySquare: kingSq,
      color,
    };
    advanceTurnSkillBookkeeping(next, color, enemy, currentMoveCount + 1);

    const ply = currentMoveCount + 1;
    return {
      nextSkillState: next,
      endedTurn: true,
      moveRecord: {
        ply,
        moveNumber: Math.ceil(ply / 2),
        color,
        san: `★대피 ${kingSq}↔${targetSquare}${chess.inCheck() ? '+' : ''}`,
        from: kingSq,
        to: targetSquare,
        flags: 'skill',
        skillUsed: 'royal_escape',
      },
    };
  }

  return null;
}

export function completeSnipeSkillAction(
  chess: Chess,
  skillState: SkillMatchState,
  color: PieceColor,
  targetSquare: string,
  currentMoveCount: number
): { nextSkillState: SkillMatchState; moveRecord: MoveRecord } | null {
  const cast = skillState.activeCast;
  if (!cast || cast.skillId !== 'snipe' || !cast.snipeBishopSquare) return null;
  const bishopSq = cast.snipeBishopSquare as Square;
  const targetSq = targetSquare as Square;

  const eligible = getEligibleSkillTargets(chess, skillState, 'snipe', color, bishopSq);
  if (!eligible.includes(targetSq)) return null;

  const cardIdx = skillState[color].hand.findIndex((c) => c.uid === cast.cardUid);
  if (cardIdx === -1) return null;
  const cost = getEffectiveSkillCost(skillState, color, 'snipe');
  if (skillState[color].mana < cost) return null;

  const targetPiece = chess.get(targetSq);
  if (!targetPiece || targetPiece.color === color || targetPiece.type === 'k') return null;
  const capturedType = targetPiece.type as PieceType;
  const enemy: PieceColor = color === 'w' ? 'b' : 'w';

  chess.remove(targetSq);
  const nextFen = flipFenTurn(
    stripCastlingRight(chess.fen(), targetSq, targetSq, enemy, capturedType),
    enemy,
    true
  );
  chess.load(nextFen);

  const next = cloneSkillState(skillState);
  const myCap = getMaxMana(next, color);
  next[color].mana -= cost;
  if (next[color].augment === 'first_refund' && !next[color].firstRefundUsed) {
    next[color].firstRefundUsed = true;
    const refunded = Math.min(2, cost);
    next[color].mana = Math.min(myCap, next[color].mana + refunded);
    emitAugmentFx(next, 'first_refund', color, `첫 스킬 마나 +${refunded} MP 환급`, targetSq);
  }
  if (
    next[color].augment === 'arcane_surge' &&
    cost >= 4 &&
    (next[color].surgeUsed || 0) < 3
  ) {
    next[color].surgeUsed = (next[color].surgeUsed || 0) + 1;
    next[color].mana = Math.min(myCap, next[color].mana + 1);
    emitAugmentFx(
      next,
      'arcane_surge',
      color,
      `마력 역류 +1 MP (${next[color].surgeUsed}/3)`,
      targetSq
    );
  }
  next[color].hand.splice(cardIdx, 1);

  // Victim whose piece was sniped gains +1 MP (and clear any stale status on sniped square)
  next.effects.disarmed = next.effects.disarmed.filter(
    (d) => !(d.square === targetSq && d.color === enemy)
  );
  if (next.effects.bound) {
    next.effects.bound = next.effects.bound.filter(
      (b) => !(b.square === targetSq && b.color === enemy)
    );
  }
  next[enemy].mana = Math.min(getMaxMana(next, enemy), next[enemy].mana + 1);
  if (next[color].augment === 'mana_siphon' && (next[color].siphonUsed || 0) < 3) {
    next[color].siphonUsed = (next[color].siphonUsed || 0) + 1;
    next[color].mana = Math.min(myCap, next[color].mana + 1);
    emitAugmentFx(
      next,
      'mana_siphon',
      color,
      `저격 마나 흡수 +1 MP (${next[color].siphonUsed}/3)`,
      targetSq
    );
  }
  const manaSeq = (next.lastCaptureMana?.seq || 0) + 1;
  next.lastCaptureMana = {
    seq: manaSeq,
    square: targetSq,
    color: enemy,
    amount: 1,
  };

  if (
    next[color].augment === 'check_press' &&
    chess.inCheck() &&
    next[color].checkBonusUsed < 3
  ) {
    next[color].checkBonusUsed++;
    next[color].mana = Math.min(myCap, next[color].mana + 1);
    emitAugmentFx(
      next,
      'check_press',
      color,
      `체크 압박 +1 MP (${next[color].checkBonusUsed}/3)`,
      targetSq
    );
  }

  const vfxSeq = (next.lastVfx?.seq || 0) + 1;
  next.lastVfx = {
    seq: vfxSeq,
    skillId: 'snipe',
    square: targetSq,
    secondarySquare: bishopSq,
    color,
  };
  advanceTurnSkillBookkeeping(next, color, enemy, currentMoveCount + 1);

  const ply = currentMoveCount + 1;
  return {
    nextSkillState: next,
    moveRecord: {
      ply,
      moveNumber: Math.ceil(ply / 2),
      color,
      san: `★저격 ${bishopSq}→×${targetSq}`,
      from: bishopSq,
      to: targetSq,
      captured: capturedType,
      flags: 'skill',
      skillUsed: 'snipe',
    },
  };
}

export function completeSwapSkillAction(
  chess: Chess,
  skillState: SkillMatchState,
  color: PieceColor,
  secondSquare: string,
  currentMoveCount: number
): { nextSkillState: SkillMatchState; moveRecord: MoveRecord } | null {
  const cast = skillState.activeCast;
  if (!cast || cast.skillId !== 'swap' || !cast.swapFirstSquare) return null;
  const firstSq = cast.swapFirstSquare as Square;
  const secondSq = secondSquare as Square;

  const eligible = getEligibleSkillTargets(chess, skillState, 'swap', color, firstSq);
  if (!eligible.includes(secondSq)) return null;

  const cardIdx = skillState[color].hand.findIndex((c) => c.uid === cast.cardUid);
  if (cardIdx === -1) return null;
  const cost = getEffectiveSkillCost(skillState, color, 'swap');
  if (skillState[color].mana < cost) return null;

  const p1 = chess.get(firstSq);
  const p2 = chess.get(secondSq);
  if (!p1 || !p2) return null;

  chess.put({ type: p2.type, color }, firstSq);
  chess.put({ type: p1.type, color }, secondSq);
  const enemy: PieceColor = color === 'w' ? 'b' : 'w';
  const nextFen = flipFenTurn(
    stripCastlingRight(
      stripCastlingRight(chess.fen(), firstSq, secondSq, color, p1.type as PieceType),
      secondSq,
      firstSq,
      color,
      p2.type as PieceType
    ),
    enemy,
    true
  );
  chess.load(nextFen);

  const next = cloneSkillState(skillState);
  const myCap = getMaxMana(next, color);
  next[color].mana -= cost;
  if (next[color].augment === 'first_refund' && !next[color].firstRefundUsed) {
    next[color].firstRefundUsed = true;
    const refunded = Math.min(2, cost);
    next[color].mana = Math.min(myCap, next[color].mana + refunded);
    emitAugmentFx(next, 'first_refund', color, `첫 스킬 마나 +${refunded} MP 환급`, firstSq);
  }
  if (
    next[color].augment === 'arcane_surge' &&
    cost >= 4 &&
    (next[color].surgeUsed || 0) < 3
  ) {
    next[color].surgeUsed = (next[color].surgeUsed || 0) + 1;
    next[color].mana = Math.min(myCap, next[color].mana + 1);
    emitAugmentFx(
      next,
      'arcane_surge',
      color,
      `마력 역류 +1 MP (${next[color].surgeUsed}/3)`,
      firstSq
    );
  }
  next[color].hand.splice(cardIdx, 1);

  for (const sh of next.effects.shielded) {
    if (sh.square === firstSq && sh.color === color) sh.square = secondSq;
    else if (sh.square === secondSq && sh.color === color) sh.square = firstSq;
  }
  for (const d of next.effects.disarmed) {
    if (d.square === firstSq && d.color === color) d.square = secondSq;
    else if (d.square === secondSq && d.color === color) d.square = firstSq;
  }
  for (const b of next.effects.bound || []) {
    if (b.square === firstSq && b.color === color) b.square = secondSq;
    else if (b.square === secondSq && b.color === color) b.square = firstSq;
  }

  const vfxSeq = (next.lastVfx?.seq || 0) + 1;
  next.lastVfx = {
    seq: vfxSeq,
    skillId: 'swap',
    square: firstSq,
    secondarySquare: secondSq,
    color,
  };
  advanceTurnSkillBookkeeping(next, color, enemy, currentMoveCount + 1);

  const ply = currentMoveCount + 1;
  return {
    nextSkillState: next,
    moveRecord: {
      ply,
      moveNumber: Math.ceil(ply / 2),
      color,
      san: `★교대 ${firstSq}↔${secondSq}`,
      from: firstSq,
      to: secondSq,
      flags: 'skill',
      skillUsed: 'swap',
    },
  };
}
