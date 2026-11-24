import type { AiLevel, Chess960State, PieceType, SkillMatchState } from '../types/chess';
import { type AiSkillAction, planAiTurn } from './chessAi';

interface AiWorkerRequest {
  id: number;
  fen: string;
  level: AiLevel;
  skillState: SkillMatchState | null;
  chess960State?: Chess960State | null;
  currentMoveCount?: number;
}

interface AiWorkerResponse {
  id: number;
  skillAction: AiSkillAction | null;
  move: { from: string; to: string; promotion?: PieceType } | null;
}

self.onmessage = (event: MessageEvent<AiWorkerRequest>) => {
  const { id, fen, level, skillState, chess960State = null, currentMoveCount = 0 } = event.data;
  try {
    const result = planAiTurn({
      fen,
      level,
      skillState,
      chess960State,
      currentMoveCount,
    });
    const response: AiWorkerResponse = {
      id,
      skillAction: result.skillAction,
      move: result.move,
    };
    self.postMessage(response);
  } catch {
    const response: AiWorkerResponse = { id, skillAction: null, move: null };
    self.postMessage(response);
  }
};
