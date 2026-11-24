import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { LogIn, Music, Settings } from 'lucide-react';
import type {
  AiLevel,
  AugmentId,
  BgmPace,
  Chess960State,
  GameOverState,
  LeaderboardUserRecord,
  MatchHistoryRecord,
  MoveRecord,
  OpponentMode,
  PieceColor,
  PieceType,
  RoomStatePayload,
  RuleMode,
  SkillId,
  SkillMatchState,
  TimeControl,
} from './types/chess';
import { AI_TIERS } from './types/chess';
import {
  type AiSkillAction,
  chooseAiAugment,
  chooseAiDraftSkill,
  chooseAiMove,
  planAiTurn,
  shouldAiDrawSkill,
} from './engine/chessAi';
import {
  cloneChess960State,
  createInitialChess960State,
  executeChess960Move,
  getChess960CastlingMoves,
} from './engine/chess960';
import {
  applyBoardMoveWithSkills,
  applySkillTargetAction,
  choosePlayerAugment,
  chooseSkillDraftCard,
  cloneSkillState,
  completeSnipeSkillAction,
  completeSwapSkillAction,
  createInitialSkillMatchState,
  discardSkillCardToTrash,
  drawSkillCard,
  getAllLegalMovesWithSkills,
} from './engine/skillChess';
import {
  auth,
  clearCloudUserMatches,
  commitMatchAndRatingToCloud,
  ensureSignedInUserDocs,
  fetchDualLeaderboards,
  fetchUserMatches,
  signInWithGoogle,
  signOutGoogle,
  testFirestoreConnection,
} from './firebase';
import { computeEffectivePlayerDelta, getRankInfo } from './utils/rating';
import { soundEngine } from './utils/sound';
import { MatchSetupPanel } from './components/MatchSetupPanel';
import { GameView } from './components/GameView';
import { RulesModal } from './components/RulesModal';
import { SettingsModal } from './components/SettingsModal';
import { PixelTierIcon } from './components/SkillPixelArt';
import { AccountStatsModal } from './components/AccountStatsModal';

const HISTORY_STORAGE_KEY = 'pixel_chess_match_history_v1';
const LOBBY_BGM_ENABLED_STORAGE_KEY = 'pixel_chess_lobby_bgm_enabled_v1';
const LOBBY_BGM_PACE_STORAGE_KEY = 'pixel_chess_lobby_bgm_pace_v1';
const BGM_PACE_STORAGE_KEY = 'pixel_chess_bgm_pace_v1';
const BGM_PAUSE_OPPONENT_KEY = 'pixel_chess_bgm_pause_opponent_v1';

function loadLobbyBgmEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(LOBBY_BGM_ENABLED_STORAGE_KEY) !== 'false';
}

function loadLobbyBgmPace(): BgmPace {
  if (typeof window === 'undefined') return 'normal';
  return window.localStorage.getItem(LOBBY_BGM_PACE_STORAGE_KEY) === 'slow' ? 'slow' : 'normal';
}

function loadBgmPace(): BgmPace {
  if (typeof window === 'undefined') return 'normal';
  return window.localStorage.getItem(BGM_PACE_STORAGE_KEY) === 'slow' ? 'slow' : 'normal';
}

function loadPauseBgmOnOpponentTurn(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(BGM_PAUSE_OPPONENT_KEY) === 'true';
}

function loadMatchHistory(): MatchHistoryRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MatchHistoryRecord[]) : [];
  } catch {
    return [];
  }
}

function saveMatchHistory(records: MatchHistoryRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(records.slice(0, 30)));
  } catch {
    // ignore quota error
  }
}

function getOrCreateClientId(): string {
  if (typeof window === 'undefined') return 'server';
  const existing = window.sessionStorage.getItem('pixel_chess_client_id');
  if (existing) return existing;
  const generated =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `c_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  window.sessionStorage.setItem('pixel_chess_client_id', generated);
  return generated;
}

function getInitialRoomParam(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return (params.get('room') || '').trim().toUpperCase().slice(0, 6);
}

function evaluateLocalGameOver(chess: Chess): GameOverState | null {
  if (chess.isCheckmate()) {
    const winner: PieceColor = chess.turn() === 'w' ? 'b' : 'w';
    return {
      winner,
      reason: 'checkmate',
      message: winner === 'w' ? '체크메이트! 백이 승리했습니다.' : '체크메이트! 흑이 승리했습니다.',
    };
  }
  if (chess.isStalemate()) {
    return { winner: 'draw', reason: 'stalemate', message: '스테일메이트로 무승부입니다.' };
  }
  if (chess.isInsufficientMaterial()) {
    return { winner: 'draw', reason: 'insufficient', message: '기물 부족으로 무승부입니다.' };
  }
  if (chess.isThreefoldRepetition()) {
    return { winner: 'draw', reason: 'threefold', message: '3회 동형 반복으로 무승부입니다.' };
  }
  if (chess.isDraw()) {
    return { winner: 'draw', reason: 'fifty-move', message: '50수 규칙 무승부입니다.' };
  }
  return null;
}

export default function App() {
  const [screen, setScreen] = useState<'lobby' | 'game'>('lobby');
  const [opponentMode, setOpponentMode] = useState<OpponentMode>('ai');
  const [ruleMode, setRuleMode] = useState<RuleMode>('skill');
  const [muted, setMuted] = useState(false);
  const [lobbyBgmEnabled, setLobbyBgmEnabled] = useState<boolean>(loadLobbyBgmEnabled);
  const [lobbyBgmPace, setLobbyBgmPace] = useState<BgmPace>(loadLobbyBgmPace);
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [bgmPace, setBgmPace] = useState<BgmPace>(loadBgmPace);
  const [pauseBgmOnOpponentTurn, setPauseBgmOnOpponentTurn] = useState<boolean>(
    loadPauseBgmOnOpponentTurn
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'rules' | 'skills'>('rules');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);

  // Auth & Cloud Leaderboard State
  const [authUser, setAuthUser] = useState<User | null>(null);
  const authUserRef = useRef<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [myLeaderboardStats, setMyLeaderboardStats] = useState<LeaderboardUserRecord | null>(
    null
  );
  const myLeaderboardStatsRef = useRef<LeaderboardUserRecord | null>(null);
  const [leaderboardSkill, setLeaderboardSkill] = useState<LeaderboardUserRecord[]>([]);
  const [leaderboardClassic, setLeaderboardClassic] = useState<LeaderboardUserRecord[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState<boolean>(false);

  // Match history persisted in localStorage + Firestore
  const [matchHistory, setMatchHistory] = useState<MatchHistoryRecord[]>(loadMatchHistory);
  const recordedGameIdsRef = useRef<Set<string>>(new Set());
  const activeMatchIdRef = useRef<string>('');

  // Local AI Match State
  const chessRef = useRef<Chess>(new Chess());
  const [aiLevel, setAiLevel] = useState<AiLevel>(3);
  const [aiPlayerColor, setAiPlayerColor] = useState<PieceColor>('w');
  const [aiTimeControl, setAiTimeControl] = useState<TimeControl>({
    minutes: 10,
    incrementSeconds: 5,
  });
  const [aiFen, setAiFen] = useState<string>(chessRef.current.fen());
  const [aiMoves, setAiMoves] = useState<MoveRecord[]>([]);
  const [aiLastMove, setAiLastMove] = useState<{
    from: string;
    to: string;
    captured?: PieceType;
  } | null>(null);
  const [aiWhiteMs, setAiWhiteMs] = useState<number>(10 * 60 * 1000);
  const [aiBlackMs, setAiBlackMs] = useState<number>(10 * 60 * 1000);
  const [aiGameOver, setAiGameOver] = useState<GameOverState | null>(null);
  const [aiThinking, setAiThinking] = useState<boolean>(false);
  const [aiSkillState, setAiSkillState] = useState<SkillMatchState | null>(null);
  const aiSkillRef = useRef<SkillMatchState | null>(null);
  const [aiChess960State, setAiChess960State] = useState<Chess960State | null>(null);
  const aiChess960Ref = useRef<Chess960State | null>(null);
  const aiUndoStackRef = useRef<
    Array<{
      fen: string;
      moves: MoveRecord[];
      lastMove: { from: string; to: string; captured?: PieceType } | null;
      skillState: SkillMatchState | null;
      chess960State: Chess960State | null;
    }>
  >([]);
  const lastAiTickRef = useRef<number | null>(null);
  const aiWorkerRef = useRef<Worker | null>(null);
  const aiWorkerRequestIdRef = useRef<number>(0);

  // Online Multiplayer State
  const [initialRoomCode] = useState<string>(getInitialRoomParam);
  const wsRef = useRef<WebSocket | null>(null);
  const [wsError, setWsError] = useState<string | null>(null);
  const [wsConnecting, setWsConnecting] = useState(false);
  const [roomState, setRoomState] = useState<RoomStatePayload | null>(null);
  const [onlineColor, setOnlineColor] = useState<PieceColor | 'spectator'>('w');
  const onlineColorRef = useRef<PieceColor | 'spectator'>('w');
  const [displayOnlineClocks, setDisplayOnlineClocks] = useState<{ w: number; b: number }>({
    w: 0,
    b: 0,
  });

  const activeRoomRef = useRef<{ roomCode: string; nickname: string } | null>(null);
  const intentionalLeaveRef = useRef<boolean>(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const autoJoinedInitialRef = useRef<boolean>(false);

  const prevOnlineMoveCountRef = useRef<number>(0);
  const prevOnlineGameOverRef = useRef<boolean>(false);
  const prevOnlineVfxSeqRef = useRef<number>(0);

  const refreshLeaderboards = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const [skillRows, classicRows] = await Promise.all([
        fetchDualLeaderboards('skill', 30),
        fetchDualLeaderboards('classic', 30),
      ]);
      setLeaderboardSkill(skillRows);
      setLeaderboardClassic(classicRows);
    } catch {
      // handled gracefully in ErrorBoundary/console
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  useEffect(() => {
    void testFirestoreConnection();
    void refreshLeaderboards();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      authUserRef.current = user;
      setAuthUser(user);
      if (user) {
        try {
          const [stats, cloudMatches] = await Promise.all([
            ensureSignedInUserDocs(user),
            fetchUserMatches(user.uid),
          ]);
          myLeaderboardStatsRef.current = stats;
          setMyLeaderboardStats(stats);
          setMatchHistory((prevLocal) => {
            const byId = new Map<string, MatchHistoryRecord>();
            for (const item of cloudMatches) {
              byId.set(item.id, item);
              recordedGameIdsRef.current.add(item.id);
            }
            for (const item of prevLocal) {
              if (!byId.has(item.id)) byId.set(item.id, item);
            }
            const merged = Array.from(byId.values())
              .sort((a, b) => (a.playedAt < b.playedAt ? 1 : -1))
              .slice(0, 30);
            saveMatchHistory(merged);
            return merged;
          });
          void refreshLeaderboards();
        } catch {
          // ignore initial sync failure
        }
      } else {
        myLeaderboardStatsRef.current = null;
        setMyLeaderboardStats(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [refreshLeaderboards]);

  const handleSignInGoogle = useCallback(async () => {
    setAuthLoading(true);
    try {
      await signInWithGoogle();
    } catch {
      // popup dismissed or blocked
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const handleSignOutGoogle = useCallback(async () => {
    try {
      await signOutGoogle();
      myLeaderboardStatsRef.current = null;
      setMyLeaderboardStats(null);
    } catch {
      // ignore
    }
  }, []);

  const appendHistoryRecord = useCallback(
    (record: MatchHistoryRecord, rawRatingDelta?: number) => {
      if (recordedGameIdsRef.current.has(record.id)) return;
      recordedGameIdsRef.current.add(record.id);
      setMatchHistory((prev) => {
        const next = [record, ...prev].slice(0, 30);
        saveMatchHistory(next);
        return next;
      });

      const currentUser = authUserRef.current;
      if (currentUser) {
        void commitMatchAndRatingToCloud({
          user: currentUser,
          record,
          rawDelta: rawRatingDelta,
        })
          .then((res) => {
            if (res?.updatedStats) {
              myLeaderboardStatsRef.current = res.updatedStats;
              setMyLeaderboardStats(res.updatedStats);
              if (res.committedDelta !== record.ratingDelta) {
                setMatchHistory((prev) => {
                  const updated = prev.map((item) =>
                    item.id === record.id
                      ? { ...item, ratingDelta: res.committedDelta }
                      : item
                  );
                  saveMatchHistory(updated);
                  return updated;
                });
              }
              if (record.opponentMode === 'online') {
                void refreshLeaderboards();
              }
            }
          })
          .catch(() => {
            // keep local record safe if offline
          });
      }
    },
    [refreshLeaderboards]
  );

  const handleClearHistory = () => {
    setMatchHistory([]);
    saveMatchHistory([]);
    if (authUserRef.current) {
      void clearCloudUserMatches(authUserRef.current.uid).catch(() => {});
    }
  };

  const playMoveAudio = useCallback(
    (flags: string, inCheck: boolean, captured?: PieceType) => {
      if (inCheck) {
        soundEngine.playCheck();
      } else if (flags.includes('k') || flags.includes('q')) {
        soundEngine.playCastle();
      } else if (captured) {
        soundEngine.playCapture();
      } else {
        soundEngine.playMove();
      }
    },
    []
  );

  const handleToggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  };

  const handleToggleLobbyBgm = () => {
    setLobbyBgmEnabled((prev) => {
      const next = !prev;
      soundEngine.setLobbyBgmEnabled(next);
      if (next && muted) {
        setMuted(false);
        soundEngine.setMuted(false);
      }
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(LOBBY_BGM_ENABLED_STORAGE_KEY, String(next));
        } catch {
          // ignore
        }
      }
      soundEngine.unlockAndStartBgm();
      return next;
    });
  };

  const handleChangeLobbyBgmPace = (pace: BgmPace) => {
    setLobbyBgmPace(pace);
    soundEngine.setLobbyBgmPace(pace);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LOBBY_BGM_PACE_STORAGE_KEY, pace);
      } catch {
        // ignore
      }
    }
    soundEngine.unlockAndStartBgm();
  };

  const handleToggleBgm = () => {
    setBgmEnabled((prev) => {
      const next = !prev;
      soundEngine.setBgmEnabled(next);
      if (next && muted) {
        setMuted(false);
        soundEngine.setMuted(false);
      }
      soundEngine.unlockAndStartBgm();
      return next;
    });
  };

  const handleChangeBgmPace = (pace: BgmPace) => {
    setBgmPace(pace);
    soundEngine.setBgmPace(pace);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(BGM_PACE_STORAGE_KEY, pace);
      } catch {
        // ignore
      }
    }
    soundEngine.unlockAndStartBgm();
  };

  const handleTogglePauseBgmOnOpponentTurn = () => {
    setPauseBgmOnOpponentTurn((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(BGM_PAUSE_OPPONENT_KEY, String(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  // Sync saved BGM scene, lobby config, and in-game pace to sound engine
  useEffect(() => {
    soundEngine.setLobbyBgmEnabled(lobbyBgmEnabled);
    soundEngine.setLobbyBgmPace(lobbyBgmPace);
    soundEngine.setBgmPace(bgmPace);
  }, [lobbyBgmEnabled, lobbyBgmPace, bgmPace]);

  useEffect(() => {
    soundEngine.setBgmScene(screen);
  }, [screen]);

  // Pause BGM during opponent's turn when enabled in Settings
  useEffect(() => {
    if (!pauseBgmOnOpponentTurn || screen !== 'game') {
      soundEngine.setBgmTurnPaused(false);
      return;
    }
    if (opponentMode === 'ai') {
      const inAugment = ruleMode === 'skill' && Boolean(aiSkillState?.augmentPhase);
      const currentTurn = chessRef.current.turn() as PieceColor;
      const shouldPause = !aiGameOver && !inAugment && currentTurn !== aiPlayerColor;
      soundEngine.setBgmTurnPaused(shouldPause);
      return;
    }
    if (!roomState || !roomState.started || roomState.gameOver) {
      soundEngine.setBgmTurnPaused(false);
      return;
    }
    const inAugment =
      roomState.ruleMode === 'skill' && Boolean(roomState.skillState?.augmentPhase);
    const shouldPause =
      !inAugment &&
      (onlineColor === 'w' || onlineColor === 'b') &&
      roomState.turn !== onlineColor;
    soundEngine.setBgmTurnPaused(shouldPause);
  }, [
    pauseBgmOnOpponentTurn,
    screen,
    opponentMode,
    ruleMode,
    aiFen,
    aiGameOver,
    aiPlayerColor,
    aiSkillState?.augmentPhase,
    roomState,
    onlineColor,
  ]);

  // Attempt immediate BGM start from lobby and unlock seamlessly on first user interaction
  useEffect(() => {
    soundEngine.setBgmScene(screen);
    const tryUnlock = () => {
      const running = soundEngine.unlockAndStartBgm();
      if (running) {
        window.removeEventListener('pointerdown', tryUnlock);
        window.removeEventListener('keydown', tryUnlock);
        window.removeEventListener('touchstart', tryUnlock);
      }
    };
    tryUnlock();
    window.addEventListener('pointerdown', tryUnlock);
    window.addEventListener('keydown', tryUnlock);
    window.addEventListener('touchstart', tryUnlock);
    return () => {
      window.removeEventListener('pointerdown', tryUnlock);
      window.removeEventListener('keydown', tryUnlock);
      window.removeEventListener('touchstart', tryUnlock);
    };
  }, []);

  const startLocalAiGame = useCallback(
    (config: {
      aiLevel: AiLevel;
      playerColor: PieceColor | 'random';
      timeControl: TimeControl;
      ruleMode: RuleMode;
    }) => {
      const resolvedColor: PieceColor =
        config.playerColor === 'random'
          ? Math.random() < 0.5
            ? 'w'
            : 'b'
          : config.playerColor;

      const initial960 =
        config.ruleMode === 'chess960' ? createInitialChess960State() : null;
      const fresh = new Chess(initial960 ? initial960.initialFen : undefined);
      chessRef.current = fresh;
      const initialMs =
        config.timeControl.minutes > 0 ? config.timeControl.minutes * 60 * 1000 : 0;
      const initialSkill =
        config.ruleMode === 'skill' ? createInitialSkillMatchState() : null;

      activeMatchIdRef.current = `ai_${Date.now()}`;
      setOpponentMode('ai');
      setRuleMode(config.ruleMode);
      setAiLevel(config.aiLevel);
      setAiPlayerColor(resolvedColor);
      setAiTimeControl(config.timeControl);
      setAiFen(fresh.fen());
      setAiMoves([]);
      setAiLastMove(null);
      setAiWhiteMs(initialMs);
      setAiBlackMs(initialMs);
      setAiGameOver(null);
      setAiThinking(false);
      aiSkillRef.current = initialSkill;
      setAiSkillState(initialSkill);
      aiChess960Ref.current = initial960;
      setAiChess960State(initial960);
      aiUndoStackRef.current = [];
      lastAiTickRef.current = Date.now();
      aiWorkerRequestIdRef.current++;
      if (aiWorkerRef.current) {
        aiWorkerRef.current.terminate();
        aiWorkerRef.current = null;
      }
      setScreen('game');
      soundEngine.playGameStart();
    },
    []
  );

  const finalizeLocalGameOver = useCallback(
    (end: GameOverState, movesSnapshot: MoveRecord[]) => {
      setAiGameOver(end);
      soundEngine.playGameOver(end.winner === aiPlayerColor);
      const tier = AI_TIERS.find((t) => t.level === aiLevel);
      appendHistoryRecord({
        id: activeMatchIdRef.current || `ai_${Date.now()}`,
        playedAt: new Date().toISOString(),
        opponentMode: 'ai',
        ruleMode,
        opponentLabel: tier?.title || `AI Lv.${aiLevel}`,
        myColor: aiPlayerColor,
        winner: end.winner,
        resultMessage: end.message,
        ratingCategory: 'none',
        ratingDelta: 0,
        moves: movesSnapshot,
      });
    },
    [aiLevel, aiPlayerColor, appendHistoryRecord, ruleMode]
  );

  const executeLocalMove = useCallback(
    (from: string, to: string, promotion?: PieceType) => {
      const chess = chessRef.current;
      if (aiGameOver) return false;

      const movingColor = chess.turn() as PieceColor;
      const now = Date.now();
      if (aiTimeControl.minutes > 0 && aiMoves.length > 0 && lastAiTickRef.current) {
        const elapsed = Math.max(0, now - lastAiTickRef.current);
        if (movingColor === 'w') {
          setAiWhiteMs((prev) =>
            Math.max(0, prev - elapsed + aiTimeControl.incrementSeconds * 1000)
          );
        } else {
          setAiBlackMs((prev) =>
            Math.max(0, prev - elapsed + aiTimeControl.incrementSeconds * 1000)
          );
        }
      }
      lastAiTickRef.current = now;

      if (movingColor === aiPlayerColor) {
        aiUndoStackRef.current.push({
          fen: chess.fen(),
          moves: [...aiMoves],
          lastMove: aiLastMove,
          skillState: aiSkillRef.current ? cloneSkillState(aiSkillRef.current) : null,
          chess960State: aiChess960Ref.current ? cloneChess960State(aiChess960Ref.current) : null,
        });
      }

      let moveRecord: MoveRecord;
      let nextSkillState = aiSkillRef.current;

      if (ruleMode === 'chess960') {
        const res960 = executeChess960Move(
          chess,
          aiChess960Ref.current,
          from,
          to,
          promotion,
          aiMoves.length
        );
        if (!res960) return false;
        moveRecord = res960.moveRecord;
        aiChess960Ref.current = res960.nextState960;
        setAiChess960State(res960.nextState960);
      } else {
        const result = applyBoardMoveWithSkills(
          chess,
          aiSkillRef.current,
          from,
          to,
          promotion,
          aiMoves.length
        );
        if (!result) return false;
        moveRecord = result.moveRecord;
        nextSkillState = result.nextSkillState;
      }

      aiSkillRef.current = nextSkillState;
      setAiSkillState(nextSkillState);

      const nextMoves = [...aiMoves, moveRecord];
      setAiFen(chess.fen());
      setAiMoves(nextMoves);
      setAiLastMove({
        from: moveRecord.from,
        to: moveRecord.to,
        captured: moveRecord.captured,
      });

      const end = evaluateLocalGameOver(chess);
      if (end) {
        finalizeLocalGameOver(end, nextMoves);
      } else {
        playMoveAudio(
          moveRecord.flags,
          chess.inCheck(),
          moveRecord.captured
        );
      }
      return true;
    },
    [
      aiGameOver,
      aiLastMove,
      aiMoves,
      aiPlayerColor,
      aiTimeControl,
      finalizeLocalGameOver,
      playMoveAudio,
      ruleMode,
    ]
  );

  // Local Skill Casting / Discarding Handlers
  const handleCastSkillSquare = (cardUid: string, targetSquare: string) => {
    if (opponentMode === 'online') {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'skill:cast',
            clientId: getOrCreateClientId(),
            cardUid,
            targetSquare,
          })
        );
      }
      return;
    }

    // Local AI mode
    const chess = chessRef.current;
    const skillState = aiSkillRef.current;
    if (!skillState || aiGameOver) return;
    const turn = chess.turn() as PieceColor;
    if (turn !== aiPlayerColor) return;

    if (
      skillState.activeCast?.skillId === 'swap' &&
      skillState.activeCast.swapFirstSquare
    ) {
      const swapped = completeSwapSkillAction(
        chess,
        skillState,
        turn,
        targetSquare,
        aiMoves.length
      );
      if (!swapped) return;
      soundEngine.playSkillCast('swap');
      aiSkillRef.current = swapped.nextSkillState;
      setAiSkillState(swapped.nextSkillState);
      const nextMoves = [...aiMoves, swapped.moveRecord];
      setAiFen(chess.fen());
      setAiMoves(nextMoves);
      setAiLastMove({ from: swapped.moveRecord.from, to: swapped.moveRecord.to });
      const end = evaluateLocalGameOver(chess);
      if (end) finalizeLocalGameOver(end, nextMoves);
      return;
    }

    if (
      skillState.activeCast?.skillId === 'snipe' &&
      skillState.activeCast.snipeBishopSquare
    ) {
      const sniped = completeSnipeSkillAction(
        chess,
        skillState,
        turn,
        targetSquare,
        aiMoves.length
      );
      if (!sniped) return;
      soundEngine.playSkillCast('snipe');
      aiSkillRef.current = sniped.nextSkillState;
      setAiSkillState(sniped.nextSkillState);
      const nextMoves = [...aiMoves, sniped.moveRecord];
      setAiFen(chess.fen());
      setAiMoves(nextMoves);
      setAiLastMove({
        from: sniped.moveRecord.from,
        to: sniped.moveRecord.to,
        captured: sniped.moveRecord.captured,
      });
      const end = evaluateLocalGameOver(chess);
      if (end) finalizeLocalGameOver(end, nextMoves);
      return;
    }

    const res = applySkillTargetAction(
      chess,
      skillState,
      turn,
      cardUid,
      targetSquare,
      aiMoves.length
    );
    if (!res) return;

    if (res.nextSkillState.lastVfx) {
      soundEngine.playSkillCast(res.nextSkillState.lastVfx.skillId);
    } else {
      soundEngine.playSelect();
    }

    aiSkillRef.current = res.nextSkillState;
    setAiSkillState(res.nextSkillState);
    setAiFen(chess.fen());

    if (res.endedTurn && res.moveRecord) {
      const nextMoves = [...aiMoves, res.moveRecord];
      setAiMoves(nextMoves);
      setAiLastMove({ from: res.moveRecord.from, to: res.moveRecord.to });
      const end = evaluateLocalGameOver(chess);
      if (end) finalizeLocalGameOver(end, nextMoves);
    }
  };

  const handleCancelSkillSwap = () => {
    if (opponentMode === 'online') {
      wsRef.current?.send(
        JSON.stringify({ type: 'skill:cancel_swap', clientId: getOrCreateClientId() })
      );
      return;
    }
    const sid = aiSkillRef.current?.activeCast?.skillId;
    if (sid === 'swap' || sid === 'snipe') {
      const next = cloneSkillState(aiSkillRef.current!);
      next.activeCast = null;
      aiSkillRef.current = next;
      setAiSkillState(next);
    }
  };

  const handleDiscardSkillCard = (cardUid: string) => {
    if (opponentMode === 'online') {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'skill:discard',
            clientId: getOrCreateClientId(),
            cardUid,
          })
        );
        soundEngine.playTrashGainMana();
      }
      return;
    }

    if (!aiSkillRef.current || aiGameOver) return;
    if (chessRef.current.turn() !== aiPlayerColor) return;
    const next = discardSkillCardToTrash(aiSkillRef.current, aiPlayerColor, cardUid);
    if (next) {
      aiSkillRef.current = next;
      setAiSkillState(next);
      soundEngine.playTrashGainMana();
    }
  };

  const handleDrawSkill = () => {
    if (opponentMode === 'online') {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'skill:draw',
            clientId: getOrCreateClientId(),
          })
        );
        soundEngine.playDrawCard();
      }
      return;
    }

    if (!aiSkillRef.current || aiGameOver) return;
    if (chessRef.current.turn() !== aiPlayerColor) return;
    const next = drawSkillCard(aiSkillRef.current, aiPlayerColor);
    if (next) {
      aiSkillRef.current = next;
      setAiSkillState(next);
      soundEngine.playDrawCard();
    }
  };

  const handleChooseAugment = (augmentId: AugmentId) => {
    if (opponentMode === 'online') {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'skill:choose_augment',
            clientId: getOrCreateClientId(),
            augmentId,
          })
        );
        soundEngine.playAugmentSelect();
      }
      return;
    }

    const cur = aiSkillRef.current;
    if (!cur || aiGameOver || !cur.augmentPhase) return;
    let next = choosePlayerAugment(cur, aiPlayerColor, augmentId);
    if (!next) return;

    const aiColor: PieceColor = aiPlayerColor === 'w' ? 'b' : 'w';
    const aiAug = chooseAiAugment(next.offeredAugments, aiLevel);
    next = choosePlayerAugment(next, aiColor, aiAug) || next;

    aiSkillRef.current = next;
    setAiSkillState(next);
    lastAiTickRef.current = Date.now();
    soundEngine.playAugmentSelect();
  };

  const handleChooseSkillDraft = (skillId: SkillId) => {
    if (opponentMode === 'online') {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'skill:choose_draft',
            clientId: getOrCreateClientId(),
            skillId,
          })
        );
        soundEngine.playDrawCard();
      }
      return;
    }

    const cur = aiSkillRef.current;
    if (!cur || aiGameOver) return;
    const next = chooseSkillDraftCard(cur, aiPlayerColor, skillId);
    if (next) {
      aiSkillRef.current = next;
      setAiSkillState(next);
      soundEngine.playDrawCard();
    }
  };

  const getAiWorker = useCallback((): Worker | null => {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;
    if (!aiWorkerRef.current) {
      try {
        aiWorkerRef.current = new Worker(
          new URL('./engine/aiWorker.ts', import.meta.url),
          { type: 'module' }
        );
      } catch {
        return null;
      }
    }
    return aiWorkerRef.current;
  }, []);

  // Trigger AI turn off the main thread (Web Worker) so BGM never stutters or pauses!
  useEffect(() => {
    if (screen !== 'game' || opponentMode !== 'ai' || aiGameOver) return;
    if (ruleMode === 'skill' && aiSkillState?.augmentPhase) return;
    const chess = chessRef.current;
    const currentTurn = chess.turn() as PieceColor;
    if (currentTurn === aiPlayerColor) return;

    let cancelled = false;
    let settled = false;
    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
    setAiThinking(true);
    const delayMs = aiLevel <= 2 ? 460 : 540;
    const timer = setTimeout(() => {
      if (cancelled) return;
      const workingChess = chessRef.current;
      let workingSkill = aiSkillRef.current;

      // Safety: resolve any dangling pending skill draft so board moves are never blocked
      if (
        ruleMode === 'skill' &&
        workingSkill &&
        workingSkill[currentTurn].pendingSkillDraft?.length
      ) {
        const picked = chooseAiDraftSkill(workingSkill[currentTurn].pendingSkillDraft!, aiLevel);
        const resolved = chooseSkillDraftCard(workingSkill, currentTurn, picked);
        if (resolved) {
          workingSkill = resolved;
          aiSkillRef.current = resolved;
          setAiSkillState(resolved);
        }
      }

      // Step 0: AI may spend 3 MP (or 1 MP) to draw a skill card
      if (
        ruleMode === 'skill' &&
        workingSkill &&
        shouldAiDrawSkill(aiLevel, workingSkill, currentTurn)
      ) {
        let drawn = drawSkillCard(workingSkill, currentTurn);
        if (drawn && drawn[currentTurn].pendingSkillDraft?.length) {
          const picked = chooseAiDraftSkill(drawn[currentTurn].pendingSkillDraft!, aiLevel);
          drawn = chooseSkillDraftCard(drawn, currentTurn, picked) || drawn;
        }
        if (drawn) {
          workingSkill = drawn;
          aiSkillRef.current = drawn;
          setAiSkillState(drawn);
        }
      }

      const applyAiPlanResult = (
        aiSkillAction: AiSkillAction | null,
        chosenMove: { from: string; to: string; promotion?: PieceType } | null
      ) => {
        if (cancelled || settled) return;
        settled = true;
        if (watchdogTimer) {
          clearTimeout(watchdogTimer);
          watchdogTimer = null;
        }
        let skillEndedTurn = false;
        let skillCastApplied = false;

        if (ruleMode === 'skill' && workingSkill && aiSkillAction) {
          if (aiSkillAction.type === 'discard') {
            const discarded = discardSkillCardToTrash(
              workingSkill,
              currentTurn,
              aiSkillAction.card.uid
            );
            if (discarded) {
              workingSkill = discarded;
              aiSkillRef.current = discarded;
              setAiSkillState(discarded);
              soundEngine.playTrashGainMana();
            }
          } else if (aiSkillAction.type === 'cast' && aiSkillAction.targetSquare) {
            const res = applySkillTargetAction(
              workingChess,
              workingSkill,
              currentTurn,
              aiSkillAction.card.uid,
              aiSkillAction.targetSquare,
              aiMoves.length
            );
            if (res) {
              if (
                aiSkillAction.skillId === 'swap' &&
                aiSkillAction.secondarySquare &&
                res.nextSkillState.activeCast?.swapFirstSquare
              ) {
                const swapped = completeSwapSkillAction(
                  workingChess,
                  res.nextSkillState,
                  currentTurn,
                  aiSkillAction.secondarySquare,
                  aiMoves.length
                );
                if (swapped) {
                  soundEngine.playSkillCast('swap');
                  aiSkillRef.current = swapped.nextSkillState;
                  setAiSkillState(swapped.nextSkillState);
                  const nextMoves = [...aiMoves, swapped.moveRecord];
                  setAiFen(workingChess.fen());
                  setAiMoves(nextMoves);
                  setAiLastMove({
                    from: swapped.moveRecord.from,
                    to: swapped.moveRecord.to,
                  });
                  setAiThinking(false);
                  const end = evaluateLocalGameOver(workingChess);
                  if (end) finalizeLocalGameOver(end, nextMoves);
                  skillEndedTurn = true;
                }
              } else if (
                aiSkillAction.skillId === 'snipe' &&
                aiSkillAction.secondarySquare &&
                res.nextSkillState.activeCast?.snipeBishopSquare
              ) {
                const sniped = completeSnipeSkillAction(
                  workingChess,
                  res.nextSkillState,
                  currentTurn,
                  aiSkillAction.secondarySquare,
                  aiMoves.length
                );
                if (sniped) {
                  soundEngine.playSkillCast('snipe');
                  aiSkillRef.current = sniped.nextSkillState;
                  setAiSkillState(sniped.nextSkillState);
                  const nextMoves = [...aiMoves, sniped.moveRecord];
                  setAiFen(workingChess.fen());
                  setAiMoves(nextMoves);
                  setAiLastMove({
                    from: sniped.moveRecord.from,
                    to: sniped.moveRecord.to,
                    captured: sniped.moveRecord.captured,
                  });
                  setAiThinking(false);
                  const end = evaluateLocalGameOver(workingChess);
                  if (end) finalizeLocalGameOver(end, nextMoves);
                  skillEndedTurn = true;
                }
              } else {
                soundEngine.playSkillCast(aiSkillAction.skillId);
                workingSkill = res.nextSkillState;
                aiSkillRef.current = res.nextSkillState;
                setAiSkillState(res.nextSkillState);
                skillCastApplied = true;

                if (res.endedTurn && res.moveRecord) {
                  const nextMoves = [...aiMoves, res.moveRecord];
                  setAiFen(workingChess.fen());
                  setAiMoves(nextMoves);
                  setAiLastMove({
                    from: res.moveRecord.from,
                    to: res.moveRecord.to,
                  });
                  setAiThinking(false);
                  const end = evaluateLocalGameOver(workingChess);
                  if (end) finalizeLocalGameOver(end, nextMoves);
                  skillEndedTurn = true;
                }
              }
            }
          }
        }

        if (skillEndedTurn) return;

        setAiThinking(false);

        let moved = false;
        if (chosenMove) {
          moved = executeLocalMove(chosenMove.from, chosenMove.to, chosenMove.promotion);
        }

        // Fallback safety net: ensure AI ALWAYS completes a legal move if possible and never freezes!
        if (!moved) {
          if (skillCastApplied && aiSkillRef.current?.activeCast) {
            const unlocked = cloneSkillState(aiSkillRef.current);
            unlocked.activeCast = null;
            aiSkillRef.current = unlocked;
            setAiSkillState(unlocked);
          }

          const legalAug =
            ruleMode === 'skill'
              ? getAllLegalMovesWithSkills(workingChess, aiSkillRef.current)
              : [];
          for (const m of legalAug) {
            if (executeLocalMove(m.from, m.to, m.promotion)) {
              moved = true;
              break;
            }
          }

          if (!moved) {
            const stdMoves = workingChess.moves({ verbose: true });
            for (const m of stdMoves) {
              if (executeLocalMove(m.from, m.to, m.promotion as PieceType | undefined)) {
                moved = true;
                break;
              }
            }
          }

          if (!moved && ruleMode === 'chess960' && aiChess960Ref.current) {
            const c960s = getChess960CastlingMoves(workingChess, aiChess960Ref.current);
            for (const c of c960s) {
              if (executeLocalMove(c.kingFrom, c.kingTo)) {
                moved = true;
                break;
              }
            }
          }

          if (!moved) {
            const end = evaluateLocalGameOver(workingChess) || {
              winner: workingChess.inCheck() ? aiPlayerColor : ('draw' as const),
              reason: workingChess.inCheck() ? ('checkmate' as const) : ('stalemate' as const),
              message: workingChess.inCheck()
                ? '모든 응수가 봉쇄되어 AI가 패배했습니다.'
                : '이동 가능한 수가 없어 무승부입니다.',
            };
            finalizeLocalGameOver(end, aiMoves);
          }
        }
      };

      const targetFen = workingChess.fen();
      const snap960 = aiChess960Ref.current ? cloneChess960State(aiChess960Ref.current) : null;
      const worker = getAiWorker();
      if (!worker) {
        const result = planAiTurn({
          fen: targetFen,
          level: aiLevel,
          skillState: workingSkill,
          chess960State: snap960,
          currentMoveCount: aiMoves.length,
        });
        applyAiPlanResult(result.skillAction, result.move);
        return;
      }

      const reqId = ++aiWorkerRequestIdRef.current;
      const cleanupWorkerListeners = () => {
        worker.removeEventListener('message', handleMessage);
        worker.removeEventListener('error', handleError);
      };

      const handleMessage = (
        ev: MessageEvent<{
          id: number;
          skillAction: AiSkillAction | null;
          move: { from: string; to: string; promotion?: PieceType } | null;
        }>
      ) => {
        if (ev.data?.id !== reqId) return;
        cleanupWorkerListeners();
        applyAiPlanResult(ev.data.skillAction, ev.data.move);
      };

      const handleError = () => {
        cleanupWorkerListeners();
        if (cancelled || settled) return;
        const emergencyMove = chooseAiMove(
          targetFen,
          Math.min(aiLevel, 3) as AiLevel,
          workingSkill,
          snap960,
          250
        );
        applyAiPlanResult(null, emergencyMove);
      };

      // Watchdog prevents AI from ever stalling if the worker hangs or exceeds budget
      const watchdogMs = aiLevel === 5 ? 18500 : 8500;
      watchdogTimer = setTimeout(() => {
        if (cancelled || settled) return;
        cleanupWorkerListeners();
        aiWorkerRequestIdRef.current++;
        if (aiWorkerRef.current === worker) {
          aiWorkerRef.current.terminate();
          aiWorkerRef.current = null;
        }
        const emergencyMove = chooseAiMove(
          targetFen,
          Math.min(aiLevel, 3) as AiLevel,
          workingSkill,
          snap960,
          250
        );
        applyAiPlanResult(null, emergencyMove);
      }, watchdogMs);

      worker.addEventListener('message', handleMessage);
      worker.addEventListener('error', handleError);
      worker.postMessage({
        id: reqId,
        fen: targetFen,
        level: aiLevel,
        skillState: workingSkill,
        chess960State: snap960,
        currentMoveCount: aiMoves.length,
      });
    }, delayMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (watchdogTimer) clearTimeout(watchdogTimer);
      aiWorkerRequestIdRef.current++;
      setAiThinking(false);
    };
  }, [
    screen,
    opponentMode,
    ruleMode,
    aiFen,
    aiPlayerColor,
    aiLevel,
    aiGameOver,
    aiMoves,
    aiSkillState?.augmentPhase,
    executeLocalMove,
    finalizeLocalGameOver,
    getAiWorker,
  ]);

  // Local AI clock ticker
  useEffect(() => {
    if (
      screen !== 'game' ||
      opponentMode !== 'ai' ||
      aiGameOver ||
      (ruleMode === 'skill' && Boolean(aiSkillState?.augmentPhase)) ||
      aiTimeControl.minutes === 0 ||
      aiMoves.length === 0
    ) {
      return;
    }

    lastAiTickRef.current = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const prevTick = lastAiTickRef.current ?? now;
      const dt = Math.max(0, now - prevTick);
      lastAiTickRef.current = now;

      const currentTurn = chessRef.current.turn() as PieceColor;
      if (currentTurn === 'w') {
        setAiWhiteMs((prev) => {
          const next = Math.max(0, prev - dt);
          if (next <= 0) {
            finalizeLocalGameOver(
              {
                winner: 'b',
                reason: 'timeout',
                message: '백의 시간이 모두 소진되었습니다. 흑 승리!',
              },
              aiMoves
            );
          }
          return next;
        });
      } else {
        setAiBlackMs((prev) => {
          const next = Math.max(0, prev - dt);
          if (next <= 0) {
            finalizeLocalGameOver(
              {
                winner: 'w',
                reason: 'timeout',
                message: '흑의 시간이 모두 소진되었습니다. 백 승리!',
              },
              aiMoves
            );
          }
          return next;
        });
      }
    }, 150);

    return () => clearInterval(interval);
  }, [
    screen,
    opponentMode,
    ruleMode,
    aiGameOver,
    aiSkillState?.augmentPhase,
    aiTimeControl.minutes,
    aiMoves,
    finalizeLocalGameOver,
  ]);

  // WebSocket Connection Helper for Online Mode
  const connectAndSend = useCallback(
    (payload: Record<string, unknown>) => {
      setWsError(null);
      setWsConnecting(true);
      intentionalLeaveRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      const clientId = getOrCreateClientId();
      const sendMsg = (ws: WebSocket) => {
        ws.send(JSON.stringify({ ...payload, clientId }));
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        sendMsg(wsRef.current);
        setWsConnecting(false);
        return;
      }

      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnecting(false);
        reconnectAttemptsRef.current = 0;
        sendMsg(ws);
      };

      ws.onmessage = (event) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(event.data) as Record<string, unknown>;
        } catch {
          return;
        }

        if (msg.type === 'pong') {
          return;
        }

        if (msg.type === 'room:error') {
          activeRoomRef.current = null;
          setWsError(String(msg.message || '방 연결에 실패했습니다.'));
          setWsConnecting(false);
          return;
        }

        if (msg.type === 'room:joined') {
          const state = msg.state as RoomStatePayload;
          const yourColor = msg.yourColor as PieceColor | 'spectator';
          const myNick =
            yourColor === 'w' || yourColor === 'b'
              ? state.players[yourColor]?.nickname || '친구'
              : '관전자';
          activeRoomRef.current = { roomCode: state.roomCode, nickname: myNick };
          reconnectAttemptsRef.current = 0;

          activeMatchIdRef.current = state.matchId || `online_${state.roomCode}_${Date.now()}`;
          setOpponentMode('online');
          setRuleMode(state.ruleMode);
          onlineColorRef.current = yourColor;
          setOnlineColor(yourColor);
          setRoomState(state);
          setDisplayOnlineClocks({ w: state.whiteTimeMs, b: state.blackTimeMs });
          prevOnlineMoveCountRef.current = state.moves.length;
          prevOnlineGameOverRef.current = Boolean(state.gameOver);
          prevOnlineVfxSeqRef.current = state.skillState?.lastVfx?.seq || 0;
          setScreen('game');
          soundEngine.playGameStart();

          const url = new URL(window.location.href);
          url.searchParams.set('room', state.roomCode);
          window.history.replaceState({}, '', url.toString());
          return;
        }

        if (msg.type === 'room:state') {
          const state = msg.state as RoomStatePayload;
          setRoomState(state);
          setDisplayOnlineClocks({ w: state.whiteTimeMs, b: state.blackTimeMs });

          const vfx = state.skillState?.lastVfx;
          if (vfx && vfx.seq > prevOnlineVfxSeqRef.current) {
            soundEngine.playSkillCast(vfx.skillId);
            prevOnlineVfxSeqRef.current = vfx.seq;
          }

          if (state.moves.length > prevOnlineMoveCountRef.current) {
            const latest = state.moves[state.moves.length - 1];
            if (latest && !state.gameOver && latest.flags !== 'skill') {
              playMoveAudio(latest.flags, state.inCheck, latest.captured);
            }
          }
          prevOnlineMoveCountRef.current = state.moves.length;

          if (state.gameOver && !prevOnlineGameOverRef.current) {
            const myRole = onlineColorRef.current;
            soundEngine.playGameOver(state.gameOver.winner === myRole);
            const oppColor: PieceColor | null =
              myRole === 'w' ? 'b' : myRole === 'b' ? 'w' : null;
            const oppName = oppColor
              ? state.players[oppColor]?.nickname || '온라인 상대'
              : '관전';

            const ro = state.ratingOutcome;
            const isParticipant = myRole === 'w' || myRole === 'b';
            const rawDelta =
              ro && isParticipant
                ? state.gameOver.winner === 'draw'
                  ? 0
                  : state.gameOver.winner === myRole
                  ? ro.winnerDelta
                  : ro.loserDelta
                : 0;
            const currentStats = myLeaderboardStatsRef.current;
            const currentR =
              ro && isParticipant
                ? ro.category === 'skill'
                  ? currentStats?.skillRating ?? 0
                  : currentStats?.classicRating ?? 0
                : 0;
            const ratingDelta =
              ro && isParticipant ? computeEffectivePlayerDelta(rawDelta, currentR) : 0;

            appendHistoryRecord(
              {
                id:
                  state.matchId ||
                  activeMatchIdRef.current ||
                  `online_${state.roomCode}_${state.moves.length}`,
                playedAt: new Date().toISOString(),
                opponentMode: 'online',
                ruleMode: state.ruleMode,
                opponentLabel: `친구 (${oppName})`,
                myColor: myRole,
                winner: state.gameOver.winner,
                resultMessage: state.gameOver.message,
                ratingCategory: ro && isParticipant ? ro.category : 'none',
                ratingDelta,
                materialDiff: ro?.materialDiff ?? 0,
                moves: state.moves,
              },
              rawDelta
            );
          }
          prevOnlineGameOverRef.current = Boolean(state.gameOver);
        }
      };

      ws.onerror = () => {
        setWsConnecting(false);
        setWsError('서버와 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
      };

      ws.onclose = () => {
        setWsConnecting(false);
        if (
          !intentionalLeaveRef.current &&
          activeRoomRef.current &&
          reconnectAttemptsRef.current < 5
        ) {
          reconnectAttemptsRef.current += 1;
          const target = activeRoomRef.current;
          reconnectTimerRef.current = setTimeout(() => {
            connectAndSend({
              type: 'room:join',
              roomCode: target.roomCode,
              nickname: target.nickname,
            });
          }, 1200);
        }
      };
    },
    [appendHistoryRecord, playMoveAudio]
  );

  // Auto-join immediately when opening an invite link (?room=CODE)
  useEffect(() => {
    if (autoJoinedInitialRef.current) return;
    if (initialRoomCode && initialRoomCode.length >= 4) {
      autoJoinedInitialRef.current = true;
      connectAndSend({
        type: 'room:join',
        roomCode: initialRoomCode,
        nickname: '친구',
      });
    }
  }, [initialRoomCode, connectAndSend]);

  // Client 20s heartbeat to prevent Cloud Run / proxy idle disconnects
  useEffect(() => {
    const pingTimer = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20000);
    return () => clearInterval(pingTimer);
  }, []);

  // Smooth local clock interpolation for Online Mode
  useEffect(() => {
    if (
      screen !== 'game' ||
      opponentMode !== 'online' ||
      !roomState ||
      roomState.gameOver ||
      !roomState.started ||
      roomState.skillState?.augmentPhase ||
      roomState.timeControl.minutes === 0 ||
      roomState.moves.length === 0
    ) {
      return;
    }

    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const dt = Math.max(0, now - last);
      last = now;
      setDisplayOnlineClocks((prev) => ({
        w: roomState.turn === 'w' ? Math.max(0, prev.w - dt) : prev.w,
        b: roomState.turn === 'b' ? Math.max(0, prev.b - dt) : prev.b,
      }));
    }, 150);

    return () => clearInterval(timer);
  }, [screen, opponentMode, roomState]);

  useEffect(() => {
    return () => {
      intentionalLeaveRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (aiWorkerRef.current) {
        aiWorkerRef.current.terminate();
        aiWorkerRef.current = null;
      }
    };
  }, []);

  const handleCreateOnlineRoom = (config: {
    nickname: string;
    preferredColor: PieceColor | 'random';
    timeControl: TimeControl;
    ruleMode: RuleMode;
  }) => {
    connectAndSend({ type: 'room:create', ...config });
  };

  const handleJoinOnlineRoom = (config: { roomCode: string; nickname: string }) => {
    connectAndSend({ type: 'room:join', ...config });
  };

  const handleGameMove = (from: string, to: string, promotion?: PieceType) => {
    if (opponentMode === 'ai') {
      executeLocalMove(from, to, promotion);
    } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'game:move',
          clientId: getOrCreateClientId(),
          from,
          to,
          promotion,
        })
      );
    }
  };

  const handleUndoAiMove = () => {
    if (opponentMode !== 'ai' || aiThinking || aiGameOver) return;
    const prev = aiUndoStackRef.current.pop();
    if (!prev) return;

    chessRef.current = new Chess(prev.fen);
    setAiFen(prev.fen);
    setAiMoves(prev.moves);
    setAiLastMove(prev.lastMove);
    aiSkillRef.current = prev.skillState;
    setAiSkillState(prev.skillState);
    aiChess960Ref.current = prev.chess960State;
    setAiChess960State(prev.chess960State);
    soundEngine.playSelect();
  };

  const handleResign = () => {
    if (opponentMode === 'ai') {
      if (aiGameOver) return;
      const winner: PieceColor = aiPlayerColor === 'w' ? 'b' : 'w';
      finalizeLocalGameOver(
        {
          winner,
          reason: 'resign',
          message: '기권했습니다. AI가 승리했습니다.',
        },
        aiMoves
      );
    } else if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: 'game:resign', clientId: getOrCreateClientId() })
      );
    }
  };

  const handleOfferDraw = () => {
    if (opponentMode === 'online' && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: 'game:draw_offer', clientId: getOrCreateClientId() })
      );
    }
  };

  const handleRespondDraw = (accept: boolean) => {
    if (opponentMode === 'online' && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'game:draw_respond',
          clientId: getOrCreateClientId(),
          accept,
        })
      );
    }
  };

  const handleRematch = () => {
    if (opponentMode === 'ai') {
      startLocalAiGame({
        aiLevel,
        playerColor: aiPlayerColor === 'w' ? 'b' : 'w',
        timeControl: aiTimeControl,
        ruleMode,
      });
    } else if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'game:rematch_request',
          clientId: getOrCreateClientId(),
        })
      );
    }
  };

  const handleExitToLobby = () => {
    intentionalLeaveRef.current = true;
    activeRoomRef.current = null;
    aiWorkerRequestIdRef.current++;
    if (aiWorkerRef.current) {
      aiWorkerRef.current.terminate();
      aiWorkerRef.current = null;
    }
    setAiThinking(false);
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (opponentMode === 'online' && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: 'room:leave', clientId: getOrCreateClientId() })
      );
    }
    setRoomState(null);
    setScreen('lobby');

    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className="h-dvh w-full overflow-hidden pixel-grid-bg flex flex-col">
      {/* Compact Top Bar (fixed height, 3-zone contract) */}
      <header className="shrink-0 border-b-2 border-[#262C3D] bg-[#161922]/95 z-40">
        <div className="max-w-[1220px] mx-auto px-3 sm:px-6 h-12 flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={handleExitToLobby}
            className="font-pixel text-sm sm:text-base font-bold tracking-tight text-amber-300 hover:text-amber-200 whitespace-nowrap shrink-0 cursor-pointer"
          >
            도트 체스
          </button>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
            <button
              type="button"
              onClick={handleExitToLobby}
              className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              대국 로비
            </button>
            <button
              type="button"
              onClick={() => {
                setModalTab('rules');
                setModalOpen(true);
              }}
              className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              체스 규칙
            </button>
            <button
              type="button"
              onClick={() => {
                setModalTab('skills');
                setModalOpen(true);
              }}
              className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              스킬 규칙
            </button>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {authUser ? (
              <button
                type="button"
                onClick={() => setAccountModalOpen(true)}
                title="계정 정보 및 전적 보기"
                className="flex items-center gap-1.5 px-2 py-1 bg-[#1B2130] hover:bg-[#252D42] border border-[#343F5A] text-xs shrink-0 cursor-pointer"
              >
                {authUser.photoURL && (
                  <img
                    src={authUser.photoURL}
                    alt={authUser.displayName || '프로필'}
                    className="w-4 h-4 object-cover border border-[#475370]"
                    referrerPolicy="no-referrer"
                  />
                )}
                <span className="hidden sm:inline font-bold text-slate-200 max-w-[84px] truncate">
                  {authUser.displayName || '유저'}
                </span>
                {myLeaderboardStats && (() => {
                  const bestR = Math.max(
                    myLeaderboardStats.skillRating,
                    myLeaderboardStats.classicRating
                  );
                  const tier = getRankInfo(bestR);
                  return (
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 border text-[10px] font-mono-tabular font-bold ${tier.badgeColor}`}
                    >
                      <PixelTierIcon tierId={tier.id} className="w-3.5 h-3.5 shrink-0" />
                      <span>{bestR}</span>
                    </span>
                  );
                })()}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSignInGoogle}
                disabled={authLoading}
                className="pixel-btn px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 border border-amber-200 text-xs font-extrabold text-[#14171F] flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">구글 로그인</span>
                <span className="sm:hidden">로그인</span>
              </button>
            )}

            <button
              type="button"
              onClick={screen === 'lobby' ? handleToggleLobbyBgm : handleToggleBgm}
              title={
                (screen === 'lobby' ? lobbyBgmEnabled : bgmEnabled)
                  ? '배경음 끄기'
                  : '배경음 켜기'
              }
              aria-label={
                (screen === 'lobby' ? lobbyBgmEnabled : bgmEnabled)
                  ? '배경음 끄기'
                  : '배경음 켜기'
              }
              className={`pixel-btn px-2.5 py-1.5 border text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                (screen === 'lobby' ? lobbyBgmEnabled : bgmEnabled) && !muted
                  ? screen === 'lobby'
                    ? 'bg-[#21312D] hover:bg-[#2A3F3A] border-emerald-500/70 text-emerald-300'
                    : 'bg-[#252D40] hover:bg-[#313B54] border-amber-500/70 text-amber-300'
                  : 'bg-[#181C26] hover:bg-[#252B3B] border-[#323B52] text-slate-400'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">BGM</span>
            </button>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              title="사운드 및 배경음 설정"
              aria-label="설정"
              className="pixel-btn px-2.5 py-1.5 bg-[#222837] hover:bg-[#2F374C] border border-[#3A4560] text-xs font-bold text-slate-200 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-sky-300" />
              <span className="hidden sm:inline">설정</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (screen === 'game') {
                  handleExitToLobby();
                } else {
                  setModalTab('skills');
                  setModalOpen(true);
                }
              }}
              className="pixel-btn px-3 py-1.5 bg-[#252B3B] hover:bg-[#31394F] border border-[#404B66] text-xs font-bold text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {screen === 'game' ? '새 대국' : '규칙 안내'}
            </button>
          </div>
        </div>
      </header>

      {/* Fixed Single-Viewport Main Stage */}
      <main className="flex-1 min-h-0 overflow-hidden">
        {screen === 'lobby' ? (
          <MatchSetupPanel
            initialRoomCode={initialRoomCode}
            wsError={wsError}
            wsConnecting={wsConnecting}
            matchHistory={matchHistory}
            authUser={
              authUser
                ? {
                    uid: authUser.uid,
                    displayName: authUser.displayName || '체스기사',
                    photoURL: authUser.photoURL || undefined,
                  }
                : null
            }
            authLoading={authLoading}
            myLeaderboardStats={myLeaderboardStats}
            leaderboardSkill={leaderboardSkill}
            leaderboardClassic={leaderboardClassic}
            leaderboardLoading={leaderboardLoading}
            onSignInGoogle={handleSignInGoogle}
            onSignOutGoogle={handleSignOutGoogle}
            onRefreshLeaderboard={refreshLeaderboards}
            onClearHistory={handleClearHistory}
            onStartAiGame={startLocalAiGame}
            onCreateOnlineRoom={handleCreateOnlineRoom}
            onJoinOnlineRoom={handleJoinOnlineRoom}
          />
        ) : opponentMode === 'ai' ? (
          <GameView
            opponentMode="ai"
            ruleMode={ruleMode}
            fen={aiFen}
            turn={chessRef.current.turn() as PieceColor}
            myColor={aiPlayerColor}
            aiLevel={aiLevel}
            aiThinking={aiThinking}
            timeControl={aiTimeControl}
            whiteTimeMs={aiWhiteMs}
            blackTimeMs={aiBlackMs}
            moves={aiMoves}
            lastMove={aiLastMove}
            inCheck={chessRef.current.inCheck()}
            gameOver={aiGameOver}
            chess960State={aiChess960State}
            skillState={aiSkillState}
            isSignedIn={Boolean(authUser)}
            myRatings={
              myLeaderboardStats
                ? {
                    skill: myLeaderboardStats.skillRating,
                    classic: myLeaderboardStats.classicRating,
                  }
                : { skill: 0, classic: 0 }
            }
            muted={muted}
            bgmEnabled={bgmEnabled}
            onToggleMute={handleToggleMute}
            onToggleBgm={handleToggleBgm}
            onMove={handleGameMove}
            onDrawSkill={handleDrawSkill}
            onCastSkillSquare={handleCastSkillSquare}
            onCancelSkillSwap={handleCancelSkillSwap}
            onDiscardSkillCard={handleDiscardSkillCard}
            onChooseAugment={handleChooseAugment}
            onChooseSkillDraft={handleChooseSkillDraft}
            onResign={handleResign}
            onUndo={handleUndoAiMove}
            onRematch={handleRematch}
            onExitToLobby={handleExitToLobby}
          />
        ) : roomState ? (
          <GameView
            opponentMode="online"
            ruleMode={roomState.ruleMode}
            fen={roomState.fen}
            turn={roomState.turn}
            myColor={onlineColor}
            timeControl={roomState.timeControl}
            whiteTimeMs={displayOnlineClocks.w}
            blackTimeMs={displayOnlineClocks.b}
            moves={roomState.moves}
            lastMove={roomState.lastMove}
            inCheck={roomState.inCheck}
            gameOver={roomState.gameOver}
            roomState={roomState}
            chess960State={roomState.chess960State}
            skillState={roomState.skillState}
            isSignedIn={Boolean(authUser)}
            myRatings={
              myLeaderboardStats
                ? {
                    skill: myLeaderboardStats.skillRating,
                    classic: myLeaderboardStats.classicRating,
                  }
                : { skill: 0, classic: 0 }
            }
            muted={muted}
            bgmEnabled={bgmEnabled}
            onToggleMute={handleToggleMute}
            onToggleBgm={handleToggleBgm}
            onMove={handleGameMove}
            onDrawSkill={handleDrawSkill}
            onCastSkillSquare={handleCastSkillSquare}
            onCancelSkillSwap={handleCancelSkillSwap}
            onDiscardSkillCard={handleDiscardSkillCard}
            onChooseAugment={handleChooseAugment}
            onChooseSkillDraft={handleChooseSkillDraft}
            onResign={handleResign}
            onOfferDraw={handleOfferDraw}
            onRespondDraw={handleRespondDraw}
            onRematch={handleRematch}
            onExitToLobby={handleExitToLobby}
          />
        ) : null}
      </main>

      <RulesModal
        open={modalOpen}
        initialTab={modalTab}
        onClose={() => setModalOpen(false)}
      />

      <SettingsModal
        open={settingsOpen}
        currentScene={screen}
        muted={muted}
        lobbyBgmEnabled={lobbyBgmEnabled}
        lobbyBgmPace={lobbyBgmPace}
        bgmEnabled={bgmEnabled}
        bgmPace={bgmPace}
        pauseBgmOnOpponentTurn={pauseBgmOnOpponentTurn}
        onToggleMute={handleToggleMute}
        onToggleLobbyBgm={handleToggleLobbyBgm}
        onChangeLobbyBgmPace={handleChangeLobbyBgmPace}
        onToggleBgm={handleToggleBgm}
        onChangeBgmPace={handleChangeBgmPace}
        onTogglePauseBgmOnOpponentTurn={handleTogglePauseBgmOnOpponentTurn}
        onClose={() => setSettingsOpen(false)}
      />

      <AccountStatsModal
        open={accountModalOpen && Boolean(authUser)}
        stats={myLeaderboardStats}
        fallbackName={authUser?.displayName || '체스기사'}
        fallbackPhotoURL={authUser?.photoURL || undefined}
        isOwnAccount={true}
        onSignOut={handleSignOutGoogle}
        onClose={() => setAccountModalOpen(false)}
      />
    </div>
  );
}
