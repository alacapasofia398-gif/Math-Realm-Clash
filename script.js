// --- 0. CUSTOM GAME TITLE ---
// Change this string to rename the game anytime!
const GAME_TITLE = "👑 Math Realm Clash 👑";

// Automatically apply the title to the page DOM
document.getElementById('page-title').textContent = GAME_TITLE;
document.getElementById('game-title-header').textContent = GAME_TITLE.replace(/👑/g, '').trim();

// --- 1. FIREBASE CONFIGURATION ---
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBq9SQSPCxmnbYLay2lOWESY96NVYWym8k",
  authDomain: "math-real-clash.firebaseapp.com",
  projectId: "math-real-clash",
  storageBucket: "math-real-clash.firebasestorage.app",
  messagingSenderId: "325329128875",
  appId: "1:325329128875:web:a753cb71f7ed8ef0f0d6ee",
  measurementId: "G-57LGMVFB0H"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- 2. GAME STATE & RANKS ---
const RANKS = [
  { name: "Beginner", minPoints: 0 },
  { name: "Apprentice", minPoints: 30 },
  { name: "Skilled", minPoints: 80 },
  { name: "Expert", minPoints: 150 },
  { name: "Master", minPoints: 250 }
];

let roomId = "";
let playerId = "";
let playerName = "";
let currentQuestion = { num1: 1, num2: 1, answer: 1 };
let playerPoints = 0;
let currentRankIndex = 0;
let streak = 0;
let accessories = { crown: true, tiara: false, necklace: false, earrings: false, wand: false };

// --- 3. DOM ELEMENTS ---
const lobbyOverlay = document.getElementById('lobby-overlay');
const lobbyForm = document.getElementById('lobby-form');
const playerNameInput = document.getElementById('player-name');
const roomCodeInput = document.getElementById('room-code');

const displayRoomCode = document.getElementById('display-room-code');
const displayTimer = document.getElementById('display-timer');
const announcementBanner = document.getElementById('announcement-banner');
const questionText = document.getElementById('question-text');

const answerForm = document.getElementById('answer-form');
const answerInput = document.getElementById('answer-input');
const leaderboardContainer = document.getElementById('leaderboard-container');

const eventOverlay = document.getElementById('event-overlay');
const eventTitle = document.getElementById('event-title');
const eventDesc = document.getElementById('event-desc');
const eventIcon = document.getElementById('event-icon');
const eventCloseBtn = document.getElementById('event-close-btn');

const resultsOverlay = document.getElementById('results-overlay');
const podiumContainer = document.getElementById('podium-container');

// --- 4. MULTIPLAYER JOIN / HOST LOGIC ---
lobbyForm.addEventListener('submit', (e) => {
  e.preventDefault();

  playerName = playerNameInput.value.trim();
  roomId = roomCodeInput.value.trim().toLowerCase();
  playerId = 'player_' + Math.random().toString(36).substr(2, 9);

  if (!playerName || !roomId) return;

  displayRoomCode.textContent = roomId.toUpperCase();

  const roomRef = db.ref('rooms/' + roomId);

  roomRef.once('value', (snapshot) => {
    const room = snapshot.val();

    if (!room) {
      // Host creates the new room
      roomRef.set({
        created: Date.now(),
        startTime: Date.now(),
        question: generateQuestion(),
        questionId: Date.now()
      });
    }

    // Register player
    const playersRef = db.ref(`rooms/${roomId}/players`);
    playersRef.once('value', (pSnap) => {
      if (pSnap.numChildren() >= 5) {
        alert("Room is full! Maximum 5 players allowed.");
        return;
      }

      const playerRef = db.ref(`rooms/${roomId}/players/${playerId}`);
      playerRef.set({
        name: playerName,
        score: 0,
        rank: RANKS[0].name
      });

      playerRef.onDisconnect().remove();

      lobbyOverlay.classList.add('hidden');
      attachMultiplayerListeners();
    });
  });
});

// --- 5. REAL-TIME LISTENERS ---
function attachMultiplayerListeners() {
  const roomRef = db.ref('rooms/' + roomId);

  // Sync Current Question
  roomRef.child('question').on('value', (snap) => {
    const q = snap.val();
    if (q) {
      currentQuestion = q;
      questionText.textContent = `${q.num1} × ${q.num2}`;
      answerInput.value = '';
      answerInput.focus();
    }
  });

  // Sync Leaderboard & Scores
  roomRef.child('players').on('value', (snap) => {
    const players = snap.val() || {};
    renderLeaderboard(players);
  });

  // Sync Announcement Feed
  roomRef.child('lastWinner').on('value', (snap) => {
    const winner = snap.val();
    if (winner) {
      announcementBanner.textContent = `✨ ${winner} got the question first! (+10 pts)`;
    }
  });

  // Sync Timer
  roomRef.child('startTime').on('value', (snap) => {
    const startTime = snap.val();
    startTimer(startTime);
  });
}

// --- 6. ANSWER SUBMISSION & SPEED BONUSES ---
answerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const val = parseInt(answerInput.value, 10);

  if (val === currentQuestion.answer) {
    streak++;
    const roomRef = db.ref('rooms/' + roomId);

    roomRef.transaction((room) => {
      if (room) {
        if (room.players && room.players[playerId]) {
          room.players[playerId].score = (room.players[playerId].score || 0) + 10;
          playerPoints = room.players[playerId].score;
        }
        room.lastWinner = playerName;
        room.question = generateQuestion();
        room.questionId = Date.now();
      }
      return room;
    });

    checkProgression();
  } else {
    streak = 0;
    announcementBanner.textContent = "❌ Incorrect answer! Try again.";
  }

  answerInput.value = '';
});

// --- 7. PROGRESSION & ACHIEVEMENTS ---
function checkProgression() {
  // Rank check
  if (currentRankIndex < RANKS.length - 1) {
    if (playerPoints >= RANKS[currentRankIndex + 1].minPoints) {
      currentRankIndex++;
      db.ref(`rooms/${roomId}/players/${playerId}/rank`).set(RANKS[currentRankIndex].name);
      triggerModal("RANK UP!", `You have reached ${RANKS[currentRankIndex].name}!`, "👑");
    }
  }

  // Achievement unlocks
  if (playerPoints >= 10) unlockAchievement('ach-1');
  if (streak >= 3) unlockAchievement('ach-2');
  if (playerPoints >= 50) unlockAchievement('ach-3');
  if (currentRankIndex >= 2) unlockAchievement('ach-4');
}

function unlockAchievement(id) {
  const el = document.getElementById(id);
  if (el && el.classList.contains('locked')) {
    el.classList.remove('locked');
    triggerModal("ACHIEVEMENT UNLOCKED!", el.textContent, "🎯");
  }
}

function triggerModal(title, desc, icon) {
  eventTitle.textContent = title;
  eventDesc.textContent = desc;
  eventIcon.textContent = icon;
  eventOverlay.classList.remove('hidden');
}

eventCloseBtn.addEventListener('click', () => {
  eventOverlay.classList.add('hidden');
  answerInput.focus();
});

// --- 8. HELPER FUNCTIONS & RENDERING ---
function generateQuestion() {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  return { num1, num2, answer: num1 * num2 };
}

function renderLeaderboard(playersObj) {
  leaderboardContainer.innerHTML = '';

  const sorted = Object.keys(playersObj)
    .map(id => ({ id, ...playersObj[id] }))
    .sort((a, b) => b.score - a.score);

  sorted.forEach((p, idx) => {
    const card = document.createElement('div');
    card.className = 'player-card';
    card.innerHTML = `
      <div class="player-meta">
        <strong>#${idx + 1} ${p.name}</strong>
        <span class="player-rank-tag">${p.rank || 'Beginner'}</span>
      </div>
      <span class="player-score">${p.score} pts</span>
    `;
    leaderboardContainer.appendChild(card);
  });
}

// Avatar Wardrobe Toggles
document.getElementById('wardrobe-grid').addEventListener('click', (e) => {
  if (e.target.classList.contains('acc-btn')) {
    const acc = e.target.getAttribute('data-acc');
    accessories[acc] = !accessories[acc];
    e.target.classList.toggle('active', accessories[acc]);

    const targetSvg = document.getElementById(`svg-${acc}`);
    if (targetSvg) {
      targetSvg.classList.toggle('hidden', !accessories[acc]);
    }
  }
});

// --- 9. 10-MINUTE TIMER & END CEREMONY ---
function startTimer(startTime) {
  const duration = 600; // 10 Minutes in seconds

  const interval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = Math.max(0, duration - elapsed);

    const mins = Math.floor(remaining / 60).toString().padStart(2, '0');
    const secs = (remaining % 60).toString().padStart(2, '0');
    displayTimer.textContent = `${mins}:${secs}`;

    if (remaining <= 0) {
      clearInterval(interval);
      showResults();
    }
  }, 1000);
}

function showResults() {
  db.ref(`rooms/${roomId}/players`).once('value', (snap) => {
    const players = snap.val() || {};
    const sorted = Object.keys(players)
      .map(id => ({ id, ...players[id] }))
      .sort((a, b) => b.score - a.score);

    podiumContainer.innerHTML = '';
    const medals = ['🥇 Gold Trophy', '🥈 Silver Trophy', '🥉 Bronze Trophy', '🎗️ Ribbon', '🎗️ Ribbon'];

    sorted.forEach((p, idx) => {
      const card = document.createElement('div');
      card.className = 'podium-card';
      card.innerHTML = `
        <div>
          <strong>${idx + 1}. ${p.name}</strong> (${p.rank || 'Beginner'})
        </div>
        <div>
          <span>${medals[idx] || '🎗️ Ribbon'}</span> - <b>${p.score} pts</b>
        </div>
      `;
      podiumContainer.appendChild(card);
    });

    resultsOverlay.classList.remove('hidden');
  });
}
