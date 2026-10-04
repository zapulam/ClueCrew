// Pure game rules, shared by the big screen, the phone relay, and tests.
// No React or Vite imports, so plain Node can load this file.

export const TEAMS = ['green', 'blue'];
export const TOTALS = { green: 9, blue: 8, neutral: 7, assassin: 1 };
export const BOARD_SIZE = 25;

export const otherTeam = (team) => (team === 'green' ? 'blue' : 'green');

export function parseWordList(raw) {
  const seen = new Set();
  return raw
    .split('\n')
    .map((word) => word.trim())
    .filter((word) => word.length > 0 && !seen.has(word) && seen.add(word));
}

function shuffle(items, rng) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createGame(wordPool, rng = Math.random) {
  if (wordPool.length < BOARD_SIZE) {
    throw new Error(`Need at least ${BOARD_SIZE} words, got ${wordPool.length}`);
  }
  const roles = [
    ...Array(TOTALS.green).fill('green'),
    ...Array(TOTALS.blue).fill('blue'),
    ...Array(TOTALS.neutral).fill('neutral'),
    'assassin',
  ];
  return {
    gameId: Date.now().toString(36) + Math.floor(rng() * 1e9).toString(36),
    words: shuffle(wordPool, rng).slice(0, BOARD_SIZE),
    roles: shuffle(roles, rng),
    revealed: Array(BOARD_SIZE).fill(false),
    turn: 'green',
    winner: null,
    endReason: null,
    seq: 0,
    lastEvent: null,
  };
}

export function getCounts(game) {
  const counts = { green: 0, blue: 0, neutral: 0 };
  if (!game) return counts;
  game.roles.forEach((role, i) => {
    if (game.revealed[i] && role in counts) counts[role]++;
  });
  return counts;
}

// 'correct' | 'opponent' | 'free' | 'assassin', from the guessing team's point of view.
export function outcomeFor(role, team) {
  if (role === team) return 'correct';
  if (role === 'assassin') return 'assassin';
  if (role === 'neutral') return 'free';
  return 'opponent';
}

// Phone actions carry their team and gameId and only count on that team's turn.
// Host actions carry neither and act for whoever's turn it is.
function canAct(game, action) {
  if (!game || game.winner) return false;
  if (action.gameId !== undefined && action.gameId !== game.gameId) return false;
  if (action.team !== undefined && action.team !== game.turn) return false;
  return true;
}

function reveal(game, action) {
  const { index } = action;
  if (!canAct(game, action)) return game;
  if (!Number.isInteger(index) || index < 0 || index >= BOARD_SIZE || game.revealed[index]) return game;

  const team = game.turn;
  const role = game.roles[index];
  const revealed = game.revealed.map((isRevealed, i) => isRevealed || i === index);

  let winner = null;
  let endReason = null;
  if (role === 'assassin') {
    winner = otherTeam(team);
    endReason = 'assassin';
  } else {
    const counts = getCounts({ roles: game.roles, revealed });
    if (counts.green === TOTALS.green) winner = 'green';
    else if (counts.blue === TOTALS.blue) winner = 'blue';
    if (winner) endReason = 'allFound';
  }

  const seq = game.seq + 1;
  return {
    ...game,
    revealed,
    turn: winner || role === team ? team : otherTeam(team),
    winner,
    endReason,
    seq,
    lastEvent: {
      seq,
      type: 'reveal',
      index,
      role,
      team,
      outcome: outcomeFor(role, team),
      source: action.source ?? 'host',
    },
  };
}

function endTurn(game, action) {
  if (!canAct(game, action)) return game;
  const seq = game.seq + 1;
  return {
    ...game,
    turn: otherTeam(game.turn),
    seq,
    lastEvent: {
      seq,
      type: 'endTurn',
      index: null,
      role: null,
      team: game.turn,
      outcome: null,
      source: action.source ?? 'host',
    },
  };
}

// Rejected actions return the same object, so nothing re-renders or re-syncs.
export function gameReducer(game, action) {
  switch (action.type) {
    case 'newGame':
      return action.game;
    case 'clear':
      return null;
    case 'reveal':
      return reveal(game, action);
    case 'endTurn':
      return endTurn(game, action);
    default:
      return game;
  }
}

// Turns a request pushed by a phone into a reducer action, or null if malformed.
export function sanitizeRequest(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { type, team, gameId, index } = raw;
  if (!TEAMS.includes(team) || typeof gameId !== 'string') return null;
  if (type === 'endTurn') return { type, team, gameId, source: 'phone' };
  if (type === 'reveal' && Number.isInteger(index) && index >= 0 && index < BOARD_SIZE) {
    return { type, team, gameId, index, source: 'phone' };
  }
  return null;
}

// Realtime Database rejects `undefined`, and drops nulls and empty arrays,
// so games are normalised on the way in and out.
export function toWire(game) {
  if (!game) return null;
  const event = game.lastEvent;
  return {
    gameId: game.gameId,
    words: game.words,
    roles: game.roles,
    revealed: game.revealed,
    turn: game.turn,
    winner: game.winner ?? null,
    endReason: game.endReason ?? null,
    seq: game.seq,
    lastEvent: event
      ? {
          seq: event.seq,
          type: event.type,
          index: event.index ?? null,
          role: event.role ?? null,
          team: event.team,
          outcome: event.outcome ?? null,
          source: event.source ?? 'host',
        }
      : null,
  };
}

export function fromWire(value) {
  if (!value || typeof value !== 'object' || typeof value.gameId !== 'string') return null;
  const list = (source, fallback) =>
    Array.from({ length: BOARD_SIZE }, (_, i) => (source && source[i] !== undefined ? source[i] : fallback));
  const event = value.lastEvent;
  return {
    gameId: value.gameId,
    words: list(value.words, ''),
    roles: list(value.roles, 'neutral'),
    revealed: list(value.revealed, false).map(Boolean),
    turn: value.turn === 'blue' ? 'blue' : 'green',
    winner: TEAMS.includes(value.winner) ? value.winner : null,
    endReason: value.endReason === 'assassin' || value.endReason === 'allFound' ? value.endReason : null,
    seq: Number(value.seq) || 0,
    lastEvent:
      event && typeof event === 'object'
        ? {
            seq: Number(event.seq) || 0,
            type: event.type === 'endTurn' ? 'endTurn' : 'reveal',
            index: Number.isInteger(event.index) ? event.index : null,
            role: event.role ?? null,
            team: TEAMS.includes(event.team) ? event.team : null,
            outcome: event.outcome ?? null,
            source: event.source ?? 'host',
          }
        : null,
  };
}
