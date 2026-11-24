import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { Chess } from 'chess.js';
import type {
  AugmentId,
  Chess960State,
  GameOverState,
  MatchRatingOutcome,
  MoveRecord,
  OnlinePlayerInfo,
  PieceColor,
  PieceType,
  RoomStatePayload,
  RuleMode,
  SkillId,
  SkillMatchState,
  TimeControl,
} from './src/types/chess.ts';
import {
  SKILL_DEFINITIONS,
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
} from './src/engine/skillChess.ts';
import { createInitialChess960State, executeChess960Move } from './src/engine/chess960.ts';
import {
  computeFriendMatchRatingDelta,
  getRatingCategoryForRuleMode,
} from './src/utils/rating.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ServerPlayer extends OnlinePlayerInfo {
  ws: WebSocket | null;
}

interface ServerRoom {
  roomCode: string;
  matchId: string;
  chess: Chess;
  ruleMode: RuleMode;
  chess960State: Chess960State | null;
  timeControl: TimeControl;
  whiteTimeMs: number;
  blackTimeMs: number;
  lastTickAt: number | null;
  started: boolean;
  players: {
    w: ServerPlayer | null;
    b: ServerPlayer | null;
  };
  spectators: Map<string, WebSocket>;
  moves: MoveRecord[];
  lastMove: { from: string; to: string; captured?: PieceType } | null;
  gameOver: GameOverState | null;
  ratingOutcome: MatchRatingOutcome | null;
  drawOfferBy: PieceColor | null;
  rematchRequests: Set<PieceColor>;
  skillState: SkillMatchState | null;
  createdAt: number;
}

interface ClientSession {
  ws: WebSocket;
  clientId: string;
  roomCode: string | null;
  role: PieceColor | 'spectator' | null;
}

const rooms = new Map<string, ServerRoom>();
const sessions = new Map<WebSocket, ClientSession>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  if (rooms.has(code)) return generateRoomCode();
  return code;
}

function getEffectiveClocks(room: ServerRoom, now: number): { whiteMs: number; blackMs: number } {
  let whiteMs = room.whiteTimeMs;
  let blackMs = room.blackTimeMs;

  if (
    room.timeControl.minutes > 0 &&
    room.started &&
    !room.gameOver &&
    !room.skillState?.augmentPhase &&
    room.moves.length > 0 &&
    room.lastTickAt !== null
  ) {
    const elapsed = Math.max(0, now - room.lastTickAt);
    if (room.chess.turn() === 'w') {
      whiteMs = Math.max(0, whiteMs - elapsed);
    } else {
      blackMs = Math.max(0, blackMs - elapsed);
    }
  }

  return { whiteMs, blackMs };
}

function redactSkillStateFor(
  skillState: SkillMatchState | null,
  viewerColor: PieceColor | 'spectator',
  currentTurn: PieceColor
): SkillMatchState | null {
  if (!skillState) return null;
  const redacted = cloneSkillState(skillState);
  redacted.w.handCount = skillState.w.hand.length;
  redacted.b.handCount = skillState.b.hand.length;
  redacted.w.deck = [];
  redacted.b.deck = [];

  if (viewerColor !== 'w') {
    redacted.w.hand = [];
    redacted.w.pendingSkillDraft = null;
  }
  if (viewerColor !== 'b') {
    redacted.b.hand = [];
    redacted.b.pendingSkillDraft = null;
  }

  // Keep secret skills hidden from the opponent while player is choosing/moving
  if (viewerColor !== currentTurn) {
    redacted.activeCast = null;
  }
  if (
    redacted.lastVfx &&
    redacted.lastVfx.color !== viewerColor &&
    SKILL_DEFINITIONS[redacted.lastVfx.skillId]?.turnBehavior === 'lock_piece_move' &&
    redacted.lastVfx.skillId !== 'shield'
  ) {
    redacted.lastVfx = null;
  }

  return redacted;
}

function serializeRoom(
  room: ServerRoom,
  viewerColor: PieceColor | 'spectator' = 'spectator'
): RoomStatePayload {
  const now = Date.now();
  const { whiteMs, blackMs } = getEffectiveClocks(room, now);
  const currentTurn = room.chess.turn() as PieceColor;

  return {
    roomCode: room.roomCode,
    matchId: room.matchId,
    fen: room.chess.fen(),
    turn: currentTurn,
    ruleMode: room.ruleMode,
    chess960State: room.chess960State,
    timeControl: room.timeControl,
    whiteTimeMs: whiteMs,
    blackTimeMs: blackMs,
    lastTickAt: room.lastTickAt,
    started: room.started,
    players: {
      w: room.players.w
        ? {
            id: room.players.w.id,
            nickname: room.players.w.nickname,
            color: 'w',
            connected: room.players.w.connected,
          }
        : null,
      b: room.players.b
        ? {
            id: room.players.b.id,
            nickname: room.players.b.nickname,
            color: 'b',
            connected: room.players.b.connected,
          }
        : null,
    },
    spectatorCount: room.spectators.size,
    moves: room.moves,
    lastMove: room.lastMove,
    inCheck: room.chess.inCheck(),
    gameOver: room.gameOver,
    ratingOutcome: room.ratingOutcome,
    drawOfferBy: room.drawOfferBy,
    rematchRequests: Array.from(room.rematchRequests),
    skillState: redactSkillStateFor(room.skillState, viewerColor, currentTurn),
  };
}

function sendJson(ws: WebSocket | null, payload: unknown) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastRoom(room: ServerRoom) {
  if (room.players.w?.ws) {
    sendJson(room.players.w.ws, {
      type: 'room:state',
      state: serializeRoom(room, 'w'),
    });
  }
  if (room.players.b?.ws) {
    sendJson(room.players.b.ws, {
      type: 'room:state',
      state: serializeRoom(room, 'b'),
    });
  }
  if (room.spectators.size > 0) {
    const specMessage = { type: 'room:state', state: serializeRoom(room, 'spectator') };
    for (const specWs of room.spectators.values()) {
      sendJson(specWs, specMessage);
    }
  }
}

function evaluateChessGameOver(chess: Chess): GameOverState | null {
  if (chess.isCheckmate()) {
    const winner: PieceColor = chess.turn() === 'w' ? 'b' : 'w';
    return {
      winner,
      reason: 'checkmate',
      message: winner === 'w' ? '체크메이트! 백이 승리했습니다.' : '체크메이트! 흑이 승리했습니다.',
    };
  }
  if (chess.isStalemate()) {
    return {
      winner: 'draw',
      reason: 'stalemate',
      message: '스테일메이트로 무승부입니다.',
    };
  }
  if (chess.isInsufficientMaterial()) {
    return {
      winner: 'draw',
      reason: 'insufficient',
      message: '기물 부족으로 무승부입니다.',
    };
  }
  if (chess.isThreefoldRepetition()) {
    return {
      winner: 'draw',
      reason: 'threefold',
      message: '3회 동형 반복으로 무승부입니다.',
    };
  }
  if (chess.isDraw()) {
    return {
      winner: 'draw',
      reason: 'fifty-move',
      message: '50수 규칙 무승부입니다.',
    };
  }
  return null;
}

function stampGameOverOutcome(room: ServerRoom) {
  if (!room.gameOver || room.ratingOutcome) return;
  if (!room.players.w || !room.players.b) return;
  const { winnerDelta, loserDelta, materialDiff } = computeFriendMatchRatingDelta(
    room.chess.fen(),
    room.gameOver.winner,
    room.moves.length
  );
  room.ratingOutcome = {
    matchId: room.matchId,
    category: getRatingCategoryForRuleMode(room.ruleMode),
    winnerDelta,
    loserDelta,
    materialDiff,
    plyCount: room.moves.length,
  };
}

function detachSessionFromRoom(session: ClientSession) {
  if (!session.roomCode) return;
  const room = rooms.get(session.roomCode);
  if (!room) {
    session.roomCode = null;
    session.role = null;
    return;
  }

  if (room.players.w?.id === session.clientId && room.players.w.ws === session.ws) {
    room.players.w.connected = false;
    room.players.w.ws = null;
  } else if (room.players.b?.id === session.clientId && room.players.b.ws === session.ws) {
    room.players.b.connected = false;
    room.players.b.ws = null;
  } else {
    room.spectators.delete(session.clientId);
  }

  session.roomCode = null;
  session.role = null;
  broadcastRoom(room);
}

function applyClockOnTurnEnd(room: ServerRoom, turnColor: PieceColor, now: number): boolean {
  if (room.timeControl.minutes > 0 && room.moves.length > 0 && room.lastTickAt !== null) {
    const elapsed = Math.max(0, now - room.lastTickAt);
    if (turnColor === 'w') {
      room.whiteTimeMs = Math.max(0, room.whiteTimeMs - elapsed);
      if (room.whiteTimeMs <= 0) {
        room.gameOver = {
          winner: 'b',
          reason: 'timeout',
          message: '백의 시간이 모두 소진되었습니다. 흑 승리!',
        };
        stampGameOverOutcome(room);
        return false;
      }
      room.whiteTimeMs += room.timeControl.incrementSeconds * 1000;
    } else {
      room.blackTimeMs = Math.max(0, room.blackTimeMs - elapsed);
      if (room.blackTimeMs <= 0) {
        room.gameOver = {
          winner: 'w',
          reason: 'timeout',
          message: '흑의 시간이 모두 소진되었습니다. 백 승리!',
        };
        stampGameOverOutcome(room);
        return false;
      }
      room.blackTimeMs += room.timeControl.incrementSeconds * 1000;
    }
  }
  room.lastTickAt = now;
  return true;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, activeRooms: rooms.size });
  });

  app.get('/api/rooms/:code', (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ exists: false, message: '방을 찾을 수 없습니다.' });
      return;
    }
    res.json({
      exists: true,
      roomCode: room.roomCode,
      ruleMode: room.ruleMode,
      timeControl: room.timeControl,
      playersCount: (room.players.w ? 1 : 0) + (room.players.b ? 1 : 0),
    });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const session: ClientSession = {
      ws,
      clientId: '',
      roomCode: null,
      role: null,
    };
    sessions.set(ws, session);

    ws.on('message', (raw) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(raw.toString()) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = String(data.type || '');
      if (type === 'ping') {
        sendJson(ws, { type: 'pong' });
        return;
      }

      const clientId =
        typeof data.clientId === 'string' && data.clientId ? data.clientId : session.clientId;
      if (clientId) {
        session.clientId = clientId;
      }

      if (type === 'room:create') {
        detachSessionFromRoom(session);
        const roomCode = generateRoomCode();
        const nickname =
          String(data.nickname || '플레이어 1').trim().slice(0, 18) || '플레이어 1';
        const colorPref =
          data.preferredColor === 'w' || data.preferredColor === 'b'
            ? data.preferredColor
            : 'random';
        const assignedColor: PieceColor =
          colorPref === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : colorPref;

        const tcInput = (data.timeControl as Partial<TimeControl> | undefined) || {};
        const minutes =
          typeof tcInput.minutes === 'number' && tcInput.minutes >= 0 && tcInput.minutes <= 60
            ? Math.floor(tcInput.minutes)
            : 10;
        const incrementSeconds =
          typeof tcInput.incrementSeconds === 'number' &&
          tcInput.incrementSeconds >= 0 &&
          tcInput.incrementSeconds <= 30
            ? Math.floor(tcInput.incrementSeconds)
            : 0;

        const ruleMode: RuleMode =
          data.ruleMode === 'skill'
            ? 'skill'
            : data.ruleMode === 'chess960'
            ? 'chess960'
            : 'classic';
        const initialMs = minutes > 0 ? minutes * 60 * 1000 : 0;
        const chess960State =
          ruleMode === 'chess960' ? createInitialChess960State() : null;

        const room: ServerRoom = {
          roomCode,
          matchId: randomUUID(),
          chess: new Chess(chess960State ? chess960State.initialFen : undefined),
          ruleMode,
          chess960State,
          timeControl: { minutes, incrementSeconds },
          whiteTimeMs: initialMs,
          blackTimeMs: initialMs,
          lastTickAt: null,
          started: false,
          players: {
            w: null,
            b: null,
          },
          spectators: new Map(),
          moves: [],
          lastMove: null,
          gameOver: null,
          ratingOutcome: null,
          drawOfferBy: null,
          rematchRequests: new Set(),
          skillState: ruleMode === 'skill' ? createInitialSkillMatchState() : null,
          createdAt: Date.now(),
        };

        room.players[assignedColor] = {
          id: session.clientId,
          nickname,
          color: assignedColor,
          connected: true,
          ws,
        };

        rooms.set(roomCode, room);
        session.roomCode = roomCode;
        session.role = assignedColor;

        sendJson(ws, {
          type: 'room:joined',
          roomCode,
          yourColor: assignedColor,
          state: serializeRoom(room, assignedColor),
        });
        return;
      }

      if (type === 'room:join') {
        const roomCode = String(data.roomCode || '').trim().toUpperCase();
        const nickname = String(data.nickname || '친구').trim().slice(0, 18) || '친구';
        const room = rooms.get(roomCode);

        if (!room) {
          sendJson(ws, {
            type: 'room:error',
            message: `방 코드(${roomCode})를 찾을 수 없습니다. 새 방을 만들거나 코드를 확인해 주세요.`,
          });
          return;
        }

        if (session.roomCode && session.roomCode !== roomCode) {
          detachSessionFromRoom(session);
        }

        let role: PieceColor | 'spectator' = 'spectator';

        if (room.players.w?.id === session.clientId) {
          room.players.w.ws = ws;
          room.players.w.connected = true;
          if (nickname && nickname !== '친구') room.players.w.nickname = nickname;
          role = 'w';
        } else if (room.players.b?.id === session.clientId) {
          room.players.b.ws = ws;
          room.players.b.connected = true;
          if (nickname && nickname !== '친구') room.players.b.nickname = nickname;
          role = 'b';
        } else if (!room.players.w) {
          room.players.w = {
            id: session.clientId,
            nickname,
            color: 'w',
            connected: true,
            ws,
          };
          role = 'w';
        } else if (!room.players.b) {
          room.players.b = {
            id: session.clientId,
            nickname,
            color: 'b',
            connected: true,
            ws,
          };
          role = 'b';
        } else if (!room.players.w.connected && !room.started) {
          room.players.w = {
            id: session.clientId,
            nickname,
            color: 'w',
            connected: true,
            ws,
          };
          role = 'w';
        } else if (!room.players.b.connected && !room.started) {
          room.players.b = {
            id: session.clientId,
            nickname,
            color: 'b',
            connected: true,
            ws,
          };
          role = 'b';
        } else {
          room.spectators.set(session.clientId, ws);
          role = 'spectator';
        }

        if (room.players.w && room.players.b && !room.started) {
          room.started = true;
          room.lastTickAt = Date.now();
        }

        session.roomCode = roomCode;
        session.role = role;

        sendJson(ws, {
          type: 'room:joined',
          roomCode,
          yourColor: role,
          state: serializeRoom(room, role),
        });
        broadcastRoom(room);
        return;
      }

      if (type === 'room:leave') {
        detachSessionFromRoom(session);
        return;
      }

      if (!session.roomCode) return;
      const room = rooms.get(session.roomCode);
      if (!room) return;

      if (type === 'skill:choose_augment') {
        if (room.gameOver || !room.started || !room.skillState) return;
        if (session.role !== 'w' && session.role !== 'b') return;
        const augmentId = String(data.augmentId || '') as AugmentId;
        const nextSkill = choosePlayerAugment(room.skillState, session.role, augmentId);
        if (nextSkill) {
          room.skillState = nextSkill;
          if (!nextSkill.augmentPhase) {
            room.lastTickAt = Date.now();
          }
          broadcastRoom(room);
        }
        return;
      }

      if (type === 'skill:draw') {
        if (room.gameOver || !room.started || !room.skillState || room.skillState.augmentPhase)
          return;
        if (session.role !== 'w' && session.role !== 'b') return;
        if (session.role !== room.chess.turn()) return;
        const nextSkill = drawSkillCard(room.skillState, session.role);
        if (nextSkill) {
          room.skillState = nextSkill;
          broadcastRoom(room);
        }
        return;
      }

      if (type === 'skill:choose_draft') {
        if (room.gameOver || !room.started || !room.skillState || room.skillState.augmentPhase)
          return;
        if (session.role !== 'w' && session.role !== 'b') return;
        if (session.role !== room.chess.turn()) return;
        const skillId = String(data.skillId || '') as SkillId;
        const nextSkill = chooseSkillDraftCard(room.skillState, session.role, skillId);
        if (nextSkill) {
          room.skillState = nextSkill;
          broadcastRoom(room);
        }
        return;
      }

      if (type === 'skill:discard') {
        if (room.gameOver || !room.started || !room.skillState || room.skillState.augmentPhase)
          return;
        if (session.role !== 'w' && session.role !== 'b') return;
        if (session.role !== room.chess.turn()) return;
        const cardUid = String(data.cardUid || '');
        const nextSkill = discardSkillCardToTrash(room.skillState, session.role, cardUid);
        if (nextSkill) {
          room.skillState = nextSkill;
          broadcastRoom(room);
        }
        return;
      }

      if (type === 'skill:cast') {
        if (room.gameOver || !room.started || !room.skillState || room.skillState.augmentPhase)
          return;
        if (session.role !== 'w' && session.role !== 'b') return;
        const turnColor = room.chess.turn() as PieceColor;
        if (session.role !== turnColor) return;

        const targetSquare = String(data.targetSquare || '');
        const now = Date.now();

        if (
          room.skillState.activeCast?.skillId === 'swap' &&
          room.skillState.activeCast.swapFirstSquare
        ) {
          const swapped = completeSwapSkillAction(
            room.chess,
            room.skillState,
            turnColor,
            targetSquare,
            room.moves.length
          );
          if (!swapped) return;
          if (!applyClockOnTurnEnd(room, turnColor, now)) {
            broadcastRoom(room);
            return;
          }
          room.skillState = swapped.nextSkillState;
          room.moves.push(swapped.moveRecord);
          room.lastMove = { from: swapped.moveRecord.from, to: swapped.moveRecord.to };
          const end = evaluateChessGameOver(room.chess);
          if (end) {
            room.gameOver = end;
            stampGameOverOutcome(room);
          }
          broadcastRoom(room);
          return;
        }

        if (
          room.skillState.activeCast?.skillId === 'snipe' &&
          room.skillState.activeCast.snipeBishopSquare
        ) {
          const sniped = completeSnipeSkillAction(
            room.chess,
            room.skillState,
            turnColor,
            targetSquare,
            room.moves.length
          );
          if (!sniped) return;
          if (!applyClockOnTurnEnd(room, turnColor, now)) {
            broadcastRoom(room);
            return;
          }
          room.skillState = sniped.nextSkillState;
          room.moves.push(sniped.moveRecord);
          room.lastMove = {
            from: sniped.moveRecord.from,
            to: sniped.moveRecord.to,
            captured: sniped.moveRecord.captured,
          };
          const end = evaluateChessGameOver(room.chess);
          if (end) {
            room.gameOver = end;
            stampGameOverOutcome(room);
          }
          broadcastRoom(room);
          return;
        }

        const cardUid = String(data.cardUid || '');
        const res = applySkillTargetAction(
          room.chess,
          room.skillState,
          turnColor,
          cardUid,
          targetSquare,
          room.moves.length
        );
        if (!res) return;

        room.skillState = res.nextSkillState;
        if (res.endedTurn && res.moveRecord) {
          if (!applyClockOnTurnEnd(room, turnColor, now)) {
            broadcastRoom(room);
            return;
          }
          room.moves.push(res.moveRecord);
          room.lastMove = {
            from: res.moveRecord.from,
            to: res.moveRecord.to,
            captured: res.moveRecord.captured,
          };
          const end = evaluateChessGameOver(room.chess);
          if (end) {
            room.gameOver = end;
            stampGameOverOutcome(room);
          }
        }
        broadcastRoom(room);
        return;
      }

      if (type === 'skill:cancel_swap') {
        const cast = room.skillState?.activeCast;
        if (!cast || (cast.skillId !== 'swap' && cast.skillId !== 'snipe')) return;
        if (session.role !== room.chess.turn()) return;
        room.skillState!.activeCast = null;
        broadcastRoom(room);
        return;
      }

      if (type === 'game:move') {
        if (room.gameOver || !room.started) return;
        if (room.skillState?.augmentPhase) return;
        if (session.role !== 'w' && session.role !== 'b') return;
        const turnColor = room.chess.turn() as PieceColor;
        if (session.role !== turnColor) return;

        const now = Date.now();
        const from = String(data.from || '');
        const to = String(data.to || '');
        const promotion =
          typeof data.promotion === 'string' ? (data.promotion as PieceType) : undefined;

        let moveRecord: MoveRecord;
        let nextSkillState = room.skillState;

        if (room.ruleMode === 'chess960') {
          const res960 = executeChess960Move(
            room.chess,
            room.chess960State,
            from,
            to,
            promotion,
            room.moves.length
          );
          if (!res960) {
            sendJson(ws, { type: 'room:error', message: '유효하지 않은 수입니다.' });
            return;
          }
          moveRecord = res960.moveRecord;
          room.chess960State = res960.nextState960;
        } else {
          const result = applyBoardMoveWithSkills(
            room.chess,
            room.skillState,
            from,
            to,
            promotion,
            room.moves.length
          );
          if (!result) {
            sendJson(ws, { type: 'room:error', message: '유효하지 않은 수입니다.' });
            return;
          }
          moveRecord = result.moveRecord;
          nextSkillState = result.nextSkillState;
        }

        if (!applyClockOnTurnEnd(room, turnColor, now)) {
          broadcastRoom(room);
          return;
        }

        room.drawOfferBy = null;
        room.skillState = nextSkillState;
        room.moves.push(moveRecord);
        room.lastMove = {
          from: moveRecord.from,
          to: moveRecord.to,
          captured: moveRecord.captured,
        };

        const end = evaluateChessGameOver(room.chess);
        if (end) {
          room.gameOver = end;
          stampGameOverOutcome(room);
        }

        broadcastRoom(room);
        return;
      }

      if (type === 'game:resign') {
        if (room.gameOver || !room.started) return;
        if (session.role !== 'w' && session.role !== 'b') return;
        const winner: PieceColor = session.role === 'w' ? 'b' : 'w';
        room.gameOver = {
          winner,
          reason: 'resign',
          message:
            session.role === 'w'
              ? '백이 기권했습니다. 흑 승리!'
              : '흑이 기권했습니다. 백 승리!',
        };
        stampGameOverOutcome(room);
        broadcastRoom(room);
        return;
      }

      if (type === 'game:draw_offer') {
        if (room.gameOver || !room.started) return;
        if (session.role !== 'w' && session.role !== 'b') return;
        room.drawOfferBy = session.role;
        broadcastRoom(room);
        return;
      }

      if (type === 'game:draw_respond') {
        if (room.gameOver || !room.started || !room.drawOfferBy) return;
        if (session.role !== 'w' && session.role !== 'b') return;
        if (session.role === room.drawOfferBy) return;

        if (data.accept === true) {
          room.gameOver = {
            winner: 'draw',
            reason: 'draw-agreement',
            message: '양측 합의로 무승부가 되었습니다.',
          };
          stampGameOverOutcome(room);
        }
        room.drawOfferBy = null;
        broadcastRoom(room);
        return;
      }

      if (type === 'game:rematch_request') {
        if (!room.gameOver) return;
        if (session.role !== 'w' && session.role !== 'b') return;
        room.rematchRequests.add(session.role);

        if (room.rematchRequests.has('w') && room.rematchRequests.has('b')) {
          const prevW = room.players.w;
          const prevB = room.players.b;
          room.players.w = prevB ? { ...prevB, color: 'w' } : null;
          room.players.b = prevW ? { ...prevW, color: 'b' } : null;

          room.matchId = randomUUID();
          room.chess960State =
            room.ruleMode === 'chess960' ? createInitialChess960State() : null;
          room.chess = new Chess(
            room.chess960State ? room.chess960State.initialFen : undefined
          );
          const initialMs =
            room.timeControl.minutes > 0 ? room.timeControl.minutes * 60 * 1000 : 0;
          room.whiteTimeMs = initialMs;
          room.blackTimeMs = initialMs;
          room.lastTickAt = Date.now();
          room.moves = [];
          room.lastMove = null;
          room.gameOver = null;
          room.ratingOutcome = null;
          room.drawOfferBy = null;
          room.rematchRequests.clear();
          room.skillState = room.ruleMode === 'skill' ? createInitialSkillMatchState() : null;

          for (const [sock, sess] of sessions.entries()) {
            if (sess.roomCode === room.roomCode) {
              if (room.players.w?.id === sess.clientId) {
                sess.role = 'w';
                sendJson(sock, {
                  type: 'room:joined',
                  roomCode: room.roomCode,
                  yourColor: 'w',
                  state: serializeRoom(room, 'w'),
                });
              } else if (room.players.b?.id === sess.clientId) {
                sess.role = 'b';
                sendJson(sock, {
                  type: 'room:joined',
                  roomCode: room.roomCode,
                  yourColor: 'b',
                  state: serializeRoom(room, 'b'),
                });
              }
            }
          }
        } else {
          broadcastRoom(room);
        }
      }
    });

    ws.on('close', () => {
      detachSessionFromRoom(session);
      sessions.delete(ws);
    });
  });

  // Authoritative timer check every 500ms + WS ping keepalive every 25s
  let pingTick = 0;
  setInterval(() => {
    const now = Date.now();
    pingTick++;

    if (pingTick % 50 === 0) {
      for (const sock of sessions.keys()) {
        if (sock.readyState === WebSocket.OPEN) {
          sock.ping();
        }
      }
    }

    for (const [code, room] of rooms.entries()) {
      if (
        room.timeControl.minutes > 0 &&
        room.started &&
        !room.gameOver &&
        !room.skillState?.augmentPhase &&
        room.moves.length > 0 &&
        room.lastTickAt !== null
      ) {
        const { whiteMs, blackMs } = getEffectiveClocks(room, now);
        const turn = room.chess.turn() as PieceColor;
        if (turn === 'w' && whiteMs <= 0) {
          room.whiteTimeMs = 0;
          room.gameOver = {
            winner: 'b',
            reason: 'timeout',
            message: '백의 시간이 모두 소진되었습니다. 흑 승리!',
          };
          stampGameOverOutcome(room);
          broadcastRoom(room);
        } else if (turn === 'b' && blackMs <= 0) {
          room.blackTimeMs = 0;
          room.gameOver = {
            winner: 'w',
            reason: 'timeout',
            message: '흑의 시간이 모두 소진되었습니다. 백 승리!',
          };
          stampGameOverOutcome(room);
          broadcastRoom(room);
        }
      }

      const anyConnected =
        Boolean(room.players.w?.connected) ||
        Boolean(room.players.b?.connected) ||
        room.spectators.size > 0;
      if (!anyConnected && now - room.createdAt > 30 * 60 * 1000) {
        rooms.delete(code);
      }
    }
  }, 500);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`Pixel Chess server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
