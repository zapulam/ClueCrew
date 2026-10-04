// Public identifiers for the Firebase Realtime Database that relays codemaster
// phone taps. They are not secrets: database.rules.json controls access.
// While they are empty, the codemaster phone feature stays hidden.
export const firebaseConfig = {
  projectId: "",
  databaseURL: "",
};

// Local testing against the Firebase emulator: set VITE_FIREBASE_EMULATOR=127.0.0.1:9000
// (for example in .env.development.local) and run `npm run dev`.
const emulator = import.meta.env.DEV ? import.meta.env.VITE_FIREBASE_EMULATOR : "";
export const emulatorHost = emulator || null;

export const activeFirebaseConfig = emulatorHost
  ? { projectId: "demo-codenames", databaseURL: "https://demo-codenames-default-rtdb.firebaseio.com" }
  : firebaseConfig;

export const relayConfigured = Boolean(activeFirebaseConfig.projectId && activeFirebaseConfig.databaseURL);
