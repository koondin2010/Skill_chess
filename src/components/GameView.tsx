import React, { useMemo, useState, useEffect } from 'react';
import { Chess, Square } from 'chess.js';
import {
  Copy,
  Check,
  RotateCw,
  Volume2,
  VolumeX,
  Flag,
  Undo2,
  Handshake,
  LogOut,
  Trophy,
  Eye,
  ScrollText,
  Music,
  X,
} from 'lucide-react';
import {
  AI_TIERS,
  AiLevel,
  AugmentId,
  Chess960State,
  GameOverState,
  MoveRecord,
  OpponentMode,
  PieceColor,
  PieceType,
  RoomStatePayload,
  RuleMode,
  SkillCardInstance,
  SkillId,
  SkillMatchState,
  TimeControl,
} from '../types/chess';
import {
  AUGMENT_DEFINITIONS,
  getAllLegalMovesWithSkills,
  getEligibleSkillTargets,
  getHandLimit,
  getMaxMana,
} from '../engine/skillChess';
import { computeEffectivePlayerDelta, getRankInfo } from '../utils/rating';
import { ChessBoard } from './ChessBoard';
import { PlayerBar } from './PlayerBar';
import { SkillHandDock } from './SkillHandDock';
import { MoveNotationModal } from './MoveNotationModal';
import { AugmentSelectModal } from './AugmentSelectModal';
import { SkillDraftModal } from './SkillDraftModal';
import { AugmentPixelBadge, PixelTierIcon } from './SkillPixelArt';

interface GameViewProps {
  opponentMode: OpponentMode;
  ruleMode: RuleMode;
  fen: string;
  turn: PieceColor;
  myColor: PieceColor | 'spectator';
  aiLevel?: AiLevel;
  aiThinking?: boolean;
  timeControl: TimeControl;
  whiteTimeMs: number;
  blackTimeMs: number;
  moves: MoveRecord[];
  lastMove: { from: string; to: string; captured?: PieceType } | null;
  inCheck: boolean;
  gameOver: GameOverState | null;
  roomState?: RoomStatePayload | null;
  chess960State?: Chess960State | null;
  skillState: SkillMatchState | null;
  isSignedIn?: boolean;
  myRatings?: { skill: number; classic: number } | null;
  muted: boolean;
  bgmEnabled: boolean;
  onToggleMute: () => void;
  onToggleBgm: () => void;
  onMove: (from: string, to: string, promotion?: PieceType) => void;
  onDrawSkill: () => void;
  onCastSkillSquare: (cardUid: string, targetSquare: string) => void;
  onCancelSkillSwap: () => void;
  onDiscardSkillCard: (cardUid: string) => void;
  onChooseAugment?: (augmentId: AugmentId) => void;
  onChooseSkillDraft?: (skillId: SkillId) => void;
  onResign: () => void;
  onUndo?: () => void;
  onOfferDraw?: () => void;
  onRespondDraw?: (accept: boolean) => void;
  onRematch: () => void;
  onExitToLobby: () => void;
}

const PIECE_VALUES: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const STARTING_COUNTS: Record<Exclude<PieceType, 'k'>, number> = {
  q: 1,
  r: 2,
  b: 2,
  n: 2,
  p: 8,
};

function computeMaterialAndCaptures(fen: string) {
  const chess = new Chess(fen);
  const board = chess.board();

  const alive: Record<PieceColor, Record<Exclude<PieceType, 'k'>, number>> = {
    w: { q: 0, r: 0, b: 0, n: 0, p: 0 },
    b: { q: 0, r: 0, b: 0, n: 0, p: 0 },
  };

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (sq && sq.type !== 'k') {
        alive[sq.color][sq.type]++;
      }
    }
  }

  const capturedByWhite: PieceType[] = [];
  const capturedByBlack: PieceType[] = [];
  let whiteMaterial = 0;
  let blackMaterial = 0;

  (['q', 'r', 'b', 'n', 'p'] as Array<Exclude<PieceType, 'k'>>).forEach((pt) => {
    whiteMaterial += alive.w[pt] * PIECE_VALUES[pt];
    blackMaterial += alive.b[pt] * PIECE_VALUES[pt];

    const missingBlack = Math.max(0, STARTING_COUNTS[pt] - alive.b[pt]);
    for (let i = 0; i < missingBlack; i++) capturedByWhite.push(pt);

    const missingWhite = Math.max(0, STARTING_COUNTS[pt] - alive.w[pt]);
    for (let i = 0; i < missingWhite; i++) capturedByBlack.push(pt);
  });

  return {
    capturedByWhite,
    capturedByBlack,
    whiteAdvantage: Math.max(0, whiteMaterial - blackMaterial),
    blackAdvantage: Math.max(0, blackMaterial - whiteMaterial),
  };
}

export const GameView: React.FC<GameViewProps> = ({
  opponentMode,
  ruleMode,
  fen,
  turn,
  myColor,
  aiLevel,
  aiThinking = false,
  timeControl,
  whiteTimeMs,
  blackTimeMs,
  moves,
  lastMove,
  inCheck,
  gameOver,
  roomState,
  chess960State = null,
  skillState,
  isSignedIn = false,
  myRatings = null,
  muted,
  bgmEnabled,
  onToggleMute,
  onToggleBgm,
  onMove,
  onDrawSkill,
  onCastSkillSquare,
  onCancelSkillSwap,
  onDiscardSkillCard,
  onChooseAugment,
  onChooseSkillDraft,
  onResign,
  onUndo,
  onOfferDraw,
  onRespondDraw,
  onRematch,
  onExitToLobby,
}) => {
  const [flipped, setFlipped] = useState<boolean>(myColor === 'b');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [dismissedModal, setDismissedModal] = useState(false);
  const [notationOpen, setNotationOpen] = useState(false);
  const [armedCard, setArmedCard] = useState<SkillCardInstance | null>(null);
  const [inspectedAugment, setInspectedAugment] = useState<{
    color: PieceColor;
    augmentId: AugmentId;
  } | null>(null);

  useEffect(() => {
    setFlipped(myColor === 'b');
  }, [myColor]);

  useEffect(() => {
    if (!gameOver) {
      setDismissedModal(false);
    }
  }, [gameOver]);

  // Clear armed card whenever turn changes or activeCast completes
  useEffect(() => {
    const sid = skillState?.activeCast?.skillId;
    if (sid !== 'swap' && sid !== 'snipe') {
      setArmedCard(null);
    }
  }, [turn, fen, skillState?.activeCast]);

  const chess = useMemo(() => new Chess(fen), [fen]);
  const material = useMemo(() => computeMaterialAndCaptures(fen), [fen]);
  const isUnlimited = timeControl.minutes === 0;
  const aiTier = aiLevel ? AI_TIERS.find((t) => t.level === aiLevel) : undefined;

  const topColor: PieceColor = flipped ? 'w' : 'b';
  const bottomColor: PieceColor = flipped ? 'b' : 'w';

  const getPlayerMeta = (color: PieceColor) => {
    if (opponentMode === 'ai') {
      const isHuman = myColor === color;
      return {
        label: isHuman ? '나' : aiTier ? aiTier.title : '체스 AI',
        subtitle:
          !isHuman && aiThinking
            ? '계산 중'
            : !isHuman && aiTier
            ? aiTier.estimatedRating
            : color === 'w'
            ? '백'
            : '흑',
        connectionState: undefined,
      };
    }

    const p = roomState?.players[color];
    const isMe = myColor === color;
    if (!p) {
      return {
        label: color === 'w' ? '백 대기' : '흑 대기',
        subtitle: color === 'w' ? '백' : '흑',
        connectionState: 'waiting' as const,
      };
    }
    return {
      label: isMe ? `${p.nickname} (나)` : p.nickname,
      subtitle: color === 'w' ? '백' : '흑',
      connectionState: p.connected ? ('connected' as const) : ('disconnected' as const),
    };
  };

  const topMeta = getPlayerMeta(topColor);
  const bottomMeta = getPlayerMeta(bottomColor);

  const copyTextSafe = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    }
  };

  const handleCopyCode = async () => {
    if (!roomState?.roomCode) return;
    if (await copyTextSafe(roomState.roomCode)) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!roomState?.roomCode) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${roomState.roomCode}`;
    if (await copyTextSafe(url)) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    }
  };

  const isWaitingForFriend =
    opponentMode === 'online' && Boolean(roomState && !roomState.started);

  const isAugmentPhase = ruleMode === 'skill' && Boolean(skillState?.augmentPhase);
  const pendingDraftSkills =
    ruleMode === 'skill' &&
    skillState &&
    myColor !== 'spectator' &&
    skillState[myColor]?.pendingSkillDraft &&
    skillState[myColor].pendingSkillDraft!.length > 0
      ? skillState[myColor].pendingSkillDraft!
      : null;
  const hasPendingSkillDraft = Boolean(pendingDraftSkills);

  const isMyTurn =
    !gameOver &&
    !aiThinking &&
    !isWaitingForFriend &&
    !isAugmentPhase &&
    !hasPendingSkillDraft &&
    myColor !== 'spectator' &&
    myColor === turn;

  const boardDisabled = !isMyTurn;

  // Compute eligible skill target squares when a skill card is armed or swap/snipe step 2 is active
  const activeTwoStepCardUid =
    skillState?.activeCast?.skillId === 'swap' || skillState?.activeCast?.skillId === 'snipe'
      ? skillState.activeCast.cardUid
      : null;
  const activeSwapFirstSq =
    skillState?.activeCast?.skillId === 'swap' ? skillState.activeCast.swapFirstSquare : null;
  const activeSnipeBishopSq =
    skillState?.activeCast?.skillId === 'snipe'
      ? skillState.activeCast.snipeBishopSquare || null
      : null;

  const targetingSkillId: SkillId | null = activeSwapFirstSq
    ? 'swap'
    : activeSnipeBishopSq
    ? 'snipe'
    : armedCard?.skillId || null;

  const skillTargetSquares: Square[] = useMemo(() => {
    if (!skillState || myColor === 'spectator' || !isMyTurn) return [];
    if (activeSwapFirstSq) {
      return getEligibleSkillTargets(chess, skillState, 'swap', myColor, activeSwapFirstSq);
    }
    if (activeSnipeBishopSq) {
      return getEligibleSkillTargets(chess, skillState, 'snipe', myColor, activeSnipeBishopSq);
    }
    if (armedCard) {
      return getEligibleSkillTargets(chess, skillState, armedCard.skillId, myColor, null);
    }
    return [];
  }, [chess, skillState, myColor, isMyTurn, activeSwapFirstSq, activeSnipeBishopSq, armedCard]);

  const hasEligibleTargetsForSkill = (skillId: SkillId): boolean => {
    if (!skillState || myColor === 'spectator') return false;
    return getEligibleSkillTargets(chess, skillState, skillId, myColor, null).length > 0;
  };

  const handleSelectCard = (card: SkillCardInstance) => {
    if (!isMyTurn) return;
    setArmedCard(card);
  };

  const handleCancelCard = () => {
    setArmedCard(null);
    if (activeSwapFirstSq || activeSnipeBishopSq) {
      onCancelSkillSwap();
    }
  };

  const handleSkillTargetSquare = (sq: Square) => {
    if (activeTwoStepCardUid && (activeSwapFirstSq || activeSnipeBishopSq)) {
      onCastSkillSquare(activeTwoStepCardUid, sq);
      setArmedCard(null);
      return;
    }
    if (armedCard) {
      onCastSkillSquare(armedCard.uid, sq);
      if (armedCard.skillId !== 'swap' && armedCard.skillId !== 'snipe') {
        setArmedCard(null);
      }
    }
  };

  const handleQuickCast = (cardUid: string, targetSquare: string) => {
    onCastSkillSquare(cardUid, targetSquare);
    setArmedCard(null);
  };

  const pendingIncomingDraw =
    opponentMode === 'online' &&
    roomState?.drawOfferBy &&
    myColor !== 'spectator' &&
    roomState.drawOfferBy !== myColor;

  const myRematchSent =
    opponentMode === 'online' &&
    myColor !== 'spectator' &&
    Boolean(roomState?.rematchRequests.includes(myColor));

  const mySkillPlayer =
    ruleMode === 'skill' && skillState
      ? myColor === 'spectator'
        ? skillState.w
        : skillState[myColor]
      : null;

  // Check if player has 0 legal moves due to freeze when not in check
  const noMovesLeft = useMemo(() => {
    if (!isMyTurn || !skillState) return false;
    return getAllLegalMovesWithSkills(chess, skillState).length === 0;
  }, [isMyTurn, skillState, chess]);

  return (
    <div className="h-full max-w-[920px] mx-auto px-2 sm:px-4 py-1 sm:py-2 flex flex-col justify-between gap-1 overflow-hidden">
      {/* Top Row: Compact Match Label + Icon-Only Action Toolbar */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 min-w-0 text-xs text-slate-300">
          <span className="font-bold text-amber-300 truncate">
            {opponentMode === 'ai'
              ? `${aiTier?.title || 'AI'}`
              : `방 ${roomState?.roomCode || '---'}`}
          </span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400 shrink-0">
            {ruleMode === 'skill'
              ? '스킬 체스'
              : ruleMode === 'chess960'
              ? chess960State
                ? `체스960 #${chess960State.positionId}`
                : '체스960'
              : '클래식'}
          </span>
          {opponentMode === 'online' && roomState && (
            <button
              type="button"
              onClick={handleCopyCode}
              title="방 코드 복사"
              aria-label="방 코드 복사"
              className="px-1.5 py-0.5 bg-[#222838] border border-[#39435C] text-[11px] font-mono-tabular text-amber-300 flex items-center gap-1 cursor-pointer shrink-0"
            >
              {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{roomState.roomCode}</span>
            </button>
          )}
        </div>

        {/* Icon-Only Action Buttons (수 무르기, 보드 회전, 무승부, 기권, 기보, 소리, 로비) */}
        <div className="flex items-center gap-1 shrink-0">
          {opponentMode === 'ai' && onUndo && (
            <button
              type="button"
              onClick={onUndo}
              disabled={moves.length === 0 || aiThinking || Boolean(gameOver)}
              title="한 수 무르기"
              aria-label="한 수 무르기"
              className="w-8 h-8 bg-[#222837] hover:bg-[#2F374C] disabled:opacity-40 border border-[#3A4560] flex items-center justify-center text-slate-200 cursor-pointer"
            >
              <Undo2 className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            title="보드 회전"
            aria-label="보드 회전"
            className="w-8 h-8 bg-[#222837] hover:bg-[#2F374C] border border-[#3A4560] flex items-center justify-center text-slate-200 cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {opponentMode === 'online' && onOfferDraw && (
            <button
              type="button"
              onClick={onOfferDraw}
              disabled={
                Boolean(gameOver) ||
                isWaitingForFriend ||
                myColor === 'spectator' ||
                Boolean(roomState?.drawOfferBy)
              }
              title="무승부 제안"
              aria-label="무승부 제안"
              className="w-8 h-8 bg-[#222837] hover:bg-[#2F374C] disabled:opacity-40 border border-[#3A4560] flex items-center justify-center text-slate-200 cursor-pointer"
            >
              <Handshake className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onResign}
            disabled={Boolean(gameOver) || isWaitingForFriend || myColor === 'spectator'}
            title="기권하기"
            aria-label="기권하기"
            className="w-8 h-8 bg-[#3A2128] hover:bg-[#4F2B35] disabled:opacity-40 border border-[#6E3643] flex items-center justify-center text-red-200 cursor-pointer"
          >
            <Flag className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setNotationOpen(true)}
            title="기보 보기"
            aria-label="기보 보기"
            className="w-8 h-8 bg-[#222837] hover:bg-[#2F374C] border border-[#3A4560] flex items-center justify-center text-amber-300 cursor-pointer"
          >
            <ScrollText className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleBgm}
            title={bgmEnabled ? '배경음(BGM) 끄기' : '배경음(BGM) 켜기'}
            aria-label={bgmEnabled ? '배경음(BGM) 끄기' : '배경음(BGM) 켜기'}
            className={`w-8 h-8 border flex items-center justify-center cursor-pointer ${
              bgmEnabled && !muted
                ? 'bg-[#252D40] hover:bg-[#313B54] border-amber-500/70 text-amber-300'
                : 'bg-[#181C26] hover:bg-[#252B3B] border-[#323B52] text-slate-500'
            }`}
          >
            <Music className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            title={muted ? '전체 소리 켜기' : '전체 소리 끄기'}
            aria-label={muted ? '전체 소리 켜기' : '전체 소리 끄기'}
            className="w-8 h-8 bg-[#222837] hover:bg-[#2F374C] border border-[#3A4560] flex items-center justify-center text-slate-200 cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onExitToLobby}
            title="로비로 나가기"
            aria-label="로비로 나가기"
            className="w-8 h-8 bg-[#181C26] hover:bg-[#252B3B] border border-[#323B52] flex items-center justify-center text-slate-300 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Incoming Draw Offer Strip */}
      {pendingIncomingDraw && onRespondDraw && (
        <div className="shrink-0 px-3 py-1.5 bg-[#252D40] border border-amber-400 flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-amber-200">
            상대가 무승부를 제안했습니다
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onRespondDraw(true)}
              className="px-2.5 py-0.5 bg-emerald-500 text-[#14171F] text-xs font-bold cursor-pointer"
            >
              수락
            </button>
            <button
              type="button"
              onClick={() => onRespondDraw(false)}
              className="px-2.5 py-0.5 bg-[#323A4F] text-slate-200 text-xs font-bold cursor-pointer"
            >
              거절
            </button>
          </div>
        </div>
      )}

      {/* Center Arena: Top Player + Board (+ Left Augment Icons) + Bottom Player */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-1 w-full max-w-[590px] mx-auto">
        <div className="w-full shrink-0">
          <PlayerBar
            label={topMeta.label}
            subtitle={topMeta.subtitle}
            color={topColor}
            isActiveTurn={!gameOver && !isWaitingForFriend && !isAugmentPhase && turn === topColor}
            timeMs={topColor === 'w' ? whiteTimeMs : blackTimeMs}
            isUnlimited={isUnlimited}
            capturedPieces={
              topColor === 'w' ? material.capturedByWhite : material.capturedByBlack
            }
            materialAdvantage={
              topColor === 'w' ? material.whiteAdvantage : material.blackAdvantage
            }
            connectionState={topMeta.connectionState}
            inCheck={!gameOver && inCheck && turn === topColor}
            mana={ruleMode === 'skill' && skillState ? skillState[topColor].mana : undefined}
          />
        </div>

        {/* Board Row: Left Augment Icons Rail + Strictly Constrained Square Board */}
        <div className="relative flex-1 min-h-0 w-full flex items-center justify-center gap-1.5 sm:gap-2 overflow-hidden">
          {ruleMode === 'skill' && skillState && !isAugmentPhase && (
            <div className="shrink-0 self-stretch flex flex-col justify-between py-1 z-20">
              {skillState[topColor].augment ? (
                <button
                  type="button"
                  onClick={() =>
                    setInspectedAugment((cur) =>
                      cur?.color === topColor
                        ? null
                        : { color: topColor, augmentId: skillState[topColor].augment! }
                    )
                  }
                  title={`${topMeta.label} 증강 보기`}
                  aria-label={`${topMeta.label} 증강 보기`}
                  className={`w-8 h-8 sm:w-10 sm:h-10 border-2 flex items-center justify-center cursor-pointer transition-colors ${
                    inspectedAugment?.color === topColor
                      ? 'bg-[#2B344D] border-amber-400'
                      : 'bg-[#171C28] hover:bg-[#232B3D] border-[#3A445F]'
                  }`}
                >
                  <AugmentPixelBadge
                    augmentId={skillState[topColor].augment!}
                    className="w-6 h-6 sm:w-7 sm:h-7"
                  />
                </button>
              ) : (
                <div className="w-8 h-8 sm:w-10 sm:h-10" />
              )}

              {skillState[bottomColor].augment ? (
                <button
                  type="button"
                  onClick={() =>
                    setInspectedAugment((cur) =>
                      cur?.color === bottomColor
                        ? null
                        : { color: bottomColor, augmentId: skillState[bottomColor].augment! }
                    )
                  }
                  title={`${bottomMeta.label} 증강 보기`}
                  aria-label={`${bottomMeta.label} 증강 보기`}
                  className={`w-8 h-8 sm:w-10 sm:h-10 border-2 flex items-center justify-center cursor-pointer transition-colors ${
                    inspectedAugment?.color === bottomColor
                      ? 'bg-[#2B344D] border-amber-400'
                      : 'bg-[#171C28] hover:bg-[#232B3D] border-amber-500/70'
                  }`}
                >
                  <AugmentPixelBadge
                    augmentId={skillState[bottomColor].augment!}
                    className="w-6 h-6 sm:w-7 sm:h-7"
                  />
                </button>
              ) : (
                <div className="w-8 h-8 sm:w-10 sm:h-10" />
              )}
            </div>
          )}

          {/* Flexible Square Board Container constrained strictly by remaining height AND width */}
          <div
            className="relative flex-1 min-w-0 h-full min-h-0 flex items-center justify-center overflow-hidden"
            style={{ containerType: 'size' }}
          >
            <div
              className="relative"
              style={{ width: 'min(100cqw, 100cqh)', height: 'min(100cqw, 100cqh)' }}
            >
              <ChessBoard
                fen={fen}
                playerColor={myColor}
                flipped={flipped}
                disabled={boardDisabled}
                lastMove={lastMove}
                moveSeq={moves.length}
                inCheck={inCheck}
                chess960State={chess960State}
                skillState={skillState}
                targetingSkillId={targetingSkillId}
                skillTargetSquares={skillTargetSquares}
                onSkillTargetSquare={handleSkillTargetSquare}
                onMove={onMove}
              />

              {/* Augment Description Popover (when clicking a left-side Augment icon) */}
              {inspectedAugment && (
                <div
                  className="absolute top-2 left-2 right-2 z-40 bg-[#151A26]/95 border-2 border-amber-400 p-2.5 shadow-[0_4px_0_#0B0E14]"
                  role="dialog"
                  aria-label="증강 설명"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-10 h-10 shrink-0 bg-[#0F131C] border border-amber-500/50 flex items-center justify-center">
                      <AugmentPixelBadge
                        augmentId={inspectedAugment.augmentId}
                        className="w-8 h-8"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-extrabold text-amber-300 truncate">
                            {AUGMENT_DEFINITIONS[inspectedAugment.augmentId].name}
                          </span>
                          <span className="px-1.5 py-0.5 bg-[#232B3D] border border-[#3E4968] text-[10px] font-bold text-slate-300 shrink-0">
                            {inspectedAugment.color === myColor ? '내 증강' : '상대 증강'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setInspectedAugment(null)}
                          aria-label="증강 설명 닫기"
                          className="p-0.5 text-slate-400 hover:text-slate-100 cursor-pointer shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-200 mt-1 leading-snug">
                        {AUGMENT_DEFINITIONS[inspectedAugment.augmentId].fullDesc}
                      </p>
                    </div>
                  </div>
                </div>
              )}

            {/* Waiting for friend overlay */}
            {isWaitingForFriend && roomState && (
              <div className="absolute inset-0 z-30 bg-[#0D1017]/80 flex items-center justify-center p-4">
                <div className="pixel-panel p-4 w-full max-w-[320px] text-center space-y-3">
                  <p className="text-sm font-bold text-amber-300">
                    친구 입장을 기다리는 중
                  </p>
                  <p className="text-xs text-slate-300">
                    방 코드 <strong className="font-mono-tabular text-amber-300">{roomState.roomCode}</strong> 또는 링크를 공유하세요.
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="pixel-btn px-3 py-2 bg-[#282F42] border border-[#475370] text-xs font-bold text-slate-100 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? '복사됨' : '코드 복사'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyInviteLink}
                      className="pixel-btn px-3 py-2 bg-amber-500 border border-amber-200 text-xs font-bold text-[#14171F] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? '복사됨' : '초대 링크'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Game Over Overlay */}
            {gameOver && !dismissedModal && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0D1017]/80 p-4">
                <div className="pixel-panel p-5 w-full max-w-[320px] text-center">
                  <div className="w-10 h-10 mx-auto mb-2.5 bg-[#282F42] border-2 border-amber-400 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-amber-400" />
                  </div>
                  <h3 className="text-base font-extrabold text-slate-50">
                    {gameOver.winner === 'draw'
                      ? '무승부'
                      : gameOver.winner === myColor
                      ? '승리했습니다!'
                      : myColor === 'spectator'
                      ? gameOver.winner === 'w'
                        ? '백 승리'
                        : '흑 승리'
                      : '패배했습니다'}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">{gameOver.message}</p>

                  {opponentMode === 'online' &&
                    roomState?.ratingOutcome &&
                    myColor !== 'spectator' && (() => {
                      const ro = roomState.ratingOutcome;
                      const rawDelta =
                        gameOver.winner === 'draw'
                          ? 0
                          : gameOver.winner === myColor
                          ? ro.winnerDelta
                          : ro.loserDelta;
                      const currentR =
                        ro.category === 'skill'
                          ? myRatings?.skill ?? 0
                          : myRatings?.classic ?? 0;
                      const myDelta = computeEffectivePlayerDelta(rawDelta, currentR);
                      const resultingTier = getRankInfo(Math.max(0, currentR + myDelta));
                      const categoryLabel =
                        ro.category === 'skill' ? '스킬 랭크' : '클래식 랭크';
                      const deltaColor =
                        myDelta > 0
                          ? 'text-emerald-300 border-emerald-500/70 bg-emerald-950/60'
                          : myDelta < 0
                          ? 'text-rose-300 border-rose-500/70 bg-rose-950/60'
                          : 'text-slate-200 border-slate-500/70 bg-slate-900/70';
                      return (
                        <div className={`mt-2.5 px-2.5 py-2 border ${deltaColor}`}>
                          <div className="flex items-center justify-between text-xs font-extrabold gap-2">
                            <span className="inline-flex items-center gap-1.5">
                              <PixelTierIcon
                                tierId={resultingTier.id}
                                className="w-4 h-4 shrink-0"
                              />
                              <span>{categoryLabel}</span>
                              <span
                                className={`px-1 py-0.5 border text-[10px] font-bold ${resultingTier.badgeColor}`}
                              >
                                {resultingTier.tier}
                              </span>
                            </span>
                            <span className="font-mono-tabular">
                              {myDelta > 0 ? `+${myDelta}` : myDelta} 점
                            </span>
                          </div>
                          <div className="text-[10px] opacity-80 mt-0.5 font-mono-tabular">
                            기물 차 {ro.materialDiff}점 · 총 {ro.plyCount}수
                            {!isSignedIn ? ' · 로그인 시 순위 반영' : ''}
                          </div>
                        </div>
                      );
                    })()}

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={onRematch}
                      disabled={myRematchSent}
                      className="pixel-btn py-2 px-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 border-2 border-amber-200 text-xs font-extrabold text-[#14171F] cursor-pointer"
                    >
                      {myRematchSent ? '수락 대기(1/2)' : '다시 하기'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotationOpen(true)}
                      className="pixel-btn py-2 px-3 bg-[#282F42] hover:bg-[#333C54] border-2 border-[#475370] text-xs font-bold text-amber-300 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <ScrollText className="w-3.5 h-3.5" />
                      <span>기보 보기</span>
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-center gap-4 text-xs">
                    <button
                      type="button"
                      onClick={() => setDismissedModal(true)}
                      className="text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>보드 보기</span>
                    </button>
                    <button
                      type="button"
                      onClick={onExitToLobby}
                      className="text-slate-400 hover:text-slate-200 underline cursor-pointer"
                    >
                      로비로
                    </button>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>

        <div className="w-full shrink-0">
          <PlayerBar
            label={bottomMeta.label}
            subtitle={bottomMeta.subtitle}
            color={bottomColor}
            isActiveTurn={!gameOver && !isWaitingForFriend && !isAugmentPhase && turn === bottomColor}
            timeMs={bottomColor === 'w' ? whiteTimeMs : blackTimeMs}
            isUnlimited={isUnlimited}
            capturedPieces={
              bottomColor === 'w' ? material.capturedByWhite : material.capturedByBlack
            }
            materialAdvantage={
              bottomColor === 'w' ? material.whiteAdvantage : material.blackAdvantage
            }
            connectionState={bottomMeta.connectionState}
            inCheck={!gameOver && inCheck && turn === bottomColor}
            mana={ruleMode === 'skill' && skillState ? skillState[bottomColor].mana : undefined}
          />
        </div>
      </div>

      {/* Bottom Dock: Strictly placed below board — Skill Cards Fan, Draw 3MP & Trash Can */}
      {ruleMode === 'skill' && mySkillPlayer && (
        <div className="shrink-0 w-full max-w-[640px] mx-auto relative z-20">
          {noMovesLeft && (
            <div className="mb-1 text-center text-[11px] font-bold text-amber-300">
              빙결/봉쇄로 이동할 수 있는 기물이 없습니다 — 기권 또는 스킬을 확인하세요.
            </div>
          )}
          <SkillHandDock
            hand={mySkillPlayer.hand}
            handLimit={getHandLimit(skillState, myColor === 'spectator' ? 'w' : myColor)}
            mana={mySkillPlayer.mana}
            maxMana={getMaxMana(skillState, myColor === 'spectator' ? 'w' : myColor)}
            augment={mySkillPlayer.augment}
            firstDrawDiscountUsed={mySkillPlayer.firstDrawDiscountUsed}
            opponentHandCount={
              myColor === 'spectator'
                ? undefined
                : skillState?.[myColor === 'w' ? 'b' : 'w'].handCount ??
                  skillState?.[myColor === 'w' ? 'b' : 'w'].hand.length
            }
            isMyTurn={isMyTurn}
            hasPendingDraft={hasPendingSkillDraft}
            usedOrDiscardedThisTurn={mySkillPlayer.usedOrDiscardedThisTurn}
            activeCast={skillState?.activeCast || null}
            selectedCardUid={armedCard?.uid || activeTwoStepCardUid}
            hasEligibleTargets={hasEligibleTargetsForSkill}
            onDrawSkill={onDrawSkill}
            onSelectCard={handleSelectCard}
            onQuickCast={handleQuickCast}
            onCancelCard={handleCancelCard}
            onDiscardToTrash={onDiscardSkillCard}
            playerColor={myColor}
          />
        </div>
      )}

      {/* Starting Augment Selection Modal (Presented equally to both players before Turn 1) */}
      {isAugmentPhase && skillState && !isWaitingForFriend && !gameOver && onChooseAugment && (
        <AugmentSelectModal
          offeredAugments={skillState.offeredAugments}
          myChoice={myColor === 'spectator' ? null : skillState[myColor].augment}
          opponentChoice={
            myColor === 'spectator'
              ? null
              : skillState[myColor === 'w' ? 'b' : 'w'].augment
          }
          myColor={myColor}
          onChoose={onChooseAugment}
        />
      )}

      {/* Opening Intel First-Buy 3-Choose-1 Skill Draft Modal */}
      {pendingDraftSkills &&
        !isAugmentPhase &&
        !isWaitingForFriend &&
        !gameOver &&
        onChooseSkillDraft && (
          <SkillDraftModal
            offeredSkills={pendingDraftSkills}
            onChoose={onChooseSkillDraft}
          />
        )}

      {/* Move Notation Modal (opened on demand or post-game) */}
      <MoveNotationModal
        open={notationOpen}
        title="대국 기보"
        subtitle={`총 ${moves.length}수 진행`}
        moves={moves}
        onClose={() => setNotationOpen(false)}
      />
    </div>
  );
};
