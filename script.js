const {
  db, ref, set, update, onValue, get, push, serverTimestamp
} = window.FirebaseGame;

let roomCode = "";
let playerId = "";
let playerName = "";
let playerAvatar = "";
let gameData = null;
let timerInterval = null;
let localTimer = 0;

const roomPath = () => `crorepatiPartyRooms/${roomCode}`;
const roomRef = () => ref(db, roomPath());

const $ = (id) => document.getElementById(id);

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
}

function makeRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function makePlayerId() {
  return "p_" + Date.now() + "_" + Math.floor(Math.random() * 9999);
}

function getQuestions(category) {
  if (category === "mixed") {
    return Object.values(window.QUESTION_BANK).flat();
  }
  return window.QUESTION_BANK[category] || window.QUESTION_BANK.funny;
}

function randomQuestionIndex(category, used = []) {
  const list = getQuestions(category);
  if (used.length >= list.length) used = [];
  let index;
  do {
    index = Math.floor(Math.random() * list.length);
  } while (used.includes(index));
  return index;
}

function currentQuestion() {
  const list = getQuestions(gameData.settings.category);
  return list[gameData.currentQuestionIndex];
}

function playSound(id) {
  const audio = $(id);
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function safeMoney(level) {
  if (level >= 10) return window.MONEY_LADDER[9];
  if (level >= 5) return window.MONEY_LADDER[4];
  return "₹0";
}

function prizeForLevel(level) {
  if (level <= 0) return "₹0";
  return window.MONEY_LADDER[level - 1] || window.MONEY_LADDER.at(-1);
}

/* HOME */

$("createRoomBtn").onclick = async () => {
  const name = $("createNameInput").value.trim();
  const avatar = $("createAvatarSelect").value;

  if (!name) {
    $("homeMessage").textContent = "Enter your name macha.";
    return;
  }

  roomCode = makeRoomCode();
  playerId = makePlayerId();
  playerName = name;
  playerAvatar = avatar;

  await set(roomRef(), {
    host: playerId,
    status: "lobby",
    createdAt: serverTimestamp(),
    settings: {
      category: "mixed",
      timer: 30,
      mode: "classic"
    },
    turnIndex: 0,
    currentQuestionIndex: 0,
    usedQuestions: [],
    answered: false,
    selectedAnswer: -1,
    showCorrect: false,
    fastest: {
      active: false,
      answers: {},
      winner: ""
    },
    wheel: {
      active: false,
      result: ""
    },
    winner: "",
    chat: {},
    players: {
      [playerId]: newPlayer(name, avatar)
    }
  });

  enterRoom();
};

$("joinRoomBtn").onclick = async () => {
  const name = $("joinNameInput").value.trim();
  const avatar = $("joinAvatarSelect").value;
  const code = $("roomCodeInput").value.trim().toUpperCase();

  if (!name || !code) {
    $("homeMessage").textContent = "Enter name and room code.";
    return;
  }

  roomCode = code;
  playerId = makePlayerId();
  playerName = name;
  playerAvatar = avatar;

  const snap = await get(roomRef());
  if (!snap.exists()) {
    $("homeMessage").textContent = "Room not found.";
    return;
  }

  const room = snap.val();
  if (Object.keys(room.players || {}).length >= 3) {
    $("homeMessage").textContent = "Room is full.";
    return;
  }

  await update(ref(db, `${roomPath()}/players/${playerId}`), newPlayer(name, avatar));
  enterRoom();
};

function newPlayer(name, avatar) {
  return {
    name,
    avatar,
    level: 0,
    money: "₹0",
    wrong: 0,
    eliminated: false,
    lifelines: {
      fifty: false,
      audience: false,
      friend: false,
      ai: false,
      swap: false,
      skip: false
    },
    achievements: {},
    joinedAt: Date.now()
  };
}

function enterRoom() {
  $("roomCodeText").textContent = roomCode;
  showScreen("lobbyScreen");

  onValue(roomRef(), (snap) => {
    gameData = snap.val();
    if (!gameData) return;

    if (gameData.status === "lobby") renderLobby();
    if (gameData.status === "fastest") renderFastest();
    if (gameData.status === "playing") renderGame();
    if (gameData.status === "wheel") renderWheel();
    if (gameData.status === "final") renderFinal();
  });
}

/* LOBBY */

function renderLobby() {
  showScreen("lobbyScreen");

  const players = gameData.players || {};
  $("lobbyPlayers").innerHTML = Object.entries(players).map(([id, p]) => `
    <div class="player-card ${id === playerId ? "active" : ""}">
      <div class="player-avatar">${p.avatar}</div>
      <b>${p.name}</b>
      <p>${id === gameData.host ? "👑 Host" : "Player"}</p>
    </div>
  `).join("");

  $("startGameBtn").style.display = gameData.host === playerId ? "block" : "none";
  $("lobbyMessage").textContent = Object.keys(players).length === 3
    ? "Ready to start!"
    : "Waiting for 3 players...";
}

$("copyRoomBtn").onclick = async () => {
  await navigator.clipboard.writeText(roomCode);
  $("lobbyMessage").textContent = "Room code copied.";
};

$("startGameBtn").onclick = async () => {
  if (gameData.host !== playerId) return;

  const players = Object.keys(gameData.players || {});
  if (players.length !== 3) {
    $("lobbyMessage").textContent = "Need exactly 3 players.";
    return;
  }

  const category = $("categorySelect").value;
  const timer = Number($("timerSelect").value);
  const mode = $("modeSelect").value;

  const qIndex = randomQuestionIndex(category, []);

  await update(roomRef(), {
    status: "fastest",
    settings: { category, timer, mode },
    currentQuestionIndex: qIndex,
    usedQuestions: [qIndex],
    "fastest/active": true,
    "fastest/answers": {},
    "fastest/winner": "",
    fastestStartTime: Date.now()
  });
};

/* FASTEST FINGER */

function renderFastest() {
  showScreen("fastestScreen");

  const q = currentQuestion();
  $("fastestQuestion").textContent = q.question;

  const answered = gameData.fastest?.answers?.[playerId];

  $("fastestOptions").innerHTML = q.options.map((op, i) => `
    <button class="option-btn" ${answered ? "disabled" : ""} onclick="fastestAnswer(${i})">
      ${String.fromCharCode(65 + i)}. ${op}
    </button>
  `).join("");

  const answers = gameData.fastest?.answers || {};
  $("fastestStatus").innerHTML = Object.entries(gameData.players).map(([id, p]) => {
    const a = answers[id];
    return `
      <div class="status-item">
        ${p.avatar} <b>${p.name}</b> —
        ${a ? (a.correct ? "✅ Answered correct" : "❌ Wrong") : "⏳ Waiting"}
      </div>
    `;
  }).join("");

  if (gameData.host === playerId) fastestHostCheck();

  startDisplayTimer(10, gameData.fastestStartTime || Date.now(), $("fastestTimer"));
}

window.fastestAnswer = async (i) => {
  const q = currentQuestion();
  const correct = i === q.answer;

  await update(ref(db, `${roomPath()}/fastest/answers/${playerId}`), {
    answer: i,
    correct,
    time: Date.now()
  });
};

async function fastestHostCheck() {
  const answers = gameData.fastest?.answers || {};
  const ids = Object.keys(gameData.players);

  const correctAnswers = Object.entries(answers)
    .filter(([, a]) => a.correct)
    .sort((a, b) => a[1].time - b[1].time);

  const elapsed = Math.floor((Date.now() - (gameData.fastestStartTime || Date.now())) / 1000);

  if (correctAnswers.length > 0 || elapsed >= 10 || Object.keys(answers).length === ids.length) {
    let winnerId = correctAnswers[0]?.[0] || ids[0];
    const turnIndex = ids.indexOf(winnerId);

    setTimeout(async () => {
      const snap = await get(roomRef());
      const latest = snap.val();
      if (latest.status !== "fastest") return;

      const category = latest.settings.category;
      const used = latest.usedQuestions || [];
      const qIndex = randomQuestionIndex(category, used);

      await update(roomRef(), {
        status: "playing",
        turnIndex,
        currentQuestionIndex: qIndex,
        usedQuestions: [...used, qIndex],
        answered: false,
        selectedAnswer: -1,
        showCorrect: false,
        questionStartTime: Date.now()
      });
    }, 1200);
  }
}

/* GAME */

function renderGame() {
  showScreen("gameScreen");

  const ids = Object.keys(gameData.players);
  const currentId = ids[gameData.turnIndex % ids.length];
  const currentPlayer = gameData.players[currentId];
  const isMyTurn = currentId === playerId;
  const q = currentQuestion();

  $("currentTurnBadge").textContent = `${currentPlayer.avatar} ${currentPlayer.name}'s Turn`;
  $("questionNumberBadge").textContent = `Q${currentPlayer.level + 1}`;
  $("categoryBadge").textContent = gameData.settings.category.toUpperCase();
  $("questionText").textContent = q.question;

  $("hostText").textContent = gameData.answered
    ? "Computer ji, answer lock ho gaya!"
    : isMyTurn
      ? "Aap hot seat par hain. Soch samajh ke jawab dijiye!"
      : `${currentPlayer.name} is on the hot seat.`;

  $("optionsGrid").innerHTML = q.options.map((op, i) => {
    let cls = "option-btn";
    if (gameData.showCorrect && i === q.answer) cls += " correct";
    if (gameData.showCorrect && i === gameData.selectedAnswer && i !== q.answer) cls += " wrong";

    return `
      <button class="${cls}" ${!isMyTurn || gameData.answered ? "disabled" : ""} onclick="submitAnswer(${i})">
        ${String.fromCharCode(65 + i)}. ${op}
      </button>
    `;
  }).join("");

  renderScoreboard();
  renderMoneyLadder(currentPlayer.level);
  renderChat();
  renderLifelines(isMyTurn, currentPlayer);

  startDisplayTimer(gameData.settings.timer, gameData.questionStartTime || Date.now(), $("gameTimer"));

  if (isMyTurn && !gameData.answered) {
    startTurnTimer();
  } else {
    clearInterval(timerInterval);
  }
}

function renderScoreboard() {
  $("scoreBoard").innerHTML = Object.entries(gameData.players).map(([id, p]) => `
    <div class="player-card ${id === playerId ? "active" : ""}">
      <div class="player-avatar">${p.avatar}</div>
      <b>${p.name}</b>
      <div class="player-money">${p.money}</div>
      <small>Level ${p.level}/14 • Wrong ${p.wrong}/2</small>
      ${p.eliminated ? "<p>❌ Eliminated</p>" : ""}
    </div>
  `).join("");
}

function renderMoneyLadder(level) {
  $("moneyLadder").innerHTML = window.MONEY_LADDER.map((m, i) => `
    <div class="money-step ${i === level ? "current" : ""} ${i === 4 || i === 9 ? "safe" : ""}">
      <span>Q${i + 1}</span>
      <b>${m}</b>
    </div>
  `).reverse().join("");
}

function renderLifelines(isMyTurn, p) {
  const l = p.lifelines || {};
  const buttons = [
    ["fiftyBtn", l.fifty],
    ["audienceBtn", l.audience],
    ["friendBtn", l.friend],
    ["aiBtn", l.ai],
    ["swapBtn", l.swap],
    ["skipBtn", l.skip]
  ];

  buttons.forEach(([id, used]) => {
    $(id).disabled = !isMyTurn || gameData.answered || used;
  });
}

function startDisplayTimer(seconds, startTime, element) {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const left = Math.max(0, seconds - elapsed);
  element.textContent = left;
}

function startTurnTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(async () => {
    if (!gameData || gameData.answered || gameData.status !== "playing") return;

    const elapsed = Math.floor((Date.now() - gameData.questionStartTime) / 1000);
    const left = gameData.settings.timer - elapsed;
    $("gameTimer").textContent = Math.max(0, left);

    if (left <= 0) {
      clearInterval(timerInterval);
      await submitAnswer(-1);
    }
  }, 500);
}

window.submitAnswer = async (i) => {
  if (gameData.answered) return;

  const ids = Object.keys(gameData.players);
  const currentId = ids[gameData.turnIndex % ids.length];

  if (currentId !== playerId) return;

  const q = currentQuestion();
  const correct = i === q.answer;

  await update(roomRef(), {
    answered: true,
    selectedAnswer: i,
    showCorrect: true
  });

  if (correct) {
    playSound("soundCorrect");
    const p = gameData.players[playerId];
    const newLevel = p.level + 1;
    const newMoney = prizeForLevel(newLevel);

    await update(ref(db, `${roomPath()}/players/${playerId}`), {
      level: newLevel,
      money: newMoney
    });
  } else {
    playSound("soundWrong");
    const p = gameData.players[playerId];
    const wrong = (p.wrong || 0) + 1;
    const eliminated = wrong >= 2;

    await update(ref(db, `${roomPath()}/players/${playerId}`), {
      wrong,
      eliminated,
      money: eliminated ? safeMoney(p.level) : p.money
    });
  }

  setTimeout(() => hostNextTurn(), 1800);
};

async function hostNextTurn() {
  const snap = await get(roomRef());
  const latest = snap.val();
  if (!latest || latest.status !== "playing") return;

  const ids = Object.keys(latest.players);
  const alive = ids.filter(id => !latest.players[id].eliminated && latest.players[id].level < 14);

  if (alive.length <= 1) {
    await finishGame(latest);
    return;
  }

  const currentId = ids[latest.turnIndex % ids.length];
  const currentLevel = latest.players[currentId].level;

  if (currentLevel > 0 && currentLevel % 5 === 0) {
    await update(roomRef(), {
      status: "wheel",
      "wheel/active": true,
      "wheel/result": "",
      wheelPlayer: currentId
    });
    return;
  }

  let nextIndex = latest.turnIndex;
  do {
    nextIndex = (nextIndex + 1) % ids.length;
  } while (latest.players[ids[nextIndex]].eliminated);

  const category = latest.settings.category;
  const used = latest.usedQuestions || [];
  const qIndex = randomQuestionIndex(category, used);

  await update(roomRef(), {
    turnIndex: nextIndex,
    currentQuestionIndex: qIndex,
    usedQuestions: [...used, qIndex],
    answered: false,
    selectedAnswer: -1,
    showCorrect: false,
    questionStartTime: Date.now()
  });
}

/* LIFELINES */

$("fiftyBtn").onclick = async () => {
  await markLifeline("fifty");

  const q = currentQuestion();
  const wrongs = [0,1,2,3].filter(i => i !== q.answer).sort(() => Math.random() - 0.5).slice(0, 2);

  $("lifelineResultCard").classList.remove("hidden");
  $("lifelineTitle").textContent = "50:50 ✂️";
  $("lifelineResult").innerHTML = `Remove options: <b>${wrongs.map(i => String.fromCharCode(65+i)).join(", ")}</b>`;
};

$("audienceBtn").onclick = async () => {
  await markLifeline("audience");

  const q = currentQuestion();
  let correctPercent = Math.floor(Math.random() * 25) + 55;
  let rest = 100 - correctPercent;
  let poll = [0,0,0,0];
  poll[q.answer] = correctPercent;

  [0,1,2,3].filter(i => i !== q.answer).forEach((i, idx, arr) => {
    if (idx === arr.length - 1) poll[i] = rest;
    else {
      const val = Math.floor(Math.random() * rest);
      poll[i] = val;
      rest -= val;
    }
  });

  $("lifelineResultCard").classList.remove("hidden");
  $("lifelineTitle").textContent = "Audience Poll 👥";
  $("lifelineResult").innerHTML = poll.map((p, i) => `
    <div class="poll-row">
      <div class="poll-label"><span>${String.fromCharCode(65+i)}</span><span>${p}%</span></div>
      <div class="poll-bar"><div class="poll-fill" style="width:${p}%"></div></div>
    </div>
  `).join("");
};

$("friendBtn").onclick = async () => {
  await markLifeline("friend");
  const q = currentQuestion();
  const lines = [
    "Bro, I am 90% sure it is",
    "Macha trust me, answer is",
    "I don't know fully, but my heart says",
    "I asked my brain. Brain says"
  ];

  $("lifelineResultCard").classList.remove("hidden");
  $("lifelineTitle").textContent = "Call Friend ☎️";
  $("lifelineResult").innerHTML = `${lines[Math.floor(Math.random()*lines.length)]} <b>${String.fromCharCode(65+q.answer)}</b>`;
};

$("aiBtn").onclick = async () => {
  await markLifeline("ai");
  const q = currentQuestion();
  const suggestion = Math.random() < 0.8 ? q.answer : Math.floor(Math.random()*4);

  $("lifelineResultCard").classList.remove("hidden");
  $("lifelineTitle").textContent = "AI Friend 🤖";
  $("lifelineResult").innerHTML = `AI suggests option <b>${String.fromCharCode(65+suggestion)}</b>`;
};

$("swapBtn").onclick = async () => {
  await markLifeline("swap");
  const category = gameData.settings.category;
  const used = gameData.usedQuestions || [];
  const qIndex = randomQuestionIndex(category, used);

  await update(roomRef(), {
    currentQuestionIndex: qIndex,
    usedQuestions: [...used, qIndex],
    questionStartTime: Date.now(),
    answered: false,
    selectedAnswer: -1,
    showCorrect: false
  });
};

$("skipBtn").onclick = async () => {
  await markLifeline("skip");
  await hostNextTurn();
};

async function markLifeline(name) {
  playSound("soundLifeline");
  await update(ref(db, `${roomPath()}/players/${playerId}/lifelines`), {
    ...gameData.players[playerId].lifelines,
    [name]: true
  });
}

/* WHEEL */

function renderWheel() {
  showScreen("wheelScreen");

  const wheelPlayer = gameData.players[gameData.wheelPlayer];
  $("wheelResult").textContent = gameData.wheel.result
    ? gameData.wheel.result
    : `${wheelPlayer.name}, spin the lucky wheel!`;

  $("spinWheelBtn").style.display = gameData.wheelPlayer === playerId ? "block" : "none";
}

$("spinWheelBtn").onclick = async () => {
  const rewards = [
    "Extra protection 🛡️",
    "+₹50,000 bonus 💸",
    "Funny punishment cancelled 😂",
    "Double confidence 😎",
    "Lucky star ⭐"
  ];
  const result = rewards[Math.floor(Math.random() * rewards.length)];

  $("wheel").classList.add("spin");
  setTimeout(async () => {
    $("wheel").classList.remove("spin");

    await update(roomRef(), {
      "wheel/result": result
    });

    setTimeout(async () => {
      const snap = await get(roomRef());
      const latest = snap.val();
      if (latest.status !== "wheel") return;

      let ids = Object.keys(latest.players);
      let nextIndex = latest.turnIndex;
      do {
        nextIndex = (nextIndex + 1) % ids.length;
      } while (latest.players[ids[nextIndex]].eliminated);

      const category = latest.settings.category;
      const used = latest.usedQuestions || [];
      const qIndex = randomQuestionIndex(category, used);

      await update(roomRef(), {
        status: "playing",
        turnIndex: nextIndex,
        currentQuestionIndex: qIndex,
        usedQuestions: [...used, qIndex],
        answered: false,
        selectedAnswer: -1,
        showCorrect: false,
        questionStartTime: Date.now()
      });
    }, 1600);
  }, 1200);
};

/* CHAT */

$("sendChatBtn").onclick = sendChat;
$("chatInput").addEventListener("keydown", e => {
  if (e.key === "Enter") sendChat();
});

async function sendChat() {
  const msg = $("chatInput").value.trim();
  if (!msg) return;

  await push(ref(db, `${roomPath()}/chat`), {
    name: playerName,
    avatar: playerAvatar,
    text: msg,
    time: Date.now()
  });

  $("chatInput").value = "";
}

function renderChat() {
  const chat = gameData.chat || {};
  const messages = Object.values(chat).slice(-20);

  $("chatBox").innerHTML = messages.map(m => `
    <div class="chat-msg">${m.avatar} <b>${m.name}:</b> ${escapeHtml(m.text)}</div>
  `).join("");

  $("chatBox").scrollTop = $("chatBox").scrollHeight;
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

/* FINAL */

async function finishGame(latest) {
  const players = Object.values(latest.players);
  const sorted = players.sort((a, b) => {
    const ai = window.MONEY_LADDER.indexOf(a.money);
    const bi = window.MONEY_LADDER.indexOf(b.money);
    return bi - ai;
  });

  await update(roomRef(), {
    status: "final",
    winner: sorted[0].name
  });
}

function renderFinal() {
  showScreen("finalScreen");
  playSound("soundWin");

  const sorted = Object.values(gameData.players).sort((a,b) => {
    const ai = window.MONEY_LADDER.indexOf(a.money);
    const bi = window.MONEY_LADDER.indexOf(b.money);
    return bi - ai;
  });

  $("winnerBox").innerHTML = `
    <h2>🏆 Winner: ${sorted[0].avatar} ${sorted[0].name}</h2>
    <p class="player-money">${sorted[0].money}</p>
    <p>🥈 ${sorted[1].name}: ${sorted[1].money}</p>
    <p>🥉 ${sorted[2].name}: ${sorted[2].money}</p>
  `;

  $("achievementsBox").innerHTML = sorted.map((p, i) => `
    <div class="achievement">
      ${i === 0 ? "👑 Crorepati King" : i === 1 ? "🔥 Strong Player" : "😂 Party Player"}<br>
      <b>${p.name}</b>
    </div>
  `).join("");
}

$("playAgainBtn").onclick = () => location.reload();