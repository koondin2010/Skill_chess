import { Chess, type PieceSymbol, type Square } from 'chess.js';
import type { Chess960State, MoveRecord, PieceColor, PieceType } from '../types/chess.ts';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

// Standard Scharnagl (1998) SP 0..959 generator
export function generateChess960BackRank(seedId?: number): {
  positionId: number;
  backRank: string;
  kingFile: string;
  queenRookFile: string;
  kingRookFile: string;
} {
  const positionId =
    typeof seedId === 'number' && Number.isInteger(seedId) && seedId >= 0 && seedId < 960
      ? seedId
      : Math.floor(Math.random() * 960);

  const squares = new Array<string>(8).fill('');
  let n = positionId;

  // 1. Light-square bishop (indices 1,3,5,7)
  const b1 = n % 4;
  n = Math.floor(n / 4);
  squares[b1 * 2 + 1] = 'B';

  // 2. Dark-square bishop (indices 0,2,4,6)
  const b2 = n % 4;
  n = Math.floor(n / 4);
  squares[b2 * 2] = 'B';

  // 3. Queen on remaining 6 empty indices
  const qIdx = n % 6;
  n = Math.floor(n / 6);
  let emptyCount = 0;
  for (let i = 0; i < 8; i++) {
    if (!squares[i]) {
      if (emptyCount === qIdx) {
        squares[i] = 'Q';
        break;
      }
      emptyCount++;
    }
  }

  // 4. Two knights on remaining 5 empty indices (C(5,2) = 10 combinations)
  const KNIGHT_TABLE: Array<[number, number]> = [
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 2],
    [1, 3],
    [1, 4],
    [2, 3],
    [2, 4],
    [3, 4],
  ];
  const [n1, n2] = KNIGHT_TABLE[n % 10];
  let idx = 0;
  for (let i = 0; i < 8; i++) {
    if (!squares[i]) {
      if (idx === n1 || idx === n2) {
        squares[i] = 'N';
      }
      idx++;
    }
  }

  // 5. Remaining 3 empty indices strictly become R - K - R
  const remaining: number[] = [];
  for (let i = 0; i < 8; i++) {
    if (!squares[i]) remaining.push(i);
  }
  squares[remaining[0]] = 'R';
  squares[remaining[1]] = 'K';
  squares[remaining[2]] = 'R';

  return {
    positionId,
    backRank: squares.join(''),
    queenRookFile: FILES[remaining[0]],
    kingFile: FILES[remaining[1]],
    kingRookFile: FILES[remaining[2]],
  };
}

export function createInitialChess960State(seedId?: number): Chess960State {
  const gen = generateChess960BackRank(seedId);
  const blackBackRank = gen.backRank.toLowerCase();
  // Use '-' for chess.js FEN castling field so chess.js never emits invalid hardcoded e1/h1 castling moves;
  // true FIDE Chess960 castling rights & execution are tracked cleanly in Chess960State.
  const initialFen = `${blackBackRank}/pppppppp/8/8/8/8/PPPPPPPP/${gen.backRank} w - - 0 1`;

  return {
    positionId: gen.positionId,
    initialFen,
    wKingSq: `${gen.kingFile}1`,
    wQRookSq: `${gen.queenRookFile}1`,
    wKRookSq: `${gen.kingRookFile}1`,
    bKingSq: `${gen.kingFile}8`,
    bQRookSq: `${gen.queenRookFile}8`,
    bKRookSq: `${gen.kingRookFile}8`,
    rights: {
      wK: true,
      wQ: true,
      bK: true,
      bQ: true,
    },
  };
}

export interface Chess960CastleOption {
  side: 'k' | 'q';
  kingFrom: Square;
  rookFrom: Square;
  kingTo: Square;
  rookTo: Square;
  sanBase: 'O-O' | 'O-O-O';
}

export function getChess960CastlingMoves(
  chess: Chess,
  state960: Chess960State | null
): Chess960CastleOption[] {
  if (!state960) return [];
  const turn = chess.turn() as PieceColor;
  if (chess.inCheck()) return [];

  const enemy: PieceColor = turn === 'w' ? 'b' : 'w';
  const rank = turn === 'w' ? '1' : '8';
  const kingFrom = (turn === 'w' ? state960.wKingSq : state960.bKingSq) as Square;
  const kingPiece = chess.get(kingFrom);
  if (!kingPiece || kingPiece.color !== turn || kingPiece.type !== 'k') return [];

  const options: Chess960CastleOption[] = [];

  const trySide = (side: 'k' | 'q') => {
    const hasRight =
      turn === 'w'
        ? side === 'k'
          ? state960.rights.wK
          : state960.rights.wQ
        : side === 'k'
        ? state960.rights.bK
        : state960.rights.bQ;
    if (!hasRight) return;

    const rookFrom = (
      turn === 'w'
        ? side === 'k'
          ? state960.wKRookSq
          : state960.wQRookSq
        : side === 'k'
        ? state960.bKRookSq
        : state960.bQRookSq
    ) as Square;

    const rookPiece = chess.get(rookFrom);
    if (!rookPiece || rookPiece.color !== turn || rookPiece.type !== 'r') return;

    const kingTo = `${side === 'k' ? 'g' : 'c'}${rank}` as Square;
    const rookTo = `${side === 'k' ? 'f' : 'd'}${rank}` as Square;

    const kf = FILES.indexOf(kingFrom[0]);
    const rf = FILES.indexOf(rookFrom[0]);
    const kt = FILES.indexOf(kingTo[0]);
    const rt = FILES.indexOf(rookTo[0]);

    // Check every square in union of [kf..kt] and [rf..rt] is empty except kingFrom & rookFrom
    const minF = Math.min(kf, rf, kt, rt);
    const maxF = Math.max(kf, rf, kt, rt);
    for (let f = minF; f <= maxF; f++) {
      const sq = `${FILES[f]}${rank}` as Square;
      if (sq === kingFrom || sq === rookFrom) continue;
      if (chess.get(sq)) return;
    }

    // Check every square king travels across (kf..kt inclusive) is NOT attacked by enemy
    const step = kt >= kf ? 1 : -1;
    for (let f = kf; ; f += step) {
      const sq = `${FILES[f]}${rank}` as Square;
      if (chess.isAttacked(sq, enemy)) return;
      if (f === kt) break;
    }

    // Also verify resulting position leaves king safe (e.g. edge cases)
    const testChess = new Chess(chess.fen());
    testChess.remove(kingFrom);
    testChess.remove(rookFrom);
    testChess.put({ type: 'k', color: turn }, kingTo);
    testChess.put({ type: 'r', color: turn }, rookTo);
    if (testChess.isAttacked(kingTo, enemy)) return;

    options.push({
      side,
      kingFrom,
      rookFrom,
      kingTo,
      rookTo,
      sanBase: side === 'k' ? 'O-O' : 'O-O-O',
    });
  };

  trySide('k');
  trySide('q');
  return options;
}

export function cloneChess960State(state: Chess960State): Chess960State {
  return {
    ...state,
    rights: { ...state.rights },
  };
}

export function updateChess960RightsAfterMove(
  state960: Chess960State,
  from: string,
  to: string,
  color: PieceColor,
  pieceType: PieceType
): Chess960State {
  const next = cloneChess960State(state960);
  if (pieceType === 'k') {
    if (color === 'w') {
      next.rights.wK = false;
      next.rights.wQ = false;
    } else {
      next.rights.bK = false;
      next.rights.bQ = false;
    }
  }
  if (from === next.wKRookSq || to === next.wKRookSq) next.rights.wK = false;
  if (from === next.wQRookSq || to === next.wQRookSq) next.rights.wQ = false;
  if (from === next.bKRookSq || to === next.bKRookSq) next.rights.bK = false;
  if (from === next.bQRookSq || to === next.bQRookSq) next.rights.bQ = false;
  return next;
}

export function executeChess960Move(
  chess: Chess,
  state960: Chess960State | null,
  from: string,
  to: string,
  promotion: PieceType | undefined,
  currentMoveCount: number
): { moveRecord: MoveRecord; nextState960: Chess960State | null } | null {
  const turn = chess.turn() as PieceColor;
  const fromSq = from as Square;
  const toSq = to as Square;
  const piece = chess.get(fromSq);
  if (!piece || piece.color !== turn) return null;

  // 1. Check Chess960 castling (user may click kingTo e.g. g1/c1 OR click the friendly rook square rookFrom!)
  if (state960 && piece.type === 'k') {
    const castlings = getChess960CastlingMoves(chess, state960);
    const matchedCastle = castlings.find((c) => c.kingTo === toSq || c.rookFrom === toSq);
    if (matchedCastle) {
      const nextTurn: PieceColor = turn === 'w' ? 'b' : 'w';
      chess.remove(matchedCastle.kingFrom);
      chess.remove(matchedCastle.rookFrom);
      chess.put({ type: 'k', color: turn }, matchedCastle.kingTo);
      chess.put({ type: 'r', color: turn }, matchedCastle.rookTo);

      const parts = chess.fen().split(' ');
      parts[1] = nextTurn;
      parts[2] = '-';
      parts[3] = '-';
      parts[4] = String(Number(parts[4] || 0) + 1);
      if (nextTurn === 'w') {
        parts[5] = String(Number(parts[5] || 1) + 1);
      }
      chess.load(parts.join(' '));

      const suffix = chess.isCheckmate() ? '#' : chess.inCheck() ? '+' : '';
      const ply = currentMoveCount + 1;
      const nextState960 = updateChess960RightsAfterMove(
        state960,
        matchedCastle.kingFrom,
        matchedCastle.kingTo,
        turn,
        'k'
      );

      return {
        moveRecord: {
          ply,
          moveNumber: Math.ceil(ply / 2),
          color: turn,
          san: `${matchedCastle.sanBase}${suffix}`,
          from: matchedCastle.kingFrom,
          to: matchedCastle.kingTo,
          flags: matchedCastle.side,
        },
        nextState960,
      };
    }
  }

  // 2. Standard move execution via chess.js
  const executed = chess.move({
    from: fromSq,
    to: toSq,
    promotion: promotion as PieceSymbol | undefined,
  });
  if (!executed) return null;

  const ply = currentMoveCount + 1;
  const nextState960 = state960
    ? updateChess960RightsAfterMove(state960, from, to, turn, piece.type as PieceType)
    : null;

  return {
    moveRecord: {
      ply,
      moveNumber: Math.ceil(ply / 2),
      color: turn,
      san: executed.san,
      from: executed.from,
      to: executed.to,
      captured: executed.captured as PieceType | undefined,
      promotion: executed.promotion as PieceType | undefined,
      flags: executed.flags,
    },
    nextState960,
  };
}
