import React, { useEffect, useState } from 'react';
import {
  Cpu,
  Users,
  BookOpen,
  History,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  ScrollText,
  Trash2,
  Trophy,
  Shuffle,
  RefreshCw,
  LogIn,
  Info,
  X,
} from 'lucide-react';
import {
  AI_TIERS,
  AiLevel,
  LeaderboardUserRecord,
  MatchHistoryRecord,
  PieceColor,
  RankTierId,
  RatingCategory,
  RuleMode,
  SkillCategory,
  TIME_PRESETS,
  TimeControl,
} from '../types/chess';
import { AUGMENT_LIST, SKILL_LIST } from '../engine/skillChess';
import { getRankInfo, INITIAL_RATING } from '../utils/rating';
import { PixelPiece } from './PixelPieces';
import {
  AugmentPixelBadge,
  PixelAiAvatar,
  PixelManaGem,
  PixelTierIcon,
  SkillPixelIllustration,
} from './SkillPixelArt';
import { MoveNotationModal } from './MoveNotationModal';
import { AccountStatsModal } from './AccountStatsModal';

const TIER_GUIDE_ROWS: Array<{ id: RankTierId; label: string; scoreText: string }> = [
  { id: 'unranked', label: '언랭크', scoreText: '0점' },
  { id: 'iron', label: '아이언', scoreText: '1점 이상' },
  { id: 'bronze', label: '브론즈', scoreText: '300점 이상' },
  { id: 'silver', label: '실버', scoreText: '600점 이상' },
  { id: 'gold', label: '골드', scoreText: '900점 이상' },
  { id: 'platinum', label: '플레티넘', scoreText: '1200점 이상' },
  { id: 'emerald', label: '에메랄드', scoreText: '1500점 이상' },
  { id: 'diamond', label: '다이아', scoreText: '2000점 이상' },
  { id: 'master', label: '마스터', scoreText: '2500점 이상' },
  { id: 'grandmaster', label: '그랜드마스터', scoreText: '3000점 이상' },
];

type LobbyTab = 'ai' | 'online' | 'leaderboard' | 'codex' | 'history';

interface MatchSetupPanelProps {
  initialRoomCode?: string;
  wsError: string | null;
  wsConnecting: boolean;
  matchHistory: MatchHistoryRecord[];
  authUser: { uid: string; displayName: string; photoURL?: string } | null;
  authLoading: boolean;
  myLeaderboardStats: LeaderboardUserRecord | null;
  leaderboardSkill: LeaderboardUserRecord[];
  leaderboardClassic: LeaderboardUserRecord[];
  leaderboardLoading: boolean;
  onSignInGoogle: () => void;
  onSignOutGoogle: () => void;
  onRefreshLeaderboard: () => void;
  onClearHistory: () => void;
  onStartAiGame: (config: {
    aiLevel: AiLevel;
    playerColor: PieceColor | 'random';
    timeControl: TimeControl;
    ruleMode: RuleMode;
  }) => void;
  onCreateOnlineRoom: (config: {
    nickname: string;
    preferredColor: PieceColor | 'random';
    timeControl: TimeControl;
    ruleMode: RuleMode;
  }) => void;
  onJoinOnlineRoom: (config: { roomCode: string; nickname: string }) => void;
}

export const MatchSetupPanel: React.FC<MatchSetupPanelProps> = ({
  initialRoomCode = '',
  wsError,
  wsConnecting,
  matchHistory,
  authUser,
  authLoading,
  myLeaderboardStats,
  leaderboardSkill,
  leaderboardClassic,
  leaderboardLoading,
  onSignInGoogle,
  onSignOutGoogle,
  onRefreshLeaderboard,
  onClearHistory,
  onStartAiGame,
  onCreateOnlineRoom,
  onJoinOnlineRoom,
}) => {
  const [activeTab, setActiveTab] = useState<LobbyTab>(initialRoomCode ? 'online' : 'ai');
  const [onlineAction, setOnlineAction] = useState<'create' | 'join'>(
    initialRoomCode ? 'join' : 'create'
  );
  const [ruleMode, setRuleMode] = useState<RuleMode>('skill');
  const [aiLevel, setAiLevel] = useState<AiLevel>(3);
  const [preferredColor, setPreferredColor] = useState<PieceColor | 'random'>('w');
  const [timeMinutes, setTimeMinutes] = useState<number>(10);
  const [addFiveSecIncrement, setAddFiveSecIncrement] = useState<boolean>(false);
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(15);
  const [nickname, setNickname] = useState(authUser?.displayName || '도트기사');
  const [joinCode, setJoinCode] = useState(initialRoomCode);

  const [rankCategory, setRankCategory] = useState<RatingCategory>('skill');

  // Codex state (Skill Codex + Augment Codex paged cleanly inside fixed viewport)
  const [codexKind, setCodexKind] = useState<'skills' | 'augments'>('skills');
  const [codexFilter, setCodexFilter] = useState<'all' | SkillCategory>('all');
  const [codexPage, setCodexPage] = useState(0);

  // History notation inspection
  const [inspectRecord, setInspectRecord] = useState<MatchHistoryRecord | null>(null);
  const [tierInfoOpen, setTierInfoOpen] = useState(false);
  const [accountModalTarget, setAccountModalTarget] = useState<{
    stats: LeaderboardUserRecord | null;
    isMe: boolean;
    name?: string;
    photoURL?: string;
  } | null>(null);

  useEffect(() => {
    if (authUser?.displayName && (nickname === '도트기사' || !nickname.trim())) {
      setNickname(authUser.displayName.slice(0, 18));
    }
  }, [authUser?.displayName, nickname]);

  const selectedTier = AI_TIERS.find((t) => t.level === aiLevel) || AI_TIERS[2];
  const effectiveTimeControl: TimeControl = {
    minutes: useCustomTime ? Math.max(1, Math.min(60, customMinutes || 1)) : timeMinutes,
    incrementSeconds: addFiveSecIncrement ? 5 : 0,
  };

  const filteredSkills =
    codexFilter === 'all'
      ? SKILL_LIST
      : SKILL_LIST.filter((s) => s.category === codexFilter);
  const pageSize = 4;
  const activeCodexCount =
    codexKind === 'skills' ? filteredSkills.length : AUGMENT_LIST.length;
  const totalPages = Math.max(1, Math.ceil(activeCodexCount / pageSize));
  const safePage = Math.min(codexPage, totalPages - 1);
  const visibleSkills = filteredSkills.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const visibleAugments = AUGMENT_LIST.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'ai') {
      onStartAiGame({
        aiLevel,
        playerColor: preferredColor,
        timeControl: effectiveTimeControl,
        ruleMode,
      });
    } else if (activeTab === 'online') {
      if (onlineAction === 'create') {
        onCreateOnlineRoom({
          nickname: nickname.trim() || '도트기사',
          preferredColor,
          timeControl: effectiveTimeControl,
          ruleMode,
        });
      } else {
        onJoinOnlineRoom({
          roomCode: joinCode.trim().toUpperCase(),
          nickname: nickname.trim() || '도전기사',
        });
      }
    }
  };

  return (
    <div className="h-full max-w-5xl mx-auto px-3 sm:px-6 py-2.5 sm:py-4 flex flex-col justify-between overflow-hidden">
      {/* Top Compact Title + 4-Tab Navigation */}
      <div className="shrink-0 space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#E6DEC8] border-2 border-[#384158] p-1 shrink-0">
              <PixelPiece type="n" color="w" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-extrabold text-slate-50 truncate">
                도트 그래픽 체스
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                스킬 체스 · 클래식 · 체스960 · 구글 랭크 순위표
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 shrink-0">
            <span>스킬 {SKILL_LIST.length}종 · 증강 {AUGMENT_LIST.length}종</span>
            <span>·</span>
            <span>960 포지션</span>
          </div>
        </div>

        {/* 5 Clean Sub-Window Tabs */}
        <div className="grid grid-cols-5 gap-1 sm:gap-1.5 bg-[#11141C] p-1 border-2 border-[#272D3E]">
          {[
            { id: 'ai' as const, label: 'AI 대전', icon: Cpu },
            { id: 'online' as const, label: '친구 대전', icon: Users },
            { id: 'leaderboard' as const, label: '순위표', icon: Trophy },
            { id: 'codex' as const, label: '도감', icon: BookOpen },
            { id: 'history' as const, label: '기록', icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'leaderboard') {
                    onRefreshLeaderboard();
                  }
                }}
                className={`py-2 px-1 flex items-center justify-center gap-1 text-[11px] sm:text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  active
                    ? 'bg-amber-500 text-[#14171F]'
                    : 'text-slate-300 hover:bg-[#1E2331]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Body (fits remaining height cleanly with zero page scroll) */}
      <div className="flex-1 min-h-0 py-2.5 flex flex-col justify-center">
        {(activeTab === 'ai' || activeTab === 'online') && (
          <form
            onSubmit={handleSubmit}
            className="h-full flex flex-col justify-between gap-2.5"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 sm:gap-4 flex-1 min-h-0">
              {/* Left Panel: Mode Specific */}
              <div className="lg:col-span-7 pixel-panel p-3 sm:p-4 flex flex-col justify-between gap-2.5 overflow-y-auto">
                {/* Rule Mode Switch (shown for AI or Online Create) */}
                {(activeTab === 'ai' || onlineAction === 'create') && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-200">체스 방식</span>
                      <span className="text-[11px] text-slate-400">
                        {ruleMode === 'skill'
                          ? '증강 선택 · 3MP 뽑기 · 피격 +1MP'
                          : ruleMode === 'chess960'
                          ? '960 랜덤 배치 · FIDE 캐슬링'
                          : 'FIDE 정식 체스 규칙'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => setRuleMode('skill')}
                        className={`py-2 px-1.5 sm:px-2 border-2 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer ${
                          ruleMode === 'skill'
                            ? 'bg-[#2B344B] border-amber-400 text-amber-300'
                            : 'bg-[#151922] border-[#2B3244] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">스킬 체스</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRuleMode('classic')}
                        className={`py-2 px-1.5 sm:px-2 border-2 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer ${
                          ruleMode === 'classic'
                            ? 'bg-[#2B344B] border-amber-400 text-amber-300'
                            : 'bg-[#151922] border-[#2B3244] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span className="truncate">클래식 체스</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRuleMode('chess960')}
                        className={`py-2 px-1.5 sm:px-2 border-2 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer ${
                          ruleMode === 'chess960'
                            ? 'bg-[#2B344B] border-amber-400 text-amber-300'
                            : 'bg-[#151922] border-[#2B3244] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Shuffle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">체스960</span>
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'ai' ? (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-200">AI 대결 상대</span>
                      <span className="text-[11px] font-mono-tabular text-amber-300">
                        {selectedTier.title} · {selectedTier.estimatedRating}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {AI_TIERS.map((tier) => (
                        <button
                          key={tier.level}
                          type="button"
                          onClick={() => setAiLevel(tier.level)}
                          className={`py-1.5 px-1 border-2 flex flex-col items-center justify-center gap-1 cursor-pointer ${
                            aiLevel === tier.level
                              ? 'bg-[#2F374D] border-amber-400 text-amber-300'
                              : 'bg-[#161A23] border-[#2B3244] text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="w-8 h-8 bg-[#0F131C] border border-[#303952] flex items-center justify-center">
                            <PixelAiAvatar level={tier.level} className="w-7 h-7" />
                          </div>
                          <div className="text-[10px] font-bold truncate w-full text-center">
                            {tier.title}
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 bg-[#141822] border border-[#283044] px-2.5 py-1.5">
                      <div className="w-7 h-7 shrink-0 bg-[#0F131C] border border-amber-500/40 flex items-center justify-center">
                        <PixelAiAvatar level={selectedTier.level} className="w-6 h-6" />
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug min-w-0">
                        <strong className="text-amber-300">{selectedTier.subtitle}</strong> ·{' '}
                        {selectedTier.description}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#14171F] border border-[#2D3446]">
                      <button
                        type="button"
                        onClick={() => setOnlineAction('create')}
                        className={`py-1.5 text-xs font-bold cursor-pointer ${
                          onlineAction === 'create'
                            ? 'bg-[#2C3346] text-amber-300'
                            : 'text-slate-400'
                        }`}
                      >
                        새 방 만들기
                      </button>
                      <button
                        type="button"
                        onClick={() => setOnlineAction('join')}
                        className={`py-1.5 text-xs font-bold cursor-pointer ${
                          onlineAction === 'join'
                            ? 'bg-[#2C3346] text-amber-300'
                            : 'text-slate-400'
                        }`}
                      >
                        코드로 입장하기
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className={onlineAction === 'create' ? 'col-span-2' : ''}>
                        <label
                          htmlFor="lobby-nick"
                          className="block text-[11px] text-slate-400 mb-1"
                        >
                          내 닉네임
                        </label>
                        <input
                          id="lobby-nick"
                          type="text"
                          maxLength={18}
                          value={nickname}
                          onChange={(e) => setNickname(e.target.value)}
                          className="w-full px-2.5 py-2 bg-[#12151E] border-2 border-[#323A4F] text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      {onlineAction === 'join' && (
                        <div>
                          <label
                            htmlFor="lobby-code"
                            className="block text-[11px] text-slate-400 mb-1"
                          >
                            방 코드 6자리
                          </label>
                          <input
                            id="lobby-code"
                            type="text"
                            maxLength={6}
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="K9P4MX"
                            className="w-full px-2.5 py-2 bg-[#12151E] border-2 border-[#323A4F] text-xs sm:text-sm font-mono-tabular uppercase tracking-widest text-amber-300 focus:outline-none focus:border-amber-400"
                          />
                        </div>
                      )}
                    </div>

                    {wsError && (
                      <div className="flex items-center gap-2 p-2 bg-red-950/60 border border-red-500/70 text-[11px] text-red-200">
                        <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
                        <span>{wsError}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Color Picker */}
                {(activeTab === 'ai' || onlineAction === 'create') && (
                  <div>
                    <span className="block text-xs font-bold text-slate-200 mb-1.5">
                      내 진영
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'w' as const, label: '백 (선공)' },
                        { id: 'random' as const, label: '무작위' },
                        { id: 'b' as const, label: '흑 (후공)' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setPreferredColor(opt.id)}
                          className={`py-1.5 border-2 text-xs font-bold cursor-pointer ${
                            preferredColor === opt.id
                              ? 'bg-[#2F374D] border-amber-400 text-amber-300'
                              : 'bg-[#161A23] border-[#2B3244] text-slate-300'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Panel: Per-Player Time Control */}
              <div className="lg:col-span-5 pixel-panel p-3 sm:p-4 flex flex-col justify-between gap-2.5">
                {activeTab === 'ai' || onlineAction === 'create' ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">
                        1인당 제한 시간
                      </span>
                      <span className="text-xs font-mono-tabular text-amber-300">
                        {effectiveTimeControl.minutes}분
                        {effectiveTimeControl.incrementSeconds > 0
                          ? ` +${effectiveTimeControl.incrementSeconds}초`
                          : ''}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      {TIME_PRESETS.map((preset) => {
                        const isSelected = !useCustomTime && timeMinutes === preset.minutes;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setUseCustomTime(false);
                              setTimeMinutes(preset.minutes);
                            }}
                            className={`py-2 px-1 border-2 text-center cursor-pointer ${
                              isSelected
                                ? 'bg-[#2F374D] border-amber-400 text-amber-300'
                                : 'bg-[#161A23] border-[#2B3244] text-slate-300'
                            }`}
                          >
                            <div className="text-xs font-bold">{preset.label}</div>
                            <div className="text-[10px] font-mono-tabular text-slate-400">
                              {preset.sub}
                            </div>
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => setUseCustomTime(true)}
                        className={`py-2 px-1 border-2 text-center cursor-pointer ${
                          useCustomTime
                            ? 'bg-[#2F374D] border-amber-400 text-amber-300'
                            : 'bg-[#161A23] border-[#2B3244] text-slate-300'
                        }`}
                      >
                        <div className="text-xs font-bold">직접 입력</div>
                        <div className="text-[10px] font-mono-tabular text-slate-400">
                          {customMinutes}분
                        </div>
                      </button>
                    </div>

                    {useCustomTime && (
                      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-[#14171F] border border-[#2D3446]">
                        <span className="text-[11px] text-slate-300">직접 시간 설정</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            max={60}
                            value={customMinutes}
                            onChange={(e) =>
                              setCustomMinutes(
                                Math.max(1, Math.min(60, Number(e.target.value) || 1))
                              )
                            }
                            aria-label="직접 시간 입력(분)"
                            className="w-14 px-1.5 py-1 bg-[#12151E] border border-[#384158] text-xs font-mono-tabular text-center text-amber-300"
                          />
                          <span className="text-xs text-slate-300">분</span>
                        </div>
                      </div>
                    )}

                    <label className="flex items-center gap-1.5 pt-1 border-t border-[#282F42] text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={addFiveSecIncrement}
                        onChange={(e) => setAddFiveSecIncrement(e.target.checked)}
                        className="accent-amber-400 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>수 둘 때 5초 추가 (피셔 방식)</span>
                    </label>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 leading-relaxed py-2 space-y-1.5">
                    <p>
                      친구가 공유한 초대 링크로 접속하면 자동으로 방에 입장하며, 6자리 방 코드를 직접 입력해서도 입장할 수 있습니다.
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    wsConnecting ||
                    (activeTab === 'online' &&
                      onlineAction === 'join' &&
                      joinCode.trim().length < 4)
                  }
                  className="pixel-btn w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-[#14171F] font-extrabold text-sm border-2 border-amber-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>
                    {wsConnecting
                      ? '연결 중...'
                      : activeTab === 'ai'
                      ? 'AI 대국 시작하기'
                      : onlineAction === 'create'
                      ? '방 만들고 초대 코드 받기'
                      : '방 입장하기'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Skill & Augment Codex Tab (Paged cleanly inside 1 viewport!) */}
        {activeTab === 'codex' && (
          <div className="h-full pixel-panel p-3 sm:p-4 flex flex-col justify-between gap-2 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setCodexKind('skills');
                    setCodexPage(0);
                  }}
                  className={`px-2.5 py-1 text-xs font-extrabold border-2 cursor-pointer ${
                    codexKind === 'skills'
                      ? 'bg-sky-500 text-[#0F172A] border-sky-300'
                      : 'bg-[#14171F] text-slate-300 border-[#2C3346]'
                  }`}
                >
                  스킬 도감 ({SKILL_LIST.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCodexKind('augments');
                    setCodexPage(0);
                  }}
                  className={`px-2.5 py-1 text-xs font-extrabold border-2 cursor-pointer ${
                    codexKind === 'augments'
                      ? 'bg-amber-500 text-[#14171F] border-amber-300'
                      : 'bg-[#14171F] text-slate-300 border-[#2C3346]'
                  }`}
                >
                  증강 도감 ({AUGMENT_LIST.length})
                </button>

                {codexKind === 'skills' && (
                  <div className="flex items-center gap-1 ml-1">
                    {[
                      { id: 'all' as const, label: '전체' },
                      { id: 'mobility' as const, label: '기동' },
                      { id: 'offense' as const, label: '공격' },
                      { id: 'defense' as const, label: '방어' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setCodexFilter(f.id);
                          setCodexPage(0);
                        }}
                        className={`px-2 py-1 text-[11px] font-bold border cursor-pointer ${
                          codexFilter === f.id
                            ? 'bg-[#2C354D] text-amber-300 border-amber-400'
                            : 'bg-[#14171F] text-slate-400 border-[#2C3346]'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <span className="text-[11px] text-slate-400 hidden sm:inline">
                {codexKind === 'skills'
                  ? '뽑기 3 MP · 기물이 잡힐 때 +1 MP · 턴 시작 +1 MP · 버리기 +1 MP'
                  : '게임 시작 시 동일한 3개 증강 중 1개 선택'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1 min-h-0">
              {codexKind === 'skills'
                ? visibleSkills.map((skill) => (
                    <div
                      key={skill.id}
                      className="bg-[#151923] border-2 border-[#2D3549] p-2.5 flex items-start gap-3"
                    >
                      <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 bg-[#10131B] border border-[#323B52] flex items-center justify-center">
                        <SkillPixelIllustration skillId={skill.id} className="w-10 h-10 sm:w-11 sm:h-11" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs sm:text-sm font-extrabold text-slate-100 truncate">
                            {skill.name}
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-sky-950 border border-sky-400 text-[11px] font-mono-tabular font-bold text-sky-200 shrink-0">
                            <PixelManaGem className="w-3 h-3" />
                            {skill.manaCost} MP
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                          {skill.fullDesc}
                        </p>
                      </div>
                    </div>
                  ))
                : visibleAugments.map((aug) => (
                    <div
                      key={aug.id}
                      className="bg-[#151923] border-2 border-[#2D3549] p-2.5 flex items-start gap-3"
                    >
                      <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 bg-[#10131B] border border-amber-500/40 flex items-center justify-center">
                        <AugmentPixelBadge augmentId={aug.id} className="w-10 h-10 sm:w-11 sm:h-11" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs sm:text-sm font-extrabold text-slate-100 truncate">
                            {aug.name}
                          </span>
                          <span className="px-1.5 py-0.5 bg-amber-950/80 border border-amber-400/70 text-[10px] font-bold text-amber-200 shrink-0">
                            {aug.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                          {aug.fullDesc}
                        </p>
                      </div>
                    </div>
                  ))}
            </div>

            {/* Codex Pagination Controls */}
            <div className="flex items-center justify-between shrink-0 pt-1 border-t border-[#262C3D]">
              <span className="text-xs font-mono-tabular text-slate-400">
                페이지 {safePage + 1} / {totalPages} (총 {activeCodexCount}종)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage === 0}
                  onClick={() => setCodexPage((p) => Math.max(0, p - 1))}
                  className="px-3 py-1 bg-[#222837] disabled:opacity-40 border border-[#38425B] text-xs font-bold text-slate-200 cursor-pointer"
                >
                  이전
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setCodexPage((p) => Math.min(totalPages - 1, p + 1))}
                  className="px-3 py-1 bg-[#222837] disabled:opacity-40 border border-[#38425B] text-xs font-bold text-slate-200 cursor-pointer"
                >
                  다음
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dual Leaderboard Tab (Skill Rank & Classic Rank) */}
        {activeTab === 'leaderboard' && (() => {
          const rows = rankCategory === 'skill' ? leaderboardSkill : leaderboardClassic;
          const activeMyRating =
            rankCategory === 'skill'
              ? myLeaderboardStats?.skillRating ?? INITIAL_RATING
              : myLeaderboardStats?.classicRating ?? INITIAL_RATING;
          const activeMyTier = getRankInfo(activeMyRating);
          return (
            <div className="h-full pixel-panel p-3 sm:p-4 flex flex-col justify-between gap-2.5 overflow-hidden">
              {/* Top Symmetrical Controls */}
              <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="grid grid-cols-2 w-[212px] sm:w-[232px] p-0.5 bg-[#14171F] border-2 border-[#2D3549]">
                    <button
                      type="button"
                      onClick={() => setRankCategory('skill')}
                      className={`h-7 text-xs font-extrabold cursor-pointer flex items-center justify-center gap-1 ${
                        rankCategory === 'skill'
                          ? 'bg-sky-500 text-[#0F172A]'
                          : 'text-slate-300 hover:text-slate-100'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>스킬 랭크</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRankCategory('classic')}
                      className={`h-7 text-xs font-extrabold cursor-pointer flex items-center justify-center gap-1 ${
                        rankCategory === 'classic'
                          ? 'bg-amber-500 text-[#14171F]'
                          : 'text-slate-300 hover:text-slate-100'
                      }`}
                    >
                      <Trophy className="w-3.5 h-3.5 shrink-0" />
                      <span>클래식 랭크</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setTierInfoOpen(true)}
                    title="티어 기준표"
                    aria-label="티어 기준표"
                    className="w-8 h-8 bg-[#1B2130] hover:bg-[#252D42] border border-[#343F5C] text-slate-300 flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={onRefreshLeaderboard}
                    disabled={leaderboardLoading}
                    title="순위표 새로고침"
                    aria-label="순위표 새로고침"
                    className="w-8 h-8 bg-[#1B2130] hover:bg-[#252D42] border border-[#343F5C] text-slate-300 flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${leaderboardLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {authUser ? (
                  <div className="flex items-center justify-between sm:justify-end gap-2 text-xs">
                    <div className="h-8 px-2.5 bg-[#141822] border border-[#2D3549] flex items-center gap-1.5">
                      <PixelTierIcon tierId={activeMyTier.id} className="w-4 h-4 shrink-0" />
                      <span className="font-bold text-slate-200">{activeMyTier.tier}</span>
                      <span
                        className={`font-mono-tabular font-extrabold ${
                          rankCategory === 'skill' ? 'text-sky-300' : 'text-amber-300'
                        }`}
                      >
                        {activeMyRating}점
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setAccountModalTarget({
                          stats: myLeaderboardStats,
                          isMe: true,
                          name: authUser.displayName,
                          photoURL: authUser.photoURL,
                        })
                      }
                      className="h-8 px-2.5 bg-[#1B2130] hover:bg-[#252D42] border border-[#3B4663] flex items-center gap-1.5 cursor-pointer"
                    >
                      {authUser.photoURL ? (
                        <img
                          src={authUser.photoURL}
                          alt={authUser.displayName}
                          className="w-4 h-4 object-cover border border-[#475370]"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-4 h-4">
                          <PixelPiece type="n" color="w" />
                        </div>
                      )}
                      <span className="font-bold text-slate-100 max-w-[88px] truncate">
                        {authUser.displayName}
                      </span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onSignInGoogle}
                    disabled={authLoading}
                    className="pixel-btn h-8 px-3 bg-amber-500 hover:bg-amber-400 border-2 border-amber-200 text-xs font-extrabold text-[#14171F] flex items-center justify-center gap-1.5 cursor-pointer self-start sm:self-auto"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>{authLoading ? '로그인 중...' : '구글 로그인'}</span>
                  </button>
                )}
              </div>

              <div className="text-[11px] text-slate-400 shrink-0 flex flex-wrap items-center justify-between gap-2 px-1 pb-1 border-b border-[#242B3D]">
                <span>
                  친구 대전 승리 시 기물 차이·게임 길이에 따라 <strong className="text-emerald-300">+15~30점</strong> 획득 (최저 0점)
                </span>
                <span className="font-mono-tabular">
                  {rankCategory === 'skill' ? '항목: 스킬 체스' : '항목: 클래식 · 체스960'}
                </span>
              </div>

              {/* Ranked List */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
                {leaderboardLoading && rows.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    순위표를 불러오는 중입니다...
                  </div>
                ) : rows.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-center text-xs text-slate-400">
                    <p>아직 등록된 랭크 기록이 없습니다.</p>
                    <p className="text-[11px] text-slate-500">
                      구글 계정으로 로그인하고 친구 대전에서 첫 승리를 거둬 보세요!
                    </p>
                  </div>
                ) : (
                  rows.map((entry, idx) => {
                    const rating =
                      rankCategory === 'skill' ? entry.skillRating : entry.classicRating;
                    const wins = rankCategory === 'skill' ? entry.skillWins : entry.classicWins;
                    const losses =
                      rankCategory === 'skill' ? entry.skillLosses : entry.classicLosses;
                    const draws =
                      rankCategory === 'skill' ? entry.skillDraws : entry.classicDraws;
                    const tierInfo = getRankInfo(rating);
                    const isMe = authUser?.uid === entry.uid;

                    return (
                      <button
                        key={entry.uid}
                        type="button"
                        onClick={() =>
                          setAccountModalTarget({
                            stats: entry,
                            isMe,
                            name: entry.displayName,
                            photoURL: entry.photoURL,
                          })
                        }
                        className={`w-full text-left px-3 py-2 border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                          isMe
                            ? 'bg-[#21293E] hover:bg-[#27314A] border-amber-400'
                            : 'bg-[#141822] hover:bg-[#1A202E] border-[#2A3247]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-6 text-center font-mono-tabular text-xs font-extrabold shrink-0 ${
                              idx === 0
                                ? 'text-amber-300'
                                : idx === 1
                                ? 'text-slate-200'
                                : idx === 2
                                ? 'text-orange-300'
                                : 'text-slate-400'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          <div className="w-7 h-7 shrink-0 bg-[#0F131C] border border-[#343F5A] flex items-center justify-center overflow-hidden">
                            {entry.photoURL ? (
                              <img
                                src={entry.photoURL}
                                alt={entry.displayName}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-5 h-5">
                                <PixelPiece type="n" color="w" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-100 truncate">
                                {entry.displayName}
                              </span>
                              {isMe && (
                                <span className="px-1 py-0.5 bg-amber-500 text-[#14171F] text-[9px] font-extrabold shrink-0">
                                  나
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono-tabular text-slate-400">
                              {wins}승 {losses}패{draws > 0 ? ` ${draws}무` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1.5">
                            <PixelTierIcon tierId={tierInfo.id} className="w-5 h-5 shrink-0" />
                            <span className="text-xs font-bold text-slate-200">
                              {tierInfo.tier}
                            </span>
                          </div>
                          <span className="font-mono-tabular text-sm font-extrabold text-amber-300 w-12 text-right">
                            {rating}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()}

        {/* Match History Tab */}
        {activeTab === 'history' && (
          <div className="h-full pixel-panel p-3 sm:p-4 flex flex-col justify-between gap-2 overflow-hidden">
            <div className="flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-slate-200">
                최근 완료된 대국 ({matchHistory.length}건)
              </span>
              {matchHistory.length > 0 && (
                <button
                  type="button"
                  onClick={onClearHistory}
                  className="text-xs text-red-300 hover:text-red-200 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>기록 지우기</span>
                </button>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
              {matchHistory.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  완료된 대국이 없습니다. 대국을 마치면 이곳에서 기보를 다시 볼 수 있습니다.
                </div>
              ) : (
                matchHistory.map((rec) => {
                  const ruleLabel =
                    rec.ruleMode === 'skill'
                      ? '스킬 체스'
                      : rec.ruleMode === 'chess960'
                      ? '체스960'
                      : '클래식';
                  const hasDelta =
                    rec.ratingCategory &&
                    rec.ratingCategory !== 'none' &&
                    typeof rec.ratingDelta === 'number';
                  return (
                    <div
                      key={rec.id}
                      className="bg-[#141822] border border-[#2B3347] px-3 py-2 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-100 truncate">
                            {rec.opponentLabel} · {ruleLabel}
                          </span>
                          {hasDelta && (
                            <span
                              className={`px-1 py-0.5 border text-[10px] font-mono-tabular font-bold ${
                                (rec.ratingDelta || 0) > 0
                                  ? 'bg-emerald-950/80 border-emerald-400 text-emerald-300'
                                  : (rec.ratingDelta || 0) < 0
                                  ? 'bg-rose-950/80 border-rose-400 text-rose-300'
                                  : 'bg-slate-800 border-slate-500 text-slate-300'
                              }`}
                            >
                              {rec.ratingCategory === 'skill' ? '스킬' : '클래식'}{' '}
                              {(rec.ratingDelta || 0) > 0
                                ? `+${rec.ratingDelta}`
                                : rec.ratingDelta}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {rec.resultMessage} · {rec.moves.length}수
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInspectRecord(rec)}
                        className="shrink-0 px-2.5 py-1.5 bg-[#252D40] hover:bg-[#313B54] border border-[#435070] text-xs font-bold text-amber-300 flex items-center gap-1 cursor-pointer"
                      >
                        <ScrollText className="w-3.5 h-3.5" />
                        <span>기보</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      <MoveNotationModal
        open={Boolean(inspectRecord)}
        title={inspectRecord ? `${inspectRecord.opponentLabel} 대국 기보` : ''}
        subtitle={inspectRecord?.resultMessage}
        moves={inspectRecord?.moves || []}
        onClose={() => setInspectRecord(null)}
      />

      {/* Vertical Tier Guide Modal (i button) */}
      {tierInfoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setTierInfoOpen(false)}
        >
          <div
            className="pixel-panel w-full max-w-[300px] p-4 space-y-2.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#2A3247]">
              <h3 className="text-sm font-extrabold text-slate-100">티어 기준표</h3>
              <button
                type="button"
                onClick={() => setTierInfoOpen(false)}
                aria-label="닫기"
                className="w-6 h-6 bg-[#222837] hover:bg-[#2F374C] border border-[#3B4661] text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-[#232A3C]">
              {TIER_GUIDE_ROWS.map((row) => (
                <div
                  key={row.id}
                  className="py-1.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <PixelTierIcon tierId={row.id} className="w-5 h-5 shrink-0" />
                    <span className="text-xs font-bold text-slate-100">{row.label}</span>
                  </div>
                  <span className="text-xs font-mono-tabular text-slate-300 shrink-0">
                    {row.scoreText}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <AccountStatsModal
        open={Boolean(accountModalTarget)}
        stats={accountModalTarget?.stats ?? null}
        fallbackName={accountModalTarget?.name}
        fallbackPhotoURL={accountModalTarget?.photoURL}
        isOwnAccount={Boolean(accountModalTarget?.isMe)}
        onSignOut={accountModalTarget?.isMe ? onSignOutGoogle : undefined}
        onClose={() => setAccountModalTarget(null)}
      />
    </div>
  );
};
