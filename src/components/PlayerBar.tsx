import React from 'react';
import { PieceColor, PieceType } from '../types/chess';
import { PixelPiece } from './PixelPieces';

interface PlayerBarProps {
  label: string;
  subtitle?: string;
  color: PieceColor;
  isActiveTurn: boolean;
  timeMs: number;
  isUnlimited: boolean;
  capturedPieces: PieceType[];
  materialAdvantage: number;
  connectionState?: 'connected' | 'disconnected' | 'waiting';
  inCheck?: boolean;
  mana?: number;
  augmentLabel?: string;
}

export function formatClock(ms: number, isUnlimited: boolean): string {
  if (isUnlimited) return '∞';
  const clamped = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  label,
  subtitle,
  color,
  isActiveTurn,
  timeMs,
  isUnlimited,
  capturedPieces,
  materialAdvantage,
  connectionState,
  inCheck,
  mana,
  augmentLabel,
}) => {
  const isLowTime = !isUnlimited && timeMs > 0 && timeMs <= 30000;
  const capturedColor: PieceColor = color === 'w' ? 'b' : 'w';

  return (
    <div
      className={`w-full px-2.5 py-1.5 border-2 transition-colors duration-150 flex items-center justify-between gap-2 ${
        isActiveTurn
          ? 'bg-[#23293A] border-amber-500/80 shadow-[0_2px_0_#0B0E14]'
          : 'bg-[#191D27] border-[#2B3244]'
      }`}
    >
      {/* Left: Piece Emblem + Name + Captures */}
      <div className="flex items-center gap-2 min-w-0">
        <div
          className={`w-8 h-8 shrink-0 flex items-center justify-center border-2 ${
            color === 'w'
              ? 'bg-[#E6DEC8] border-[#384158]'
              : 'bg-[#242A38] border-[#4A5572]'
          }`}
        >
          <div className="w-6 h-6">
            <PixelPiece type="k" color={color} />
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-100 truncate">
            <span className="truncate">{label}</span>
            {subtitle && (
              <span className="text-[11px] font-normal text-slate-400 shrink-0">
                · {subtitle}
              </span>
            )}
            {typeof mana === 'number' && (
              <span className="text-[11px] font-mono-tabular font-bold text-sky-300 shrink-0">
                · {mana}MP
              </span>
            )}
            {augmentLabel && (
              <span className="hidden xs:inline text-[10px] font-bold text-amber-300/90 truncate max-w-[90px] sm:max-w-none">
                · {augmentLabel}
              </span>
            )}
            {connectionState === 'waiting' && (
              <span className="text-[11px] font-medium text-amber-400 shrink-0">
                · 대기 중
              </span>
            )}
            {connectionState === 'disconnected' && (
              <span className="text-[11px] font-medium text-red-400 shrink-0">
                · 끊김
              </span>
            )}
            {inCheck && (
              <span className="text-[11px] font-extrabold text-red-400 shrink-0">
                · 체크!
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 min-h-[15px]">
            {capturedPieces.length > 0 ? (
              <div className="flex items-center overflow-hidden max-w-[170px] sm:max-w-[260px]">
                {capturedPieces.slice(0, 12).map((pt, idx) => (
                  <div key={`${pt}-${idx}`} className="w-3.5 h-3.5 shrink-0">
                    <PixelPiece type={pt} color={capturedColor} />
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-slate-500">
                {isActiveTurn ? '현재 차례' : '대기 중'}
              </span>
            )}
            {materialAdvantage > 0 && (
              <span className="text-[10px] font-mono-tabular font-bold text-emerald-400 ml-0.5">
                +{materialAdvantage}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Chess Clock */}
      <div
        className={`shrink-0 px-2.5 py-1 border-2 font-mono-tabular text-sm sm:text-base font-bold tracking-tight min-w-[70px] sm:min-w-[78px] text-center ${
          isActiveTurn
            ? isLowTime
              ? 'bg-red-950/80 border-red-500 text-red-300'
              : 'bg-[#121620] border-amber-400 text-amber-300'
            : 'bg-[#12151E] border-[#2C3346] text-slate-400'
        }`}
      >
        {formatClock(timeMs, isUnlimited)}
      </div>
    </div>
  );
};
