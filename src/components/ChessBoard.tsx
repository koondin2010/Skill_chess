import React, { useMemo, useState, useEffect } from 'react';
import { Chess, Square } from 'chess.js';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import type {
  AugmentId,
  Chess960State,
  PieceColor,
  PieceType,
  SkillId,
  SkillMatchState,
} from '../types/chess';
import {
  AUGMENT_DEFINITIONS,
  SKILL_DEFINITIONS,
  getSkillAugmentedMovesForSquare,
  isHolyBishopActive,
  isMegaKnightActive,
} from '../engine/skillChess';
import { getChess960CastlingMoves } from '../engine/chess960';
import { PixelPiece } from './PixelPieces';
import { AugmentPixelBadge, PixelManaGem, SkillPixelIllustration } from './SkillPixelArt';
import { soundEngine } from '../utils/sound';

interface ChessBoardProps {
  fen: string;
  playerColor: PieceColor | 'both' | 'spectator';
  flipped: boolean;
  disabled: boolean;
  lastMove: { from: string; to: string; captured?: PieceType } | null;
  moveSeq: number;
  inCheck: boolean;
  chess960State?: Chess960State | null;
  skillState?: SkillMatchState | null;
  targetingSkillId?: SkillId | null;
  skillTargetSquares?: Square[];
  onSkillTargetSquare?: (sq: Square) => void;
  onMove: (from: string, to: string, promotion?: PieceType) => void;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

function squareToCoords(sq: string, flipped: boolean): { col: number; row: number } {
  const fileIdx = FILES.indexOf(sq[0]);
  const rankIdx = RANKS.indexOf(sq[1]);
  if (flipped) {
    return { col: 7 - fileIdx, row: 7 - rankIdx };
  }
  return { col: fileIdx, row: rankIdx };
}

export const ChessBoard: React.FC<ChessBoardProps> = ({
  fen,
  playerColor,
  flipped,
  disabled,
  lastMove,
  moveSeq,
  inCheck,
  chess960State = null,
  skillState = null,
  targetingSkillId = null,
  skillTargetSquares = [],
  onSkillTargetSquare,
  onMove,
}) => {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square;
    to: Square;
    color: PieceColor;
  } | null>(null);
  const [burstSquare, setBurstSquare] = useState<string | null>(null);
  const [manaBurst, setManaBurst] = useState<{
    seq: number;
    square: string;
    color: PieceColor;
    amount: number;
  } | null>(null);
  const [inspectedStatus, setInspectedStatus] = useState<{
    square: string;
    title: string;
    items: Array<{ label: string; badgeClass: string; desc: string }>;
  } | null>(null);
  const [activeVfx, setActiveVfx] = useState<{
    seq: number;
    skillId: SkillId;
    square: string;
    secondarySquare?: string;
    color: PieceColor;
  } | null>(null);
  const [activeAugmentFx, setActiveAugmentFx] = useState<{
    seq: number;
    augmentId: AugmentId;
    color: PieceColor;
    square?: string;
    label: string;
  } | null>(null);

  const chess = useMemo(() => new Chess(fen), [fen]);
  const turn = chess.turn() as PieceColor;
  const boardMatrix = useMemo(() => chess.board(), [chess]);

  const lockedSquare = skillState?.activeCast?.lockedPieceSquare as Square | null | undefined;
  const swapFirstSquare = skillState?.activeCast?.swapFirstSquare as Square | null | undefined;
  const snipeBishopSquare = skillState?.activeCast?.snipeBishopSquare as Square | null | undefined;

  const megaKnightActiveW = useMemo(
    () => isMegaKnightActive(chess, skillState, 'w'),
    [chess, skillState]
  );
  const megaKnightActiveB = useMemo(
    () => isMegaKnightActive(chess, skillState, 'b'),
    [chess, skillState]
  );
  const holyBishopActiveW = useMemo(
    () => isHolyBishopActive(chess, skillState, 'w'),
    [chess, skillState]
  );
  const holyBishopActiveB = useMemo(
    () => isHolyBishopActive(chess, skillState, 'b'),
    [chess, skillState]
  );

  // Auto-select locked piece when a piece-buff skill was just applied!
  useEffect(() => {
    if (lockedSquare && !disabled && (playerColor === 'both' || playerColor === turn)) {
      setSelectedSquare(lockedSquare);
    } else {
      setSelectedSquare(null);
    }
    setPendingPromotion(null);
  }, [fen, lockedSquare, disabled, playerColor, turn]);

  // Capture pixel burst
  useEffect(() => {
    if (lastMove?.captured) {
      setBurstSquare(lastMove.to);
      const timer = setTimeout(() => setBurstSquare(null), 340);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [lastMove, moveSeq]);

  // Skill cast VFX burst
  useEffect(() => {
    const vfx = skillState?.lastVfx;
    if (!vfx) return;
    setActiveVfx({
      seq: vfx.seq,
      skillId: vfx.skillId,
      square: vfx.square,
      secondarySquare: vfx.secondarySquare,
      color: vfx.color,
    });
    const timer = setTimeout(() => setActiveVfx(null), 780);
    return () => clearTimeout(timer);
  }, [skillState?.lastVfx?.seq]);

  // Augment trigger VFX + chime
  useEffect(() => {
    const afx = skillState?.lastAugmentFx;
    if (!afx) return;
    setActiveAugmentFx(afx);
    soundEngine.playAugmentTrigger();
    const timer = setTimeout(() => setActiveAugmentFx(null), 1550);
    return () => clearTimeout(timer);
  }, [skillState?.lastAugmentFx?.seq]);

  // Capture mana +1/+2 floating effect when a piece is captured
  useEffect(() => {
    const cap = skillState?.lastCaptureMana;
    if (!cap) return;
    setManaBurst(cap);
    const soundTimer = setTimeout(() => soundEngine.playManaGain(), 90);
    const clearTimer = setTimeout(() => setManaBurst(null), 1050);
    return () => {
      clearTimeout(soundTimer);
      clearTimeout(clearTimer);
    };
  }, [skillState?.lastCaptureMana?.seq]);

  // Clear inspected status tooltip if FEN changes
  useEffect(() => {
    setInspectedStatus(null);
  }, [fen]);

  const canControlTurn =
    !disabled &&
    playerColor !== 'spectator' &&
    (playerColor === 'both' || playerColor === turn);

  const skillTargetSet = useMemo(
    () => new Set<string>(skillTargetSquares),
    [skillTargetSquares]
  );

  const legalMovesForSelected = useMemo(() => {
    if (!selectedSquare || !canControlTurn || targetingSkillId) return [];
    const baseMoves = getSkillAugmentedMovesForSquare(chess, skillState, selectedSquare).map(
      (m) => ({ ...m, isChess960Castle: false })
    );
    if (chess960State) {
      const selPiece = chess.get(selectedSquare);
      if (selPiece && selPiece.type === 'k' && selPiece.color === turn) {
        const castlings = getChess960CastlingMoves(chess, chess960State);
        for (const c of castlings) {
          if (c.kingTo !== selectedSquare && !baseMoves.some((m) => m.to === c.kingTo)) {
            baseMoves.push({
              from: selectedSquare,
              to: c.kingTo,
              san: c.sanBase,
              flags: c.side,
              isSkillAugmented: false,
              isChess960Castle: true,
            });
          }
          if (!baseMoves.some((m) => m.to === c.rookFrom)) {
            baseMoves.push({
              from: selectedSquare,
              to: c.rookFrom,
              san: c.sanBase,
              flags: c.side,
              isSkillAugmented: false,
              isChess960Castle: true,
            });
          }
        }
      }
    }
    return baseMoves;
  }, [chess, skillState, chess960State, selectedSquare, canControlTurn, targetingSkillId, turn]);

  const legalTargetMap = useMemo(() => {
    const map = new Map<string, typeof legalMovesForSelected>();
    for (const m of legalMovesForSelected) {
      const list = map.get(m.to) || [];
      list.push(m);
      map.set(m.to, list);
    }
    return map;
  }, [legalMovesForSelected]);

  const shieldSet = useMemo(
    () => new Set(skillState?.effects.shielded.map((s) => s.square) || []),
    [skillState?.effects.shielded]
  );
  const shieldZoneMap = useMemo(() => {
    const map = new Map<string, PieceColor>();
    for (const z of skillState?.effects.shieldZones || []) {
      map.set(z.square, z.color);
    }
    return map;
  }, [skillState?.effects.shieldZones]);
  const frozenSet = useMemo(
    () => new Set(skillState?.effects.frozen.map((f) => f.square) || []),
    [skillState?.effects.frozen]
  );
  const disarmedSet = useMemo(
    () => new Set(skillState?.effects.disarmed.map((d) => d.square) || []),
    [skillState?.effects.disarmed]
  );
  const smokeSet = useMemo(
    () => new Set(skillState?.effects.smoke.map((s) => s.square) || []),
    [skillState?.effects.smoke]
  );
  const boundSet = useMemo(
    () => new Set(skillState?.effects.bound?.map((b) => b.square) || []),
    [skillState?.effects.bound]
  );
  const veiledEnemyRanks = useMemo(() => {
    const set = new Set<string>();
    for (const v of skillState?.effects.veiledRanks || []) {
      if (v.ownerColor !== playerColor) {
        set.add(v.rank);
      }
    }
    return set;
  }, [skillState?.effects.veiledRanks, playerColor]);
  const veiledOwnRanks = useMemo(() => {
    const set = new Set<string>();
    for (const v of skillState?.effects.veiledRanks || []) {
      if (v.ownerColor === playerColor) {
        set.add(v.rank);
      }
    }
    return set;
  }, [skillState?.effects.veiledRanks, playerColor]);

  const displayRanks = flipped ? [...RANKS].reverse() : RANKS;
  const displayFiles = flipped ? [...FILES].reverse() : FILES;

  const isPieceMegaKnight = (sq: Square): boolean => {
    const p = chess.get(sq);
    if (!p || p.type !== 'n') return false;
    return p.color === 'w' ? megaKnightActiveW : megaKnightActiveB;
  };

  const isPieceHolyBishop = (sq: Square): boolean => {
    const p = chess.get(sq);
    if (!p || p.type !== 'b') return false;
    return p.color === 'w' ? holyBishopActiveW : holyBishopActiveB;
  };

  const getSquareStatusItems = (sq: Square) => {
    const items: Array<{ label: string; badgeClass: string; desc: string }> = [];
    if (veiledEnemyRanks.has(sq[1])) {
      items.push({
        label: '전술 교란 (시야 차단)',
        badgeClass: 'bg-fuchsia-950 border-fuchsia-400 text-fuchsia-200',
        desc: '상대의 전술 교란으로 인해 이 가로줄의 기물과 상태를 볼 수 없습니다.',
      });
      return items;
    }
    if (frozenSet.has(sq)) {
      items.push({
        label: '빙결',
        badgeClass: 'bg-cyan-950 border-cyan-400 text-cyan-200',
        desc: '다음 자신의 턴이 끝날 때까지 이동할 수 없으며, 상대도 이 기물을 잡을 수 없습니다.',
      });
    }
    const shieldEntry = skillState?.effects.shielded.find((s) => s.square === sq);
    if (shieldEntry) {
      items.push({
        label: shieldEntry.untilMoved ? '철벽 방패 (이동 전 무적)' : '철벽 보호막',
        badgeClass: 'bg-amber-950 border-amber-400 text-amber-200',
        desc: shieldEntry.untilMoved
          ? '이 기물이 다시 이동하기 전까지 절대 풀리지 않으며 상대에게 잡히지 않습니다.'
          : '다음 상대 턴이 끝날 때까지 상대 기물의 공격으로 잡히지 않습니다.',
      });
    }
    const zoneColor = shieldZoneMap.get(sq);
    if (zoneColor) {
      items.push({
        label: `철벽 진지 (${zoneColor === 'w' ? '백' : '흑'})`,
        badgeClass: 'bg-amber-950/90 border-amber-300 text-amber-200',
        desc: `${zoneColor === 'w' ? '백' : '흑'} 기물(킹 제외)이 이 칸에 들어가면 이동 전까지 무적인 방패를 장착합니다.`,
      });
    }
    const disarmEntry = skillState?.effects.disarmed.find((d) => d.square === sq);
    if (disarmEntry) {
      items.push({
        label: `무장 해제 (${disarmEntry.remainingTurns}턴)`,
        badgeClass: 'bg-orange-950 border-orange-400 text-orange-200',
        desc: `남은 ${disarmEntry.remainingTurns}턴 동안 상대 기물을 잡을 수 없으며, 빈 칸 이동만 가능합니다.`,
      });
    }
    if (boundSet.has(sq)) {
      items.push({
        label: '그림자 속박',
        badgeClass: 'bg-violet-950 border-violet-400 text-violet-200',
        desc: '다음 자신의 턴이 끝날 때까지 현재 칸 기준 상하좌우·대각선 1칸 이내로만 움직일 수 있습니다.',
      });
    }
    if (smokeSet.has(sq)) {
      items.push({
        label: '연막 봉쇄',
        badgeClass: 'bg-slate-800 border-slate-400 text-slate-200',
        desc: '다음 턴까지 이 칸으로 이동하거나 통과할 수 없습니다. (나이트 도약 제외)',
      });
    }
    if (isPieceMegaKnight(sq)) {
      items.push({
        label: '메가나이트 활성',
        badgeClass: 'bg-emerald-950 border-emerald-400 text-emerald-200',
        desc: '필드에 남은 유일한 나이트로, L자 도약 외에도 상하좌우 인접 빈 칸 1칸으로 이동할 수 있습니다.',
      });
    }
    if (isPieceHolyBishop(sq)) {
      items.push({
        label: '신성 강화 활성',
        badgeClass: 'bg-amber-950 border-amber-300 text-amber-200',
        desc: '필드에 남은 유일한 비숍으로, 대각선 외에도 상하좌우 인접 빈 칸 1칸으로 이동할 수 있습니다.',
      });
    }
    return items;
  };

  const getPieceKoreanTitle = (sq: Square): string => {
    const p = chess.get(sq);
    if (!p) return `${sq} 칸`;
    const colorName = p.color === 'w' ? '백' : '흑';
    const typeMap: Record<PieceType, string> = {
      p: '폰',
      n: '나이트',
      b: '비숍',
      r: '룩',
      q: '퀸',
      k: '킹',
    };
    return `${colorName} ${typeMap[p.type as PieceType]} (${sq})`;
  };

  const handleSquareTap = (sq: Square) => {
    if (pendingPromotion) return;

    const statusItems = getSquareStatusItems(sq);

    if (!canControlTurn) {
      if (statusItems.length > 0) {
        setInspectedStatus({
          square: sq,
          title: getPieceKoreanTitle(sq),
          items: statusItems,
        });
        soundEngine.playSelect();
      } else {
        setInspectedStatus(null);
      }
      return;
    }

    // 1. Skill targeting mode active
    if (targetingSkillId && onSkillTargetSquare) {
      if (skillTargetSet.has(sq)) {
        setInspectedStatus(null);
        onSkillTargetSquare(sq);
      }
      return;
    }

    // 2. Execute legal move from selected square
    const matchingMoves = legalTargetMap.get(sq);
    if (selectedSquare && matchingMoves && matchingMoves.length > 0) {
      setInspectedStatus(null);
      const isPromotion = matchingMoves.some((m) => Boolean(m.promotion));
      if (isPromotion) {
        setPendingPromotion({
          from: selectedSquare,
          to: sq,
          color: turn,
        });
        soundEngine.playSelect();
        return;
      }
      onMove(selectedSquare, sq);
      setSelectedSquare(null);
      return;
    }

    // 3. If a piece-buff skill locked this turn to a specific square, keep it selected (allow inspecting enemy status)
    if (lockedSquare) {
      setSelectedSquare(lockedSquare);
      if (statusItems.length > 0 && sq !== lockedSquare) {
        setInspectedStatus({
          square: sq,
          title: getPieceKoreanTitle(sq),
          items: statusItems,
        });
      }
      return;
    }

    // 4. Select friendly piece (unless frozen), and display status tooltip if afflicted
    const piece = chess.get(sq);
    if (piece && piece.color === turn && !frozenSet.has(sq)) {
      if (selectedSquare === sq) {
        setSelectedSquare(null);
        setInspectedStatus(null);
      } else {
        setSelectedSquare(sq);
        if (statusItems.length > 0) {
          setInspectedStatus({
            square: sq,
            title: getPieceKoreanTitle(sq),
            items: statusItems,
          });
        } else {
          setInspectedStatus(null);
        }
        soundEngine.playSelect();
      }
      return;
    }

    // 5. Tapping frozen friendly piece, status-afflicted enemy piece, or smoke square -> show status info!
    if (statusItems.length > 0) {
      setSelectedSquare(null);
      setInspectedStatus({
        square: sq,
        title: getPieceKoreanTitle(sq),
        items: statusItems,
      });
      soundEngine.playSelect();
      return;
    }

    setInspectedStatus(null);
    setSelectedSquare(null);
  };

  const handleSelectPromotion = (pieceType: PieceType) => {
    if (!pendingPromotion) return;
    onMove(pendingPromotion.from, pendingPromotion.to, pieceType);
    setPendingPromotion(null);
    setSelectedSquare(null);
  };

  const slideDelta = useMemo(() => {
    if (!lastMove) return null;
    const fromPos = squareToCoords(lastMove.from, flipped);
    const toPos = squareToCoords(lastMove.to, flipped);
    return {
      targetSquare: lastMove.to,
      dx: fromPos.col - toPos.col,
      dy: fromPos.row - toPos.row,
    };
  }, [lastMove, flipped]);

  return (
    <div className="relative select-none w-full h-full aspect-square mx-auto">
      <div className="bg-[#232837] border-2 border-[#384158] p-1.5 sm:p-2 shadow-[0_4px_0_#0B0E14] w-full h-full">
        <div className="relative grid grid-cols-8 border-2 border-[#10131C] w-full h-full overflow-hidden">
          {displayRanks.map((rank, visualRow) =>
            displayFiles.map((file, visualCol) => {
              const sq = `${file}${rank}` as Square;
              const boardRow = RANKS.indexOf(rank);
              const boardCol = FILES.indexOf(file);
              const piece = boardMatrix[boardRow][boardCol];

              const isLight = (boardRow + boardCol) % 2 === 0;
              const isSelected = selectedSquare === sq;
              const isLockedPiece = lockedSquare === sq;
              const isSwapFirst = swapFirstSquare === sq || snipeBishopSquare === sq;
              const isRankVeiledToMe = veiledEnemyRanks.has(rank);
              const isRankVeiledByMe = veiledOwnRanks.has(rank);
              const isLastFrom = !isRankVeiledToMe && lastMove?.from === sq;
              const isLastTo = !isRankVeiledToMe && lastMove?.to === sq;
              const isSkillTarget = Boolean(targetingSkillId && skillTargetSet.has(sq));

              const targetMoves = legalTargetMap.get(sq);
              const isLegalTarget = Boolean(targetMoves && targetMoves.length > 0);
              const isChess960CastleTarget =
                isLegalTarget && Boolean(targetMoves?.some((m) => m.isChess960Castle));
              const isCaptureTarget =
                !isRankVeiledToMe &&
                isLegalTarget &&
                !isChess960CastleTarget &&
                (Boolean(piece) || Boolean(targetMoves?.some((m) => m.flags.includes('e'))));
              const isSkillAugmentedMove =
                isLegalTarget && Boolean(targetMoves?.some((m) => m.isSkillAugmented));

              const isShielded = !isRankVeiledToMe && shieldSet.has(sq);
              const shieldZoneColor = !isRankVeiledToMe ? shieldZoneMap.get(sq) : undefined;
              const isFrozen = !isRankVeiledToMe && frozenSet.has(sq);
              const isDisarmed = !isRankVeiledToMe && disarmedSet.has(sq);
              const isBound = !isRankVeiledToMe && boundSet.has(sq);
              const isSmoke = !isRankVeiledToMe && smokeSet.has(sq);
              const hasMegaKnight =
                !isRankVeiledToMe &&
                Boolean(piece && piece.type === 'n') &&
                (piece?.color === 'w' ? megaKnightActiveW : megaKnightActiveB);
              const hasHolyBishop =
                !isRankVeiledToMe &&
                Boolean(piece && piece.type === 'b') &&
                (piece?.color === 'w' ? holyBishopActiveW : holyBishopActiveB);
              const hasAnyStatus =
                isShielded ||
                Boolean(shieldZoneColor) ||
                isFrozen ||
                isDisarmed ||
                isBound ||
                isSmoke ||
                hasMegaKnight ||
                hasHolyBishop ||
                isRankVeiledToMe;
              const isKingInCheck =
                !isRankVeiledToMe && inCheck && piece?.type === 'k' && piece.color === turn;
              const showVfxHere =
                !isRankVeiledToMe &&
                activeVfx &&
                (activeVfx.square === sq || activeVfx.secondarySquare === sq);
              const showAugmentTileHere =
                !isRankVeiledToMe && activeAugmentFx && activeAugmentFx.square === sq;
              const showManaBurstHere = !isRankVeiledToMe && manaBurst && manaBurst.square === sq;

              let baseBg = isLight ? 'bg-[#E6DEC8]' : 'bg-[#48685B]';
              if (isRankVeiledToMe) {
                baseBg = 'bg-[#171A26]';
              } else if (isSelected || isLockedPiece || isSwapFirst) {
                baseBg = 'bg-[#D99B26]';
              } else if (isLastFrom || isLastTo) {
                baseBg = isLight ? 'bg-[#D8CF95]' : 'bg-[#5A7E56]';
              }

              const shouldSlide = !isRankVeiledToMe && slideDelta && slideDelta.targetSquare === sq;

              return (
                <button
                  key={sq}
                  type="button"
                  onClick={() => handleSquareTap(sq)}
                  aria-label={`${sq}${
                    !isRankVeiledToMe && piece
                      ? ` ${piece.color === 'w' ? '백' : '흑'} ${piece.type}`
                      : ''
                  }`}
                  className={`relative w-full h-full aspect-square flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:z-20 transition-colors duration-100 ${baseBg} ${
                    hasAnyStatus ||
                    (canControlTurn &&
                      (isSkillTarget ||
                        isLegalTarget ||
                        (!isRankVeiledToMe && piece && piece.color === turn && !frozenSet.has(sq))))
                      ? 'cursor-pointer'
                      : 'cursor-default'
                  }`}
                >
                  {/* Coordinate Labels */}
                  {visualCol === 0 && (
                    <span
                      className={`pointer-events-none absolute top-0.5 left-0.5 text-[8px] sm:text-[10px] font-mono-tabular font-bold leading-none ${
                        isLight ? 'text-[#48685B]' : 'text-[#E6DEC8]/80'
                      }`}
                    >
                      {rank}
                    </span>
                  )}
                  {visualRow === 7 && (
                    <span
                      className={`pointer-events-none absolute bottom-0.5 right-0.5 text-[8px] sm:text-[10px] font-mono-tabular font-bold leading-none ${
                        isLight ? 'text-[#48685B]' : 'text-[#E6DEC8]/80'
                      }`}
                    >
                      {file}
                    </span>
                  )}

                  {/* King in Check */}
                  {isKingInCheck && (
                    <div
                      className="pointer-events-none absolute inset-0 bg-red-600/55 border-2 border-red-400 animate-check-flash"
                      aria-hidden="true"
                    />
                  )}

                  {/* Smoke Blockade Overlay */}
                  {isSmoke && (
                    <div
                      className="pointer-events-none absolute inset-0 z-20 bg-slate-800/85 border-2 border-slate-400 flex items-center justify-center"
                      aria-hidden="true"
                    >
                      <div className="w-3/4 h-3/4 grid grid-cols-3 gap-0.5 opacity-90">
                        <span className="bg-slate-400" />
                        <span className="bg-slate-300" />
                        <span className="bg-transparent" />
                        <span className="bg-slate-300" />
                        <span className="bg-slate-200" />
                        <span className="bg-slate-400" />
                        <span className="bg-transparent" />
                        <span className="bg-slate-400" />
                        <span className="bg-slate-500" />
                      </div>
                    </div>
                  )}

                  {/* Frozen Overlay */}
                  {isFrozen && (
                    <div
                      className="pointer-events-none absolute inset-0 z-20 bg-cyan-400/35 border-2 border-cyan-300"
                      aria-hidden="true"
                    >
                      <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-cyan-200 border border-cyan-900" />
                    </div>
                  )}

                  {/* Shield Zone Floor Bastion Sigil */}
                  {shieldZoneColor && (
                    <div
                      className="pointer-events-none absolute inset-0.5 z-15 border-2 border-dashed border-amber-300 bg-amber-400/20 flex items-center justify-center"
                      aria-hidden="true"
                    >
                      {!piece && (
                        <div className="flex flex-col items-center justify-center opacity-90">
                          <SkillPixelIllustration skillId="shield" className="w-4 h-4 sm:w-5 sm:h-5" />
                          <span className="text-[6.5px] font-extrabold text-amber-200 bg-amber-950/90 px-0.5 border border-amber-400/70 leading-none">
                            철벽
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Shielded Aura */}
                  {isShielded && (
                    <div
                      className="pointer-events-none absolute inset-0.5 z-20 border-2 border-amber-300 shadow-[inset_0_0_8px_rgba(251,191,36,0.75)]"
                      aria-hidden="true"
                    >
                      <span className="absolute bottom-0.5 right-0.5 px-0.5 bg-amber-950/95 border border-amber-300 text-[6.5px] font-extrabold text-amber-200 leading-tight">
                        무적
                      </span>
                    </div>
                  )}

                  {/* Disarmed Status Indicator */}
                  {isDisarmed && (
                    <div
                      className="pointer-events-none absolute inset-0.5 z-20 border-2 border-dashed border-orange-400/90"
                      aria-hidden="true"
                    >
                      <span className="absolute top-0.5 right-0.5 px-0.5 bg-orange-950/90 border border-orange-400 text-[7px] font-bold text-orange-200 leading-tight">
                        무장해제
                      </span>
                    </div>
                  )}

                  {/* Shadow Bind Status Indicator */}
                  {isBound && (
                    <div
                      className="pointer-events-none absolute inset-0.5 z-20 border-2 border-dotted border-violet-400 bg-violet-950/20"
                      aria-hidden="true"
                    >
                      <span className="absolute bottom-0.5 left-0.5 px-0.5 bg-violet-950/95 border border-violet-400 text-[7px] font-bold text-violet-200 leading-tight">
                        속박
                      </span>
                    </div>
                  )}

                  {/* Tactical Jam Curtain (hides opponent back rank for 2 turns) */}
                  {isRankVeiledToMe && (
                    <div
                      className="pointer-events-none absolute inset-0 z-25 bg-[#121623] border border-fuchsia-500/45 flex flex-col items-center justify-center overflow-hidden"
                      aria-hidden="true"
                    >
                      <div className="w-4/5 h-4/5 grid grid-cols-3 gap-0.5 opacity-60">
                        <span className="bg-fuchsia-500/40" />
                        <span className="bg-slate-600/40" />
                        <span className="bg-fuchsia-400/25" />
                        <span className="bg-slate-700/45" />
                        <span className="bg-fuchsia-500/50" />
                        <span className="bg-slate-600/35" />
                        <span className="bg-fuchsia-400/30" />
                        <span className="bg-slate-700/40" />
                        <span className="bg-fuchsia-500/35" />
                      </div>
                      {visualCol === 3 && (
                        <span className="absolute px-1 py-0.5 bg-fuchsia-950/95 border border-fuchsia-400 text-[7px] font-bold text-fuchsia-200 leading-none">
                          교란됨
                        </span>
                      )}
                    </div>
                  )}

                  {/* Caster indicator for own veiled back rank */}
                  {isRankVeiledByMe && (
                    <div
                      className="pointer-events-none absolute inset-0 z-15 border-b-2 border-t-2 border-fuchsia-400/70 bg-fuchsia-500/10"
                      aria-hidden="true"
                    />
                  )}

                  {/* Mega Knight Persistent Effect */}
                  {hasMegaKnight && (
                    <div
                      className="pointer-events-none absolute inset-0.5 z-20 border-2 border-emerald-300 bg-emerald-400/15 shadow-[inset_0_0_8px_rgba(52,211,153,0.7)] animate-pulse"
                      aria-hidden="true"
                    >
                      <span className="absolute top-0.5 left-0.5 px-0.5 bg-emerald-950/95 border border-emerald-300 text-[6.5px] font-extrabold text-emerald-200 leading-tight">
                        메가
                      </span>
                    </div>
                  )}

                  {/* Holy Bishop Persistent Effect */}
                  {hasHolyBishop && (
                    <div
                      className="pointer-events-none absolute inset-0.5 z-20 border-2 border-amber-300 bg-amber-300/15 shadow-[inset_0_0_8px_rgba(250,204,21,0.75)] animate-pulse"
                      aria-hidden="true"
                    >
                      <span className="absolute top-0.5 left-0.5 px-0.5 bg-amber-950/95 border border-amber-300 text-[6.5px] font-extrabold text-amber-200 leading-tight">
                        신성
                      </span>
                    </div>
                  )}

                  {/* Selected / Locked Corner Frame */}
                  {(isSelected || isLockedPiece || isSwapFirst) && (
                    <div
                      className="pointer-events-none absolute inset-0.5 border-2 border-[#FFF3C4] z-20"
                      aria-hidden="true"
                    />
                  )}

                  {/* Skill Target Indicator */}
                  {isSkillTarget && (
                    <div
                      className="pointer-events-none absolute inset-0.5 z-30 border-2 border-sky-300 bg-sky-400/25 animate-legal-pulse"
                      aria-hidden="true"
                    />
                  )}

                  {/* Legal Quiet / Castling Move Indicator */}
                  {isLegalTarget && !isCaptureTarget && !isRankVeiledToMe && (
                    <div
                      className="pointer-events-none relative z-20 flex items-center justify-center w-full h-full animate-legal-pulse"
                      aria-hidden="true"
                    >
                      <div
                        className={`${
                          isChess960CastleTarget
                            ? 'w-4 h-4 sm:w-5 sm:h-5 bg-amber-400/80 border-2 border-[#0F172A]'
                            : isSkillAugmentedMove
                            ? 'w-3 h-3 sm:w-3.5 sm:h-3.5 border-2 bg-sky-400 border-[#0F172A]'
                            : 'w-3 h-3 sm:w-3.5 sm:h-3.5 border-2 bg-emerald-400/90 border-[#14171F]'
                        } shadow-[0_2px_0_rgba(0,0,0,0.4)]`}
                      />
                    </div>
                  )}

                  {/* Capture Target Indicator */}
                  {isLegalTarget && isCaptureTarget && (
                    <div
                      className="pointer-events-none absolute inset-1 z-20 animate-capture-target"
                      aria-hidden="true"
                    >
                      <span className="absolute top-0 left-0 w-2.5 h-2.5 border-t-[3px] border-l-[3px] border-red-500 drop-shadow-[0_1px_0_#000]" />
                      <span className="absolute top-0 right-0 w-2.5 h-2.5 border-t-[3px] border-r-[3px] border-red-500 drop-shadow-[0_1px_0_#000]" />
                      <span className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-[3px] border-l-[3px] border-red-500 drop-shadow-[0_1px_0_#000]" />
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-[3px] border-r-[3px] border-red-500 drop-shadow-[0_1px_0_#000]" />
                    </div>
                  )}

                  {/* Chess Piece */}
                  {piece && !isRankVeiledToMe && (
                    <motion.div
                      key={`${sq}-${piece.color}-${piece.type}-${shouldSlide ? moveSeq : 'static'}`}
                      initial={
                        shouldSlide
                          ? {
                              x: `${slideDelta.dx * 100}%`,
                              y: `${slideDelta.dy * 100}%`,
                              scale: 1.08,
                            }
                          : false
                      }
                      animate={{
                        x: 0,
                        y: isSelected ? -2 : 0,
                        scale: isSelected ? 1.08 : 1,
                      }}
                      transition={{
                        duration: 0.16,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className={`relative z-10 w-[86%] h-[86%] flex items-center justify-center pointer-events-none drop-shadow-[0_2px_0_rgba(0,0,0,0.45)] ${
                        isFrozen ? 'opacity-80 saturate-50' : ''
                      }`}
                    >
                      <PixelPiece type={piece.type as PieceType} color={piece.color as PieceColor} />
                    </motion.div>
                  )}

                  {/* Capture Burst */}
                  <AnimatePresence>
                    {burstSquare === sq && (
                      <div
                        className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
                        aria-hidden="true"
                      >
                        <div className="w-7 h-7 border-2 border-amber-300 bg-red-500/45 animate-pixel-burst" />
                      </div>
                    )}
                  </AnimatePresence>

                  {/* Augment Tile Shimmer */}
                  <AnimatePresence>
                    {showAugmentTileHere && activeAugmentFx && (
                      <motion.div
                        key={`augfx-${activeAugmentFx.seq}-${sq}`}
                        initial={{ scale: 0.75, opacity: 1 }}
                        animate={{ scale: 1.15, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                        className="pointer-events-none absolute inset-0 z-35 border-2 border-emerald-300 bg-emerald-400/30 shadow-[inset_0_0_10px_rgba(52,211,153,0.85)]"
                      />
                    )}
                  </AnimatePresence>

                  {/* Skill Cast VFX Pop (Tailored per Skill Category/Effect) */}
                  <AnimatePresence>
                    {showVfxHere && activeVfx && (
                      <motion.div
                        key={`vfx-${activeVfx.seq}-${sq}`}
                        initial={{ scale: 0.45, opacity: 1 }}
                        animate={{ scale: 1.28, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.68, ease: [0.16, 1, 0.3, 1] }}
                        className={`pointer-events-none absolute inset-0 z-40 flex items-center justify-center border-2 ${
                          activeVfx.skillId === 'freeze'
                            ? 'bg-cyan-400/40 border-cyan-200'
                            : activeVfx.skillId === 'shield'
                            ? 'bg-amber-400/40 border-amber-200'
                            : activeVfx.skillId === 'smoke'
                            ? 'bg-slate-600/60 border-slate-200'
                            : activeVfx.skillId === 'purify' ||
                              activeVfx.skillId === 'revive' ||
                              activeVfx.skillId === 'pawn_guard'
                            ? 'bg-emerald-400/40 border-emerald-200'
                            : activeVfx.skillId === 'snipe' ||
                              activeVfx.skillId === 'great_attack' ||
                              activeVfx.skillId === 'diagonal_rook'
                            ? 'bg-red-500/40 border-amber-300'
                            : 'bg-sky-400/35 border-amber-300'
                        }`}
                      >
                        <SkillPixelIllustration
                          skillId={activeVfx.skillId}
                          className="w-7 h-7 sm:w-8 sm:h-8"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Capture Mana +1/+2 Floating Effect */}
                  <AnimatePresence>
                    {showManaBurstHere && manaBurst && (
                      <motion.div
                        key={`manaburst-${manaBurst.seq}-${sq}`}
                        initial={{ y: 4, scale: 0.7, opacity: 1 }}
                        animate={{ y: -24, scale: 1.12, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
                        className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-center"
                      >
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#0F172A]/95 border-2 border-sky-300 text-[10px] sm:text-xs font-mono-tabular font-extrabold text-sky-300 shadow-[0_2px_0_#000] whitespace-nowrap">
                          <PixelManaGem className="w-3 h-3" />
                          +{manaBurst.amount} MP ({manaBurst.color === 'w' ? '백' : '흑'})
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              );
            })
          )}

          {/* Board-wide Vector Beam / Warp Line VFX (Snipe, Swap, Royal Escape) */}
          <AnimatePresence>
            {activeVfx && activeVfx.secondarySquare && (() => {
              const p1 = squareToCoords(activeVfx.secondarySquare, flipped);
              const p2 = squareToCoords(activeVfx.square, flipped);
              if (p1.col < 0 || p1.row < 0 || p2.col < 0 || p2.row < 0) return null;
              const x1 = p1.col * 12.5 + 6.25;
              const y1 = p1.row * 12.5 + 6.25;
              const x2 = p2.col * 12.5 + 6.25;
              const y2 = p2.row * 12.5 + 6.25;
              const isSnipe = activeVfx.skillId === 'snipe';
              return (
                <motion.svg
                  key={`beam-${activeVfx.seq}`}
                  viewBox="0 0 100 100"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7 }}
                  className="pointer-events-none absolute inset-0 w-full h-full z-40"
                >
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isSnipe ? '#EF4444' : '#A78BFA'}
                    strokeWidth={isSnipe ? 2.2 : 1.8}
                    strokeDasharray={isSnipe ? undefined : '2.5 2'}
                  />
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isSnipe ? '#FEF08A' : '#E0F2FE'}
                    strokeWidth={0.8}
                  />
                </motion.svg>
              );
            })()}
          </AnimatePresence>

          {/* Floating Skill & Augment Effect Toast Banners (Non-blocking pointer-events-none) */}
          <div className="pointer-events-none absolute top-1.5 inset-x-2 z-40 flex flex-col items-center gap-1">
            <AnimatePresence>
              {activeVfx && (
                <motion.div
                  key={`skill-banner-${activeVfx.seq}`}
                  initial={{ opacity: 0, y: -8, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#0F172A]/95 border-2 border-amber-400 shadow-[0_3px_0_#000]"
                >
                  <SkillPixelIllustration skillId={activeVfx.skillId} className="w-4 h-4 shrink-0" />
                  <span className="text-[10px] sm:text-[11px] font-extrabold text-amber-200 whitespace-nowrap">
                    {activeVfx.color === 'w' ? '백' : '흑'} ·{' '}
                    {SKILL_DEFINITIONS[activeVfx.skillId].name} 발동!
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {activeAugmentFx && (
                <motion.div
                  key={`aug-banner-${activeAugmentFx.seq}`}
                  initial={{ opacity: 0, y: -8, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                  className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#0B1E1A]/95 border-2 border-emerald-400 shadow-[0_3px_0_#000]"
                >
                  <AugmentPixelBadge augmentId={activeAugmentFx.augmentId} className="w-4 h-4 shrink-0" />
                  <span className="text-[10px] sm:text-[11px] font-extrabold text-emerald-200 whitespace-nowrap">
                    {AUGMENT_DEFINITIONS[activeAugmentFx.augmentId].name}: {activeAugmentFx.label}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Status Effect Inspection Banner */}
          <AnimatePresence>
            {inspectedStatus && (
              <motion.div
                key={`status-${inspectedStatus.square}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="absolute bottom-2 left-2 right-2 z-40 bg-[#131722]/95 border-2 border-[#475370] p-2.5 shadow-[0_4px_0_#0B0E14]"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-extrabold text-slate-100">
                    {inspectedStatus.title} · 상태이상 정보
                  </span>
                  <button
                    type="button"
                    onClick={() => setInspectedStatus(null)}
                    aria-label="상태이상 닫기"
                    className="p-0.5 text-slate-400 hover:text-slate-100 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1">
                  {inspectedStatus.items.map((item) => (
                    <div key={item.label} className="flex items-start gap-2 text-[11px]">
                      <span
                        className={`shrink-0 px-1.5 py-0.5 border text-[10px] font-bold ${item.badgeClass}`}
                      >
                        {item.label}
                      </span>
                      <span className="text-slate-200 leading-snug">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pawn Promotion Pixel Modal */}
          {pendingPromotion && (
            <div className="absolute inset-0 z-40 bg-[#0D1017]/80 flex items-center justify-center p-4">
              <div className="pixel-panel p-4 w-full max-w-[280px] text-center">
                <p className="text-xs sm:text-sm font-bold text-amber-300 mb-3">
                  폰 승급 기물 선택
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {(['q', 'r', 'b', 'n'] as PieceType[]).map((pt) => {
                    const labels: Record<string, string> = {
                      q: '퀸',
                      r: '룩',
                      b: '비숍',
                      n: '나이트',
                    };
                    return (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => handleSelectPromotion(pt)}
                        className="pixel-btn flex flex-col items-center justify-center gap-1 p-2 bg-[#282F42] hover:bg-[#343D54] border-2 border-[#475370] cursor-pointer"
                      >
                        <div className="w-8 h-8">
                          <PixelPiece type={pt} color={pendingPromotion.color} />
                        </div>
                        <span className="text-[11px] font-medium text-slate-200 whitespace-nowrap">
                          {labels[pt]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setPendingPromotion(null)}
                  className="mt-2.5 text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
