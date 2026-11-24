import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import type {
  AiLevel,
  AugmentId,
  Chess960State,
  PieceColor,
  PieceType,
  SkillCardInstance,
  SkillId,
  SkillMatchState,
} from '../types/chess.ts';
import {
  type AugmentedMove,
  SKILL_DEFINITIONS,
  applySkillTargetAction,
  completeSnipeSkillAction,
  completeSwapSkillAction,
  countFriendlyPieces,
  getAllLegalMovesWithSkills,
  getDrawSkillCost,
  getEffectiveSkillCost,
  getEligibleSkillTargets,
  getHandLimit,
  getRevivablePieceType,
} from './skillChess.ts';
import { executeChess960Move, getChess960CastlingMoves } from './chess960.ts';

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 335,
  r: 500,
  q: 900,
  k: 20000,
};

const PAWN_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [55, 55, 55, 60, 60, 55, 55, 55],
  [12, 12, 22, 34, 34, 22, 12, 12],
  [6, 6, 14, 30, 30, 14, 6, 6],
  [0, 0, 4, 26, 26, 4, 0, 0],
  [5, -5, -8, 2, 2, -8, -5, 5],
  [5, 10, 10, -24, -24, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

const KNIGHT_PST = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 4, 4, 0, -20, -40],
  [-30, 4, 14, 18, 18, 14, 4, -30],
  [-30, 6, 18, 24, 24, 18, 6, -30],
  [-30, 4, 18, 24, 24, 18, 4, -30],
  [-30, 6, 14, 18, 18, 14, 6, -30],
  [-40, -20, 0, 6, 6, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50],
];

const BISHOP_PST = [
  [-20, -10, -10, -10, -10, -10, -10, -20],
  [-10, 4, 0, 0, 0, 0, 4, -10],
  [-10, 4, 8, 14, 14, 8, 4, -10],
  [-10, 8, 8, 14, 14, 8, 8, -10],
  [-10, 2, 12, 14, 14, 12, 2, -10],
  [-10, 12, 12, 12, 12, 12, 12, -10],
  [-10, 8, 2, 0, 0, 2, 8, -10],
  [-20, -10, -10, -10, -10, -10, -10, -20],
];

const ROOK_PST = [
  [0, 0, 0, 4, 4, 0, 0, 0],
  [8, 14, 14, 14, 14, 14, 14, 8],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [0, 0, 2, 8, 8, 2, 0, 0],
];

const QUEEN_PST = [
  [-20, -10, -10, -5, -5, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 6, 6, 6, 6, 0, -10],
  [-5, 0, 6, 8, 8, 6, 0, -5],
  [0, 0, 6, 8, 8, 6, 0, -5],
  [-10, 6, 6, 6, 6, 6, 0, -10],
  [-10, 0, 6, 0, 0, 0, 0, -10],
  [-20, -10, -10, -5, -5, -10, -10, -20],
];

const KING_MID_PST = [
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-20, -30, -30, -40, -40, -30, -30, -20],
  [-10, -20, -20, -24, -24, -20, -20, -10],
  [20, 22, 2, -4, -4, 2, 22, 20],
  [22, 34, 12, -4, 0, 10, 34, 22],
];

const KING_END_PST = [
  [-50, -35, -25, -15, -15, -25, -35, -50],
  [-30, -15, 0, 10, 10, 0, -15, -30],
  [-25, 0, 20, 30, 30, 20, 0, -25],
  [-25, 0, 30, 42, 42, 30, 0, -25],
  [-25, 0, 30, 42, 42, 30, 0, -25],
  [-25, 0, 20, 30, 30, 20, 0, -25],
  [-30, -20, 0, 10, 10, 0, -20, -30],
  [-45, -30, -20, -15, -15, -20, -30, -45],
];

const PST_MAP: Record<Exclude<PieceSymbol, 'k'>, number[][]> = {
  p: PAWN_PST,
  n: KNIGHT_PST,
  b: BISHOP_PST,
  r: ROOK_PST,
  q: QUEEN_PST,
};

function evaluateBoard(chess: Chess, aiColor: PieceColor): number {
  if (chess.isCheckmate()) {
    return chess.turn() === aiColor ? -99999 : 99999;
  }
  if (chess.isDraw()) {
    return 0;
  }

  const board = chess.board();
  let score = 0;

  let nonKingMaterial = 0;
  let wBishops = 0;
  let bBishops = 0;
  const wPawnsOnFile = [0, 0, 0, 0, 0, 0, 0, 0];
  const bPawnsOnFile = [0, 0, 0, 0, 0, 0, 0, 0];
  const wMostAdvancedPawnRow = [8, 8, 8, 8, 8, 8, 8, 8]; // smaller r = closer to promotion (r=0)
  const bMostAdvancedPawnRow = [-1, -1, -1, -1, -1, -1, -1, -1]; // larger r = closer to promotion (r=7)

  const wPawns: Array<{ r: number; c: number }> = [];
  const bPawns: Array<{ r: number; c: number }> = [];
  const wRooks: Array<{ r: number; c: number }> = [];
  const bRooks: Array<{ r: number; c: number }> = [];
  let wKing: { r: number; c: number } | null = null;
  let bKing: { r: number; c: number } | null = null;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const isW = piece.color === 'w';

      if (piece.type !== 'k') {
        nonKingMaterial += PIECE_VALUES[piece.type];
        const base = PIECE_VALUES[piece.type];
        const pstRow = isW ? r : 7 - r;
        let pos = PST_MAP[piece.type][pstRow][c];

        // Extra center control bonus for central 4 squares (d4,e4,d5,e5)
        if ((r === 3 || r === 4) && (c === 3 || c === 4)) {
          pos += piece.type === 'p' ? 12 : piece.type === 'n' || piece.type === 'b' ? 10 : 4;
        }

        const val = base + pos;
        score += piece.color === aiColor ? val : -val;

        if (piece.type === 'b') {
          if (isW) wBishops++;
          else bBishops++;
        } else if (piece.type === 'p') {
          if (isW) {
            wPawnsOnFile[c]++;
            if (r < wMostAdvancedPawnRow[c]) wMostAdvancedPawnRow[c] = r;
            wPawns.push({ r, c });
          } else {
            bPawnsOnFile[c]++;
            if (r > bMostAdvancedPawnRow[c]) bMostAdvancedPawnRow[c] = r;
            bPawns.push({ r, c });
          }
        } else if (piece.type === 'r') {
          if (isW) wRooks.push({ r, c });
          else bRooks.push({ r, c });
        }
      } else {
        if (isW) wKing = { r, c };
        else bKing = { r, c };
      }
    }
  }

  // Endgame weight (0 = full opening/midgame, 1 = pure endgame)
  const endWeight = Math.max(0, Math.min(1, 1 - nonKingMaterial / 5200));

  if (wKing) {
    const kPos =
      KING_MID_PST[wKing.r][wKing.c] * (1 - endWeight) +
      KING_END_PST[wKing.r][wKing.c] * endWeight;
    let shield = 0;
    if (endWeight < 0.7 && wKing.r >= 6) {
      for (let dc = -1; dc <= 1; dc++) {
        const fc = wKing.c + dc;
        if (fc >= 0 && fc < 8) {
          const pFront = board[wKing.r - 1]?.[fc];
          if (pFront && pFront.color === 'w' && pFront.type === 'p') shield += 11;
        }
      }
    }
    const wKingScore = kPos + shield * (1 - endWeight);
    score += aiColor === 'w' ? wKingScore : -wKingScore;
  }

  if (bKing) {
    const br = 7 - bKing.r;
    const kPos =
      KING_MID_PST[br][bKing.c] * (1 - endWeight) + KING_END_PST[br][bKing.c] * endWeight;
    let shield = 0;
    if (endWeight < 0.7 && bKing.r <= 1) {
      for (let dc = -1; dc <= 1; dc++) {
        const fc = bKing.c + dc;
        if (fc >= 0 && fc < 8) {
          const pFront = board[bKing.r + 1]?.[fc];
          if (pFront && pFront.color === 'b' && pFront.type === 'p') shield += 11;
        }
      }
    }
    const bKingScore = kPos + shield * (1 - endWeight);
    score += aiColor === 'b' ? bKingScore : -bKingScore;
  }

  // Bishop pair bonus
  if (wBishops >= 2) score += aiColor === 'w' ? 36 : -36;
  if (bBishops >= 2) score += aiColor === 'b' ? 36 : -36;

  // Pawn structure: doubled, isolated, passed pawns
  let wStruct = 0;
  let bStruct = 0;

  for (let c = 0; c < 8; c++) {
    if (wPawnsOnFile[c] > 1) wStruct -= (wPawnsOnFile[c] - 1) * 14;
    if (bPawnsOnFile[c] > 1) bStruct -= (bPawnsOnFile[c] - 1) * 14;
  }

  for (const p of wPawns) {
    const hasAdjFriendly =
      (p.c > 0 && wPawnsOnFile[p.c - 1] > 0) || (p.c < 7 && wPawnsOnFile[p.c + 1] > 0);
    if (!hasAdjFriendly) wStruct -= 12;

    let isPassed = true;
    for (let fc = Math.max(0, p.c - 1); fc <= Math.min(7, p.c + 1); fc++) {
      if (bMostAdvancedPawnRow[fc] !== -1 && bMostAdvancedPawnRow[fc] < p.r) {
        // Enemy pawn on fc is strictly in front (or check all enemy pawns: for white moving toward r=0, enemy pawn at row <= p.r - 1 blocks)
        isPassed = false;
        break;
      }
    }
    if (isPassed) {
      const rankAdv = 7 - p.r; // 1..6
      wStruct += Math.round((14 + rankAdv * rankAdv * 2.2) * (0.65 + endWeight * 0.75));
    }
  }

  for (const p of bPawns) {
    const hasAdjFriendly =
      (p.c > 0 && bPawnsOnFile[p.c - 1] > 0) || (p.c < 7 && bPawnsOnFile[p.c + 1] > 0);
    if (!hasAdjFriendly) bStruct -= 12;

    let isPassed = true;
    for (let fc = Math.max(0, p.c - 1); fc <= Math.min(7, p.c + 1); fc++) {
      if (wMostAdvancedPawnRow[fc] !== 8 && wMostAdvancedPawnRow[fc] > p.r) {
        isPassed = false;
        break;
      }
    }
    if (isPassed) {
      const rankAdv = p.r; // 1..6
      bStruct += Math.round((14 + rankAdv * rankAdv * 2.2) * (0.65 + endWeight * 0.75));
    }
  }

  // Rooks on open / semi-open files & 7th rank
  for (const rk of wRooks) {
    if (wPawnsOnFile[rk.c] === 0) {
      wStruct += bPawnsOnFile[rk.c] === 0 ? 22 : 11;
    }
    if (rk.r === 1) wStruct += 24;
  }
  for (const rk of bRooks) {
    if (bPawnsOnFile[rk.c] === 0) {
      bStruct += wPawnsOnFile[rk.c] === 0 ? 22 : 11;
    }
    if (rk.r === 6) bStruct += 24;
  }

  score += aiColor === 'w' ? wStruct - bStruct : bStruct - wStruct;

  if (chess.inCheck()) {
    score += chess.turn() === aiColor ? -32 : 32;
  }

  return score;
}

type TTFlag = 'exact' | 'lower' | 'upper';

interface TTEntry {
  depth: number;
  flag: TTFlag;
  score: number;
  bestMoveKey?: string;
}

interface SearchContext {
  deadline: number;
  aborted: boolean;
  nodes: number;
  qMaxDepth: number;
  maxExtensions: number;
  tt: Map<string, TTEntry>;
  killers: Array<[string | null, string | null]>;
  history: Map<string, number>;
}

function moveKey(m: Move): string {
  return `${m.from}${m.to}${m.promotion || ''}`;
}

function ttPositionKey(chess: Chess): string {
  const parts = chess.fen().split(' ');
  return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]}`;
}

function scoreMoveOrder(
  move: Move,
  ply: number,
  ctx?: SearchContext,
  ttBestKey?: string
): number {
  const key = moveKey(move);
  if (ttBestKey && key === ttBestKey) return 1_000_000;

  let s = 0;
  if (move.captured) {
    s += 100_000 + 10 * PIECE_VALUES[move.captured] - PIECE_VALUES[move.piece];
  }
  if (move.promotion) {
    s += 80_000 + PIECE_VALUES[move.promotion];
  }
  if (!move.captured && ctx) {
    const kPair = ctx.killers[ply];
    if (kPair) {
      if (kPair[0] === key) s += 45_000;
      else if (kPair[1] === key) s += 40_000;
    }
    const hist = ctx.history.get(key) || 0;
    s += Math.min(30_000, hist);
  }
  if (move.san.includes('+')) {
    s += 650;
  }
  if (move.flags.includes('k') || move.flags.includes('q')) {
    s += 420;
  }
  return s;
}

function orderMoves(
  moves: Move[],
  ply = 0,
  ctx?: SearchContext,
  ttBestKey?: string
): Move[] {
  return moves.sort(
    (a, b) => scoreMoveOrder(b, ply, ctx, ttBestKey) - scoreMoveOrder(a, ply, ctx, ttBestKey)
  );
}

function quiescence(
  chess: Chess,
  alpha: number,
  beta: number,
  maximizing: boolean,
  aiColor: PieceColor,
  ctx: SearchContext,
  qDepth: number
): number {
  ctx.nodes++;
  if ((ctx.nodes & 511) === 0 && performance.now() > ctx.deadline) {
    ctx.aborted = true;
    return 0;
  }

  const standPat = evaluateBoard(chess, aiColor);
  if (qDepth <= 0 || chess.isGameOver()) return standPat;

  if (maximizing) {
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;
    const captures = orderMoves(
      chess.moves({ verbose: true }).filter((m) => Boolean(m.captured || m.promotion))
    );
    for (const move of captures) {
      // Delta pruning for hopeless captures in deep quiescence
      if (
        !move.promotion &&
        move.captured &&
        standPat + PIECE_VALUES[move.captured] + 200 < alpha
      ) {
        continue;
      }
      chess.move(move);
      const score = quiescence(chess, alpha, beta, false, aiColor, ctx, qDepth - 1);
      chess.undo();
      if (ctx.aborted) return 0;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  } else {
    if (standPat <= alpha) return alpha;
    if (beta > standPat) beta = standPat;
    const captures = orderMoves(
      chess.moves({ verbose: true }).filter((m) => Boolean(m.captured || m.promotion))
    );
    for (const move of captures) {
      if (
        !move.promotion &&
        move.captured &&
        standPat - PIECE_VALUES[move.captured] - 200 > beta
      ) {
        continue;
      }
      chess.move(move);
      const score = quiescence(chess, alpha, beta, true, aiColor, ctx, qDepth - 1);
      chess.undo();
      if (ctx.aborted) return 0;
      if (score <= alpha) return alpha;
      if (score < beta) beta = score;
    }
    return beta;
  }
}

function alphaBeta(
  chess: Chess,
  depth: number,
  ply: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  aiColor: PieceColor,
  ctx: SearchContext,
  useQuiescence: boolean,
  extensionsLeft: number
): number {
  ctx.nodes++;
  if ((ctx.nodes & 511) === 0 && performance.now() > ctx.deadline) {
    ctx.aborted = true;
    return 0;
  }

  if (chess.isGameOver()) {
    const terminal = evaluateBoard(chess, aiColor);
    if (terminal > 50000) return terminal - ply * 100;
    if (terminal < -50000) return terminal + ply * 100;
    return terminal;
  }

  if (depth <= 0) {
    return useQuiescence
      ? quiescence(chess, alpha, beta, maximizing, aiColor, ctx, ctx.qMaxDepth)
      : evaluateBoard(chess, aiColor);
  }

  const origAlpha = alpha;
  const origBeta = beta;
  const key = ttPositionKey(chess);
  const cached = ctx.tt.get(key);
  if (cached && cached.depth >= depth) {
    if (cached.flag === 'exact') return cached.score;
    if (cached.flag === 'lower' && cached.score > alpha) alpha = cached.score;
    else if (cached.flag === 'upper' && cached.score < beta) beta = cached.score;
    if (alpha >= beta) return cached.score;
  }

  const moves = orderMoves(
    chess.moves({ verbose: true }),
    ply,
    ctx,
    cached?.bestMoveKey
  );

  let bestMoveKey: string | undefined;

  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      const givesCheck = move.san.includes('+');
      const ext = givesCheck && extensionsLeft > 0 && depth <= 2 ? 1 : 0;
      chess.move(move);
      const val = alphaBeta(
        chess,
        depth - 1 + ext,
        ply + 1,
        alpha,
        beta,
        false,
        aiColor,
        ctx,
        useQuiescence,
        extensionsLeft - ext
      );
      chess.undo();
      if (ctx.aborted) return 0;
      if (val > best) {
        best = val;
        bestMoveKey = moveKey(move);
      }
      if (best > alpha) alpha = best;
      if (beta <= alpha) {
        if (!move.captured) {
          const mk = moveKey(move);
          const kp = ctx.killers[ply] || [null, null];
          if (kp[0] !== mk) ctx.killers[ply] = [mk, kp[0]];
          ctx.history.set(mk, (ctx.history.get(mk) || 0) + depth * depth);
        }
        break;
      }
    }

    if (!ctx.aborted && ctx.tt.size < 65000) {
      const flag: TTFlag =
        best <= origAlpha ? 'upper' : best >= origBeta ? 'lower' : 'exact';
      ctx.tt.set(key, { depth, flag, score: best, bestMoveKey });
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      const givesCheck = move.san.includes('+');
      const ext = givesCheck && extensionsLeft > 0 && depth <= 2 ? 1 : 0;
      chess.move(move);
      const val = alphaBeta(
        chess,
        depth - 1 + ext,
        ply + 1,
        alpha,
        beta,
        true,
        aiColor,
        ctx,
        useQuiescence,
        extensionsLeft - ext
      );
      chess.undo();
      if (ctx.aborted) return 0;
      if (val < best) {
        best = val;
        bestMoveKey = moveKey(move);
      }
      if (best < beta) beta = best;
      if (beta <= alpha) {
        if (!move.captured) {
          const mk = moveKey(move);
          const kp = ctx.killers[ply] || [null, null];
          if (kp[0] !== mk) ctx.killers[ply] = [mk, kp[0]];
          ctx.history.set(mk, (ctx.history.get(mk) || 0) + depth * depth);
        }
        break;
      }
    }

    if (!ctx.aborted && ctx.tt.size < 65000) {
      const flag: TTFlag =
        best <= origAlpha ? 'upper' : best >= origBeta ? 'lower' : 'exact';
      ctx.tt.set(key, { depth, flag, score: best, bestMoveKey });
    }
    return best;
  }
}

function createSearchContext(
  timeBudgetMs: number,
  qMaxDepth: number,
  maxExtensions: number
): SearchContext {
  return {
    deadline: performance.now() + timeBudgetMs,
    aborted: false,
    nodes: 0,
    qMaxDepth,
    maxExtensions,
    tt: new Map(),
    killers: Array.from({ length: 24 }, () => [null, null]),
    history: new Map(),
  };
}

function applyAugmentedMoveToClone(
  baseChess: Chess,
  move: AugmentedMove
): Chess | null {
  const sim = new Chess(baseChess.fen());
  if (!move.isSkillAugmented) {
    try {
      const ok = sim.move({
        from: move.from as Square,
        to: move.to as Square,
        promotion: move.promotion as PieceSymbol | undefined,
      });
      return ok ? sim : null;
    } catch {
      return null;
    }
  }

  const piece = sim.get(move.from as Square);
  if (!piece) return null;
  const turn = sim.turn() as PieceColor;
  const enemy: PieceColor = turn === 'w' ? 'b' : 'w';
  const nextType = (move.promotion || piece.type) as PieceSymbol;

  sim.remove(move.from as Square);
  sim.put({ type: nextType, color: turn }, move.to as Square);

  const parts = sim.fen().split(' ');
  let castling = parts[2];
  if (castling !== '-') {
    if (piece.type === 'k') {
      castling = turn === 'w' ? castling.replace(/[KQ]/g, '') : castling.replace(/[kq]/g, '');
    }
    if (move.from === 'h1' || move.to === 'h1') castling = castling.replace('K', '');
    if (move.from === 'a1' || move.to === 'a1') castling = castling.replace('Q', '');
    if (move.from === 'h8' || move.to === 'h8') castling = castling.replace('k', '');
    if (move.from === 'a8' || move.to === 'a8') castling = castling.replace('q', '');
    parts[2] = castling.length > 0 ? castling : '-';
  }
  parts[1] = enemy;
  parts[3] = '-';
  parts[4] = String(Number(parts[4] || 0) + 1);
  if (enemy === 'w') {
    parts[5] = String(Number(parts[5] || 1) + 1);
  }
  try {
    sim.load(parts.join(' '));
    return sim;
  } catch {
    return null;
  }
}

const AUGMENT_PRIORITY: Record<AugmentId, number> = {
  cheap_skills: 9,
  mana_well: 9,
  opening_intel: 9,
  first_refund: 8,
  mana_siphon: 8,
  arcane_surge: 7,
  double_pawn_march: 7,
  tactical_reserve: 7,
  iron_castle: 7,
  knight_step: 6,
  holy_bishop: 6,
  check_press: 6,
  veteran_pawn: 6,
  recycle_pro: 5,
  large_hand: 5,
  swift_recovery: 5,
  royal_guard: 4,
  forward_aura: 4,
  castle_vault: 4,
  late_bloom: 3,
};

export function chooseAiAugment(offered: AugmentId[], level: AiLevel): AugmentId {
  if (offered.length === 0) return 'mana_well';
  if (level <= 2) {
    return offered[Math.floor(Math.random() * offered.length)];
  }
  const sorted = [...offered].sort((a, b) => AUGMENT_PRIORITY[b] - AUGMENT_PRIORITY[a]);
  return sorted[0];
}

const DRAFT_SKILL_PRIORITY: Partial<Record<SkillId, number>> = {
  snipe: 10,
  freeze: 9,
  phantom_step: 9,
  queens_gambit: 8,
  shield: 8,
  arcane_tome: 8,
  alfil_leap: 8,
  vanguard_lance: 8,
  center_drop: 8,
  knight_sweep: 8,
  straight_bishop: 7,
  diagonal_rook: 7,
  royal_escape: 7,
  purify: 7,
  disarm: 7,
  shadow_bind: 7,
  field_promotion: 7,
  mana_drain: 6,
  tactical_jam: 6,
  royal_dash: 6,
};

export function chooseAiDraftSkill(offered: SkillId[], level: AiLevel): SkillId {
  if (offered.length === 0) return 'arcane_tome';
  if (level <= 2) {
    return offered[Math.floor(Math.random() * offered.length)];
  }
  const sorted = [...offered].sort(
    (a, b) => (DRAFT_SKILL_PRIORITY[b] || 5) - (DRAFT_SKILL_PRIORITY[a] || 5)
  );
  return sorted[0];
}

export function shouldAiDrawSkill(
  level: AiLevel,
  skillState: SkillMatchState,
  aiColor: PieceColor
): boolean {
  if (skillState.augmentPhase || skillState.activeCast) return false;
  const player = skillState[aiColor];
  if (player.pendingSkillDraft && player.pendingSkillDraft.length > 0) return false;
  const limit = getHandLimit(skillState, aiColor);
  const drawCost = getDrawSkillCost(skillState, aiColor);
  if (player.mana < drawCost || player.hand.length >= limit) return false;

  if (drawCost === 1 && player.hand.length < limit) {
    return true;
  }
  if (player.hand.length === 0) {
    const chance = level === 1 ? 0.45 : level === 2 ? 0.65 : 0.88;
    return Math.random() < chance;
  }
  if (player.mana >= 6 && player.hand.length < 2) {
    return Math.random() < 0.72;
  }
  if (player.mana >= 8) {
    return Math.random() < 0.78;
  }
  return false;
}

export interface AiSkillAction {
  type: 'cast' | 'discard';
  card: SkillCardInstance;
  skillId: SkillId;
  targetSquare?: string;
  secondarySquare?: string;
}

function countNonKingMaterial(chess: Chess): number {
  const board = chess.board();
  let total = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type !== 'k') {
        total += PIECE_VALUES[p.type];
      }
    }
  }
  return total;
}

function isCriticalPosition(
  chess: Chess,
  skillState: SkillMatchState | null,
  aiColor: PieceColor
): boolean {
  if (chess.inCheck()) return true;

  const nonKingMat = countNonKingMaterial(chess);
  if (nonKingMat <= 4200) return true;

  const moves = chess.moves({ verbose: true });
  let checkingMoves = 0;
  for (const m of moves) {
    if (m.promotion) return true;
    if (m.captured && PIECE_VALUES[m.captured] >= 300) return true;
    if (m.san.includes('+')) {
      checkingMoves++;
      if (checkingMoves >= 2) return true;
    }
  }

  if (skillState) {
    const p = skillState[aiColor];
    if (
      p.hand.length > 0 &&
      p.mana >= 3 &&
      p.hand.some((c) => p.mana >= getEffectiveSkillCost(skillState, aiColor, c.skillId))
    ) {
      return true;
    }
    if (
      (skillState.effects.frozen.length || 0) > 0 ||
      (skillState.effects.shielded.length || 0) > 0 ||
      (skillState.effects.shieldZones?.length || 0) > 0 ||
      (skillState.effects.bound?.length || 0) > 0
    ) {
      return true;
    }
  }

  return false;
}

function scoreAfterOpponentReply(
  simChess: Chess,
  aiColor: PieceColor,
  level: AiLevel,
  deadline: number
): number {
  if (simChess.isCheckmate()) {
    return simChess.turn() === aiColor ? -99999 : 99999;
  }
  if (simChess.isDraw()) return 0;

  const ctx = createSearchContext(
    Math.max(40, Math.min(260, deadline - performance.now())),
    level === 5 ? 3 : 2,
    1
  );
  const depth = level === 5 ? 2 : 1;
  const val = alphaBeta(
    simChess,
    depth,
    1,
    -Infinity,
    Infinity,
    false,
    aiColor,
    ctx,
    true,
    1
  );
  if (ctx.aborted) {
    return evaluateBoard(simChess, aiColor);
  }
  return val;
}

function evaluateBestFollowupWithSkills(
  simChess: Chess,
  simSkillState: SkillMatchState,
  aiColor: PieceColor,
  level: AiLevel,
  deadline: number
): number {
  const moves = getAllLegalMovesWithSkills(simChess, simSkillState);
  if (moves.length === 0) return -1_000_000;

  const sorted = [...moves]
    .sort((a, b) => {
      const sa =
        (a.san.includes('#') ? 100000 : 0) +
        (a.captured ? PIECE_VALUES[a.captured] * 10 : 0) +
        (a.promotion ? PIECE_VALUES[a.promotion] * 8 : 0) +
        (a.san.includes('+') ? 80 : 0);
      const sb =
        (b.san.includes('#') ? 100000 : 0) +
        (b.captured ? PIECE_VALUES[b.captured] * 10 : 0) +
        (b.promotion ? PIECE_VALUES[b.promotion] * 8 : 0) +
        (b.san.includes('+') ? 80 : 0);
      return sb - sa;
    })
    .slice(0, level === 5 ? 10 : 6);

  let best = -Infinity;
  for (const m of sorted) {
    if (performance.now() > deadline) break;
    if (m.san.includes('#')) return 99999;
    const afterMove = applyAugmentedMoveToClone(simChess, m);
    if (!afterMove) continue;
    const val = scoreAfterOpponentReply(afterMove, aiColor, level, deadline);
    if (val > best) best = val;
  }
  return best === -Infinity ? evaluateBoard(simChess, aiColor) : best;
}

export function chooseAiSkillAction(
  fen: string,
  level: AiLevel,
  skillState: SkillMatchState,
  maxSimBudgetMs = 2800
): AiSkillAction | null {
  if (skillState.augmentPhase) return null;
  const chess = new Chess(fen);
  const aiColor = chess.turn() as PieceColor;
  const enemyColor: PieceColor = aiColor === 'w' ? 'b' : 'w';
  const player = skillState[aiColor];
  if (
    player.usedOrDiscardedThisTurn ||
    skillState.activeCast ||
    player.hand.length === 0 ||
    (player.pendingSkillDraft && player.pendingSkillDraft.length > 0)
  ) {
    return null;
  }

  const affordableCards = player.hand.filter(
    (c) => player.mana >= getEffectiveSkillCost(skillState, aiColor, c.skillId)
  );

  if (affordableCards.length === 0) {
    if (player.mana < 4 && Math.random() < (level >= 4 ? 0.85 : 0.72)) {
      const sortedExpensive = [...player.hand].sort(
        (a, b) =>
          SKILL_DEFINITIONS[b.skillId].manaCost - SKILL_DEFINITIONS[a.skillId].manaCost
      );
      return {
        type: 'discard',
        card: sortedExpensive[0],
        skillId: sortedExpensive[0].skillId,
      };
    }
    return null;
  }

  // Levels 4 & 5: Full tactical skill simulation comparing against baseline board move!
  if (level >= 4) {
    const deadline = performance.now() + (level === 5 ? maxSimBudgetMs : 950);
    const baselineScore = evaluateBestFollowupWithSkills(
      chess,
      skillState,
      aiColor,
      level,
      Math.min(deadline, performance.now() + 450)
    );

    const manaOverflowDiscount = player.mana >= 8 ? 0.55 : 1;
    let bestAction: AiSkillAction | null = null;
    let bestNetScore = baselineScore + (level === 5 ? 18 : 28);

    const seenSkillIds = new Set<SkillId>();
    for (const card of affordableCards) {
      if (performance.now() > deadline) break;
      const id = card.skillId;
      if (seenSkillIds.has(id)) continue;
      seenSkillIds.add(id);

      const cost = getEffectiveSkillCost(skillState, aiColor, id);
      const manaPenalty = cost * 22 * manaOverflowDiscount;
      const targets = getEligibleSkillTargets(chess, skillState, id, aiColor, null);
      if (targets.length === 0) continue;

      if (id === 'snipe') {
        for (const bSq of targets) {
          const enemies = getEligibleSkillTargets(chess, skillState, 'snipe', aiColor, bSq);
          for (const eSq of enemies) {
            if (performance.now() > deadline) break;
            const simChess = new Chess(fen);
            const step1 = applySkillTargetAction(simChess, skillState, aiColor, card.uid, bSq, 10);
            if (!step1) continue;
            const step2 = completeSnipeSkillAction(simChess, step1.nextSkillState, aiColor, eSq, 10);
            if (!step2) continue;
            const evalVal = scoreAfterOpponentReply(simChess, aiColor, level, deadline);
            const net = evalVal - manaPenalty;
            if (net > bestNetScore) {
              bestNetScore = net;
              bestAction = {
                type: 'cast',
                card,
                skillId: id,
                targetSquare: bSq,
                secondarySquare: eSq,
              };
            }
          }
        }
        continue;
      }

      if (id === 'swap' && targets.length >= 2) {
        const sortedTgt = [...targets].sort((a, b) => {
          const pa = chess.get(a);
          const pb = chess.get(b);
          const va = (pa ? PIECE_VALUES[pa.type] : 0) * (chess.isAttacked(a, enemyColor) ? 2 : 1);
          const vb = (pb ? PIECE_VALUES[pb.type] : 0) * (chess.isAttacked(b, enemyColor) ? 2 : 1);
          return vb - va;
        });
        let pairsChecked = 0;
        for (const firstSq of sortedTgt.slice(0, 4)) {
          const seconds = getEligibleSkillTargets(chess, skillState, 'swap', aiColor, firstSq);
          for (const secSq of seconds.slice(0, 3)) {
            if (performance.now() > deadline || pairsChecked >= 8) break;
            pairsChecked++;
            const simChess = new Chess(fen);
            const step1 = applySkillTargetAction(simChess, skillState, aiColor, card.uid, firstSq, 10);
            if (!step1) continue;
            const step2 = completeSwapSkillAction(simChess, step1.nextSkillState, aiColor, secSq, 10);
            if (!step2) continue;
            const evalVal = scoreAfterOpponentReply(simChess, aiColor, level, deadline);
            const net = evalVal - manaPenalty;
            if (net > bestNetScore) {
              bestNetScore = net;
              bestAction = {
                type: 'cast',
                card,
                skillId: id,
                targetSquare: firstSq,
                secondarySquare: secSq,
              };
            }
          }
        }
        continue;
      }

      // Rank candidate target squares intelligently before simulation
      let candidateTargets = targets;
      if (id === 'shield') {
        candidateTargets = [...targets]
          .sort((a, b) => {
            const occA = chess.get(a);
            const occB = chess.get(b);
            let sa = ['c', 'd', 'e', 'f'].includes(a[0]) ? 30 : 10;
            let sb = ['c', 'd', 'e', 'f'].includes(b[0]) ? 30 : 10;
            if (occA && occA.color === aiColor && occA.type !== 'k') {
              sa += PIECE_VALUES[occA.type] * (chess.isAttacked(a, enemyColor) ? 2.5 : 0.7);
            }
            if (occB && occB.color === aiColor && occB.type !== 'k') {
              sb += PIECE_VALUES[occB.type] * (chess.isAttacked(b, enemyColor) ? 2.5 : 0.7);
            }
            return sb - sa;
          })
          .slice(0, 5);
      } else if (id === 'freeze' || id === 'disarm' || id === 'shadow_bind') {
        candidateTargets = [...targets]
          .sort((a, b) => {
            const pa = chess.get(a);
            const pb = chess.get(b);
            return (pb ? PIECE_VALUES[pb.type] : 0) - (pa ? PIECE_VALUES[pa.type] : 0);
          })
          .slice(0, 4);
      } else if (id === 'smoke') {
        candidateTargets = [...targets]
          .sort((a, b) => {
            const ca = (['d4', 'd5', 'e4', 'e5'].includes(a) ? 40 : 0) + (chess.isAttacked(a, enemyColor) ? 35 : 0);
            const cb = (['d4', 'd5', 'e4', 'e5'].includes(b) ? 40 : 0) + (chess.isAttacked(b, enemyColor) ? 35 : 0);
            return cb - ca;
          })
          .slice(0, 4);
      } else if (id === 'revive' || id === 'pawn_guard') {
        candidateTargets = [...targets]
          .sort((a, b) => {
            const ca = ['c', 'd', 'e', 'f'].includes(a[0]) ? 20 : 0;
            const cb = ['c', 'd', 'e', 'f'].includes(b[0]) ? 20 : 0;
            return cb - ca;
          })
          .slice(0, 4);
      } else if (id === 'tactical_jam' || id === 'arcane_tome' || id === 'mana_drain') {
        candidateTargets = targets.slice(0, 1);
      } else {
        candidateTargets = targets.slice(0, 6);
      }

      for (const sq of candidateTargets) {
        if (performance.now() > deadline) break;
        const simChess = new Chess(fen);
        const res = applySkillTargetAction(simChess, skillState, aiColor, card.uid, sq, 10);
        if (!res) continue;

        let strategicBonus = 0;
        if (id === 'freeze') {
          const tgt = chess.get(sq as Square);
          if (tgt) strategicBonus += PIECE_VALUES[tgt.type] * 0.28;
        } else if (id === 'disarm' || id === 'shadow_bind') {
          const tgt = chess.get(sq as Square);
          if (tgt) strategicBonus += PIECE_VALUES[tgt.type] * 0.22;
        } else if (id === 'shield') {
          const occ = chess.get(sq as Square);
          if (occ && occ.color === aiColor && occ.type !== 'k') {
            strategicBonus += PIECE_VALUES[occ.type] * (chess.isAttacked(sq as Square, enemyColor) ? 0.65 : 0.16);
          } else {
            strategicBonus += 55;
          }
        } else if (id === 'purify') {
          const occ = chess.get(sq as Square);
          if (occ) strategicBonus += PIECE_VALUES[occ.type] * 0.32;
        } else if (id === 'tactical_jam') {
          const alreadyVeiled = skillState.effects.veiledRanks?.some(
            (v) => v.ownerColor === aiColor && v.remainingTurns > 0
          );
          if (!alreadyVeiled) strategicBonus += 70;
        } else if (id === 'arcane_tome') {
          const roomInHand = getHandLimit(skillState, aiColor) - player.hand.length + 1;
          strategicBonus += roomInHand >= 2 ? 120 : 50;
        } else if (id === 'mana_drain') {
          strategicBonus += skillState[enemyColor].mana >= 3 ? 110 : 35;
        } else if (id === 'smoke') {
          strategicBonus += chess.isAttacked(sq as Square, enemyColor) ? 55 : 25;
        }

        if (!res.endedTurn) {
          const legalFollowups = getAllLegalMovesWithSkills(simChess, res.nextSkillState);
          if (legalFollowups.length === 0) continue;
        }

        const evalVal = res.endedTurn
          ? scoreAfterOpponentReply(simChess, aiColor, level, deadline)
          : evaluateBestFollowupWithSkills(simChess, res.nextSkillState, aiColor, level, deadline);

        const net = evalVal + strategicBonus - manaPenalty;
        if (net > bestNetScore) {
          bestNetScore = net;
          bestAction = {
            type: 'cast',
            card,
            skillId: id,
            targetSquare: sq,
          };
        }
      }
    }

    return bestAction;
  }

  // Levels 1-3: Fast lightweight heuristics (always verify post-cast legal moves exist!)
  const castChance = level === 1 ? 0.28 : level === 2 ? 0.48 : 0.68;
  if (Math.random() > castChance) return null;

  const canMoveAfterCast = (candidate: AiSkillAction): boolean => {
    try {
      const simChess = new Chess(fen);
      if (candidate.skillId === 'snipe' || candidate.skillId === 'swap') {
        return true;
      }
      if (!candidate.targetSquare) return false;
      const res = applySkillTargetAction(
        simChess,
        skillState,
        aiColor,
        candidate.card.uid,
        candidate.targetSquare,
        10
      );
      if (!res) return false;
      if (res.endedTurn) return true;
      return getAllLegalMovesWithSkills(simChess, res.nextSkillState).length > 0;
    } catch {
      return false;
    }
  };

  for (const card of affordableCards) {
    const id = card.skillId;
    const targets = getEligibleSkillTargets(chess, skillState, id, aiColor, null);
    if (targets.length === 0) continue;

    if (id === 'snipe') {
      let bestBishop = targets[0];
      let bestTarget = '';
      let bestVal = -1;
      for (const bSq of targets) {
        const enemies = getEligibleSkillTargets(chess, skillState, 'snipe', aiColor, bSq);
        for (const eSq of enemies) {
          const p = chess.get(eSq);
          const val = p ? PIECE_VALUES[p.type] : 0;
          if (val > bestVal) {
            bestVal = val;
            bestBishop = bSq;
            bestTarget = eSq;
          }
        }
      }
      if (bestTarget) {
        return {
          type: 'cast',
          card,
          skillId: id,
          targetSquare: bestBishop,
          secondarySquare: bestTarget,
        };
      }
      continue;
    }

    if (id === 'revive') {
      if (countFriendlyPieces(chess, aiColor, 'n') < 2) {
        const centerPref = targets.filter((sq) => ['c', 'd', 'e', 'f'].includes(sq[0]));
        const pool = centerPref.length > 0 ? centerPref : targets;
        const sq = pool[Math.floor(Math.random() * pool.length)];
        const cand: AiSkillAction = { type: 'cast', card, skillId: id, targetSquare: sq };
        if (canMoveAfterCast(cand)) return cand;
      }
      continue;
    }

    if (id === 'pawn_guard') {
      const revType = getRevivablePieceType(chess, aiColor, true);
      if (revType) {
        const sq = targets[Math.floor(Math.random() * targets.length)];
        const cand: AiSkillAction = { type: 'cast', card, skillId: id, targetSquare: sq };
        if (canMoveAfterCast(cand)) return cand;
      }
      continue;
    }

    if (id === 'shield') {
      let bestSq = '';
      let bestScore = -1;
      for (const sq of targets) {
        const occ = chess.get(sq);
        let sc = ['c', 'd', 'e', 'f'].includes(sq[0]) ? 30 : 10;
        if (['4', '5'].includes(sq[1])) sc += 25;
        if (occ && occ.color === aiColor && occ.type !== 'k') {
          sc += PIECE_VALUES[occ.type] * (chess.isAttacked(sq, enemyColor) ? 1.5 : 0.6);
        }
        if (sc > bestScore) {
          bestScore = sc;
          bestSq = sq;
        }
      }
      if (bestSq) {
        const cand: AiSkillAction = { type: 'cast', card, skillId: id, targetSquare: bestSq };
        if (canMoveAfterCast(cand)) return cand;
      }
      continue;
    }

    if (id === 'freeze' || id === 'disarm' || id === 'shadow_bind') {
      let bestSq = targets[0];
      let bestVal = -1;
      for (const sq of targets) {
        const p = chess.get(sq);
        const val = p ? PIECE_VALUES[p.type] : 0;
        if (val > bestVal) {
          bestVal = val;
          bestSq = sq;
        }
      }
      if (bestVal >= 320 || level <= 2) {
        const cand: AiSkillAction = { type: 'cast', card, skillId: id, targetSquare: bestSq };
        if (canMoveAfterCast(cand)) return cand;
      }
      continue;
    }

    if (id === 'purify') {
      const cand: AiSkillAction = { type: 'cast', card, skillId: id, targetSquare: targets[0] };
      if (canMoveAfterCast(cand)) return cand;
      continue;
    }

    if (id === 'mana_drain') {
      if (skillState[enemyColor].mana >= 2 || (level <= 2 && skillState[enemyColor].mana >= 1)) {
        const cand: AiSkillAction = { type: 'cast', card, skillId: id, targetSquare: targets[0] };
        if (canMoveAfterCast(cand)) return cand;
      }
      continue;
    }

    if (id === 'arcane_tome') {
      const limit = getHandLimit(skillState, aiColor);
      if (player.hand.length <= limit - 1 || level <= 2) {
        const cand: AiSkillAction = { type: 'cast', card, skillId: id, targetSquare: targets[0] };
        if (canMoveAfterCast(cand)) return cand;
      }
      continue;
    }

    if (id === 'tactical_jam') {
      const alreadyVeiled = skillState.effects.veiledRanks?.some(
        (v) => v.ownerColor === aiColor && v.remainingTurns > 0
      );
      if (!alreadyVeiled) {
        const cand: AiSkillAction = { type: 'cast', card, skillId: id, targetSquare: targets[0] };
        if (canMoveAfterCast(cand)) return cand;
      }
      continue;
    }

    if (id === 'royal_escape') {
      if (chess.inCheck() || (level <= 3 && Math.random() < 0.3)) {
        const sq = targets[Math.floor(Math.random() * targets.length)];
        const cand: AiSkillAction = { type: 'cast', card, skillId: id, targetSquare: sq };
        if (canMoveAfterCast(cand)) return cand;
      }
      continue;
    }

    if (id === 'great_attack') {
      const dir = aiColor === 'w' ? 1 : -1;
      const frontEnemyTargets = targets.filter((sq) => {
        const frontRank = Number(sq[1]) + dir;
        if (frontRank < 1 || frontRank > 8) return false;
        const frontOcc = chess.get(`${sq[0]}${frontRank}` as Square);
        return Boolean(frontOcc && frontOcc.color === enemyColor);
      });
      if (frontEnemyTargets.length > 0) {
        const sq = frontEnemyTargets[Math.floor(Math.random() * frontEnemyTargets.length)];
        const cand: AiSkillAction = { type: 'cast', card, skillId: id, targetSquare: sq };
        if (canMoveAfterCast(cand)) return cand;
      }
      continue;
    }

    if (
      id === 'diagonal_rook' ||
      id === 'leap' ||
      id === 'march' ||
      id === 'camel_jump' ||
      id === 'phantom_step' ||
      id === 'bishop_shift' ||
      id === 'straight_bishop' ||
      id === 'trojan_horse' ||
      id === 'queens_gambit' ||
      id === 'pawn_surge' ||
      id === 'knight_sweep' ||
      id === 'field_promotion' ||
      id === 'royal_dash' ||
      id === 'alfil_leap' ||
      id === 'vanguard_lance' ||
      id === 'center_drop'
    ) {
      const sq = targets[Math.floor(Math.random() * targets.length)];
      const cand: AiSkillAction = { type: 'cast', card, skillId: id, targetSquare: sq };
      if (canMoveAfterCast(cand)) return cand;
      continue;
    }

    if (id === 'smoke') {
      const centerPref = targets.filter((sq) =>
        ['d4', 'd5', 'e4', 'e5', 'c4', 'c5', 'f4', 'f5'].includes(sq)
      );
      const pool = centerPref.length > 0 ? centerPref : targets;
      const sq = pool[Math.floor(Math.random() * pool.length)];
      const cand: AiSkillAction = { type: 'cast', card, skillId: id, targetSquare: sq };
      if (canMoveAfterCast(cand)) return cand;
      continue;
    }

    if (id === 'retreat' && level <= 3) {
      const sq = targets[Math.floor(Math.random() * targets.length)];
      const cand: AiSkillAction = { type: 'cast', card, skillId: id, targetSquare: sq };
      if (canMoveAfterCast(cand)) return cand;
      continue;
    }

    if (id === 'swap' && targets.length >= 2) {
      const first = targets[Math.floor(Math.random() * targets.length)];
      const seconds = getEligibleSkillTargets(chess, skillState, 'swap', aiColor, first);
      if (seconds.length > 0) {
        return {
          type: 'cast',
          card,
          skillId: id,
          targetSquare: first,
          secondarySquare: seconds[Math.floor(Math.random() * seconds.length)],
        };
      }
    }
  }

  return null;
}

export function chooseAiMove(
  fen: string,
  level: AiLevel,
  skillState: SkillMatchState | null = null,
  chess960State: Chess960State | null = null,
  customBudgetMs?: number
): { from: string; to: string; promotion?: PieceType } | null {
  const chess = new Chess(fen);
  const aiColor = chess.turn() as PieceColor;
  const aiAug = skillState ? skillState[aiColor].augment : null;
  const isCritical = level === 5 && isCriticalPosition(chess, skillState, aiColor);

  const hasSkillConstraints =
    Boolean(skillState) &&
    (Boolean(skillState?.activeCast?.lockedPieceSquare) ||
      (skillState?.effects.frozen.length || 0) > 0 ||
      (skillState?.effects.disarmed.length || 0) > 0 ||
      (skillState?.effects.shielded.length || 0) > 0 ||
      (skillState?.effects.shieldZones?.length || 0) > 0 ||
      (skillState?.effects.smoke.length || 0) > 0 ||
      (skillState?.effects.bound?.length || 0) > 0 ||
      aiAug === 'double_pawn_march' ||
      aiAug === 'knight_step' ||
      aiAug === 'holy_bishop');

  if (hasSkillConstraints && skillState) {
    let augmentedMoves: AugmentedMove[] = getAllLegalMovesWithSkills(chess, skillState);
    if (augmentedMoves.length === 0 && skillState.activeCast) {
      augmentedMoves = getAllLegalMovesWithSkills(chess, {
        ...skillState,
        activeCast: null,
      });
    }
    if (augmentedMoves.length === 0) return null;

    if (level === 1) {
      const chosen = augmentedMoves[Math.floor(Math.random() * augmentedMoves.length)];
      return { from: chosen.from, to: chosen.to, promotion: chosen.promotion };
    }

    if (level === 2) {
      let bestMove = augmentedMoves[0];
      let bestScore = -Infinity;
      for (const m of augmentedMoves) {
        let score = Math.random() * 40;
        if (m.captured) score += PIECE_VALUES[m.captured] * 1.15;
        if (m.promotion) score += PIECE_VALUES[m.promotion];
        if (m.isSkillAugmented) score += 90;
        if (m.san.includes('#')) score += 90000;
        else if (m.san.includes('+')) score += 60;
        if (score > bestScore) {
          bestScore = score;
          bestMove = m;
        }
      }
      return {
        from: bestMove.from,
        to: bestMove.to,
        promotion: bestMove.promotion,
      };
    }

    // Iterative Deepening Skill-Constrained Alpha-Beta Search
    const maxSkillDepth = level === 5 ? (isCritical ? 5 : 4) : level === 4 ? 2 : 1;
    const budgetMs =
      customBudgetMs !== undefined
        ? customBudgetMs
        : level === 5
        ? isCritical
          ? 14500
          : 4800
        : level === 4
        ? 950
        : 420;
    const ctx = createSearchContext(budgetMs, level === 5 ? 4 : 2, level === 5 ? 2 : 1);

    const ownZoneSet = new Set(
      (skillState.effects.shieldZones || [])
        .filter((z) => z.color === aiColor)
        .map((z) => z.square)
    );
    const ownUntilMovedShieldSet = new Set(
      skillState.effects.shielded
        .filter((s) => s.color === aiColor && Boolean(s.untilMoved))
        .map((s) => s.square)
    );
    const shieldedEnemyBonusSquares = new Set(
      skillState.effects.shielded.filter((s) => s.color !== aiColor).map((s) => s.square)
    );

    const sortedRoot = [...augmentedMoves].sort((a, b) => {
      const sa =
        (a.san.includes('#') ? 100000 : 0) +
        (a.captured ? PIECE_VALUES[a.captured] * 10 : 0) +
        (a.promotion ? PIECE_VALUES[a.promotion] * 8 : 0) +
        (ownZoneSet.has(a.to) ? 200 : 0) +
        (a.san.includes('+') ? 80 : 0);
      const sb =
        (b.san.includes('#') ? 100000 : 0) +
        (b.captured ? PIECE_VALUES[b.captured] * 10 : 0) +
        (b.promotion ? PIECE_VALUES[b.promotion] * 8 : 0) +
        (ownZoneSet.has(b.to) ? 200 : 0) +
        (b.san.includes('+') ? 80 : 0);
      return sb - sa;
    });

    let bestMove = sortedRoot[0];

    try {
      for (let depth = 1; depth <= maxSkillDepth; depth++) {
        let currentBestMove = bestMove;
        let currentBestScore = -Infinity;

        // Put previous best move first on deeper iterations
        const iterationMoves =
          depth === 1
            ? sortedRoot
            : [bestMove, ...sortedRoot.filter((m) => m !== bestMove)];

        for (const m of iterationMoves) {
          if (m.san.includes('#')) {
            return { from: m.from, to: m.to, promotion: m.promotion };
          }

          const simChess = applyAugmentedMoveToClone(chess, m);
          if (!simChess) continue;
          if (simChess.isCheckmate()) {
            return { from: m.from, to: m.to, promotion: m.promotion };
          }

          let val: number;
          if (depth <= 1) {
            val = evaluateBoard(simChess, aiColor);
          } else {
            val = alphaBeta(
              simChess,
              depth - 1,
              1,
              -Infinity,
              Infinity,
              false,
              aiColor,
              ctx,
              level >= 4,
              ctx.maxExtensions
            );
          }

          if (ctx.aborted) break;

          const movingPiece = chess.get(m.from as Square);
          if (movingPiece && movingPiece.type !== 'k' && ownZoneSet.has(m.to)) {
            val += 150 + PIECE_VALUES[movingPiece.type] * 0.35;
          }
          if (movingPiece && ownUntilMovedShieldSet.has(m.from) && !m.captured) {
            val -= 95;
          }
          if (
            shieldedEnemyBonusSquares.size > 0 &&
            movingPiece &&
            simChess.isAttacked(m.to as Square, aiColor === 'w' ? 'b' : 'w')
          ) {
            val -= 12;
          }

          const jitter =
            level === 3 ? Math.random() * 8 - 4 : level === 4 ? Math.random() * 3 - 1.5 : 0;
          if (val + jitter > currentBestScore) {
            currentBestScore = val + jitter;
            currentBestMove = m;
          }
        }

        if (ctx.aborted) break;
        bestMove = currentBestMove;
        if (currentBestScore > 50000) break;
      }
    } catch {
      // Fall through safely with bestMove initialized to sortedRoot[0]
    }

    return {
      from: bestMove.from,
      to: bestMove.to,
      promotion: bestMove.promotion,
    };
  }

  const legalMoves = chess.moves({ verbose: true });
  const castling960Options = chess960State
    ? getChess960CastlingMoves(chess, chess960State)
    : [];
  if (legalMoves.length === 0 && castling960Options.length === 0) return null;

  if (level === 1) {
    const mateMove = legalMoves.find((m) => m.san.includes('#'));
    if (mateMove)
      return {
        from: mateMove.from,
        to: mateMove.to,
        promotion: mateMove.promotion as PieceType | undefined,
      };
    const captures = legalMoves.filter((m) => Boolean(m.captured));
    if (captures.length > 0 && Math.random() < 0.45) {
      const c = captures[Math.floor(Math.random() * captures.length)];
      return { from: c.from, to: c.to, promotion: c.promotion as PieceType | undefined };
    }
    if (legalMoves.length > 0) {
      const r = legalMoves[Math.floor(Math.random() * legalMoves.length)];
      return { from: r.from, to: r.to, promotion: r.promotion as PieceType | undefined };
    }
    const c960 = castling960Options[0];
    return { from: c960.kingFrom, to: c960.kingTo };
  }

  if (level === 2) {
    const scored = legalMoves.map((move) => {
      chess.move(move);
      const val = evaluateBoard(chess, aiColor) + (Math.random() * 45 - 22);
      chess.undo();
      return {
        from: move.from,
        to: move.to,
        promotion: move.promotion as PieceType | undefined,
        val,
      };
    });
    for (const c960 of castling960Options) {
      const sim = new Chess(fen);
      const res = executeChess960Move(sim, chess960State, c960.kingFrom, c960.kingTo, undefined, 0);
      if (res) {
        scored.push({
          from: c960.kingFrom,
          to: c960.kingTo,
          promotion: undefined,
          val: evaluateBoard(sim, aiColor) + 35,
        });
      }
    }
    scored.sort((a, b) => b.val - a.val);
    const topPool = scored.slice(0, Math.min(3, scored.length));
    const pick =
      scored[0].val > 50000 || Math.random() < 0.65
        ? scored[0]
        : topPool[Math.floor(Math.random() * topPool.length)];
    return { from: pick.from, to: pick.to, promotion: pick.promotion };
  }

  // Iterative Deepening Alpha-Beta with TT + Killers + History + Check Extension
  // Lv.5 Viktor uses up to 15s (14800ms) and deeper iterative search on critical positions!
  const nonKingMat = countNonKingMaterial(chess);
  const maxDepth =
    level === 3
      ? 3
      : level === 4
      ? 4
      : isCritical
      ? nonKingMat <= 2200
        ? 8
        : 7
      : 6;
  const timeBudgetMs =
    customBudgetMs !== undefined
      ? customBudgetMs
      : level === 3
      ? 450
      : level === 4
      ? 1100
      : isCritical
      ? 14800
      : 4200;
  const useQuiescence = level >= 4;
  const qMaxDepth = level === 5 ? (isCritical ? 5 : 4) : 2;
  const maxExtensions = level === 5 ? 2 : 1;

  const ctx = createSearchContext(timeBudgetMs, qMaxDepth, maxExtensions);

  let bestChoice: { from: string; to: string; promotion?: PieceType; key: string } =
    legalMoves.length > 0
      ? (() => {
          const m = orderMoves([...legalMoves])[0];
          return {
            from: m.from,
            to: m.to,
            promotion: m.promotion as PieceType | undefined,
            key: moveKey(m),
          };
        })()
      : {
          from: castling960Options[0].kingFrom,
          to: castling960Options[0].kingTo,
          key: `${castling960Options[0].kingFrom}${castling960Options[0].kingTo}`,
        };

  try {
    for (let depth = 1; depth <= maxDepth; depth++) {
      let currentBestChoice = bestChoice;
      let currentBestScore = -Infinity;
      const ordered = orderMoves([...legalMoves], 0, ctx, bestChoice.key);

      for (const move of ordered) {
        chess.move(move);
        const score = alphaBeta(
          chess,
          depth - 1,
          1,
          -Infinity,
          Infinity,
          false,
          aiColor,
          ctx,
          useQuiescence,
          maxExtensions
        );
        chess.undo();

        if (ctx.aborted) break;

        const jitter =
          level === 3 ? Math.random() * 10 - 5 : level === 4 ? Math.random() * 3 - 1.5 : 0;
        if (score + jitter > currentBestScore) {
          currentBestScore = score + jitter;
          currentBestChoice = {
            from: move.from,
            to: move.to,
            promotion: move.promotion as PieceType | undefined,
            key: moveKey(move),
          };
        }
      }

      // Also consider Chess960 castling moves at the root!
      if (!ctx.aborted && castling960Options.length > 0) {
        for (const c960 of castling960Options) {
          const sim = new Chess(fen);
          const res = executeChess960Move(
            sim,
            chess960State,
            c960.kingFrom,
            c960.kingTo,
            undefined,
            0
          );
          if (!res) continue;
          const score =
            alphaBeta(
              sim,
              depth - 1,
              1,
              -Infinity,
              Infinity,
              false,
              aiColor,
              ctx,
              useQuiescence,
              maxExtensions
            ) + 28;
          if (ctx.aborted) break;
          if (score > currentBestScore) {
            currentBestScore = score;
            currentBestChoice = {
              from: c960.kingFrom,
              to: c960.kingTo,
              key: `${c960.kingFrom}${c960.kingTo}`,
            };
          }
        }
      }

      if (ctx.aborted) break;
      bestChoice = currentBestChoice;
      if (currentBestScore > 50000) break;
    }
  } catch {
    // Fall through safely with bestChoice initialized from root legal move
  }

  return {
    from: bestChoice.from,
    to: bestChoice.to,
    promotion: bestChoice.promotion,
  };
}

export function planAiTurn(params: {
  fen: string;
  level: AiLevel;
  skillState: SkillMatchState | null;
  chess960State?: Chess960State | null;
  currentMoveCount?: number;
}): {
  skillAction: AiSkillAction | null;
  move: { from: string; to: string; promotion?: PieceType } | null;
} {
  const {
    fen,
    level,
    skillState,
    chess960State = null,
    currentMoveCount = 0,
  } = params;
  const startMs = performance.now();

  let workingFen = fen;
  let workingSkill = skillState;
  let skillAction: AiSkillAction | null = null;

  if (skillState && !skillState.augmentPhase) {
    try {
      skillAction = chooseAiSkillAction(
        fen,
        level,
        skillState,
        level === 5 ? 3200 : 950
      );

      if (skillAction?.type === 'cast' && skillAction.targetSquare) {
        const simChess = new Chess(fen);
        const turnColor = simChess.turn() as PieceColor;
        const res = applySkillTargetAction(
          simChess,
          skillState,
          turnColor,
          skillAction.card.uid,
          skillAction.targetSquare,
          currentMoveCount
        );
        if (res) {
          if (
            skillAction.skillId === 'swap' &&
            skillAction.secondarySquare &&
            res.nextSkillState.activeCast?.swapFirstSquare
          ) {
            const swapped = completeSwapSkillAction(
              simChess,
              res.nextSkillState,
              turnColor,
              skillAction.secondarySquare,
              currentMoveCount
            );
            if (swapped) {
              return { skillAction, move: null };
            }
            skillAction = null;
          } else if (
            skillAction.skillId === 'snipe' &&
            skillAction.secondarySquare &&
            res.nextSkillState.activeCast?.snipeBishopSquare
          ) {
            const sniped = completeSnipeSkillAction(
              simChess,
              res.nextSkillState,
              turnColor,
              skillAction.secondarySquare,
              currentMoveCount
            );
            if (sniped) {
              return { skillAction, move: null };
            }
            skillAction = null;
          } else if (res.endedTurn) {
            return { skillAction, move: null };
          } else if (getAllLegalMovesWithSkills(simChess, res.nextSkillState).length > 0) {
            workingFen = simChess.fen();
            workingSkill = res.nextSkillState;
          } else {
            // Never lock AI into a zero-move state via skill cast
            skillAction = null;
            workingFen = fen;
            workingSkill = skillState;
          }
        } else {
          skillAction = null;
        }
      }
    } catch {
      skillAction = null;
      workingFen = fen;
      workingSkill = skillState;
    }
  }

  let budgetOverride: number | undefined;
  if (level === 5) {
    const simChess = new Chess(workingFen);
    const aiColor = simChess.turn() as PieceColor;
    const critical = isCriticalPosition(simChess, workingSkill, aiColor);
    const elapsed = performance.now() - startMs;
    const totalMax = critical ? 14800 : 4500;
    budgetOverride = Math.max(1200, totalMax - elapsed);
  }

  const move = chooseAiMove(
    workingFen,
    level,
    workingSkill,
    chess960State,
    budgetOverride
  );
  if (!move && skillAction) {
    // Retry without the skill action so AI still plays a legal move
    const fallbackMove = chooseAiMove(
      fen,
      level,
      skillState,
      chess960State,
      400
    );
    return { skillAction: null, move: fallbackMove };
  }
  return { skillAction, move };
}


