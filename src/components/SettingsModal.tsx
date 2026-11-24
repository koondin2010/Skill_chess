import React from 'react';
import {
  Disc3,
  Music,
  PauseCircle,
  SlidersHorizontal,
  Swords,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { BgmPace, BgmScene } from '../types/chess';

interface SettingsModalProps {
  open: boolean;
  currentScene: BgmScene;
  muted: boolean;
  lobbyBgmEnabled: boolean;
  lobbyBgmPace: BgmPace;
  bgmEnabled: boolean;
  bgmPace: BgmPace;
  pauseBgmOnOpponentTurn: boolean;
  onToggleMute: () => void;
  onToggleLobbyBgm: () => void;
  onChangeLobbyBgmPace: (pace: BgmPace) => void;
  onToggleBgm: () => void;
  onChangeBgmPace: (pace: BgmPace) => void;
  onTogglePauseBgmOnOpponentTurn: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  currentScene,
  muted,
  lobbyBgmEnabled,
  lobbyBgmPace,
  bgmEnabled,
  bgmPace,
  pauseBgmOnOpponentTurn,
  onToggleMute,
  onToggleLobbyBgm,
  onChangeLobbyBgmPace,
  onToggleBgm,
  onChangeBgmPace,
  onTogglePauseBgmOnOpponentTurn,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0B0E14]/80 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="게임 및 사운드 설정"
    >
      <div className="pixel-panel w-full max-w-md max-h-[90dvh] flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-[#2B3244]">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-amber-300" />
            <h2 className="text-sm font-extrabold text-slate-100">사운드 · 배경음 설정</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="설정 닫기"
            className="p-1 text-slate-400 hover:text-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto">
          {/* Master Sound Toggle */}
          <div className="flex items-center justify-between gap-3 bg-[#141822] border border-[#2B3347] p-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {muted ? (
                <VolumeX className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <Volume2 className="w-4 h-4 text-sky-300 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-100">전체 사운드</div>
                <div className="text-[11px] text-slate-400">
                  효과음과 모든 배경음을 한 번에 켜거나 끕니다.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleMute}
              className={`pixel-btn shrink-0 px-3 py-1.5 border text-xs font-extrabold cursor-pointer whitespace-nowrap ${
                !muted
                  ? 'bg-emerald-500 border-emerald-200 text-[#0F172A]'
                  : 'bg-[#222837] border-[#3B4560] text-slate-300'
              }`}
            >
              {muted ? '음소거' : '켜짐'}
            </button>
          </div>

          {/* Section 1: Lobby (Main Screen) BGM */}
          <div
            className={`bg-[#141822] border p-3 space-y-2.5 ${
              currentScene === 'lobby' ? 'border-emerald-500/60' : 'border-[#2B3347]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Disc3 className="w-4 h-4 text-emerald-300 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold text-slate-100">
                      메인 화면 (대기창) BGM
                    </span>
                    {currentScene === 'lobby' && (
                      <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-emerald-500/20 border border-emerald-400/50 text-emerald-300">
                        현재 화면
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    로비에서 들리는 부드러운 도트 멜로디를 설정합니다.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleLobbyBgm}
                className={`pixel-btn shrink-0 px-3 py-1.5 border text-xs font-extrabold cursor-pointer whitespace-nowrap ${
                  lobbyBgmEnabled && !muted
                    ? 'bg-emerald-400 border-emerald-200 text-[#0F172A]'
                    : 'bg-[#222837] border-[#3B4560] text-slate-300'
                }`}
              >
                {lobbyBgmEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChangeLobbyBgmPace('normal')}
                className={`py-2 px-2.5 border-2 text-center cursor-pointer transition-colors ${
                  lobbyBgmPace === 'normal'
                    ? 'bg-[#23322E] border-emerald-400 text-emerald-300'
                    : 'bg-[#171C28] border-[#2C3449] text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="text-xs font-extrabold">기본 버전</div>
                <div className="text-[10px] text-slate-400 mt-0.5">포근한 로비 템포</div>
              </button>
              <button
                type="button"
                onClick={() => onChangeLobbyBgmPace('slow')}
                className={`py-2 px-2.5 border-2 text-center cursor-pointer transition-colors ${
                  lobbyBgmPace === 'slow'
                    ? 'bg-[#232D3D] border-teal-400 text-teal-300'
                    : 'bg-[#171C28] border-[#2C3449] text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="text-xs font-extrabold">느린 버전</div>
                <div className="text-[10px] text-slate-400 mt-0.5">차분하고 느긋한 템포</div>
              </button>
            </div>
          </div>

          {/* Section 2: In-Game Battle BGM */}
          <div
            className={`bg-[#141822] border p-3 space-y-2.5 ${
              currentScene === 'game' ? 'border-amber-500/60' : 'border-[#2B3347]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Swords className="w-4 h-4 text-amber-300 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold text-slate-100">
                      인게임 (대국) BGM
                    </span>
                    {currentScene === 'game' && (
                      <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-amber-500/20 border border-amber-400/50 text-amber-300">
                        현재 화면
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    대국 시작 후 재생되는 레트로 체스 배틀 BGM입니다.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleBgm}
                className={`pixel-btn shrink-0 px-3 py-1.5 border text-xs font-extrabold cursor-pointer whitespace-nowrap ${
                  bgmEnabled && !muted
                    ? 'bg-amber-400 border-amber-200 text-[#14171F]'
                    : 'bg-[#222837] border-[#3B4560] text-slate-300'
                }`}
              >
                {bgmEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChangeBgmPace('normal')}
                className={`py-2 px-2.5 border-2 text-center cursor-pointer transition-colors ${
                  bgmPace === 'normal'
                    ? 'bg-[#2B344B] border-amber-400 text-amber-300'
                    : 'bg-[#171C28] border-[#2C3449] text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="text-xs font-extrabold">기본 버전</div>
                <div className="text-[10px] text-slate-400 mt-0.5">경쾌한 기본 템포</div>
              </button>
              <button
                type="button"
                onClick={() => onChangeBgmPace('slow')}
                className={`py-2 px-2.5 border-2 text-center cursor-pointer transition-colors ${
                  bgmPace === 'slow'
                    ? 'bg-[#2B344B] border-sky-400 text-sky-300'
                    : 'bg-[#171C28] border-[#2C3449] text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="text-xs font-extrabold">느린 버전</div>
                <div className="text-[10px] text-slate-400 mt-0.5">차분하고 느긋한 템포</div>
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1.5 border-t border-[#232A3C]">
              <div className="flex items-center gap-2 min-w-0">
                <PauseCircle className="w-4 h-4 text-fuchsia-300 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-100">
                    상대 턴일 때 노래 일시정지
                  </div>
                  <div className="text-[10px] text-slate-400">
                    상대가 생각하는 동안 멈추고 내 차례에 다시 이어집니다.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onTogglePauseBgmOnOpponentTurn}
                className={`pixel-btn shrink-0 px-3 py-1.5 border text-xs font-extrabold cursor-pointer whitespace-nowrap ${
                  pauseBgmOnOpponentTurn
                    ? 'bg-sky-500 border-sky-200 text-[#0F172A]'
                    : 'bg-[#222837] border-[#3B4560] text-slate-300'
                }`}
              >
                {pauseBgmOnOpponentTurn ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 px-1">
            <Music className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>설정은 자동 저장되며 화면 전환 시 해당 BGM으로 자연스럽게 바뀝니다.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
