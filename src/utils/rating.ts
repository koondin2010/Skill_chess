import { Chess } from 'chess.js';
import type { PieceColor, PieceType, RankTierInfo, RatingCategory, RuleMode } from '../types/chess.ts';

const MATERIAL_POINTS: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export const INITIAL_RATING = 0;
export const MIN_RATING = 0;

export function getRatingCategoryForRuleMode(ruleMode: RuleMode): RatingCategory {
  return ruleMode === 'skill' ? 'skill' : 'classic';
}

export function computeMaterialDiffForWinner(fen: string, winner: PieceColor): number {
  try {
    const chess = new Chess(fen);
    const board = chess.board();
    let wPts = 0;
    let bPts = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p || p.type === 'k') continue;
        if (p.color === 'w') wPts += MATERIAL_POINTS[p.type];
        else bPts += MATERIAL_POINTS[p.type];
      }
    }
    const diff = winner === 'w' ? wPts - bPts : bPts - wPts;
    return Math.max(0, diff);
  } catch {
    return 0;
  }
}

/**
 * Computes friend-match rating delta based on material margin & game length:
 * - Close win (~0-1 pt margin): ~15 pts
 * - Dominant win (~9+ pt margin): up to hard cap 30 pts
 * - Longer games gradually increase delta up to the 30-pt cap
 */
export function computeFriendMatchRatingDelta(
  fen: string,
  winner: PieceColor | 'draw',
  plyCount: number
): { winnerDelta: number; loserDelta: number; materialDiff: number } {
  if (winner === 'draw') {
    return { winnerDelta: 0, loserDelta: 0, materialDiff: 0 };
  }
  const materialDiff = computeMaterialDiffForWinner(fen, winner);
  const marginBonus = Math.min(14, (materialDiff / 9) * 14);
  const lengthBonus = Math.min(5, Math.floor(Math.max(0, plyCount - 16) / 14));
  const magnitude = Math.min(30, Math.max(15, Math.round(15 + marginBonus + lengthBonus)));

  return {
    winnerDelta: magnitude,
    loserDelta: -magnitude,
    materialDiff,
  };
}

/**
 * Applies tier-based loss protection & max-loss cap:
 * - Iron (<300, >0): 30% less loss (floored)
 * - Bronze (300..599): 20% less loss (floored)
 * - Silver (600..899): 10% less loss (floored)
 * - Any loss is at most (winnerGain - 1), and rating never drops below 0
 */
export function computeEffectivePlayerDelta(
  baseDelta: number,
  currentRating: number
): number {
  if (baseDelta >= 0) {
    return Math.round(baseDelta);
  }
  const winnerGain = Math.abs(Math.round(baseDelta));
  if (winnerGain === 0) return 0;

  const tier = getRankInfo(currentRating).id;
  let reductionPct = 0;
  if (tier === 'iron') reductionPct = 30;
  else if (tier === 'bronze') reductionPct = 20;
  else if (tier === 'silver') reductionPct = 10;

  const discount = Math.floor((winnerGain * reductionPct) / 100);
  const maxAllowedLoss = Math.max(0, winnerGain - 1);
  const adjustedLoss = Math.min(maxAllowedLoss, Math.max(0, winnerGain - discount));
  const nextRating = Math.max(MIN_RATING, currentRating - adjustedLoss);
  return nextRating - currentRating;
}

export function applyRatingDelta(currentRating: number, delta: number): number {
  return Math.max(MIN_RATING, Math.round(currentRating + delta));
}

export function getRankInfo(rating: number): RankTierInfo {
  if (rating >= 3000) {
    return {
      id: 'grandmaster',
      tier: '그랜드마스터',
      badgeColor: 'text-rose-200 border-rose-400 bg-rose-950/90',
      minRating: 3000,
    };
  }
  if (rating >= 2500) {
    return {
      id: 'master',
      tier: '마스터',
      badgeColor: 'text-purple-200 border-purple-400 bg-purple-950/90',
      minRating: 2500,
    };
  }
  if (rating >= 2000) {
    return {
      id: 'diamond',
      tier: '다이아',
      badgeColor: 'text-sky-200 border-sky-400 bg-sky-950/90',
      minRating: 2000,
    };
  }
  if (rating >= 1500) {
    return {
      id: 'emerald',
      tier: '에메랄드',
      badgeColor: 'text-emerald-200 border-emerald-400 bg-emerald-950/90',
      minRating: 1500,
    };
  }
  if (rating >= 1200) {
    return {
      id: 'platinum',
      tier: '플레티넘',
      badgeColor: 'text-teal-200 border-teal-400 bg-teal-950/90',
      minRating: 1200,
    };
  }
  if (rating >= 900) {
    return {
      id: 'gold',
      tier: '골드',
      badgeColor: 'text-amber-200 border-amber-400 bg-amber-950/90',
      minRating: 900,
    };
  }
  if (rating >= 600) {
    return {
      id: 'silver',
      tier: '실버',
      badgeColor: 'text-slate-100 border-slate-300 bg-slate-800/90',
      minRating: 600,
    };
  }
  if (rating >= 300) {
    return {
      id: 'bronze',
      tier: '브론즈',
      badgeColor: 'text-orange-200 border-orange-500/80 bg-orange-950/85',
      minRating: 300,
    };
  }
  if (rating > 0) {
    return {
      id: 'iron',
      tier: '아이언',
      badgeColor: 'text-zinc-200 border-zinc-400 bg-zinc-800/90',
      minRating: 1,
    };
  }
  return {
    id: 'unranked',
    tier: '언랭크',
    badgeColor: 'text-slate-400 border-slate-600 bg-slate-900/90',
    minRating: 0,
  };
}
