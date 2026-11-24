import React from 'react';
import type { AugmentId, PieceColor } from '../types/chess';
import { AUGMENT_DEFINITIONS } from '../engine/skillChess';
import { AugmentPixelBadge } from './SkillPixelArt';

interface AugmentSelectModalProps {
  offeredAugments: AugmentId[];
  myChoice: AugmentId | null;
  opponentChoice: AugmentId | null;
  myColor: PieceColor | 'spectator';
  onChoose: (augmentId: AugmentId) => void;
}

export const AugmentSelectModal: React.FC<AugmentSelectModalProps> = ({
  offeredAugments,
  myChoice,
  myColor,
  onChoose,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-[#0B0E14]/85 flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="대국 증강 선택"
    >
      <div className="pixel-panel w-full max-w-2xl p-4 sm:p-6">
        <div className="text-center mb-4">
          <p className="font-pixel text-[11px] text-amber-400 tracking-wider">
            AUGMENT SELECTION
          </p>
          <h2 className="text-base sm:text-xl font-extrabold text-slate-50 mt-1">
            이번 대국 증강 1개를 선택하세요
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            양측 플레이어에게 동일한 3개의 증강이 제시됩니다. 선택한 증강은 게임 내내 적용됩니다.
          </p>
        </div>

        {myChoice ? (
          <div className="py-6 text-center space-y-2 bg-[#141822] border-2 border-amber-400/70 p-4">
            <div className="w-12 h-12 mx-auto bg-[#1B2130] border border-[#323B52] flex items-center justify-center">
              <AugmentPixelBadge augmentId={myChoice} className="w-9 h-9" />
            </div>
            <div className="text-sm font-extrabold text-amber-300">
              {AUGMENT_DEFINITIONS[myChoice].name} 선택 완료
            </div>
            <p className="text-xs text-slate-300">
              상대방이 증강을 고를 때까지 기다리고 있습니다...
            </p>
          </div>
        ) : myColor === 'spectator' ? (
          <div className="py-6 text-center text-xs text-slate-300">
            두 플레이어가 시작 증강을 선택 중입니다...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {offeredAugments.map((augId) => {
              const def = AUGMENT_DEFINITIONS[augId];
              return (
                <button
                  key={augId}
                  type="button"
                  onClick={() => onChoose(augId)}
                  className="pixel-btn bg-[#191F2C] hover:bg-[#252D40] border-2 border-[#3C4663] hover:border-amber-400 p-3 sm:p-4 text-left flex sm:flex-col items-center sm:items-stretch gap-3 sm:gap-2.5 cursor-pointer transition-colors"
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 sm:mx-auto shrink-0 bg-[#10141E] border-2 border-[#2D354B] flex items-center justify-center">
                    <AugmentPixelBadge augmentId={augId} className="w-9 h-9 sm:w-10 sm:h-10" />
                  </div>
                  <div className="min-w-0 flex-1 sm:text-center">
                    <div className="text-[10px] font-bold text-sky-300">{def.tag}</div>
                    <div className="text-sm font-extrabold text-slate-100 mt-0.5">
                      {def.name}
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                      {def.fullDesc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
