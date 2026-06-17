const {
  db,
  ref,
  set,
  update,
  onValue,
  get,
  push,
  serverTimestamp
} = window.FirebaseGame;

let room = "";
let pid = "";
let pname = "";
let avatar = "";
let data = null;
let timerInt = null;

window.QUESTION_DATA = {};

const DATA_FILES = {
  riddles: "data/riddles.json",
  funny: "data/funny.json",
  love: "data/love.json",
  football: "data/football.json",
  gaming: "data/gaming.json",
  movies: "data/movies.json",
  food: "data/food.json",
  brainTeasers: "data/brain.json",
  currentAffairs: "data/current-affairs.json",
  upsc: "data/upsc.json",
  college: "data/college.json"
};

async function loadAllQuestionPacks() {
  for (const [category, file] of Object.entries(DATA_FILES)) {
    try {
      const res = await fetch(file);
      if (!res.ok) throw new Error(file + " not found");
      const questions = await res.json();
      window.QUESTION_DATA[category] = questions;
      console.log(category, "loaded:", questions.length);
    } catch (err) {
      console.warn("Could not load:", file);
      window.QUESTION_DATA[category] = [];
    }
  }
}

loadAllQuestionPacks();

const $ = id => document.getElementById(id);

const path = () => `pookieCrorepatiRooms/${room}`;
const roomRef = () => ref(db, path());

function show(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
}

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function makePlayerId() {
  return "p_" + Date.now() + "_" + Math.floor(Math.random() * 9999);
}

function allQuestions(category) {
  if (category === "mixed") {
    const fromData = Object.values(window.QUESTION_DATA || {}).flat();
    const fromOld = window.QUESTION_BANK
      ? Object.values(window.QUESTION_BANK).flat()
      : [];
    return [...fromData, ...fromOld];
  }

  const dataQuestions = window.QUESTION_DATA?.[category] || [];
  if (dataQuestions.length > 0) return dataQuestions;

  return window.QUESTION_BANK?.[category] || window.QUESTION_BANK?.funny || [];
}

function pickQuestion(category, used = []) {
  const list = allQuestions(category);
  if (!list.length) return 0;

  const unused = list
    .map((_, i) => i)
    .filter(i => !used.includes(i));

  if (unused.length === 0) {
    return Math.floor(Math.random() * list.length);
  }

  return unused[Math.floor(Math.random() * unused.length)];
}

function currentQuestion() {
  const list = allQuestions(data.settings.category);
  return list[data.qIndex] || list[0];
}

function prize(level) {
  if (level <= 0) return "₹0";
  return window.MONEY_LADDER[level - 1] || window.MONEY_LADDER.at(-1);
}

function safeMoney(level) {
  if (level >= 10) return window.MONEY_LADDER[9];
  if (level >= 5) return window.MONEY_LADDER[4];
  return "₹0";
}

function newPlayer(name, av) {
  return {
    name,
    avatar: av,
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
    joinedAt: Date.now()
  };
}

/* CREATE ROOM */

$("createBtn").onclick = async () => {
  pname = $("createName").value.trim();
  avatar = $("createAvatar").value;

  if (!pname) {
    $("homeMsg").textContent = "Enter your name macha";
    return;
  }

  room = makeCode();
  pid = makePlayerId();

  const category = $("category").value;
  const maxPlayers = Number($("playerMode").value);

  const qIndex = pickQuestion(category, []);

  await set(roomRef(), {
    host: pid,
    status: "lobby",
    maxPlayers,
    settings: {
      category,
      timer: 30
    },
    turn: 0,
    qIndex,
    used: [qIndex],
    answered: false,
    selected: -1,
    showCorrect: false,
    winner: "",
    chat: {},
    players: {
      [pid]: newPlayer(pname, avatar)
    },
    createdAt: serverTimestamp()
  });

  enterRoom();
};

/* JOIN ROOM */

$("joinBtn").onclick = async () => {
  pname = $("joinName").value.trim();
  avatar = $("joinAvatar").value;
  room = $("joinCode").value.trim().toUpperCase();

  if (!pname || !room) {
    $("homeMsg").textContent = "Enter name and room code";
    return;
  }

  const snap = await get(roomRef());

  if (!snap.exists()) {
    $("homeMsg").textContent = "Room not found";
    return;
  }

  const d = snap.val();
  const count = Object.keys(d.players || {}).length;

  if (count >= d.maxPlayers) {
    $("homeMsg").textContent = "Room full";
    return;
  }

  pid = makePlayerId();

  await update(ref(db, `${path()}/players/${pid}`), newPlayer(pname, avatar));

  enterRoom();
};

function enterRoom() {
  $("roomCode").textContent = room;
  show("lobbyScreen");

  onValue(roomRef(), snap => {
    data = snap.val();
    if (!data) return;

    if (data.status === "lobby") renderLobby();
    if (data.status === "playing") renderGame();
    if (data.status === "final") renderFinal();
  });
}

/* LOBBY */

function renderLobby() {
  show("lobbyScreen");

  const players = data.players || {};
  const count = Object.keys(players).length;

  $("modeText").textContent =
    `Mode: ${data.maxPlayers} players • Category: ${data.settings.category}`;

  $("lobbyPlayers").innerHTML = Object.entries(players).map(([id, p]) => `
    <div class="player ${id === pid ? "active" : ""}">
      <div class="avatar">${p.avatar}</div>
      <b>${p.name}</b>
      <p>${id === data.host ? "👑 Host" : "Player"}</p>
    </div>
  `).join("");

  $("startBtn").style.display = data.host === pid ? "block" : "none";

  $("lobbyMsg").textContent =
    count === data.maxPlayers
      ? "Ready pookie!"
      : `Need ${data.maxPlayers} players`;
}

$("copyBtn").onclick = async () => {
  await navigator.clipboard.writeText(room);
  $("lobbyMsg").textContent = "Room code copied";
};

$("startBtn").onclick = async () => {
  if (data.host !== pid) return;

  const count = Object.keys(data.players || {}).length;

  if (count !== data.maxPlayers) {
    $("lobbyMsg").textContent = `Need ${data.maxPlayers} players`;
    return;
  }

  const qIndex = pickQuestion(data.settings.category, []);

  await update(roomRef(), {
    status: "playing",
    turn: 0,
    qIndex,
    used: [qIndex],
    answered: false,
    selected: -1,
    showCorrect: false,
    questionStart: Date.now()
  });
};

/* GAME */

function renderGame() {
  show("gameScreen");

  const ids = Object.keys(data.players);
  const currentId = ids[data.turn % ids.length];
  const player = data.players[currentId];
  const isMyTurn = currentId === pid;
  const q = currentQuestion();

  $("turnBadge").textContent = `${player.avatar} ${player.name}'s Turn`;
  $("qBadge").textContent = `Q${player.level + 1}`;
  $("catBadge").textContent = data.settings.category;

  $("questionText").textContent = q.question;

  $("hostText").textContent = data.answered
    ? "Answer locked!"
    : isMyTurn
      ? "Your turn macha, choose carefully!"
      : `${player.name} is playing now`;

  renderOptions(q, isMyTurn);
  renderScoreboard(ids, currentId);
  renderLadder(player.level);
  renderLifelines(isMyTurn, player);
  renderChat();
  startTimer(isMyTurn);
}

function renderOptions(q, isMyTurn) {
  $("options").innerHTML = q.options.map((op, i) => {
    let cls = "opt";

    if (data.showCorrect && i === q.answer) cls += " correct";
    if (data.showCorrect && i === data.selected && i !== q.answer) cls += " wrong";

    return `
      <button class="${cls}" 
        ${!isMyTurn || data.answered ? "disabled" : ""}
        onclick="answerQuestion(${i})">
        ${String.fromCharCode(65 + i)}. ${op}
      </button>
    `;
  }).join("");
}

function renderScoreboard(ids, currentId) {
  $("scoreBoard").innerHTML = ids.map(id => {
    const p = data.players[id];

    return `
      <div class="scoreItem ${id === currentId ? "active" : ""}">
        <div class="avatar">${p.avatar}</div>
        <b>${p.name}</b>
        <div class="money">${p.money}</div>
        <small>Level ${p.level}/14 • Wrong ${p.wrong}/2</small>
        ${p.eliminated ? "<p>❌ Out</p>" : ""}
      </div>
    `;
  }).join("");
}

function renderLadder(level) {
  $("ladder").innerHTML = window.MONEY_LADDER.map((m, i) => `
    <div class="step ${i === level ? "now" : ""} ${i === 4 || i === 9 ? "safe" : ""}">
      <span>Q${i + 1}</span>
      <b>${m}</b>
    </div>
  `).reverse().join("");
}

function renderLifelines(isMyTurn, p) {
  ["fifty", "audience", "friend", "ai", "swap", "skip"].forEach(name => {
    $(name).disabled = !isMyTurn || data.answered || p.lifelines[name];
  });
}

function startTimer(active) {
  clearInterval(timerInt);

  function tick() {
    const elapsed = Math.floor((Date.now() - data.questionStart) / 1000);
    const left = Math.max(0, data.settings.timer - elapsed);
    $("timer").textContent = left;

    if (active && !data.answered && left <= 0) {
      clearInterval(timerInt);
      answerQuestion(-1);
    }
  }

  tick();
  timerInt = setInterval(tick, 500);
}

window.answerQuestion = async (choice) => {
  if (data.answered) return;

  const ids = Object.keys(data.players);
  const currentId = ids[data.turn % ids.length];

  if (currentId !== pid) return;

  const q = currentQuestion();
  const correct = choice === q.answer;
  const p = data.players[pid];

  await update(roomRef(), {
    answered: true,
    selected: choice,
    showCorrect: true
  });

  if (correct) {
    await update(ref(db, `${path()}/players/${pid}`), {
      level: p.level + 1,
      money: prize(p.level + 1)
    });
  } else {
    const wrong = p.wrong + 1;
    const eliminated = wrong >= 2;

    await update(ref(db, `${path()}/players/${pid}`), {
      wrong,
      eliminated,
      money: eliminated ? safeMoney(p.level) : p.money
    });
  }

  setTimeout(nextTurn, 1700);
};

async function nextTurn() {
  const snap = await get(roomRef());
  const latest = snap.val();

  if (!latest || latest.status !== "playing") return;

  const ids = Object.keys(latest.players);
  const alive = ids.filter(id =>
    !latest.players[id].eliminated &&
    latest.players[id].level < 14
  );

  if (alive.length <= 1) {
    finishGame(latest);
    return;
  }

  let next = latest.turn;

  do {
    next = (next + 1) % ids.length;
  } while (latest.players[ids[next]].eliminated);

  const qIndex = pickQuestion(
    latest.settings.category,
    latest.used || []
  );

  await update(roomRef(), {
    turn: next,
    qIndex,
    used: [...(latest.used || []), qIndex],
    answered: false,
    selected: -1,
    showCorrect: false,
    questionStart: Date.now()
  });
}

/* LIFELINES */

async function markLifeline(name) {
  const p = data.players[pid];

  await update(ref(db, `${path()}/players/${pid}/lifelines`), {
    ...p.lifelines,
    [name]: true
  });

  $("resultCard").classList.remove("hidden");
}

$("fifty").onclick = async () => {
  await markLifeline("fifty");

  const q = currentQuestion();
  const wrong = [0, 1, 2, 3]
    .filter(i => i !== q.answer)
    .sort(() => Math.random() - 0.5)
    .slice(0, 2);

  $("resultTitle").textContent = "50:50 ✂️";
  $("resultText").innerHTML =
    `Remove options: <b>${wrong.map(i => String.fromCharCode(65 + i)).join(", ")}</b>`;
};

$("audience").onclick = async () => {
  await markLifeline("audience");

  const q = currentQuestion();
  let poll = [0, 0, 0, 0];
  let correctPercent = Math.floor(Math.random() * 25) + 55;
  let rest = 100 - correctPercent;

  poll[q.answer] = correctPercent;

  [0, 1, 2, 3].filter(i => i !== q.answer).forEach((i, idx, arr) => {
    if (idx === arr.length - 1) poll[i] = rest;
    else {
      const val = Math.floor(Math.random() * rest);
      poll[i] = val;
      rest -= val;
    }
  });

  $("resultTitle").textContent = "Audience Poll 👥";

  $("resultText").innerHTML = poll.map((p, i) => `
    <div class="poll">
      <b>${String.fromCharCode(65 + i)} ${p}%</b>
      <div class="bar">
        <div class="fill" style="width:${p}%"></div>
      </div>
    </div>
  `).join("");
};

$("friend").onclick = async () => {
  await markLifeline("friend");

  const q = currentQuestion();

  $("resultTitle").textContent = "Call Pookie ☎️";
  $("resultText").innerHTML =
    `Pookie says: I think answer is <b>${String.fromCharCode(65 + q.answer)}</b> 💖`;
};

$("ai").onclick = async () => {
  await markLifeline("ai");

  const q = currentQuestion();
  const suggestion = Math.random() < 0.8
    ? q.answer
    : Math.floor(Math.random() * 4);

  $("resultTitle").textContent = "AI Pookie 🤖";
  $("resultText").innerHTML =
    `AI suggests <b>${String.fromCharCode(65 + suggestion)}</b>`;
};

$("swap").onclick = async () => {
  await markLifeline("swap");

  const qIndex = pickQuestion(data.settings.category, data.used || []);

  await update(roomRef(), {
    qIndex,
    used: [...(data.used || []), qIndex],
    questionStart: Date.now(),
    answered: false,
    selected: -1,
    showCorrect: false
  });
};

$("skip").onclick = async () => {
  await markLifeline("skip");
  nextTurn();
};

/* CHAT */

$("sendChat").onclick = sendChat;

$("chatInput").onkeydown = e => {
  if (e.key === "Enter") sendChat();
};

async function sendChat() {
  const text = $("chatInput").value.trim();
  if (!text) return;

  await push(ref(db, `${path()}/chat`), {
    name: pname,
    avatar,
    text,
    time: Date.now()
  });

  $("chatInput").value = "";
}

function renderChat() {
  const messages = Object.values(data.chat || {}).slice(-20);

  $("chatBox").innerHTML = messages.map(m => `
    <div class="chatMsg">
      ${m.avatar} <b>${m.name}</b>: ${escapeHtml(m.text)}
    </div>
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
  const sorted = Object.values(latest.players).sort((a, b) =>
    window.MONEY_LADDER.indexOf(b.money) -
    window.MONEY_LADDER.indexOf(a.money)
  );

  await update(roomRef(), {
    status: "final",
    winner: sorted[0].name
  });
}

function renderFinal() {
  show("finalScreen");

  const sorted = Object.values(data.players).sort((a, b) =>
    window.MONEY_LADDER.indexOf(b.money) -
    window.MONEY_LADDER.indexOf(a.money)
  );

  $("winnerBox").innerHTML = `
    <h2>${sorted[0].avatar} ${sorted[0].name} wins!</h2>
    <div class="money">${sorted[0].money}</div>
    ${sorted.map((p, i) => `
      <p>${i + 1}. ${p.avatar} ${p.name} — ${p.money}</p>
    `).join("")}
  `;
}
