export type PieceColor = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type RuleMode = 'classic' | 'skill' | 'chess960';
export type RatingCategory = 'skill' | 'classic';
export type OpponentMode = 'ai' | 'online';
export type AiLevel = 1 | 2 | 3 | 4 | 5;
export type BgmPace = 'normal' | 'slow';
export type BgmScene = 'lobby' | 'game';

export interface Chess960State {
  positionId: number;
  initialFen: string;
  wKingSq: string;
  wQRookSq: string;
  wKRookSq: string;
  bKingSq: string;
  bQRookSq: string;
  bKRookSq: string;
  rights: {
    wK: boolean;
    wQ: boolean;
    bK: boolean;
    bQ: boolean;
  };
}

export type RankTierId =
  | 'unranked'
  | 'iron'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'emerald'
  | 'diamond'
  | 'master'
  | 'grandmaster';

export interface RankTierInfo {
  id: RankTierId;
  tier: string;
  badgeColor: string;
  minRating: number;
}

export interface LeaderboardUserRecord {
  uid: string;
  displayName: string;
  photoURL?: string;
  ratingEpoch?: number;
  skillRating: number;
  skillWins: number;
  skillLosses: number;
  skillDraws: number;
  classicRating: number;
  classicWins: number;
  classicLosses: number;
  classicDraws: number;
}

export interface MatchRatingOutcome {
  matchId: string;
  category: RatingCategory;
  winnerDelta: number;
  loserDelta: number;
  materialDiff: number;
  plyCount: number;
}

export type SkillId =
  | 'march'
  | 'leap'
  | 'diagonal_rook'
  | 'retreat'
  | 'shield'
  | 'smoke'
  | 'freeze'
  | 'swap'
  | 'revive'
  | 'snipe'
  | 'bishop_shift'
  | 'camel_jump'
  | 'disarm'
  | 'pawn_guard'
  | 'phantom_step'
  | 'tactical_jam'
  | 'great_attack'
  | 'straight_bishop'
  | 'trojan_horse'
  | 'queens_gambit'
  | 'pawn_surge'
  | 'mana_drain'
  | 'shadow_bind'
  | 'knight_sweep'
  | 'field_promotion'
  | 'arcane_tome'
  | 'purify'
  | 'royal_dash'
  | 'alfil_leap'
  | 'vanguard_lance'
  | 'center_drop'
  | 'royal_escape';

export type AugmentId =
  | 'double_pawn_march'
  | 'late_bloom'
  | 'mana_well'
  | 'recycle_pro'
  | 'cheap_skills'
  | 'forward_aura'
  | 'knight_step'
  | 'holy_bishop'
  | 'castle_vault'
  | 'check_press'
  | 'large_hand'
  | 'first_refund'
  | 'opening_intel'
  | 'tactical_reserve'
  | 'mana_siphon'
  | 'arcane_surge'
  | 'royal_guard'
  | 'veteran_pawn'
  | 'iron_castle'
  | 'swift_recovery';

export type SkillCategory = 'mobility' | 'offense' | 'defense';

export interface SkillDefinition {
  id: SkillId;
  name: string;
  manaCost: number;
  category: SkillCategory;
  shortDesc: string;
  fullDesc: string;
  targetMode:
    | 'friendly_piece'
    | 'enemy_piece'
    | 'empty_square'
    | 'shield_zone'
    | 'swap_two'
    | 'snipe_two'
    | 'revive_square'
    | 'instant';
  turnBehavior: 'lock_piece_move' | 'continue_turn' | 'end_turn';
}

export interface AugmentDefinition {
  id: AugmentId;
  name: string;
  tag: string;
  shortDesc: string;
  fullDesc: string;
}

export interface SkillCardInstance {
  uid: string;
  skillId: SkillId;
}

export interface SkillBoardEffects {
  shielded: Array<{
    square: string;
    color: PieceColor;
    expiresAfterTurnOf: PieceColor;
    untilMoved?: boolean;
  }>;
  shieldZones?: Array<{ square: string; color: PieceColor }>;
  frozen: Array<{ square: string; color: PieceColor; expiresAfterTurnOf: PieceColor }>;
  disarmed: Array<{ square: string; color: PieceColor; remainingTurns: number }>;
  smoke: Array<{ square: string; expiresAfterTurnOf: PieceColor }>;
  bound: Array<{ square: string; color: PieceColor; expiresAfterTurnOf: PieceColor }>;
  veiledRanks: Array<{ rank: '1' | '8'; ownerColor: PieceColor; remainingTurns: number }>;
}

export interface ActiveSkillTurnState {
  skillId: SkillId;
  cardUid: string;
  lockedPieceSquare: string | null;
  swapFirstSquare: string | null;
  snipeBishopSquare?: string | null;
}

export interface PlayerSkillState {
  mana: number;
  hand: SkillCardInstance[];
  handCount?: number;
  deck: SkillId[];
  usedOrDiscardedThisTurn: boolean;
  augment: AugmentId | null;
  checkBonusUsed: number;
  firstRefundUsed: boolean;
  firstDrawDiscountUsed: boolean;
  milestone20Claimed: boolean;
  milestone50Claimed: boolean;
  kingManaUsed?: number;
  siphonUsed?: number;
  surgeUsed?: number;
  veteranPawnClaimed?: boolean;
  ironCastleUsed?: number;
  discardCycleCount?: number;
  openingIntelUsed?: boolean;
  pendingSkillDraft?: SkillId[] | null;
}

export interface SkillMatchState {
  w: PlayerSkillState;
  b: PlayerSkillState;
  augmentPhase: boolean;
  offeredAugments: AugmentId[];
  effects: SkillBoardEffects;
  activeCast: ActiveSkillTurnState | null;
  lastVfx: {
    seq: number;
    skillId: SkillId;
    square: string;
    secondarySquare?: string;
    color: PieceColor;
  } | null;
  lastCaptureMana?: {
    seq: number;
    square: string;
    color: PieceColor;
    amount: number;
  } | null;
  lastAugmentFx?: {
    seq: number;
    augmentId: AugmentId;
    color: PieceColor;
    square?: string;
    label: string;
  } | null;
}

export interface TimeControl {
  minutes: number; // 0 means unlimited
  incrementSeconds: number;
}

export interface MoveRecord {
  ply: number;
  moveNumber: number;
  color: PieceColor;
  san: string;
  from: string;
  to: string;
  captured?: PieceType;
  promotion?: PieceType;
  flags: string;
  skillUsed?: SkillId;
}

export interface GameOverState {
  winner: PieceColor | 'draw';
  reason:
    | 'checkmate'
    | 'timeout'
    | 'resign'
    | 'stalemate'
    | 'threefold'
    | 'insufficient'
    | 'fifty-move'
    | 'draw-agreement';
  message: string;
}

export interface OnlinePlayerInfo {
  id: string;
  nickname: string;
  color: PieceColor;
  connected: boolean;
}

export interface RoomStatePayload {
  roomCode: string;
  matchId: string;
  fen: string;
  turn: PieceColor;
  ruleMode: RuleMode;
  chess960State: Chess960State | null;
  timeControl: TimeControl;
  whiteTimeMs: number;
  blackTimeMs: number;
  lastTickAt: number | null;
  started: boolean;
  players: {
    w: OnlinePlayerInfo | null;
    b: OnlinePlayerInfo | null;
  };
  spectatorCount: number;
  moves: MoveRecord[];
  lastMove: { from: string; to: string; captured?: PieceType } | null;
  inCheck: boolean;
  gameOver: GameOverState | null;
  ratingOutcome: MatchRatingOutcome | null;
  drawOfferBy: PieceColor | null;
  rematchRequests: PieceColor[];
  skillState: SkillMatchState | null;
}

export interface MatchHistoryRecord {
  id: string;
  playedAt: string;
  opponentMode: OpponentMode;
  ruleMode: RuleMode;
  opponentLabel: string;
  myColor: PieceColor | 'spectator';
  winner: PieceColor | 'draw';
  resultMessage: string;
  ratingCategory?: RatingCategory | 'none';
  ratingDelta?: number;
  materialDiff?: number;
  moves: MoveRecord[];
}

export interface AiTierInfo {
  level: AiLevel;
  title: string;
  subtitle: string;
  estimatedRating: string;
  description: string;
}

export const AI_TIERS: AiTierInfo[] = [
  {
    level: 1,
    title: '리암',
    subtitle: '동네 입문자',
    estimatedRating: '약 500',
    description: '기본적인 기물 잡기만 인식하며 실수가 잦아 입문에 적합합니다.',
  },
  {
    level: 2,
    title: '클라라',
    subtitle: '취미 동호인',
    estimatedRating: '약 850',
    description: '유리한 기물 교환과 체크 기회를 놓치지 않고 공격합니다.',
  },
  {
    level: 3,
    title: '올리버',
    subtitle: '체스 클럽 멤버',
    estimatedRating: '약 1200',
    description: '2수 앞을 내다보고 중앙 장악과 기물 배치를 계산합니다.',
  },
  {
    level: 4,
    title: '소피아',
    subtitle: '오픈 대회 입상자',
    estimatedRating: '약 1550',
    description: '3수 탐색으로 전술적 포크·핀을 노리며 견고히 수비합니다.',
  },
  {
    level: 5,
    title: '빅토르',
    subtitle: '체스 마스터',
    estimatedRating: '약 2100+',
    description: '깊은 수읽기와 정교한 국면 판단으로 최선의 수를 찾아냅니다.',
  },
];

export const TIME_PRESETS: Array<{ label: string; sub: string; minutes: number }> = [
  { label: '블리츠', sub: '3분', minutes: 3 },
  { label: '기본', sub: '10분', minutes: 10 },
];
