import React from 'react';
import { LogOut, Sparkles, Trophy, UserCheck, X } from 'lucide-react';
import type { LeaderboardUserRecord } from '../types/chess';
import { getRankInfo, INITIAL_RATING } from '../utils/rating';
import { PixelPiece } from './PixelPieces';
import { PixelTierIcon } from './SkillPixelArt';

interface AccountStatsModalProps {
  open: boolean;
  stats: LeaderboardUserRecord | null;
  fallbackName?: string;
  fallbackPhotoURL?: string;
  isOwnAccount?: boolean;
  onSignOut?: () => void;
  onClose: () => void;
}

function calcWinRate(wins: number, losses: number, draws: number): string {
  const total = wins + losses + draws;
  if (total === 0) return '0%';
  return `${Math.round((wins / total) * 100)}%`;
}

export const AccountStatsModal: React.FC<AccountStatsModalProps> = ({
  open,
  stats,
  fallbackName = '도트기사',
  fallbackPhotoURL,
  isOwnAccount = false,
  onSignOut,
  onClose,
}) => {
  if (!open) return null;

  const displayName = stats?.displayName || fallbackName;
  const photoURL = stats?.photoURL || fallbackPhotoURL;

  const skillRating = stats?.skillRating ?? INITIAL_RATING;
  const skillWins = stats?.skillWins ?? 0;
  const skillLosses = stats?.skillLosses ?? 0;
  const skillDraws = stats?.skillDraws ?? 0;
  const skillTier = getRankInfo(skillRating);

  const classicRating = stats?.classicRating ?? INITIAL_RATING;
  const classicWins = stats?.classicWins ?? 0;
  const classicLosses = stats?.classicLosses ?? 0;
  const classicDraws = stats?.classicDraws ?? 0;
  const classicTier = getRankInfo(classicRating);

  const totalWins = skillWins + classicWins;
  const totalLosses = skillLosses + classicLosses;
  const totalDraws = skillDraws + classicDraws;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
    >
      <div
        className="pixel-panel w-full max-w-[390px] p-4 sm:p-5 space-y-3.5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#2B3347]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 shrink-0 bg-[#0F131C] border-2 border-[#3C4866] flex items-center justify-center overflow-hidden">
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-6 h-6">
                  <PixelPiece type="n" color="w" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-extrabold text-slate-50 truncate">{displayName}</h3>
                {isOwnAccount && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500 text-[#14171F] text-[9px] font-extrabold shrink-0">
                    <UserCheck className="w-2.5 h-2.5" />
                    <span>내 계정</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] font-mono-tabular text-slate-400">
                전체 {totalWins}승 {totalLosses}패 {totalDraws}무 · 승률{' '}
                {calcWinRate(totalWins, totalLosses, totalDraws)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-7 h-7 bg-[#222837] hover:bg-[#2F374C] border border-[#3B4661] text-slate-300 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Symmetrical 2-Column Dual Rank Cards */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Skill Rank Card */}
          <div className="bg-[#141822] border-2 border-[#2B3449] p-3 flex flex-col items-center text-center gap-2">
            <div className="flex items-center gap-1 text-[11px] font-bold text-sky-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>스킬 랭크</span>
            </div>

            <div className="w-12 h-12 bg-[#0F131C] border border-[#323C55] flex items-center justify-center">
              <PixelTierIcon tierId={skillTier.id} className="w-9 h-9" />
            </div>

            <div>
              <div className="text-xs font-extrabold text-slate-100">{skillTier.tier}</div>
              <div className="text-sm font-mono-tabular font-extrabold text-sky-300 mt-0.5">
                {skillRating}점
              </div>
            </div>

            <div className="w-full pt-2 border-t border-[#252C3E] space-y-0.5 text-[11px] font-mono-tabular">
              <div className="text-slate-300">
                {skillWins}승 {skillLosses}패 {skillDraws}무
              </div>
              <div className="text-slate-400">
                승률 {calcWinRate(skillWins, skillLosses, skillDraws)}
              </div>
            </div>
          </div>

          {/* Classic Rank Card */}
          <div className="bg-[#141822] border-2 border-[#2B3449] p-3 flex flex-col items-center text-center gap-2">
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-300">
              <Trophy className="w-3.5 h-3.5" />
              <span>클래식 랭크</span>
            </div>

            <div className="w-12 h-12 bg-[#0F131C] border border-[#323C55] flex items-center justify-center">
              <PixelTierIcon tierId={classicTier.id} className="w-9 h-9" />
            </div>

            <div>
              <div className="text-xs font-extrabold text-slate-100">{classicTier.tier}</div>
              <div className="text-sm font-mono-tabular font-extrabold text-amber-300 mt-0.5">
                {classicRating}점
              </div>
            </div>

            <div className="w-full pt-2 border-t border-[#252C3E] space-y-0.5 text-[11px] font-mono-tabular">
              <div className="text-slate-300">
                {classicWins}승 {classicLosses}패 {classicDraws}무
              </div>
              <div className="text-slate-400">
                승률 {calcWinRate(classicWins, classicLosses, classicDraws)}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        {isOwnAccount && onSignOut ? (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onSignOut();
                onClose();
              }}
              className="pixel-btn py-2 bg-[#231922] hover:bg-[#33212E] border border-rose-500/60 text-xs font-bold text-rose-200 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>로그아웃</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="pixel-btn py-2 bg-amber-500 hover:bg-amber-400 border border-amber-200 text-xs font-extrabold text-[#14171F] cursor-pointer"
            >
              닫기
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="pixel-btn w-full py-2 bg-amber-500 hover:bg-amber-400 border border-amber-200 text-xs font-extrabold text-[#14171F] cursor-pointer"
          >
            닫기
          </button>
        )}
      </div>
    </div>
  );
};
