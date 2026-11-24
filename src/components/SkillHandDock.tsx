import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X } from 'lucide-react';
import type {
  ActiveSkillTurnState,
  AugmentId,
  PieceColor,
  SkillCardInstance,
  SkillId,
} from '../types/chess';
import {
  DRAW_SKILL_COST,
  MAX_MANA,
  SKILL_DEFINITIONS,
} from '../engine/skillChess';
import {
  PixelManaGem,
  PixelTrashCan,
  SkillPixelIllustration,
} from './SkillPixelArt';

interface SkillHandDockProps {
  hand: SkillCardInstance[];
  handLimit: number;
  mana: number;
  maxMana?: number;
  augment: AugmentId | null;
  firstDrawDiscountUsed?: boolean;
  opponentHandCount?: number;
  isMyTurn: boolean;
  hasPendingDraft?: boolean;
  usedOrDiscardedThisTurn: boolean;
  activeCast: ActiveSkillTurnState | null;
  selectedCardUid: string | null;
  hasEligibleTargets: (skillId: SkillId) => boolean;
  onDrawSkill: () => void;
  onSelectCard: (card: SkillCardInstance) => void;
  onQuickCast?: (cardUid: string, targetSquare: string) => void;
  onCancelCard: () => void;
  onDiscardToTrash: (cardUid: string) => void;
  playerColor: PieceColor | 'spectator';
}

const CATEGORY_LABELS = {
  mobility: '기동',
  offense: '공격·교란',
  defense: '방어·소환',
} as const;

export const SkillHandDock: React.FC<SkillHandDockProps> = ({
  hand,
  handLimit,
  mana,
  maxMana = MAX_MANA,
  augment,
  firstDrawDiscountUsed = false,
  opponentHandCount,
  isMyTurn,
  hasPendingDraft = false,
  usedOrDiscardedThisTurn,
  activeCast,
  selectedCardUid,
  hasEligibleTargets,
  onDrawSkill,
  onSelectCard,
  onQuickCast,
  onCancelCard,
  onDiscardToTrash,
  playerColor,
}) => {
  const [previewCardUid, setPreviewCardUid] = useState<string | null>(null);
  const [draggingState, setDraggingState] = useState<{
    card: SkillCardInstance;
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    moved: boolean;
    overTrash: boolean;
  } | null>(null);

  const trashRef = useRef<HTMLDivElement | null>(null);
  const canUseHand =
    playerColor !== 'spectator' &&
    isMyTurn &&
    !hasPendingDraft &&
    !usedOrDiscardedThisTurn &&
    !activeCast;

  const drawCost =
    augment === 'cheap_skills' && !firstDrawDiscountUsed ? 1 : DRAW_SKILL_COST;

  const canDraw =
    playerColor !== 'spectator' &&
    isMyTurn &&
    !hasPendingDraft &&
    !activeCast &&
    mana >= drawCost &&
    hand.length < handLimit;

  const getCost = (skillId: SkillId) => {
    return SKILL_DEFINITIONS[skillId].manaCost;
  };

  const checkOverTrash = (clientX: number, clientY: number): boolean => {
    const el = trashRef.current;
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const pad = 14;
    return (
      clientX >= rect.left - pad &&
      clientX <= rect.right + pad &&
      clientY >= rect.top - pad &&
      clientY <= rect.bottom + pad
    );
  };

  const handleCardPointerDown = (
    e: React.PointerEvent,
    card: SkillCardInstance
  ) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const startX = e.clientX;
    const startY = e.clientY;

    const onMove = (ev: PointerEvent) => {
      const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
      if (dist <= 9) return;
      const overTrash = canUseHand && checkOverTrash(ev.clientX, ev.clientY);
      setDraggingState({
        card,
        startX,
        startY,
        curX: ev.clientX,
        curY: ev.clientY,
        moved: true,
        overTrash,
      });
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);

      const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
      setDraggingState(null);

      if (dist > 9) {
        if (canUseHand && checkOverTrash(ev.clientX, ev.clientY)) {
          if (previewCardUid === card.uid) setPreviewCardUid(null);
          onDiscardToTrash(card.uid);
        }
        return;
      }

      // Tap card: toggle expanded card view & arm targeting if usable
      const isAlreadyOpen =
        selectedCardUid === card.uid || previewCardUid === card.uid;

      if (isAlreadyOpen) {
        setPreviewCardUid(null);
        if (selectedCardUid === card.uid) {
          onCancelCard();
        }
        return;
      }

      setPreviewCardUid(card.uid);
      if (canUseHand) {
        onSelectCard(card);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const activeUid = selectedCardUid || previewCardUid;
  const activeCard = activeUid
    ? hand.find((c) => c.uid === activeUid) || null
    : null;
  const activeDef = activeCard ? SKILL_DEFINITIONS[activeCard.skillId] : null;
  const activeCost = activeCard ? getCost(activeCard.skillId) : 0;
  const activeAffordable = activeCard ? mana >= activeCost : false;
  const activeHasTarget = activeCard ? hasEligibleTargets(activeCard.skillId) : false;
  const activeUsable = Boolean(canUseHand && activeAffordable && activeHasTarget);

  const recycleBonus = augment === 'recycle_pro' ? 2 : 1;

  return (
    <div className="relative w-full bg-[#191D28] border-2 border-[#2E364A] px-2 py-1.5 shadow-[0_3px_0_#0B0E14] select-none">
      {/* Expanded Card Detail Panel (In-flow inside bottom dock so board bottom ranks are NEVER covered!) */}
      <AnimatePresence>
        {activeCard && activeDef && (
          <motion.div
            key={`expanded-${activeCard.uid}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="mb-1.5 bg-[#1B2232] border-2 border-amber-400 p-2 shadow-[0_3px_0_#0B0E14]"
          >
            <div className="flex items-start gap-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 bg-[#10141E] border-2 border-[#384360] flex items-center justify-center">
                <SkillPixelIllustration
                  skillId={activeCard.skillId}
                  className="w-8 h-8 sm:w-10 sm:h-10"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-extrabold text-slate-50 truncate">
                      {activeDef.name}
                    </span>
                    <span className="px-1 py-0.5 bg-[#252E44] border border-[#3B4766] text-[9.5px] font-bold text-slate-300 shrink-0">
                      {CATEGORY_LABELS[activeDef.category]}
                    </span>
                    <span
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 border text-[10px] font-mono-tabular font-extrabold shrink-0 ${
                        activeAffordable
                          ? 'bg-sky-950 border-sky-400 text-sky-200'
                          : 'bg-red-950/80 border-red-500 text-red-300'
                      }`}
                    >
                      <PixelManaGem className="w-2.5 h-2.5" />
                      {activeCost} MP
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPreviewCardUid(null);
                      onCancelCard();
                    }}
                    aria-label="카드 닫기"
                    className="p-0.5 bg-[#252D40] hover:bg-[#323C54] border border-[#435070] text-slate-300 cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-[11px] text-slate-200 mt-0.5 leading-snug">
                  {activeDef.fullDesc}
                </p>

                <div className="flex items-center justify-between gap-2 mt-1">
                  <p className="text-[10px] font-bold min-w-0">
                    {activeCast?.skillId === 'swap' && activeCast.swapFirstSquare ? (
                      <span className="text-amber-300">
                        교대할 두 번째 아군 기물을 보드에서 터치하세요.
                      </span>
                    ) : activeCast?.skillId === 'snipe' && activeCast.snipeBishopSquare ? (
                      <span className="text-amber-300">
                        선택한 비숍 대각선의 적 기물을 터치해 제거하세요.
                      </span>
                    ) : activeUsable ? (
                      activeDef.id === 'snipe' ? (
                        <span className="text-sky-300">
                          저격을 수행할 내 비숍을 보드에서 터치하세요.
                        </span>
                      ) : activeDef.id === 'shield' ? (
                        <span className="text-sky-300">
                          내 진영 4줄 중 철벽을 소환할 빈 칸 또는 아군 기물을 터치하세요.
                        </span>
                      ) : activeDef.id === 'tactical_jam' ||
                        activeDef.id === 'mana_drain' ||
                        activeDef.id === 'arcane_tome' ? (
                        <span className="text-sky-300">
                          오른쪽 발동 버튼 또는 아군 맨 아래줄 칸을 터치하세요.
                        </span>
                      ) : (
                        <span className="text-sky-300">
                          보드 위에 표시된 하늘색 칸을 터치해 스킬을 사용하세요.
                        </span>
                      )
                    ) : !isMyTurn ? (
                      <span className="text-slate-400">상대 차례에는 카드를 미리 보기만 할 수 있습니다.</span>
                    ) : usedOrDiscardedThisTurn ? (
                      <span className="text-slate-400">이번 턴에 이미 스킬 또는 버리기를 사용했습니다.</span>
                    ) : !activeAffordable ? (
                      <span className="text-red-300">마나가 부족합니다. (필요: {activeCost} MP)</span>
                    ) : activeDef.id === 'queens_gambit' ? (
                      <span className="text-amber-300">체크 상태이거나 이동 가능한 칸이 없어 사용할 수 없습니다.</span>
                    ) : activeDef.id === 'mana_drain' ? (
                      <span className="text-amber-300">상대 마나가 0 MP여서 흡수할 수 없습니다.</span>
                    ) : activeDef.id === 'purify' ? (
                      <span className="text-amber-300">현재 상태이상에 걸린 아군 기물이 없습니다.</span>
                    ) : activeDef.id === 'royal_escape' ? (
                      <span className="text-amber-300">안전하게 자리를 바꿀 수 있는 룩이 없습니다.</span>
                    ) : (
                      <span className="text-amber-300">현재 보드에 적용할 수 있는 대상이 없습니다.</span>
                    )}
                  </p>

                  {activeUsable &&
                    (activeDef.id === 'tactical_jam' ||
                      activeDef.id === 'mana_drain' ||
                      activeDef.id === 'arcane_tome') &&
                    onQuickCast && (
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewCardUid(null);
                          onQuickCast(activeCard.uid, playerColor === 'b' ? 'a8' : 'a1');
                        }}
                        className="pixel-btn shrink-0 px-2 py-1 bg-fuchsia-600 hover:bg-fuchsia-500 border border-fuchsia-300 text-[10px] font-extrabold text-white cursor-pointer whitespace-nowrap"
                      >
                        즉시 발동
                      </button>
                    )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Strip: Mana Bar + Skill Draw (3 MP or 1 MP) + Status */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-[#0F172A] border border-sky-500/60 shrink-0">
            <PixelManaGem className="w-3 h-3" />
            <span className="font-mono-tabular text-[11px] font-extrabold text-sky-300">
              {mana}/{maxMana}
            </span>
          </div>

          <div className="hidden xs:flex items-center gap-0.5 shrink-0" aria-hidden="true">
            {Array.from({ length: maxMana }).map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-2 border ${
                  i < mana
                    ? 'bg-sky-400 border-sky-200'
                    : 'bg-[#11151E] border-[#2A3245]'
                }`}
              />
            ))}
          </div>

          {typeof opponentHandCount === 'number' && (
            <span className="text-[10px] font-semibold text-slate-400 shrink-0">
              · 상대 패 {opponentHandCount}장
            </span>
          )}

          {activeCast?.lockedPieceSquare && (
            <span className="text-[10px] font-bold text-amber-300 truncate">
              · {SKILL_DEFINITIONS[activeCast.skillId].name} 활성(지정 기물만 이동)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {(selectedCardUid ||
            (activeCast && (activeCast.skillId === 'swap' || activeCast.skillId === 'snipe'))) && (
            <button
              type="button"
              onClick={() => {
                setPreviewCardUid(null);
                onCancelCard();
              }}
              className="px-1.5 py-0.5 bg-[#2A3142] hover:bg-[#374057] border border-[#495573] text-[10px] font-bold text-slate-200 flex items-center gap-0.5 cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>취소</span>
            </button>
          )}

          <button
            type="button"
            onClick={onDrawSkill}
            disabled={!canDraw}
            title={`마나 ${drawCost}을 사용해 비밀 스킬 1장 뽑기`}
            className={`pixel-btn px-2 py-0.5 disabled:bg-[#1E2433] disabled:text-slate-500 disabled:border-[#2E364A] border text-[10px] sm:text-[11px] font-extrabold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
              drawCost === 1
                ? 'bg-amber-400 hover:bg-amber-300 border-amber-200 text-[#14171F]'
                : 'bg-sky-500 hover:bg-sky-400 border-sky-200 text-[#0F172A]'
            }`}
          >
            <Plus className="w-3 h-3" />
            <span>뽑기</span>
            <span className="font-mono-tabular">{drawCost}MP</span>
          </button>
        </div>
      </div>

      {/* Handheld Fan Cards (Name + Icon only, no descriptions!) + Trash Can */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0 flex items-end justify-center sm:justify-start py-0.5 min-h-[62px] sm:min-h-[68px]">
          {hand.length === 0 ? (
            <div className="w-full flex items-center justify-center gap-2 text-[11px] text-slate-400 py-1.5">
              <span>보유 스킬 없음</span>
              {canDraw ? (
                <button
                  type="button"
                  onClick={onDrawSkill}
                  className="px-2 py-0.5 bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400 text-sky-200 text-[11px] font-bold cursor-pointer"
                >
                  마나 {drawCost}으로 스킬 뽑기
                </button>
              ) : (
                <span className="text-[10px] text-slate-500">
                  (턴당 +1 MP · 잡힐 때 +1 MP)
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-end justify-center pl-1 pr-2">
              {hand.map((card, idx) => {
                const def = SKILL_DEFINITIONS[card.skillId];
                const cost = getCost(card.skillId);
                const affordable = mana >= cost;
                const hasTarget = hasEligibleTargets(card.skillId);
                const usable = canUseHand && affordable && hasTarget;
                const isSelected = selectedCardUid === card.uid || previewCardUid === card.uid;
                const isBeingDragged =
                  draggingState?.card.uid === card.uid && draggingState.moved;

                const mid = (hand.length - 1) / 2;
                const fanAngle = (idx - mid) * 5.5;
                const fanArcY = Math.abs(idx - mid) * 2.5;

                return (
                  <motion.div
                    key={card.uid}
                    layout
                    initial={{ opacity: 0, y: 12, scale: 0.85 }}
                    animate={{
                      opacity: isBeingDragged ? 0.3 : 1,
                      y: isSelected ? -7 : fanArcY,
                      rotate: isSelected ? 0 : fanAngle,
                      scale: isSelected ? 1.07 : 1,
                    }}
                    whileHover={{ y: -5, scale: 1.04 }}
                    transition={{ type: 'spring', stiffness: 360, damping: 25 }}
                    onPointerDown={(e) => handleCardPointerDown(e, card)}
                    style={{
                      zIndex: isSelected ? 30 : 10 + idx,
                      touchAction: 'none',
                      transformOrigin: 'bottom center',
                    }}
                    className={`relative shrink-0 -ml-1.5 first:ml-0 w-[64px] sm:w-[74px] h-[58px] sm:h-[64px] p-1 border-2 flex flex-col items-center justify-between shadow-[0_2px_0_#0B0E14] transition-colors ${
                      isSelected
                        ? 'bg-[#2C354D] border-amber-400 cursor-pointer'
                        : usable
                        ? 'bg-[#22293B] border-[#4B5A7E] hover:border-amber-300 cursor-grab active:cursor-grabbing'
                        : canUseHand
                        ? 'bg-[#181C26] border-[#2D3549] opacity-85 cursor-grab active:cursor-grabbing'
                        : 'bg-[#171B24] border-[#282F40] opacity-80 cursor-pointer'
                    }`}
                  >
                    {/* Mana Badge (Top-left) */}
                    <div className="w-full flex items-center justify-between leading-none">
                      <span
                        className={`inline-flex items-center gap-0.5 px-1 py-0.5 text-[8.5px] font-mono-tabular font-extrabold border leading-none ${
                          affordable
                            ? 'bg-sky-950 border-sky-400 text-sky-200'
                            : 'bg-red-950/75 border-red-500/70 text-red-300'
                        }`}
                      >
                        <PixelManaGem className="w-2 h-2" />
                        {cost}
                      </span>
                    </div>

                    {/* Pixel Icon */}
                    <div className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center">
                      <SkillPixelIllustration
                        skillId={card.skillId}
                        className="w-6 h-6 sm:w-7 sm:h-7"
                      />
                    </div>

                    {/* Skill Name Only (No Description!) */}
                    <span className="w-full text-center text-[9px] sm:text-[9.5px] font-bold text-slate-100 truncate leading-none">
                      {def.name}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Trash Can Drop Zone */}
        <div
          ref={trashRef}
          className={`shrink-0 w-[48px] sm:w-[58px] h-[58px] sm:h-[64px] border-2 flex flex-col items-center justify-center p-1 transition-colors ${
            draggingState?.overTrash
              ? 'bg-amber-500/25 border-amber-400 scale-105'
              : canUseHand
              ? 'bg-[#141822] border-dashed border-[#3D4761]'
              : 'bg-[#13161E] border-[#252B3B] opacity-55'
          }`}
          title="카드를 끌어다 버리면 마나를 얻습니다"
        >
          <PixelTrashCan
            isOpen={Boolean(draggingState?.overTrash)}
            className="w-6 h-6 sm:w-7 sm:h-7"
          />
          <span className="text-[8.5px] font-mono-tabular font-bold text-sky-300 mt-0.5 whitespace-nowrap">
            +{recycleBonus} MP
          </span>
        </div>
      </div>

      {/* Floating Drag Preview */}
      <AnimatePresence>
        {draggingState && draggingState.moved && (
          <div
            style={{
              position: 'fixed',
              left: draggingState.curX - 36,
              top: draggingState.curY - 36,
              pointerEvents: 'none',
              zIndex: 80,
            }}
            className={`w-[72px] h-[68px] p-1 border-2 flex flex-col items-center justify-between shadow-xl ${
              draggingState.overTrash
                ? 'bg-amber-950/95 border-amber-400 scale-95'
                : 'bg-[#283147]/95 border-sky-400'
            }`}
          >
            <div className="w-full flex items-center justify-between">
              <span className="px-1 py-0.5 text-[8.5px] font-mono-tabular font-extrabold bg-sky-950 border border-sky-400 text-sky-200 leading-none">
                {getCost(draggingState.card.skillId)}
              </span>
              <span className="text-[8.5px] font-bold text-slate-100 truncate">
                {SKILL_DEFINITIONS[draggingState.card.skillId].name}
              </span>
            </div>
            <SkillPixelIllustration
              skillId={draggingState.card.skillId}
              className="w-7 h-7"
            />
            <span className="text-[8.5px] font-bold text-amber-300">
              {draggingState.overTrash ? `+${recycleBonus} MP` : '버리기'}
            </span>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
