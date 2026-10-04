import { fromWire, toWire } from './game.js';

// Unambiguous characters only (no I, L, O, 0 or 1), so codes are easy to read off a screen.
export const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_LENGTH = 6;

// crypto.getRandomValues works on plain-http LAN addresses too, unlike crypto.randomUUID.
export function randomId(length = 12) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('');
}

export function generateRoomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_LENGTH));
  return Array.from(bytes, (b) => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join('');
}

export function normalizeRoomId(value) {
  const id = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return id.length === ROOM_LENGTH && [...id].every((c) => ROOM_ALPHABET.includes(c)) ? id : null;
}

export function buildJoinUrl(roomId) {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  url.searchParams.set('room', roomId);
  return url.toString();
}

const CLIENT_KEY = 'codenames.clientId';

export function getClientId() {
  try {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(CLIENT_KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

// The big screen keeps its game in sessionStorage so a refresh picks up where it left off.
const HOST_KEY = 'codenames.host';

export function loadHostSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(HOST_KEY) ?? 'null');
    return {
      roomId: normalizeRoomId(saved?.roomId),
      game: fromWire(saved?.game),
      phonesEnabled: saved?.phonesEnabled === true,
    };
  } catch {
    return { roomId: null, game: null, phonesEnabled: false };
  }
}

export function saveHostSession({ roomId, game, phonesEnabled }) {
  try {
    sessionStorage.setItem(HOST_KEY, JSON.stringify({ roomId, game: toWire(game), phonesEnabled }));
  } catch {
    // Storage unavailable (private mode): a refresh just starts fresh.
  }
}

const teamKey = (roomId) => `codenames.team.${roomId}`;

export function loadTeam(roomId) {
  try {
    const team = localStorage.getItem(teamKey(roomId));
    return team === 'green' || team === 'blue' ? team : null;
  } catch {
    return null;
  }
}

export function saveTeam(roomId, team) {
  try {
    if (team) localStorage.setItem(teamKey(roomId), team);
    else localStorage.removeItem(teamKey(roomId));
  } catch {
    // Storage unavailable: the phone asks for the team again after a reload.
  }
}
