import React from 'react';
import type { SkillId } from '../types/chess';
import { SKILL_DEFINITIONS } from '../engine/skillChess';
import { PixelManaGem, SkillPixelIllustration } from './SkillPixelArt';

interface SkillDraftModalProps {
  offeredSkills: SkillId[];
  onChoose: (skillId: SkillId) => void;
}

const CATEGORY_LABELS = {
  mobility: '기동',
  offense: '공격·교란',
  defense: '방어·소환',
} as const;

export const SkillDraftModal: React.FC<SkillDraftModalProps> = ({
  offeredSkills,
  onChoose,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-[#0B0E14]/85 flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="초반 보급 스킬 선택"
    >
      <div className="pixel-panel w-full max-w-2xl p-4 sm:p-6">
        <div className="text-center mb-4">
          <p className="font-pixel text-[11px] text-sky-400 tracking-wider">
            OPENING INTEL DRAFT
          </p>
          <h2 className="text-base sm:text-xl font-extrabold text-slate-50 mt-1">
            초반 보급 · 스킬 1장을 선택하세요
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            첫 스킬 뽑기 보너스로 제시된 3장의 비밀 스킬 중 원하는 1장을 손으로 가져옵니다.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
          {offeredSkills.map((skillId) => {
            const def = SKILL_DEFINITIONS[skillId];
            return (
              <button
                key={skillId}
                type="button"
                onClick={() => onChoose(skillId)}
                className="pixel-btn bg-[#191F2C] hover:bg-[#252D40] border-2 border-[#3C4663] hover:border-sky-400 p-3 sm:p-4 text-left flex sm:flex-col items-center sm:items-stretch gap-3 sm:gap-2.5 cursor-pointer transition-colors"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 sm:mx-auto shrink-0 bg-[#10141E] border-2 border-[#2D354B] flex items-center justify-center">
                  <SkillPixelIllustration
                    skillId={skillId}
                    className="w-9 h-9 sm:w-10 sm:h-10"
                  />
                </div>
                <div className="min-w-0 flex-1 sm:text-center">
                  <div className="flex items-center sm:justify-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-300">
                      {CATEGORY_LABELS[def.category]}
                    </span>
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-sky-950 border border-sky-400 text-[10px] font-mono-tabular font-extrabold text-sky-200">
                      <PixelManaGem className="w-2.5 h-2.5" />
                      {def.manaCost} MP
                    </span>
                  </div>
                  <div className="text-sm font-extrabold text-slate-100 mt-1">
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
      </div>
    </div>
  );
};
