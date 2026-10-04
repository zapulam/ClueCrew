# ClueCrew

A modern, interactive web implementation of the popular word association game CodeNames, built with React, Tailwind CSS, and Framer Motion.

Play for free [here](https://zapulam.github.io/ClueCrew).

![CodeNames Game](https://img.shields.io/badge/React-19.0.0-blue) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0.6-38B2AC) ![Framer Motion](https://img.shields.io/badge/Framer_Motion-12.4.1-purple)

## 🎮 Game Overview

CodeNames is a team-based word association game where players work together to identify their team's words while avoiding the opponent's words and the deadly assassin. This digital version features a sleek, modern interface with smooth animations and intuitive controls.

## ✨ Features

- **🎯 Dual View Modes**: Toggle between Player View (sees only revealed cards) and Codemaster View (sees all card roles)
- **📲 Codemaster Phones**: Codemasters scan a QR code, see their words on their own phone, and tap guesses to reveal them on the big screen
- **🔁 Turns**: Always shows whose turn it is, with an End Turn button
- **🎉 Reveal Animations**: Confetti for a correct guess, and distinct animations for the other team's word, a free word, and the assassin
- **🎨 Modern UI**: Dark theme with smooth animations and responsive design
- **📱 Responsive Design**: Works seamlessly on desktop and mobile devices
- **🎲 Dynamic Game Generation**: Random word selection from a curated word list
- **⚡ Real-time Updates**: Instant feedback and game state management
- **🎪 Smooth Animations**: Polished transitions using Framer Motion
- **🎯 Win Detection**: Automatic win condition checking with themed popups
- **🔄 Collapsible Sidebar**: Space-efficient navigation with smooth animations

## 🚀 Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ClueCrew
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173` (or the port shown in your terminal)

### Building for Production

```bash
npm run build
npm run preview
```

## 🎯 How to Play

### Game Setup
- The game uses 25 words arranged in a 5x5 grid
- Words are randomly assigned roles: 9 Red Team, 8 Blue Team, 7 Neutral, 1 Assassin
- Red team goes first

### Team Roles
- **Red Team**: 9 words to find
- **Blue Team**: 8 words to find  
- **Neutral**: 7 words (safe to guess, but don't help either team)
- **Assassin**: 1 word (instant loss if revealed)

### Gameplay
1. **Codemaster View**: One player can toggle to see all card roles
2. **Player View**: Other players see only revealed cards
3. **Take Turns**: Click cards to reveal them
4. **Win Condition**: First team to find all their words wins
5. **Lose Condition**: Revealing the assassin causes instant loss

### Controls
- **New Game**: Start a fresh game (with confirmation if game is in progress)
- **End Turn**: Stop guessing and pass the turn to the other team
- **Toggle View**: Switch between Player and Codemaster modes
- **Codemaster Phones**: Show the QR code for codemasters to scan
- **Collapse Sidebar**: Minimize the sidebar for more game space
- **Help**: Access game rules and instructions

## 📲 Codemaster Phones

Instead of peeking at the shared screen, each team's codemaster can use their own phone:

1. On the big screen, click **Connect codemaster phones** (on the start screen or the phone button in the header). A QR code and a 6-letter room code appear.
2. Each codemaster scans the QR code (or opens the site and types the code) and picks their team.
3. The phone lists every word grouped by color: your team first, then the other team, Free, and Assassin.
4. When your team guesses a word out loud, tap it and confirm. The big screen reveals the card and plays the animation. Taps only count on your team's turn, and **End turn** passes the turn.

The popup closes itself once both codemasters have joined, so guessers can't scan it. **New code** disconnects everyone and shows a fresh code. New games reuse the same room, so nobody needs to rescan between games.

### How it works

The site stays a static GitHub Pages app. Phones and the big screen talk through a [Firebase Realtime Database](https://firebase.google.com/docs/database) (free Spark plan) that the browser calls directly. The big screen is the only one that changes the board: phones send small requests (reveal a word, end the turn) that the big screen checks against the rules and applies.

Firebase is only downloaded once someone clicks **Connect codemaster phones**. While `src/lib/firebaseConfig.js` is empty, the phone feature is hidden and the game works as a single-screen app.

### One-time Firebase setup

1. Go to the [Firebase console](https://console.firebase.google.com) and **Create a project**. Google Analytics isn't needed.
2. Open **Build → Realtime Database → Create Database**, pick a location, and choose **Start in locked mode**.
3. In the **Rules** tab, replace everything with the contents of [`database.rules.json`](database.rules.json) and click **Publish**.
4. Copy the **database URL** (top of the Data tab) and the **project ID** (Project settings → General) into `src/lib/firebaseConfig.js`.
5. Build and deploy as usual.

These two values are public identifiers, not secrets: the rules decide what anyone can read or write. They keep the database root private, so rooms can't be listed, and they only accept valid room codes and well-formed requests. Anyone holding a room's code can see that game's key, which is why the QR code shouldn't be left on screen.

The free plan allows 100 simultaneous connections (about 33 games at once) and 1 GB of storage. Each room takes about 2 KB.

### Testing locally with the Firebase emulator

You don't need a Firebase project to try the phone feature locally:

```bash
npx firebase-tools emulators:start --only database --project demo-codenames   # needs Java
VITE_FIREBASE_EMULATOR=9000 npm run dev -- --host
```

Open the board at the **Network** address Vite prints (not `localhost`), then scan the QR code with a phone on the same Wi-Fi. The phone then reaches both the page and the emulator through your computer's address. You can also put `VITE_FIREBASE_EMULATOR=9000` in `.env.development.local` instead of the command line. The emulator setting is ignored in production builds.

## 🔧 Development

### Available Scripts
- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run preview`: Preview production build
- `npm run lint`: Run ESLint

## Deployment
- `npm install`: Install dependencies (run again after pulling changes that add packages)
- `npm run build`: Build for production
- `npm run deploy`: Deploy to Github pages

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

If you encounter any issues or have questions, please open an issue on the GitHub repository.

---

**Enjoy playing ClueCrew! 🎉**
