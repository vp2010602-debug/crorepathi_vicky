const QUESTIONS = Array.isArray(window.TODAY_QUESTION_BANK) ? window.TODAY_QUESTION_BANK : [];
const TOTAL_PER_ROUND = 15;
const TIMER_SECONDS = 45;
const STORAGE_KEY = 'th_17_06_2026_used_questions';
const ladder = ['₹1,000','₹2,000','₹3,000','₹5,000','₹10,000','₹20,000','₹40,000','₹80,000','₹1.6 lakh','₹3.2 lakh','₹6.4 lakh','₹12.5 lakh','₹25 lakh','₹50 lakh','₹1 crore'];
const letters = ['A','B','C','D'];
let round = [], current = 0, timer = null, seconds = TIMER_SECONDS, locked = false;
let lifelines = { fifty:false, poll:false, flip:false, hint:false };

const $ = id => document.getElementById(id);

function usedSet(){ try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); } catch { return new Set(); } }
function saveUsed(set){ localStorage.setItem(STORAGE_KEY, JSON.stringify([...set])); }
function shuffle(arr){ return [...arr].sort(() => Math.random() - 0.5); }
function byDifficulty(q){ return q.difficulty === 'Easy' ? 1 : q.difficulty === 'Medium' ? 2 : 3; }

function buildRound(){
  let used = usedSet();
  let pool = QUESTIONS.filter(q => !used.has(q.id));
  if(pool.length < TOTAL_PER_ROUND){ used = new Set(); saveUsed(used); pool = [...QUESTIONS]; }
  const easy = shuffle(pool.filter(q => q.difficulty === 'Easy'));
  const medium = shuffle(pool.filter(q => q.difficulty === 'Medium'));
  const hard = shuffle(pool.filter(q => q.difficulty === 'Hard'));
  let selected = [...easy.slice(0,5), ...medium.slice(0,6), ...hard.slice(0,4)];
  const missing = TOTAL_PER_ROUND - selected.length;
  if(missing > 0){
    const extra = shuffle(pool.filter(q => !selected.some(s => s.id === q.id))).slice(0, missing);
    selected.push(...extra);
  }
  return selected.sort((a,b)=>byDifficulty(a)-byDifficulty(b)).slice(0,TOTAL_PER_ROUND);
}

function showScreen(name){
  ['startScreen','gameScreen','resultScreen'].forEach(id => $(id).classList.add('hidden'));
  $(name).classList.remove('hidden');
}

function drawLadder(){
  $('ladder').innerHTML = ladder.map((money, i) => `<div class="ladder-item ${i===current?'active':''} ${[4,9,14].includes(i)?'safe':''}"><span>${i+1}</span><b>${money}</b></div>`).join('');
}

function markUsed(q){ const u = usedSet(); u.add(q.id); saveUsed(u); }

function startGame(){
  if(!QUESTIONS.length){ alert('Question bank not found. Check data/questions.js'); return; }
  round = buildRound(); current = 0; lifelines = { fifty:false, poll:false, flip:false, hint:false };
  ['fiftyBtn','pollBtn','flipBtn','hintBtn'].forEach(id => $(id).disabled = false);
  showScreen('gameScreen'); renderQuestion();
}

function renderQuestion(){
  locked = false; seconds = TIMER_SECONDS; clearInterval(timer); startTimer();
  const q = round[current]; markUsed(q);
  $('qCounter').textContent = `${current+1} / ${TOTAL_PER_ROUND}`;
  $('currentPrize').textContent = ladder[current];
  $('category').textContent = q.category; $('difficulty').textContent = q.difficulty; $('source').textContent = q.source;
  $('questionText').textContent = q.question;
  $('message').textContent = 'Choose the correct answer.';
  $('options').innerHTML = q.options.map((op,i)=>`<button class="option" data-index="${i}"><span>${letters[i]}.</span>${op}</button>`).join('');
  document.querySelectorAll('.option').forEach(btn => btn.addEventListener('click', () => chooseAnswer(+btn.dataset.index)));
  drawLadder();
}

function startTimer(){
  $('timer').classList.remove('low'); $('timer').textContent = seconds;
  timer = setInterval(() => {
    seconds--; $('timer').textContent = seconds;
    if(seconds <= 10) $('timer').classList.add('low');
    if(seconds <= 0){ clearInterval(timer); endGame(false, 'Time up!'); }
  }, 1000);
}

function chooseAnswer(index){
  if(locked) return; locked = true; clearInterval(timer);
  const q = round[current];
  document.querySelectorAll('.option').forEach(b => b.disabled = true);
  const selected = document.querySelector(`.option[data-index="${index}"]`);
  const correct = document.querySelector(`.option[data-index="${q.answerIndex}"]`);
  if(index === q.answerIndex){
    selected.classList.add('correct'); $('message').innerHTML = `Correct! <br>${q.explanation}`;
    setTimeout(() => {
      if(current === TOTAL_PER_ROUND - 1) endGame(true, 'You became Crorepati!');
      else { current++; renderQuestion(); }
    }, 1400);
  } else {
    selected.classList.add('wrong'); correct.classList.add('correct');
    $('message').innerHTML = `Wrong answer. Correct answer: <b>${q.options[q.answerIndex]}</b><br>${q.explanation}`;
    setTimeout(() => endGame(false, 'Game Over'), 2200);
  }
}

function safePrize(){
  if(current >= 10) return ladder[9];
  if(current >= 5) return ladder[4];
  return '₹0';
}
function endGame(won, title){
  clearInterval(timer); showScreen('resultScreen');
  $('resultTitle').textContent = title;
  $('resultText').textContent = won ? `Amazing! Final prize: ${ladder[14]}` : `You reached Question ${current+1}. Safe prize: ${safePrize()}`;
}

$('fiftyBtn').addEventListener('click', () => {
  if(lifelines.fifty || locked) return; lifelines.fifty = true; $('fiftyBtn').disabled = true;
  const q = round[current];
  const wrong = shuffle([0,1,2,3].filter(i => i !== q.answerIndex)).slice(0,2);
  wrong.forEach(i => document.querySelector(`.option[data-index="${i}"]`).classList.add('removed'));
  $('message').textContent = '50:50 used. Two wrong options removed.';
});

$('pollBtn').addEventListener('click', () => {
  if(lifelines.poll || locked) return; lifelines.poll = true; $('pollBtn').disabled = true;
  const q = round[current]; const base = [8,10,12,14]; base[q.answerIndex] = 52 + Math.floor(Math.random()*22);
  const total = base.reduce((a,b)=>a+b,0); const poll = base.map(v => Math.round(v*100/total));
  $('message').innerHTML = `Audience Poll:<br>${letters.map((l,i)=>`${l}: ${poll[i]}%`).join(' • ')}`;
});

$('flipBtn').addEventListener('click', () => {
  if(lifelines.flip || locked) return; lifelines.flip = true; $('flipBtn').disabled = true;
  const currentIds = new Set(round.map(q => q.id)); const used = usedSet();
  const candidates = QUESTIONS.filter(q => !currentIds.has(q.id) && !used.has(q.id) && byDifficulty(q) >= byDifficulty(round[current]));
  const pick = shuffle(candidates)[0] || shuffle(QUESTIONS.filter(q => !currentIds.has(q.id)))[0];
  if(pick){ round[current] = pick; renderQuestion(); $('message').textContent = 'Question flipped!'; }
});

$('hintBtn').addEventListener('click', () => {
  if(lifelines.hint || locked) return; lifelines.hint = true; $('hintBtn').disabled = true;
  const q = round[current];
  $('message').innerHTML = `<b>Hint:</b> ${q.source} • ${q.category}. Think about the news angle in the explanation.`;
});

$('startBtn').addEventListener('click', startGame);
$('playAgainBtn').addEventListener('click', startGame);
$('homeBtn').addEventListener('click', () => showScreen('startScreen'));
$('resetMemoryBtn').addEventListener('click', () => { localStorage.removeItem(STORAGE_KEY); alert('Used question memory reset.'); });
$('totalQ').textContent = QUESTIONS.length;
