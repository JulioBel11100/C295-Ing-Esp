const APP_VERSION = '1.0.0';
const TOTAL_SENTENCES = DATA.length * 20;
document.getElementById('subtitle').textContent = `Práctica de vocabulario técnico · ${DATA.length} bloques · ${TOTAL_SENTENCES} frases · v${APP_VERSION}`;

/* ---------- Persistence ---------- */
const LS_PROGRESS = 'c295_ingles_progress_v1';
const LS_STATS = 'c295_ingles_stats_v1';
const LS_THEME = 'c295_ingles_theme_v1';
const INTERVAL_DAYS = [1,2,4,7,14];
let storageOK = true;
let progress = {};
let stats = { streak:0, lastDate:null, totalReviews:0 };

function loadAll(){
  try{
    progress = JSON.parse(localStorage.getItem(LS_PROGRESS) || '{}');
    stats = JSON.parse(localStorage.getItem(LS_STATS) || 'null') || stats;
  }catch(e){ storageOK = false; progress = {}; }
}
function saveProgress(){ if(!storageOK) return; try{ localStorage.setItem(LS_PROGRESS, JSON.stringify(progress)); }catch(e){ storageOK=false; } }
function saveStats(){ if(!storageOK) return; try{ localStorage.setItem(LS_STATS, JSON.stringify(stats)); }catch(e){ storageOK=false; } }

function todayStr(){ return new Date().toISOString().slice(0,10); }
function touchStreak(){
  const t = todayStr();
  if(stats.lastDate !== t){
    const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
    stats.streak = (stats.lastDate === yesterday) ? stats.streak+1 : 1;
    stats.lastDate = t;
  }
  stats.totalReviews++;
  saveStats();
}

function cardKey(bi,ci){ return bi+'-'+ci; }
function getCardState(bi,ci){ return progress[cardKey(bi,ci)] || { box:-1, due:0, seen:0, correct:0 }; }
function markCard(bi,ci,gotRight){
  const key = cardKey(bi,ci);
  const cs = progress[key] || { box:-1, due:0, seen:0, correct:0 };
  cs.seen++;
  if(gotRight){ cs.correct++; cs.box = Math.min(cs.box+1, 4); } else { cs.box = 0; }
  cs.due = Date.now() + INTERVAL_DAYS[cs.box]*86400000;
  progress[key] = cs;
  saveProgress();
  touchStreak();
}
function boxColor(box){ if(box<0) return '#5B6672'; return ['#D6684F','#E8A33D','#E0C34A','#9AC97F','#7FB07A'][box]; }
function blockMasteryPct(bi){ let m=0; for(let ci=0;ci<20;ci++){ if(getCardState(bi,ci).box>=3) m++; } return Math.round(m/20*100); }

loadAll();

/* ---------- Theme ---------- */
function applyTheme(t){
  document.documentElement.classList.toggle('light', t==='light');
  try{ localStorage.setItem(LS_THEME, t); }catch(e){}
}
applyTheme((()=>{ try{ return localStorage.getItem(LS_THEME) || 'dark'; }catch(e){ return 'dark'; } })());

/* ---------- Audio (TTS) ---------- */
function speak(text){
  if(!('speechSynthesis' in window)) return;
  try{ window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang='en-US'; u.rate=0.92; window.speechSynthesis.speak(u); }catch(e){}
}

/* ---------- Speech recognition (pronunciation) ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const speechSupported = !!SR;

/* ---------- State ---------- */
let state = {
  blockIdx:0, mode:'cards', dir:'es-en',
  cardQueue:[], cardPos:0, flipped:false,
  quizQueue:[], quizPos:0, quizScore:0, quizAnswered:false, quizOptions:null,
  dictQueue:[], dictPos:0,
  reviewQueue:[], reviewPos:0, reviewFlipped:false,
  examQueue:[], examPos:0, examScore:0, examOptions:null, examAnswered:false,
  speakQueue:[], speakPos:0, speakListening:false
};

function shuffled(arr){ const a=arr.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function currentBlock(){ return DATA[state.blockIdx]; }
function normalizeWords(s){ return s.toLowerCase().replace(/[^\w\s']/g,'').trim().split(/\s+/).filter(Boolean); }

function resetSession(){
  state.cardQueue = shuffled([...Array(20).keys()]); state.cardPos=0; state.flipped=false;
  state.quizQueue = shuffled([...Array(20).keys()]); state.quizPos=0; state.quizScore=0; state.quizAnswered=false; state.quizOptions=null;
  state.dictQueue = shuffled([...Array(20).keys()]); state.dictPos=0;
  state.speakQueue = shuffled([...Array(20).keys()]); state.speakPos=0; state.speakListening=false;
}

function buildReviewQueue(){
  const now = Date.now();
  let items = [];
  DATA.forEach((b,bi)=>{ for(let ci=0; ci<20; ci++){ const cs=getCardState(bi,ci); if(cs.box<0 || cs.due<=now) items.push({bi,ci,due:cs.due,isNew:cs.box<0}); } });
  items.sort((a,b)=> (a.isNew-b.isNew) || (a.due-b.due));
  return items.slice(0,40);
}

function buildExamQueue(){
  // Mix of quiz-style items pulled from across ALL blocks, prioritising cards already seen at least once
  let seen = [], unseen = [];
  DATA.forEach((b,bi)=>{ for(let ci=0; ci<20; ci++){ const cs=getCardState(bi,ci); (cs.box>=0?seen:unseen).push({bi,ci}); } });
  let pool = shuffled(seen).length>=10 ? shuffled(seen) : shuffled(seen).concat(shuffled(unseen));
  return pool.slice(0,10);
}

/* ---------- Header / tabs ---------- */
const blocksEl = document.getElementById('blocks');
const stageEl = document.getElementById('stage');

function renderBlockTabs(){
  blocksEl.innerHTML = '';
  DATA.forEach((b,i)=>{
    const pct = blockMasteryPct(i);
    const tab = document.createElement('div');
    tab.className = 'tab' + (i===state.blockIdx ? ' active':'');
    tab.innerHTML = `<div class="num">${String(i+1).padStart(2,'0')}</div><div class="tag">${b.title.split(' ').slice(0,2).join(' ')}</div><div class="mastery"><i style="width:${pct}%"></i></div>`;
    tab.onclick = () => { state.blockIdx=i; resetSession(); render(); };
    blocksEl.appendChild(tab);
  });
}

function renderHeaderStats(){
  const globalModes = ['review','exam'];
  document.getElementById('stat-block').textContent = globalModes.includes(state.mode) ? (state.mode==='review'?'REPASO GLOBAL':'EXAMEN MIXTO') : `BLOQUE ${String(state.blockIdx+1).padStart(2,'0')}/${DATA.length}`;
  const modeNames = {cards:'FLASHCARDS', quiz:'TEST', dict:'DICTADO', review:'REPASO', exam:'EXAMEN', speak:'PRONUNCIA'};
  document.getElementById('stat-mode').textContent = 'MODO: ' + modeNames[state.mode];
  let prog = '0/20';
  if(state.mode==='cards') prog = `${Math.min(state.cardPos,20)}/20`;
  else if(state.mode==='quiz') prog = `${Math.min(state.quizPos,20)}/20`;
  else if(state.mode==='dict') prog = `${Math.min(state.dictPos,20)}/20`;
  else if(state.mode==='speak') prog = `${Math.min(state.speakPos,20)}/20`;
  else if(state.mode==='review') prog = `${Math.min(state.reviewPos,state.reviewQueue.length)}/${state.reviewQueue.length}`;
  else if(state.mode==='exam') prog = `${Math.min(state.examPos,state.examQueue.length)}/${state.examQueue.length}`;
  document.getElementById('stat-progress').textContent = prog;
  document.getElementById('stat-streak').textContent = `🔥 ${stats.streak} día${stats.streak===1?'':'s'}`;
}

function renderBlockTitle(){
  const globalModes = ['review','exam'];
  if(globalModes.includes(state.mode)){
    document.getElementById('blocktitle-wrap').style.display='none';
    document.getElementById('blocks').style.display='none';
    document.getElementById('blocklabel').style.display='none';
    document.getElementById('dirbar').classList.add('disabled');
    return;
  }
  document.getElementById('blocktitle-wrap').style.display='block';
  document.getElementById('blocks').style.display='flex';
  document.getElementById('blocklabel').style.display='block';
  document.getElementById('dirbar').classList.remove('disabled');
  const b = currentBlock();
  document.getElementById('bt-es').textContent = `Bloque ${state.blockIdx+1}. ${b.title}`;
  document.getElementById('bt-en').textContent = b.titleEN;
}

/* ---------- Flashcards ---------- */
function renderCards(){
  const block = currentBlock();
  if(state.cardPos >= 20){
    stageEl.innerHTML = `<div class="donebox"><div class="big">✔</div><p>Has repasado las 20 frases de este bloque.<br>You've reviewed all 20 sentences in this block.</p><div class="restartbtn" id="restart-cards">Repasar de nuevo / Review again</div></div>`;
    document.getElementById('restart-cards').onclick = () => { state.cardQueue=shuffled([...Array(20).keys()]); state.cardPos=0; state.flipped=false; render(); };
    return;
  }
  const idx = state.cardQueue[state.cardPos];
  const pair = block.pairs[idx];
  const cs = getCardState(state.blockIdx, idx);
  const front = state.dir==='es-en' ? pair[0] : pair[1];
  const back = state.dir==='es-en' ? pair[1] : pair[0];
  const frontLbl = state.dir==='es-en' ? 'Español' : 'English';
  const backLbl = state.dir==='es-en' ? 'English' : 'Español';
  const englishText = state.dir==='es-en' ? back : front;
  const showSpeaker = state.flipped ? (state.dir==='es-en') : (state.dir==='en-es');

  stageEl.innerHTML = `
    <div class="progressbar"><div class="fill" style="width:${(state.cardPos/20)*100}%"></div></div>
    <div class="card ${state.flipped?'flipped':''}" id="flipcard">
      <div class="rivet tl"></div><div class="rivet tr"></div><div class="rivet bl"></div><div class="rivet br"></div>
      <div class="dot" style="background:${boxColor(cs.box)}" title="Nivel de dominio"></div>
      <div class="facelabel">${state.flipped?backLbl:frontLbl}</div>
      <div class="txt">${state.flipped?back:front}</div>
      ${showSpeaker ? '<div class="speaker" id="speak-btn">🔊</div>' : ''}
    </div>
    <div class="hint">Toca la tarjeta para ver la traducción / Tap the card to reveal the translation</div>
    <div class="cardbtns">
      <div class="cbtn again" id="btn-again">↺ Otra vez</div>
      <div class="cbtn know" id="btn-know">✓ Lo sé</div>
    </div>`;
  document.getElementById('flipcard').onclick = () => { state.flipped=!state.flipped; render(); };
  const spk = document.getElementById('speak-btn');
  if(spk) spk.onclick = (e) => { e.stopPropagation(); speak(englishText); };
  document.getElementById('btn-again').onclick = (e) => { e.stopPropagation(); markCard(state.blockIdx, idx, false); state.cardQueue.push(idx); state.cardPos++; state.flipped=false; render(); };
  document.getElementById('btn-know').onclick = (e) => { e.stopPropagation(); markCard(state.blockIdx, idx, true); state.cardPos++; state.flipped=false; render(); };
}

/* ---------- Quiz ---------- */
function buildOptionsFrom(pairs, correctIdx, dir){
  const correctAnswer = dir==='es-en' ? pairs[correctIdx][1] : pairs[correctIdx][0];
  const pool = pairs.map((p,i)=>i).filter(i=>i!==correctIdx);
  const distractorIdx = shuffled(pool).slice(0,3);
  const options = distractorIdx.map(i => dir==='es-en' ? pairs[i][1] : pairs[i][0]);
  options.push(correctAnswer);
  return shuffled(options).map(text => ({text, correct: text===correctAnswer}));
}
function renderQuiz(){
  const block = currentBlock();
  if(state.quizPos >= 20){
    stageEl.innerHTML = `<div class="donebox"><div class="big">🏁</div><p>Resultado: ${state.quizScore}/20 correctas<br>Score: ${state.quizScore}/20 correct</p><div class="restartbtn" id="restart-quiz">Repetir test / Retake test</div></div>`;
    document.getElementById('restart-quiz').onclick = () => { state.quizQueue=shuffled([...Array(20).keys()]); state.quizPos=0; state.quizScore=0; state.quizAnswered=false; state.quizOptions=null; render(); };
    return;
  }
  const idx = state.quizQueue[state.quizPos];
  const pair = block.pairs[idx];
  const question = state.dir==='es-en' ? pair[0] : pair[1];
  const qLbl = state.dir==='es-en' ? 'Traduce al inglés' : 'Traduce al español';
  const opts = state.quizOptions || (state.quizOptions = buildOptionsFrom(block.pairs, idx, state.dir));

  stageEl.innerHTML = `
    <div class="scorebar">ACIERTOS: ${state.quizScore} / ${state.quizPos}</div>
    <div class="qcounter"><span>PREGUNTA ${state.quizPos+1}/20</span><span>Bloque ${state.blockIdx+1}</span></div>
    <div class="qbox"><div class="lbl">${qLbl}</div><div class="qtxt">${question}</div></div>
    <div id="opts"></div>`;
  const optsEl = document.getElementById('opts');
  opts.forEach((o) => {
    const btn = document.createElement('div');
    btn.className = 'opt'; btn.textContent = o.text;
    btn.onclick = () => {
      if(state.quizAnswered) return;
      state.quizAnswered = true;
      markCard(state.blockIdx, idx, o.correct);
      document.querySelectorAll('.opt').forEach(el=>el.classList.add('disabled'));
      opts.forEach((oo,j)=>{ const el=optsEl.children[j]; if(oo.correct) el.classList.add('correct'); else if(oo===o) el.classList.add('wrong'); });
      if(o.correct) state.quizScore++;
      const nb = document.createElement('div'); nb.className='nextbtn';
      nb.textContent = state.quizPos+1<20 ? 'Siguiente / Next →' : 'Ver resultado / See result →';
      nb.onclick = () => { state.quizPos++; state.quizAnswered=false; state.quizOptions=null; render(); };
      stageEl.appendChild(nb);
    };
    optsEl.appendChild(btn);
  });
}

/* ---------- Dictation ---------- */
function renderDictation(){
  const block = currentBlock();
  if(state.dictPos >= 20){
    stageEl.innerHTML = `<div class="donebox"><div class="big">🎧</div><p>Dictado del bloque completado.<br>Dictation for this block completed.</p><div class="restartbtn" id="restart-dict">Repetir dictado / Retake dictation</div></div>`;
    document.getElementById('restart-dict').onclick = () => { state.dictQueue=shuffled([...Array(20).keys()]); state.dictPos=0; render(); };
    return;
  }
  const idx = state.dictQueue[state.dictPos];
  const pair = block.pairs[idx];
  const english = pair[1], spanish = pair[0];

  stageEl.innerHTML = `
    <div class="progressbar"><div class="fill" style="width:${(state.dictPos/20)*100}%"></div></div>
    <div class="dictbox">
      <div class="playbtn" id="play-btn">🔊 Reproducir frase / Play sentence</div>
      <textarea class="dicttextarea" id="dict-input" placeholder="Escribe en inglés lo que oigas... / Type in English what you hear..."></textarea>
      <div class="checkbtn" id="check-btn">Comprobar / Check</div>
      <div id="dict-result"></div>
    </div>`;
  document.getElementById('play-btn').onclick = () => speak(english);
  document.getElementById('check-btn').onclick = () => {
    const input = document.getElementById('dict-input').value;
    const userWords = normalizeWords(input);
    const correctWords = normalizeWords(english);
    let matches = 0;
    const wordsHtml = correctWords.map((w,i)=>{ const ok = userWords[i]===w; if(ok) matches++; return `<span class="${ok?'w-ok':'w-bad'}">${w}</span>`; }).join(' ');
    const acc = Math.round((matches/correctWords.length)*100);
    const gotRight = acc >= 85;
    markCard(state.blockIdx, idx, gotRight);
    const resEl = document.getElementById('dict-result');
    resEl.innerHTML = `
      <div class="accbadge" style="color:${gotRight?'#7FB07A':'#D6684F'};background:${gotRight?'rgba(127,176,122,.12)':'rgba(214,104,79,.12)'}">Precisión: ${acc}%</div>
      <div class="dictresult">
        <div class="row"><div class="lbl2">Tu respuesta / Your answer</div>${input || '(vacío / empty)'}</div>
        <div class="row"><div class="lbl2">Frase correcta / Correct sentence</div>${wordsHtml}</div>
        <div class="row"><div class="lbl2">Traducción / Translation</div>${spanish}</div>
      </div>
      <div class="nextbtn" id="dict-next">Siguiente / Next →</div>`;
    document.getElementById('dict-next').onclick = () => { state.dictPos++; render(); };
    document.getElementById('check-btn').style.display='none';
    document.getElementById('play-btn').textContent = '🔊 Escuchar de nuevo / Listen again';
  };
}

/* ---------- Pronunciation practice (speech recognition) ---------- */
function renderSpeak(){
  const block = currentBlock();
  if(!speechSupported){
    stageEl.innerHTML = `<div class="emptybox"><div class="big">🎤</div>Este navegador no admite reconocimiento de voz.<br>This browser doesn't support speech recognition.<br><br>Funciona en Chrome, Edge, Opera o Safari 14.5+. Firefox tiene esta función desactivada por defecto (no depende de esta app). El resto de modos —Tarjetas, Test, Dictado, Repaso y Examen— funcionan con normalidad en Firefox.</div>`;
    return;
  }
  if(state.speakPos >= 20){
    stageEl.innerHTML = `<div class="donebox"><div class="big">🎤</div><p>Práctica de pronunciación completada.<br>Pronunciation practice completed.</p><div class="restartbtn" id="restart-speak">Repetir / Retry</div></div>`;
    document.getElementById('restart-speak').onclick = () => { state.speakQueue=shuffled([...Array(20).keys()]); state.speakPos=0; render(); };
    return;
  }
  const idx = state.speakQueue[state.speakPos];
  const pair = block.pairs[idx];
  const english = pair[1];

  stageEl.innerHTML = `
    <div class="progressbar"><div class="fill" style="width:${(state.speakPos/20)*100}%"></div></div>
    <div class="dictbox">
      <div class="hint" style="margin-bottom:10px;">Lee esta frase en voz alta / Read this sentence aloud</div>
      <div class="qtxt" style="margin-bottom:6px;">${english}</div>
      <div class="hint" style="margin-bottom:14px;">${pair[0]}</div>
      <div class="speaker" style="position:static;display:inline-block;font-size:22px;" id="speak-model">🔊 Escuchar modelo</div>
      <br>
      <div class="micbtn ${state.speakListening?'listening':''}" id="mic-btn">${state.speakListening?'🎤 Escuchando...':'🎤 Grabar'}</div>
      <div id="speak-result"></div>
    </div>`;
  document.getElementById('speak-model').onclick = () => speak(english);
  document.getElementById('mic-btn').onclick = () => startRecognition(english, idx);
}
function startRecognition(englishTarget, idx){
  const rec = new SR();
  rec.lang = 'en-US';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  state.speakListening = true; render();
  rec.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    const userWords = normalizeWords(transcript);
    const correctWords = normalizeWords(englishTarget);
    let matches = 0;
    const wordsHtml = correctWords.map((w,i)=>{ const ok = userWords[i]===w; if(ok) matches++; return `<span class="${ok?'w-ok':'w-bad'}">${w}</span>`; }).join(' ');
    const acc = Math.round((matches/correctWords.length)*100);
    const gotRight = acc >= 75;
    markCard(state.blockIdx, idx, gotRight);
    state.speakListening = false;
    render();
    const resEl = document.getElementById('speak-result');
    if(resEl){
      resEl.innerHTML = `
        <div class="accbadge" style="color:${gotRight?'#7FB07A':'#D6684F'};background:${gotRight?'rgba(127,176,122,.12)':'rgba(214,104,79,.12)'}">Precisión: ${acc}%</div>
        <div class="dictresult">
          <div class="row"><div class="lbl2">Se ha entendido / What was heard</div>${transcript}</div>
          <div class="row"><div class="lbl2">Frase objetivo / Target sentence</div>${wordsHtml}</div>
        </div>
        <div class="nextbtn" id="speak-next">Siguiente / Next →</div>`;
      document.getElementById('speak-next').onclick = () => { state.speakPos++; render(); };
    }
  };
  rec.onerror = () => { state.speakListening = false; render(); };
  rec.onend = () => { if(state.speakListening){ state.speakListening=false; render(); } };
  try{ rec.start(); }catch(e){ state.speakListening=false; render(); }
}

/* ---------- Global review ---------- */
function renderReview(){
  if(state.reviewPos===0 && state.reviewQueue.length===0) state.reviewQueue = buildReviewQueue();
  if(state.reviewQueue.length===0){
    stageEl.innerHTML = `<div class="emptybox"><div class="big">🎉</div>No tienes frases pendientes de repaso ahora mismo.<br>No cards are due for review right now.<br><br>Vuelve más tarde o practica un bloque con Tarjetas o Test.</div>`;
    return;
  }
  if(state.reviewPos >= state.reviewQueue.length){
    stageEl.innerHTML = `<div class="donebox"><div class="big">⏱️</div><p>Repaso completado: ${state.reviewQueue.length} frases.<br>Review session completed.</p><div class="restartbtn" id="restart-review">Buscar más pendientes / Check for more</div></div>`;
    document.getElementById('restart-review').onclick = () => { state.reviewQueue=buildReviewQueue(); state.reviewPos=0; state.reviewFlipped=false; render(); };
    return;
  }
  const item = state.reviewQueue[state.reviewPos];
  const pair = DATA[item.bi].pairs[item.ci];
  const cs = getCardState(item.bi, item.ci);
  const front = pair[0], back = pair[1];

  stageEl.innerHTML = `
    <div class="progressbar"><div class="fill" style="width:${(state.reviewPos/state.reviewQueue.length)*100}%"></div></div>
    <div class="hint" style="margin-bottom:8px;">Bloque ${item.bi+1}: ${DATA[item.bi].title}</div>
    <div class="card ${state.reviewFlipped?'flipped':''}" id="revcard">
      <div class="rivet tl"></div><div class="rivet tr"></div><div class="rivet bl"></div><div class="rivet br"></div>
      <div class="dot" style="background:${boxColor(cs.box)}"></div>
      <div class="facelabel">${state.reviewFlipped?'English':'Español'}</div>
      <div class="txt">${state.reviewFlipped?back:front}</div>
      ${state.reviewFlipped ? '<div class="speaker" id="rev-speak">🔊</div>' : ''}
    </div>
    <div class="hint">Toca para ver la traducción / Tap to reveal translation</div>
    <div class="cardbtns">
      <div class="cbtn again" id="rev-again">↺ Otra vez</div>
      <div class="cbtn know" id="rev-know">✓ Lo sé</div>
    </div>`;
  document.getElementById('revcard').onclick = () => { state.reviewFlipped=!state.reviewFlipped; render(); };
  const spk = document.getElementById('rev-speak');
  if(spk) spk.onclick = (e) => { e.stopPropagation(); speak(back); };
  document.getElementById('rev-again').onclick = (e) => { e.stopPropagation(); markCard(item.bi,item.ci,false); state.reviewPos++; state.reviewFlipped=false; render(); };
  document.getElementById('rev-know').onclick = (e) => { e.stopPropagation(); markCard(item.bi,item.ci,true); state.reviewPos++; state.reviewFlipped=false; render(); };
}

/* ---------- Exam (mixed, cross-block) ---------- */
function renderExam(){
  if(state.examPos===0 && state.examQueue.length===0) state.examQueue = buildExamQueue();
  if(state.examPos >= state.examQueue.length){
    const pct = Math.round((state.examScore/state.examQueue.length)*100);
    stageEl.innerHTML = `<div class="donebox"><div class="big">🎓</div><p>Examen del día: ${state.examScore}/${state.examQueue.length} (${pct}%)<br>Daily exam completed.</p><div class="restartbtn" id="restart-exam">Nuevo examen / New exam</div></div>`;
    document.getElementById('restart-exam').onclick = () => { state.examQueue=buildExamQueue(); state.examPos=0; state.examScore=0; state.examOptions=null; state.examAnswered=false; render(); };
    return;
  }
  const item = state.examQueue[state.examPos];
  const block = DATA[item.bi];
  const pair = block.pairs[item.ci];
  const dir = Math.random()<0.5 ? 'es-en' : 'en-es';
  const question = dir==='es-en' ? pair[0] : pair[1];
  const qLbl = dir==='es-en' ? 'Traduce al inglés' : 'Traduce al español';
  const opts = state.examOptions || (state.examOptions = buildOptionsFrom(block.pairs, item.ci, dir));

  stageEl.innerHTML = `
    <div class="scorebar">ACIERTOS: ${state.examScore} / ${state.examPos}</div>
    <div class="qcounter"><span>PREGUNTA ${state.examPos+1}/${state.examQueue.length}</span><span>Bloque ${item.bi+1}: ${block.title.split(' ').slice(0,2).join(' ')}</span></div>
    <div class="qbox"><div class="lbl">${qLbl}</div><div class="qtxt">${question}</div></div>
    <div id="opts"></div>`;
  const optsEl = document.getElementById('opts');
  opts.forEach((o) => {
    const btn = document.createElement('div');
    btn.className = 'opt'; btn.textContent = o.text;
    btn.onclick = () => {
      if(state.examAnswered) return;
      state.examAnswered = true;
      markCard(item.bi, item.ci, o.correct);
      document.querySelectorAll('.opt').forEach(el=>el.classList.add('disabled'));
      opts.forEach((oo,j)=>{ const el=optsEl.children[j]; if(oo.correct) el.classList.add('correct'); else if(oo===o) el.classList.add('wrong'); });
      if(o.correct) state.examScore++;
      const nb = document.createElement('div'); nb.className='nextbtn';
      nb.textContent = state.examPos+1<state.examQueue.length ? 'Siguiente / Next →' : 'Ver resultado / See result →';
      nb.onclick = () => { state.examPos++; state.examAnswered=false; state.examOptions=null; render(); };
      stageEl.appendChild(nb);
    };
    optsEl.appendChild(btn);
  });
}

/* ---------- Stats modal ---------- */
function openStats(){
  const totalMastered = DATA.reduce((sum,_,bi)=>{ let m=0; for(let ci=0;ci<20;ci++){ if(getCardState(bi,ci).box>=3) m++; } return sum+m; },0);
  let barsHtml = DATA.map((b,i)=>{
    const pct = blockMasteryPct(i);
    return `<div class="barrow"><div class="bl">${i+1}. ${b.title.split(' ').slice(0,2).join(' ')}</div><div class="barouter"><div class="barinner" style="width:${pct}%"></div></div><div class="barpct">${pct}%</div></div>`;
  }).join('');
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal modal-wrap">
        <div class="close" id="modal-close">✕</div>
        <h2>📊 Tu progreso</h2>
        <div class="subtitle">Your learning stats</div>
        <div class="bigstats">
          <div class="bigstat"><div class="n">🔥 ${stats.streak}</div><div class="l">Racha días</div></div>
          <div class="bigstat"><div class="n">${stats.totalReviews}</div><div class="l">Repasos totales</div></div>
          <div class="bigstat"><div class="n">${totalMastered}/${TOTAL_SENTENCES}</div><div class="l">Dominadas</div></div>
        </div>
        <div class="blocklabel" style="margin-top:6px;">Dominio por bloque / Mastery by block</div>
        ${barsHtml}
        ${!storageOK ? '<div class="hint" style="margin-top:10px;color:var(--red)">⚠ Este navegador no permite guardar el progreso localmente.</div>' : ''}
      </div>
    </div>`;
  document.getElementById('modal-close').onclick = () => root.innerHTML='';
  document.getElementById('modal-bg').onclick = (e) => { if(e.target.id==='modal-bg') root.innerHTML=''; };
}

/* ---------- Settings modal (theme, export/import, install info) ---------- */
function openSettings(){
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-bg" id="modal-bg2">
      <div class="modal modal-wrap">
        <div class="close" id="modal-close2">✕</div>
        <h2>⚙️ Ajustes</h2>
        <div class="subtitle">Settings &amp; data</div>

        <div class="settingrow">
          <div><div class="st">Tema / Theme</div><div class="sd">Oscuro (hangar) o claro</div></div>
          <div class="togglebtn" id="theme-toggle">${document.documentElement.classList.contains('light') ? '☀️ Claro' : '🌙 Oscuro'}</div>
        </div>

        <div class="settingrow">
          <div><div class="st">Exportar progreso</div><div class="sd">Descarga un archivo de respaldo</div></div>
          <div class="settingbtn" id="export-btn">⬇ Exportar</div>
        </div>

        <div class="settingrow">
          <div><div class="st">Importar progreso</div><div class="sd">Restaura un archivo exportado</div></div>
          <label class="filelabel" for="import-file">⬆ Importar</label>
          <input type="file" id="import-file" accept="application/json" style="display:none;">
        </div>

        <div class="settingrow">
          <div><div class="st">Versión instalada</div><div class="sd">Contenido: ${DATA.length} bloques · ${TOTAL_SENTENCES} frases</div></div>
          <div class="togglebtn" style="cursor:default;">v${APP_VERSION}</div>
        </div>

        <div class="resetbtn" id="reset-progress">Borrar todo el progreso guardado</div>
      </div>
    </div>`;
  document.getElementById('modal-close2').onclick = () => root.innerHTML='';
  document.getElementById('modal-bg2').onclick = (e) => { if(e.target.id==='modal-bg2') root.innerHTML=''; };
  document.getElementById('theme-toggle').onclick = () => {
    const isLight = document.documentElement.classList.contains('light');
    applyTheme(isLight ? 'dark' : 'light');
    openSettings();
  };
  document.getElementById('export-btn').onclick = () => {
    const payload = { exportedAt: new Date().toISOString(), appVersion: APP_VERSION, progress, stats };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `c295-ingles-progreso-${todayStr()}.json`;
    a.click();
  };
  document.getElementById('import-file').onchange = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const payload = JSON.parse(reader.result);
        if(payload.progress) progress = payload.progress;
        if(payload.stats) stats = payload.stats;
        saveProgress(); saveStats();
        root.innerHTML='';
        render();
        alert('Progreso importado correctamente. / Progress imported successfully.');
      }catch(err){ alert('El archivo no es válido. / Invalid file.'); }
    };
    reader.readAsText(file);
  };
  document.getElementById('reset-progress').onclick = () => {
    if(confirm('¿Seguro que quieres borrar todo tu progreso guardado? / Are you sure you want to erase all saved progress?')){
      progress = {}; stats = {streak:0,lastDate:null,totalReviews:0};
      saveProgress(); saveStats();
      root.innerHTML=''; render();
    }
  };
}

/* ---------- Main render ---------- */
function render(){
  renderBlockTabs();
  renderHeaderStats();
  renderBlockTitle();
  ['cards','quiz','dict','review','exam','speak'].forEach(m => document.getElementById('mode-'+m).classList.toggle('active', state.mode===m));
  document.getElementById('dir-es-en').classList.toggle('on', state.dir==='es-en');
  document.getElementById('dir-en-es').classList.toggle('on', state.dir==='en-es');

  if(state.mode==='cards') renderCards();
  else if(state.mode==='quiz') renderQuiz();
  else if(state.mode==='dict') renderDictation();
  else if(state.mode==='review') renderReview();
  else if(state.mode==='exam') renderExam();
  else if(state.mode==='speak') renderSpeak();
}

['cards','quiz','dict','speak'].forEach(m => {
  document.getElementById('mode-'+m).onclick = () => { state.mode=m; render(); };
});
document.getElementById('mode-review').onclick = () => { state.mode='review'; state.reviewQueue=[]; state.reviewPos=0; state.reviewFlipped=false; render(); };
document.getElementById('mode-exam').onclick = () => { state.mode='exam'; state.examQueue=[]; state.examPos=0; state.examScore=0; state.examOptions=null; state.examAnswered=false; render(); };
document.getElementById('dir-es-en').onclick = () => { state.dir='es-en'; state.quizOptions=null; state.flipped=false; render(); };
document.getElementById('dir-en-es').onclick = () => { state.dir='en-es'; state.quizOptions=null; state.flipped=false; render(); };
document.getElementById('open-stats').onclick = openStats;
document.getElementById('open-settings').onclick = openSettings;

/* ---------- PWA install prompt ---------- */
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.getElementById('installbanner').style.display = 'flex';
});
document.getElementById('install-btn').onclick = async () => {
  if(!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.getElementById('installbanner').style.display = 'none';
};
document.getElementById('install-dismiss').onclick = () => { document.getElementById('installbanner').style.display = 'none'; };

/* ---------- Service worker registration + update detection ---------- */
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if(newWorker.state === 'installed' && navigator.serviceWorker.controller){
            document.getElementById('updatebanner').style.display = 'flex';
          }
        });
      });
    }).catch(()=>{});
  });
}
document.getElementById('update-btn').onclick = () => { window.location.reload(); };
document.getElementById('update-dismiss').onclick = () => { document.getElementById('updatebanner').style.display = 'none'; };

resetSession();
render();
