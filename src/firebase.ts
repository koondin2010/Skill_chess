import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type {
  LeaderboardUserRecord,
  MatchHistoryRecord,
  PieceColor,
  RatingCategory,
} from './types/chess';
import {
  INITIAL_RATING,
  applyRatingDelta,
  computeEffectivePlayerDelta,
} from './utils/rating';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export const CURRENT_RATING_EPOCH = 2;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: Array<{
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutGoogle(): Promise<void> {
  await signOut(auth);
}

function safeDisplayName(user: User): string {
  const raw = (user.displayName || user.email?.split('@')[0] || '도트기사').trim();
  return raw.slice(0, 40) || '도트기사';
}

function safePhotoUrl(user: User): string {
  const url = (user.photoURL || '').trim();
  return url.length <= 512 ? url : '';
}

export async function ensureSignedInUserDocs(user: User): Promise<LeaderboardUserRecord> {
  const uid = user.uid;
  const displayName = safeDisplayName(user);
  const photoURL = safePhotoUrl(user);
  const userPath = `users/${uid}`;
  const lbPath = `leaderboardUsers/${uid}`;

  try {
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', uid);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) {
        tx.set(userRef, {
          uid,
          email: user.email || `${uid}@google.user`,
          displayName,
          photoURL,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.update(userRef, {
          email: user.email || userSnap.data().email || `${uid}@google.user`,
          displayName,
          photoURL,
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  try {
    const lbRef = doc(db, 'leaderboardUsers', uid);
    const lbRecord = await runTransaction(db, async (tx) => {
      const lbSnap = await tx.get(lbRef);
      if (!lbSnap.exists()) {
        const fresh: LeaderboardUserRecord = {
          uid,
          displayName,
          photoURL,
          ratingEpoch: CURRENT_RATING_EPOCH,
          skillRating: INITIAL_RATING,
          skillWins: 0,
          skillLosses: 0,
          skillDraws: 0,
          classicRating: INITIAL_RATING,
          classicWins: 0,
          classicLosses: 0,
          classicDraws: 0,
        };
        tx.set(lbRef, {
          ...fresh,
          updatedAt: serverTimestamp(),
        });
        return fresh;
      } else {
        const existing = lbSnap.data() as LeaderboardUserRecord;
        const needsEpochReset = (existing.ratingEpoch ?? 1) < CURRENT_RATING_EPOCH;
        const patch: Record<string, unknown> = {
          displayName,
          photoURL,
          updatedAt: serverTimestamp(),
        };
        if (needsEpochReset) {
          patch.ratingEpoch = CURRENT_RATING_EPOCH;
          patch.skillRating = INITIAL_RATING;
          patch.classicRating = INITIAL_RATING;
        }
        tx.update(lbRef, patch);
        return {
          ...existing,
          ratingEpoch: needsEpochReset ? CURRENT_RATING_EPOCH : existing.ratingEpoch,
          skillRating: needsEpochReset ? INITIAL_RATING : existing.skillRating,
          classicRating: needsEpochReset ? INITIAL_RATING : existing.classicRating,
          displayName,
          photoURL,
        };
      }
    });
    return lbRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, lbPath);
  }
}

export async function fetchUserMatches(uid: string): Promise<MatchHistoryRecord[]> {
  const matchesPath = `users/${uid}/matches`;
  try {
    const q = query(
      collection(db, 'users', uid, 'matches'),
      orderBy('playedAt', 'desc'),
      limit(30)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      let moves: MatchHistoryRecord['moves'] = [];
      try {
        const parsed = JSON.parse(String(data.movesJson || '[]'));
        if (Array.isArray(parsed)) moves = parsed;
      } catch {
        moves = [];
      }
      return {
        id: String(data.matchId || d.id),
        playedAt: String(data.playedAt || new Date().toISOString()),
        opponentMode: data.opponentMode === 'online' ? 'online' : 'ai',
        ruleMode:
          data.ruleMode === 'skill' || data.ruleMode === 'chess960' ? data.ruleMode : 'classic',
        opponentLabel: String(data.opponentLabel || '상대'),
        myColor:
          data.myColor === 'w' || data.myColor === 'b' ? data.myColor : 'spectator',
        winner: data.winner === 'w' || data.winner === 'b' ? data.winner : 'draw',
        resultMessage: String(data.resultMessage || ''),
        ratingCategory:
          data.ratingCategory === 'skill' || data.ratingCategory === 'classic'
            ? data.ratingCategory
            : 'none',
        ratingDelta: typeof data.ratingDelta === 'number' ? data.ratingDelta : 0,
        materialDiff: typeof data.materialDiff === 'number' ? data.materialDiff : 0,
        moves,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, matchesPath);
  }
}

export async function clearCloudUserMatches(uid: string): Promise<void> {
  const matchesPath = `users/${uid}/matches`;
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'matches'));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, matchesPath);
  }
}

export async function fetchDualLeaderboards(
  category: RatingCategory,
  maxRows = 30
): Promise<LeaderboardUserRecord[]> {
  const orderField = category === 'skill' ? 'skillRating' : 'classicRating';
  try {
    const q = query(
      collection(db, 'leaderboardUsers'),
      orderBy(orderField, 'desc'),
      limit(maxRows)
    );
    const snap = await getDocs(q);
    const normalized = snap.docs.map((d) => {
      const data = d.data() as LeaderboardUserRecord;
      if ((data.ratingEpoch ?? 1) < CURRENT_RATING_EPOCH) {
        return {
          ...data,
          ratingEpoch: CURRENT_RATING_EPOCH,
          skillRating: INITIAL_RATING,
          classicRating: INITIAL_RATING,
        };
      }
      return data;
    });
    normalized.sort((a, b) =>
      category === 'skill' ? b.skillRating - a.skillRating : b.classicRating - a.classicRating
    );
    return normalized;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'leaderboardUsers');
  }
}

function sanitizeMatchId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned.length >= 3 ? cleaned : `match_${Date.now()}`;
}

export async function commitMatchAndRatingToCloud(params: {
  user: User;
  record: MatchHistoryRecord;
  rawDelta?: number;
}): Promise<{ updatedStats: LeaderboardUserRecord; committedDelta: number } | null> {
  const { user, record, rawDelta } = params;
  const uid = user.uid;
  const displayName = safeDisplayName(user);
  const photoURL = safePhotoUrl(user);
  const matchId = sanitizeMatchId(record.id);
  const matchPath = `users/${uid}/matches/${matchId}`;

  const delta = Math.max(
    -30,
    Math.min(30, Math.round(typeof rawDelta === 'number' ? rawDelta : record.ratingDelta || 0))
  );
  const category = record.ratingCategory || 'none';
  const myColor = record.myColor;
  const isParticipant = myColor === 'w' || myColor === 'b';
  const didWin = isParticipant && record.winner === myColor;
  const didLose = isParticipant && record.winner !== 'draw' && record.winner !== myColor;
  const didDraw = isParticipant && record.winner === 'draw';

  try {
    const result = await runTransaction(db, async (tx) => {
      const matchRef = doc(db, 'users', uid, 'matches', matchId);
      const lbRef = doc(db, 'leaderboardUsers', uid);

      const [matchSnap, lbSnap] = await Promise.all([tx.get(matchRef), tx.get(lbRef)]);
      if (matchSnap.exists()) {
        // Already committed idempotently
        const existingStats = lbSnap.exists()
          ? (lbSnap.data() as LeaderboardUserRecord)
          : await ensureSignedInUserDocs(user);
        return { updatedStats: existingStats, committedDelta: 0, needsInitialLeaderboardUpdate: false };
      }

      const rawStats: LeaderboardUserRecord = lbSnap.exists()
        ? (lbSnap.data() as LeaderboardUserRecord)
        : {
            uid,
            displayName,
            photoURL,
            ratingEpoch: CURRENT_RATING_EPOCH,
            skillRating: INITIAL_RATING,
            skillWins: 0,
            skillLosses: 0,
            skillDraws: 0,
            classicRating: INITIAL_RATING,
            classicWins: 0,
            classicLosses: 0,
            classicDraws: 0,
          };

      const needsEpochReset = (rawStats.ratingEpoch ?? 1) < CURRENT_RATING_EPOCH;
      const nextStats: LeaderboardUserRecord = {
        ...rawStats,
        ratingEpoch: CURRENT_RATING_EPOCH,
        skillRating: needsEpochReset ? INITIAL_RATING : rawStats.skillRating,
        classicRating: needsEpochReset ? INITIAL_RATING : rawStats.classicRating,
        displayName,
        photoURL,
      };

      const shouldApplyRanked =
        record.opponentMode === 'online' &&
        isParticipant &&
        (category === 'skill' || category === 'classic');

      let appliedDelta = 0;
      if (shouldApplyRanked) {
        if (category === 'skill') {
          const prevR = nextStats.skillRating;
          const effDelta = computeEffectivePlayerDelta(delta, prevR);
          nextStats.skillRating = applyRatingDelta(prevR, effDelta);
          appliedDelta = nextStats.skillRating - prevR;
          if (didWin) nextStats.skillWins += 1;
          else if (didLose) nextStats.skillLosses += 1;
          else if (didDraw) nextStats.skillDraws += 1;
        } else {
          const prevR = nextStats.classicRating;
          const effDelta = computeEffectivePlayerDelta(delta, prevR);
          nextStats.classicRating = applyRatingDelta(prevR, effDelta);
          appliedDelta = nextStats.classicRating - prevR;
          if (didWin) nextStats.classicWins += 1;
          else if (didLose) nextStats.classicLosses += 1;
          else if (didDraw) nextStats.classicDraws += 1;
        }
      }

      let movesJson = JSON.stringify(record.moves || []);
      if (movesJson.length > 48000) {
        movesJson = JSON.stringify((record.moves || []).slice(-180));
      }

      tx.set(matchRef, {
        matchId,
        playedAt: record.playedAt,
        opponentMode: record.opponentMode,
        ruleMode: record.ruleMode,
        opponentLabel: record.opponentLabel.slice(0, 64),
        myColor: record.myColor as PieceColor | 'spectator',
        winner: record.winner,
        resultMessage: record.resultMessage.slice(0, 160),
        ratingCategory: shouldApplyRanked ? category : 'none',
        ratingDelta: appliedDelta,
        materialDiff: Math.max(0, Math.min(150, Math.round(record.materialDiff || 0))),
        plyCount: Math.max(0, Math.min(2000, record.moves.length)),
        movesJson,
        createdAt: serverTimestamp(),
      });

      const createdFreshLb = !lbSnap.exists();
      if (createdFreshLb) {
        tx.set(lbRef, {
          uid,
          displayName,
          photoURL,
          ratingEpoch: CURRENT_RATING_EPOCH,
          skillRating: INITIAL_RATING,
          skillWins: 0,
          skillLosses: 0,
          skillDraws: 0,
          classicRating: INITIAL_RATING,
          classicWins: 0,
          classicLosses: 0,
          classicDraws: 0,
          updatedAt: serverTimestamp(),
        });
      } else if (shouldApplyRanked || needsEpochReset) {
        tx.update(lbRef, {
          displayName,
          photoURL,
          ratingEpoch: CURRENT_RATING_EPOCH,
          skillRating: nextStats.skillRating,
          skillWins: nextStats.skillWins,
          skillLosses: nextStats.skillLosses,
          skillDraws: nextStats.skillDraws,
          classicRating: nextStats.classicRating,
          classicWins: nextStats.classicWins,
          classicLosses: nextStats.classicLosses,
          classicDraws: nextStats.classicDraws,
          updatedAt: serverTimestamp(),
        });
      }

      return {
        updatedStats: nextStats,
        committedDelta: appliedDelta,
        needsInitialLeaderboardUpdate: createdFreshLb && shouldApplyRanked,
      };
    });

    if (result.needsInitialLeaderboardUpdate) {
      const lbRef = doc(db, 'leaderboardUsers', uid);
      await updateDoc(lbRef, {
        displayName,
        photoURL,
        ratingEpoch: CURRENT_RATING_EPOCH,
        skillRating: result.updatedStats.skillRating,
        skillWins: result.updatedStats.skillWins,
        skillLosses: result.updatedStats.skillLosses,
        skillDraws: result.updatedStats.skillDraws,
        classicRating: result.updatedStats.classicRating,
        classicWins: result.updatedStats.classicWins,
        classicLosses: result.updatedStats.classicLosses,
        classicDraws: result.updatedStats.classicDraws,
        updatedAt: serverTimestamp(),
      });
    }

    return { updatedStats: result.updatedStats, committedDelta: result.committedDelta };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, matchPath);
  }
}
