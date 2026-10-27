import { QUESTIONS, QUESTION_HINTS, TYPE_LABEL } from './questions.js';
import { OUTCOMES } from './outcomes.js';
import { applyOutcome, nextTeam, save, load, clone } from './engine.js';
import { renderQuestionEditor, makeCustomQuestion, downloadQuestionSet, parseQuestionSet } from './question-editor.js';

const app = document.querySelector('#app');
const toastEl = document.querySelector('#toast');
let state = load() || null;
let pregameScreen = state ? 'game' : 'intro';
if(state?.questionPool){state.questionPool=state.questionPool.map(q=>({...q,hint:q.hint||QUESTION_HINTS[q.id]||''}));if(state.question)state.question={...state.question,hint:state.question.hint||QUESTION_HINTS[state.question.id]||''};}
let selectedWords = [];
let selectedChoice = null;
let toastTimer;
let soundEnabled = localStorage.getItem('midnight-candy-sound') !== 'off';
let reducedMotion = localStorage.getItem('midnight-candy-motion') === 'reduced';
const CUSTOM_KEY='midnight-candy-custom-questions-v1',QUESTION_SOURCE_KEY='midnight-candy-question-source-v1',QUESTION_SET_NAME_KEY='midnight-candy-question-set-name-v1';
function loadCustomQuestions(){try{const list=JSON.parse(localStorage.getItem(CUSTOM_KEY)||'[]');return Array.isArray(list)?list:[]}catch{return []}}
let customQuestions=loadCustomQuestions();
let questionSource=localStorage.getItem(QUESTION_SOURCE_KEY)==='custom'&&customQuestions.length?'custom':'built-in';
let editorOpen=false;
let editingQuestionIndex=null;
let questionSetName=localStorage.getItem(QUESTION_SET_NAME_KEY)||'My Halloween questions';
const TRICK_PRIZES=[{id:'trick-10',points:10,icon:'🍬',label:'10 Candy'},{id:'trick-15',points:15,icon:'🍭',label:'15 Candy'},{id:'trick-25',points:25,icon:'🍫',label:'25 Candy'},{id:'trick-60',points:60,icon:'🍬',label:'60 Candy jackpot'}];
const PRIZE_ODDS_KEY='midnight-candy-prize-odds-v3',PREVIOUS_PRIZE_ODDS_KEY='midnight-candy-prize-odds-v2',LEGACY_PRIZE_ODDS_KEY='midnight-candy-prize-odds-v1';
const defaultPrizeOdds={trick:{jackpot:5,blessing:20,gift:14,golden:8,vampire:13,skeleton:10,swap:8,heist:8,mayhem:7,haunted:7},treat:{'trick-10':50,'trick-15':30,'trick-25':15,'trick-60':5}};
function loadPrizeOdds(){try{
 const saved=localStorage.getItem(PRIZE_ODDS_KEY);
 if(saved){const stored=JSON.parse(saved);return{trick:{...defaultPrizeOdds.trick,...stored.trick},treat:{...defaultPrizeOdds.treat,...stored.treat}};}
 const previous=localStorage.getItem(PREVIOUS_PRIZE_ODDS_KEY),old=JSON.parse(previous||localStorage.getItem(LEGACY_PRIZE_ODDS_KEY)||'{}');
 const odds=previous?old:{trick:old.treat,treat:old.trick};
 const oldCandyIds=['trick-10','trick-20','trick-30','trick-50'];
 const trickWasDefault=OUTCOMES.every(outcome=>Number(odds.trick?.[outcome.id])===10),treatWasDefault=oldCandyIds.every(id=>Number(odds.treat?.[id])===25);
 const migratedTreat={...odds.treat,'trick-15':odds.treat?.['trick-20'],'trick-25':odds.treat?.['trick-30'],'trick-60':odds.treat?.['trick-50']};
 const result={trick:trickWasDefault?{...defaultPrizeOdds.trick}:{...defaultPrizeOdds.trick,...odds.trick},treat:treatWasDefault?{...defaultPrizeOdds.treat}:{...defaultPrizeOdds.treat,...migratedTreat}};
 if(previous||localStorage.getItem(LEGACY_PRIZE_ODDS_KEY))localStorage.setItem(PRIZE_ODDS_KEY,JSON.stringify(result));
 return result;
}catch{return{trick:{...defaultPrizeOdds.trick},treat:{...defaultPrizeOdds.treat}}}}
let prizeOdds=loadPrizeOdds();
function chanceFor(group,id){return Number(prizeOdds[group]?.[id])||0}
function chooseByChance(items,group){const roll=Math.random()*100;let total=0;for(const item of items){total+=chanceFor(group,item.id);if(roll<total)return item;}return items.at(-1)}
function oddsPanel(){const rows=(items,group)=>items.map(item=>`<label class="odds-row"><span>${item.icon||'🎃'} ${esc(item.label||item.name)}</span><input class="odds-input" data-odds-group="${group}" data-odds-id="${item.id}" type="number" min="0" max="100" step="1" value="${chanceFor(group,item.id)}" aria-label="${esc(item.label||item.name)} chance percentage"><b data-odds-value="${group}-${item.id}">${chanceFor(group,item.id)}%</b></label>`).join('');return `<details class="odds-settings"><summary>Customize prize chances</summary><p>Set each chance as a percentage. When you change one, the rest adjust to keep each group at 100%.</p><div class="odds-groups"><section><h3>TRICK · MYSTERY EVENTS</h3>${rows(OUTCOMES,'trick')}</section><section><h3>TREAT · CANDY BAG</h3>${rows(TRICK_PRIZES,'treat')}</section></div><div class="odds-footer"><p class="odds-save-note">These teacher settings save on this device. Trick percentages apply to each mystery card you pick; cards draw independently, so the same event can appear more than once.</p><button class="outline-btn" type="button" data-action="reset-odds">Reset chances to default</button></div></details>`}
function getStandings(teams){let previousScore=null,rank=0;return [...teams].map((team,seed)=>({...team,seed})).sort((a,b)=>b.score-a.score||a.seed-b.seed).map((team,index)=>{if(index===0||team.score<previousScore)rank=index+1;previousScore=team.score;return{id:team.id,name:team.name,score:team.score,rank}})}
function standingsSnapshot(teams){return getStandings(teams).map(({id,rank})=>({id,rank}))}
function rankMovement(teamId,previous,rank){const oldRank=previous?.find(item=>item.id===teamId)?.rank;if(!oldRank)return{className:'unchanged',label:'—',detail:'No previous position'};if(oldRank>rank)return{className:'moved-up',label:`▲ ${oldRank-rank}`,detail:`Up ${oldRank-rank} ${oldRank-rank===1?'place':'places'}`};if(oldRank<rank)return{className:'moved-down',label:`▼ ${rank-oldRank}`,detail:`Down ${rank-oldRank} ${rank-oldRank===1?'place':'places'}`};return{className:'unchanged',label:'—',detail:'Position unchanged'}}
if(reducedMotion) document.documentElement.classList.add('reduce-motion');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function highlightChangedText(text, other, className) {
 const words = value => [...String(value).matchAll(/\S+/g)].map(match => ({ value: match[0], start: match.index, end: match.index + match[0].length }));
 const a = words(text), b = words(other);
 let prefix = 0;
 while (prefix < a.length && prefix < b.length && a[prefix].value === b[prefix].value) prefix++;
 let suffix = 0;
 while (suffix < a.length - prefix && suffix < b.length - prefix && a[a.length - 1 - suffix].value === b[b.length - 1 - suffix].value) suffix++;
 if (prefix === a.length && prefix === b.length) return esc(text);
 const start = prefix < a.length ? a[prefix].start : String(text).length;
 const end = suffix < a.length ? a[a.length - 1 - suffix].end : String(text).length;
 return `${esc(String(text).slice(0, start))}<mark class="${className}">${esc(String(text).slice(start, end)) || '∅'}</mark>${esc(String(text).slice(end))}`;
}
const current = () => state?.teams.find(t => t.id === state.currentTeamId);
function commit(next, undo = true) {
  if (undo && state) recordHistory(next, state);
  state = next; save(state); render();
}
function recordHistory(next, previous) {
  const snapshot = clone(previous);
  delete snapshot.history;
  next.history = [...(previous.history || []), snapshot].slice(-30);
}
function notify(message) {
  toastEl.textContent = message; toastEl.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}
function playSound(kind='reveal') {
 if(!soundEnabled)return;
 try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const ctx=new AC(),osc=ctx.createOscillator(),gain=ctx.createGain();const notes=kind==='correct'?[523,659,784]:kind==='trick'?[240,180,660]:kind==='turn'?[293,440,587]:[392,587,784];osc.type=kind==='trick'||kind==='turn'?'triangle':'sine';osc.frequency.setValueAtTime(notes[0],ctx.currentTime);notes.slice(1).forEach((n,i)=>osc.frequency.setValueAtTime(n,ctx.currentTime+.09*(i+1)));gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.12,ctx.currentTime+.025);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.32);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.34);osc.onended=()=>ctx.close()}catch{}
}
function playPrizeSound(prize) {
 if(!soundEnabled)return;
 const profiles={jackpot:['triangle',[523,659,784,1047],.075],blessing:['sine',[392,523,659],.12],gift:['triangle',[440,554,659,880],.09],golden:['sine',[659,831,988,1318],.08],vampire:['sawtooth',[330,247,165,110],.09],skeleton:['square',[440,220,370,147],.065],swap:['triangle',[220,660,330,880],.075],heist:['sawtooth',[392,294,220,147],.1],mayhem:['triangle',[523,784,659,988,784,1175],.065],haunted:['sawtooth',[110,116,98,82],.16]};
 const profile=profiles[prize];if(!profile){playSound('reveal');return;}
 try{
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  const [wave,notes,step]=profile,ctx=new AC(),start=ctx.currentTime;
  notes.forEach((frequency,index)=>{const at=start+index*step,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=wave;osc.frequency.setValueAtTime(frequency,at);gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(['vampire','haunted'].includes(prize)?.055:.09,at+.012);gain.gain.exponentialRampToValueAtTime(.0001,at+.18);osc.connect(gain);gain.connect(ctx.destination);osc.start(at);osc.stop(at+.19);osc.onended=()=>{if(index===notes.length-1)setTimeout(()=>ctx.close(),240)}});
  if(['vampire','skeleton','heist','haunted'].includes(prize)){const length=Math.floor(ctx.sampleRate*.28),buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();noise.buffer=buffer;filter.type='lowpass';filter.frequency.value=prize==='skeleton'?900:420;gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(prize==='skeleton'?.1:.07,start+.018);gain.gain.exponentialRampToValueAtTime(.0001,start+.26);noise.connect(filter);filter.connect(gain);gain.connect(ctx.destination);noise.start(start);noise.stop(start+.27)}
 }catch{}
}
const pumpkin = (n, used = false) => `<span class="pumpkin ${used?'is-used':''}"><span class="pumpkin-shape">&#127875;</span><b>${String(n).padStart(2,'0')}</b></span>`;
function header() {
 return `<header class="topbar"><a class="brand" href="#"><span class="brand-icon">&#127875;</span><span><strong>MIDNIGHT CANDY</strong></span></a><div class="top-actions"><button class="icon-btn" data-action="sound-toggle" aria-pressed="${soundEnabled}">${soundEnabled?'&#128266;':'&#128263;'} <span>Sound ${soundEnabled?'on':'off'}</span></button><button class="icon-btn" data-action="motion-toggle" aria-pressed="${reducedMotion}">&#10024; <span>Motion ${reducedMotion?'reduced':'full'}</span></button><button class="icon-btn" data-action="fullscreen">&#x26F6; <span>Full screen</span></button>${state&&!['setup','results'].includes(state.phase)?'<button class="icon-btn" data-action="pause">&#x275A;&#x275A; <span>Pause</span></button>':''}</div></header>`;
}
function questionSourceOptions(){return '<label class="field-label" for="questionSource">QUESTION SET</label><select class="question-source" id="questionSource"><option value="built-in">Midnight Candy questions (24)</option><option value="custom" '+(customQuestions.length?'':'disabled')+'>My questions ('+customQuestions.length+')</option></select><button class="outline-btn editor-open-btn" data-action="open-editor">&#9998; Create / edit questions</button>'}
function editor(){return renderQuestionEditor(customQuestions,esc,header(),editingQuestionIndex,questionSetName)}
function persistCustomQuestions(){localStorage.setItem(CUSTOM_KEY,JSON.stringify(customQuestions))}
function intro() {
 return `${header()}<main class="intro-screen"><div class="intro-moon"></div><div class="intro-mist mist-one"></div><div class="intro-mist mist-two"></div><span class="intro-bat bat-one">&#129415;</span><span class="intro-bat bat-two">&#129415;</span><div class="intro-content"><div class="intro-pumpkin">&#127875;</div><h1>Midnight<br><em>Candy</em></h1><button class="primary-btn intro-start" data-action="open-setup">Enter if you dare <span>&#8594;</span></button></div><div class="intro-ground"></div></main>`;
}
function setup() {
 return `${header()}<main class="setup-layout"><section class="hero"><h1>Midnight<br><em>Candy</em></h1><div class="hero-art"><span class="hero-moon"></span><span class="hero-ghost ghost-a">&#128123;</span><span class="hero-ghost ghost-b">&#129415;</span><span class="hero-pumpkin">&#127875;</span><span class="spark s1">&#10022;</span><span class="spark s2">&#10023;</span><span class="hero-grass"></span></div><div class="feature-row"><span>&#10022; 24 classroom-ready questions</span><span>&#10022; 10 spooky outcomes</span><span>&#10022; Works offline</span></div></section><section class="setup-card"><button class="text-btn setup-back" data-action="return-intro">&#8592; Opening screen</button><div class="card-heading"><div><span class="eyebrow orange">TEACHER SETUP</span><h2>Prepare your game</h2></div><div class="setup-badge">About 1 minute</div></div><label class="field-label">NUMBER OF TEAMS</label><div class="stepper"><button data-action="team-minus" aria-label="Fewer teams">&#8722;</button><strong id="teamCount">4</strong><button data-action="team-plus" aria-label="More teams">+</button><span>teams - choose 2&#8211;6</span></div><div class="team-inputs" id="teamInputs"></div><div class="field-grid"><label><span>STARTING CANDY</span><div class="input-wrap"><input id="startingScore" type="number" min="0" max="999" value="0"><b>&#127852;</b></div></label><label><span>NUMBER OF PUMPKINS</span><div class="input-wrap"><input id="pumpkinCount" type="number" min="1" max="30" value="12"><b>&#127875;</b></div></label></div><div class="question-source-block">${questionSourceOptions()}</div>${oddsPanel()}<button class="primary-btn start-btn" data-action="start">Start the game <span>&#8594;</span></button><p class="microcopy">Your game saves automatically on this device.</p></section></main>`;
}
function renderTeamInputs() {
 const count = +(document.querySelector('#teamCount')?.textContent || 4);
 const el = document.querySelector('#teamInputs'); if (!el) return;
 const source=document.querySelector('#questionSource');if(source){source.value=questionSource;const option=source.querySelector('option[value=custom]');option.disabled=!customQuestions.length;option.textContent='My questions ('+customQuestions.length+')';}
 const old = [...el.querySelectorAll('input')].map(x => x.value);
 el.innerHTML = Array.from({length:count},(_,i)=>`<label class="team-field"><span class="team-dot t${i}"></span><span class="sr-only">Team ${i+1} name</span><input maxlength="18" value="${esc(old[i]||`Team ${i+1}`)}" aria-label="Team ${i+1} name"></label>`).join('');
}
function scoreboard() {
 return `<aside class="score-panel"><div class="panel-title"><span>THE SCOREBOARD</span><span class="score-live"><i></i> LIVE</span></div><div class="score-list">${state.teams.map((t,i)=>`<div class="score-row ${t.id===state.currentTeamId?'active':''}"><span class="team-dot t${i%6}"></span><span class="score-team">${esc(t.name)}${t.skipTurns?'<small>Haunted turn</small>':''}</span><strong>${t.score}<small> candy</small></strong></div>`).join('')}</div><div class="score-footer"><button data-action="adjust">+ Adjust scores</button><button data-action="undo" ${state.history?.length?'':'disabled'}>Undo last action</button></div></aside>`;
}
function board() {
 const used = new Set(state.used), team = current();
 return `${header()}<main class="game-layout"><section class="board-area"><div class="turn-banner turn-arrival"><div class="turn-spotlight" aria-hidden="true"></div><div><span class="eyebrow orange">THE NIGHT IS YOUNG</span><h1 aria-live="polite">${esc(team.name)}<span>'s turn</span></h1></div><div class="turn-candy">&#127852; <b>${team.score}</b><small>CANDY</small></div></div><div class="board-instruction"><span class="instruction-icon">&#10022;</span><span>Choose a pumpkin to reveal your team's question.</span><span class="progress-count">${used.size} / ${state.pumpkinCount} OPENED</span></div><div class="pumpkin-grid">${Array.from({length:state.pumpkinCount},(_,i)=>`<button class="pumpkin-tile ${used.has(i)?'used':''}" data-action="choose-pumpkin" data-index="${i}" ${used.has(i)?'disabled':''} aria-label="${used.has(i)?'Used':'Choose'} pumpkin ${i+1}">${pumpkin(i+1,used.has(i))}<span>${used.has(i)?'OPENED':'PICK ME'}</span></button>`).join('')}</div></section>${scoreboard()}</main><footer class="game-footer"><span>&#10022; Choose wisely. The night is full of surprises.</span><div class="board-teacher-actions"><button data-action="end-game" class="subtle-btn">End game</button><button data-action="new-game" class="subtle-btn">Start new game</button></div></footer>`;
}
function choiceList(q) {
 return `<div class="choice-grid">${q.choices.map((c,i)=>`<button class="choice-btn ${selectedChoice===i?'picked':''} ${state.answerRevealed&&i===q.answer?'answer-good':''}" data-action="choose-answer" data-i="${i}"><span>${'ABCD'[i]}</span>${esc(c)}${state.answerRevealed&&i===q.answer?'<b>&#10003;</b>':''}</button>`).join('')}</div>`;
}
function question() {
 const q=state.question, team=current();
 let body = '';
 if(q.type==='build') body = `<div class="jp-prompt">${esc(q.jp)}</div><div class="answer-zone"><span class="zone-label">YOUR SENTENCE</span><div class="word-answer">${selectedWords.map((wi,i)=>`<button class="word-chip selected" data-action="remove-word" data-i="${i}">${esc(q.words[wi])} <small>x</small></button>`).join('')||'<span class="placeholder">Choose the words in order...</span>'}</div><button class="clear-words" data-action="clear-words">Clear sentence</button></div><div class="word-bank">${q.words.map((w,i)=>`<button class="word-chip ${selectedWords.includes(i)?'taken':''}" data-action="add-word" data-i="${i}" ${selectedWords.includes(i)?'disabled':''}>${esc(w)}</button>`).join('')}</div>`;
 else if(q.type==='vocab') body = `<div class="jp-prompt vocab-prompt"><small>WHAT'S THE ENGLISH WORD FOR...</small><strong>${esc(q.jp)}</strong></div>${choiceList(q)}`;
 else if(q.type==='grammar') body = `<div class="prompt-text">${esc(q.prompt)}</div>${choiceList(q)}`;
 else if(q.type==='mistake') body = state.answerRevealed
  ? `<div class="mistake-comparison"><div class="mistake-line mistake-original"><span>ORIGINAL · INCORRECT</span><p>${highlightChangedText(q.prompt,q.answer,'wrong-word')}</p></div><div class="mistake-line mistake-corrected"><span>CORRECTED SENTENCE</span><p>${highlightChangedText(q.answer,q.prompt,'correct-word')}</p></div></div>${q.note?`<div class="mistake-explanation"><span>WHY IS IT WRONG?</span><p>${esc(q.note)}</p></div>`:''}`
  : `<div class="prompt-text mistake-prompt">${esc(q.prompt)}</div><div class="teacher-hint">Read the sentence carefully. Can you find the mistake?</div>`;
 else body = `<div class="jp-prompt translate-prompt"><small>TRANSLATE THIS SENTENCE INTO ENGLISH</small><strong>${esc(q.jp)}</strong></div><div class="teacher-hint">Say your answer aloud. Your teacher will decide if it is correct.</div>`;
 const answer = q.type==='vocab'||q.type==='grammar' ? `${'ABCD'[q.answer]}. ${q.choices[q.answer]}` : q.answer;
 const hint=q.hint?`<div class="question-hint-area">${state.hintRevealed?`<div class="question-hint" role="status"><span>&#128161; HINT</span><p>${esc(q.hint)}</p></div>`:`<button class="hint-btn" data-action="reveal-hint">&#128161; Show a hint</button>`}</div>`:'';
 return `${header()}<main class="question-layout"><div class="question-sidebar">${scoreboard()}<div class="question-progress"><span>THE HAUNTED TRAIL</span><b>${state.used.length} <small>/ ${state.pumpkinCount}</small></b><i><em style="width:${Math.round(state.used.length/state.pumpkinCount*100)}%"></em></i></div></div><section class="question-card"><div class="question-meta"><span class="question-type">${TYPE_LABEL[q.type]}</span><span class="level ${q.level.toLowerCase()}">${q.level}</span><span class="q-number">PUMPKIN ${String(state.selectedPumpkin+1).padStart(2,'0')}</span></div><div class="question-team">${pumpkin(state.selectedPumpkin+1)}<span><small>IT'S YOUR TURN</small><b>${esc(team.name)}</b></span></div>${body}${hint}${state.answerRevealed&&q.type!=='mistake'?`<div class="model-answer"><span>MODEL ANSWER</span><strong>${esc(answer)}</strong>${q.note?`<small>${esc(q.note)}</small>`:''}</div>`:''}${state.resolved===null?`<div class="question-controls"><button class="outline-btn" data-action="reveal">Reveal answer</button><div class="grade-buttons"><button class="wrong-btn" data-action="grade-no">Incorrect</button><button class="right-btn" data-action="grade-yes" ${q.type==='build'&&!selectedWords.length?'disabled':''}>Correct</button></div></div>`:`<div class="resolved-note ${state.resolved?'good':'bad'}">${state.resolved?'Correct! Choose a Trick or Treat next.':'Not quite. No Candy this time.'}</div><button class="primary-btn continue-btn" data-action="question-continue">${state.resolved?'Choose a Trick or Treat':'Continue'} <span>&#8594;</span></button>`}</section></main>`;
}
function choiceScreen(){const team=current();return `${header()}<main class="choice-screen"><div class="choice-spotlight"></div><span class="eyebrow orange">${esc(team.name)} GOT IT RIGHT</span><h1>Now choose your<br><em>Halloween fate</em></h1><p class="choice-subtitle">Play it steady with a Treat or risk it all with a Trick.</p><div class="fate-options"><button class="fate-card trick-card" data-action="choose-trick"><span class="fate-art">&#128123;</span><span class="fate-kicker">HIGH RISK · HIGH DRAMA</span><strong>TRICK</strong><small>Could win big, lose Candy, steal, swap, or trigger a spooky event.</small><span class="fate-arrow">&#8594;</span></button><button class="fate-card treat-choice" data-action="choose-treat"><span class="fate-art trick-bag">&#127852;</span><span class="fate-kicker">STEADIER · SWEET</span><strong>TREAT</strong><small>Usually a little Candy. A rare roll can hit the jackpot.</small><span class="fate-arrow">&#8594;</span></button></div><div class="choice-score">CURRENT CANDY <b>&#127852; ${team.score}</b></div></main>`}
function trickScreen(){const team=current(),reward=state.trickReward||{points:10,icon:'🍬'};return `${header()}<main class="trick-screen"><div class="trick-glow"></div><span class="eyebrow orange">A SWEET TREAT!</span><h1>The candy bag<br>has a surprise…</h1><div class="big-candy-bag"><span class="bag-spark spark-left">&#10022;</span><span class="bag-emoji">&#127852;</span><span class="bag-spark spark-right">&#10023;</span></div><section class="trick-prize"><span class="prize-candy">${reward.icon}</span><strong>+${reward.points} CANDY!</strong><p>${esc(team.name)} found a sweet stash!</p></section><button class="primary-btn trick-continue" data-action="finish-trick">Back to the haunted trail <span>&#8594;</span></button><p class="choice-score">TOTAL CANDY <b>&#127852; ${team.score}</b></p></main>`}
function effectMessage(outcome,before,after,targetId){
 const teamBefore=before.teams.find(t=>t.id===before.currentTeamId),teamAfter=after.teams.find(t=>t.id===after.currentTeamId),targetBefore=before.teams.find(t=>t.id===targetId);
 switch(outcome.effect){
  case'gain':return `+${teamAfter.score-teamBefore.score} CANDY FOR ${teamAfter.name.toUpperCase()}!`;
  case'lose':{const lost=teamBefore.score-teamAfter.score;return lost?`${lost} CANDY HAS BEEN TAKEN!`:'NO CANDY LEFT TO TAKE!'}
  case'all_gain':return `EVERY TEAM GAINED ${outcome.amount} CANDY!`;
  case'swap':return `${teamAfter.name.toUpperCase()} AND ${(after.teams.find(t=>t.id===targetId)?.name||'THE OTHER TEAM').toUpperCase()} SWAPPED SCORES!`;
  case'steal':{const taken=teamAfter.score-teamBefore.score;return taken?`${taken} CANDY STOLEN FROM ${targetBefore?.name.toUpperCase()||'THE OTHER TEAM'}!`:'THERE WAS NO CANDY LEFT TO STEAL!'}
  case'skip':return `${teamAfter.name.toUpperCase()}'S NEXT TURN WILL BE HAUNTED!`;
  default:return outcome.description.toUpperCase();
 }
}
function treat(){
 const revealed=Boolean(state.outcome),art=['&#127875;','&#128123;','&#128376;','&#129514;','&#128273;','&#127769;'];
 const impact=state.eventImpact||(state.outcome?.effect==='swap'||state.outcome?.effect==='steal'?'CHOOSE A TEAM TO SEE WHAT HAPPENS NEXT':state.outcome?.description.toUpperCase());
 return `${header()}<main class="treat-screen ${revealed?'has-reveal event-'+state.outcome.id:''}">${revealed?`<section class="event-reveal"><div class="event-orbit orbit-a"></div><div class="event-orbit orbit-b"></div><span class="event-kicker">A TRICK IS REVEALED</span><div class="event-icon">${state.outcome.icon}</div><h1>${esc(state.outcome.name)}</h1><p class="event-description">${esc(state.outcome.description)}</p><div class="event-score-impact">${esc(impact)}</div><div class="event-total">${esc(current().name)} · 🍬 ${current().score} CANDY</div></section>`:`<div class="treat-top"><span class="eyebrow orange">ANSWER ACCEPTED · ${esc(current().name.toUpperCase())}</span><h1>Choose a <em>mystery trick</em></h1><p>Every object hides a different Halloween surprise.</p></div><div class="treat-grid">${state.cards.map((c,i)=>`<button class="treat-card" data-action="pick-treat" data-i="${i}"><span class="treat-number">${String(i+1).padStart(2,'0')}</span><span class="treat-object">${art[i%art.length]}</span><strong>${['Creepy candy','Ghostly glow','Black cat charm','Witch’s potion','Haunted key','Moonlit note'][i%6]}</strong><small>${['Something rustles inside…','A pale light flickers…','It purrs in the dark…','Bubbles rise to the top…','A cold wind escapes…','The paper whispers…'][i%6]}</small></button>`).join('')}</div><div class="skip-hint">Pick one. There is no telling what the night has planned.</div>`}${revealed&&['swap','steal'].includes(state.outcome.effect)?`<div class="target-picker"><label for="targetTeam">${state.outcome.effect==='swap'?'Choose a team to swap scores with':'Choose a team to steal from'}</label><select id="targetTeam"><option value="">Choose team...</option>${state.teams.filter(t=>t.id!==state.currentTeamId).map(t=>`<option value="${t.id}">${esc(t.name)} (${t.score} Candy)</option>`).join('')}</select><button class="small-primary" data-action="apply-target" ${state.effectApplied?'disabled':''}>Reveal the result</button></div>`:''}${revealed?`<button class="primary-btn continue-btn event-continue" data-action="finish-treat" ${!state.effectApplied?'disabled':''}>Continue <span>&#8594;</span></button>`:''}</main>`;
}
function leaderboard(){const standings=getStandings(state.teams),previous=state.leaderboardPrevious||state.previousLeaderboard||[];return `${header()}<main class="round-leaderboard"><div class="leaderboard-backdrop"></div><span class="eyebrow orange">THE SCOREBOARD SHIFTS</span><h1>Round ${state.roundNumber||1}<br><em>standings</em></h1><p class="leaderboard-intro">The teams have faced the night. See who climbed the ranks.</p><section class="leaderboard-table" aria-label="Round ${state.roundNumber||1} leaderboard">${standings.map((team,index)=>{const move=rankMovement(team.id,previous,team.rank);return `<article class="leaderboard-row ${index===0?'leaderboard-first':''}" style="--row-index:${index}"><span class="leaderboard-rank">${String(team.rank).padStart(2,'0')}</span><div class="leaderboard-team"><strong>${esc(team.name)}</strong><small>${index===0?'TOP OF THE HAUNTED TRAIL':`POSITION ${team.rank}`}</small></div><b class="leaderboard-score">${team.score}<small> CANDY</small></b><span class="leaderboard-movement ${move.className}" aria-label="${move.detail}">${move.label}</span></article>`}).join('')}</section><button class="primary-btn leaderboard-continue" data-action="continue-leaderboard">Continue to Round ${(state.roundNumber||1)+1} <span>&#8594;</span></button></main>`}
function results() {
 const high=Math.max(...state.teams.map(t=>t.score)), winners=state.teams.filter(t=>t.score===high);
 const previous=state.previousLeaderboard||[],standings=getStandings(state.teams);
 return `${header()}<main class="results-screen"><div class="result-confetti">&#10022; &#10023; &#10022; &#10023; &#10022;</div><span class="eyebrow orange">${state.endReason==='teacher'?'THE TEACHER ENDED THE GAME':'THE HAUNTED TRAIL IS COMPLETE'}</span><h1>${winners.length===1?'The winner is...':'It is a tie!'}</h1><div class="winner-name">${winners.map(t=>esc(t.name)).join(' & ')}</div><div class="winner-candy">&#127852; &nbsp;${high} Candy</div><section class="final-scores"><h2>FINAL SCOREBOARD · POSITION CHANGES</h2>${standings.map((team,i)=>{const move=rankMovement(team.id,previous,team.rank);return `<div class="final-row"><span class="rank">${String(team.rank).padStart(2,'0')}</span><span>${i===0?'&#127942; ':''}${esc(team.name)} <small class="final-movement ${move.className}">${move.label}</small></span><b>${team.score} <small>candy</small></b></div>`}).join('')}</section><div class="results-actions"><button class="outline-btn" data-action="return-setup">Return to setup</button><button class="primary-btn" data-action="return-setup">Start a new game <span>&#8594;</span></button></div><p class="microcopy">What a wickedly good game. See you next Halloween!</p></main>`;
}
function modal() {
 if(!state?.modal) return '';
 if(state.modal==='pause') return `<div class="modal-backdrop"><section class="modal"><span class="modal-icon">&#127769;</span><h2>Game paused</h2><p>Take a breath. Your progress is saved on this device.</p><button class="primary-btn" data-action="resume">Resume game <span>&#8594;</span></button><button class="text-btn" data-action="end-game">End game and show results</button><button class="text-btn" data-action="new-game">Start a new game</button></section></div>`;
 if(state.modal==='end') return `<div class="modal-backdrop"><section class="modal"><span class="modal-icon">&#127875;</span><h2>End this game?</h2><p>We’ll show the final scores and rankings. Your game results stay saved until you choose a new game.</p><button class="primary-btn" data-action="confirm-end">Show final results <span>&#8594;</span></button><button class="text-btn" data-action="close-modal">Keep playing</button></section></div>`;
 if(state.modal==='adjust') return `<div class="modal-backdrop"><section class="modal"><button class="modal-close" data-action="close-modal">&#215;</button><span class="eyebrow orange">TEACHER CONTROL</span><h2>Adjust Candy</h2><label class="modal-label">TEAM<select id="adjustTeam">${state.teams.map(t=>`<option value="${t.id}">${esc(t.name)} - ${t.score} Candy</option>`).join('')}</select></label><label class="modal-label">CHANGE (+ / -)<input id="adjustAmount" type="number" value="10"></label><button class="primary-btn" data-action="apply-adjust">Apply adjustment <span>&#8594;</span></button></section></div>`;
 return `<div class="modal-backdrop"><section class="modal"><span class="modal-icon">&#127875;</span><h2>Start a new game?</h2><p>Your current game will be replaced. This cannot be undone.</p><button class="primary-btn" data-action="confirm-new">Yes, start fresh <span>&#8594;</span></button><button class="text-btn" data-action="close-modal">Keep playing</button></section></div>`;
}
function render() {
 if(editorOpen){app.innerHTML=editor();return;}
 if(!state){if(pregameScreen==='intro'){app.innerHTML=intro();return;}app.innerHTML=setup();renderTeamInputs();return;}
 const page=state.phase==='board'?board():state.phase==='question'?question():state.phase==='choice'?choiceScreen():state.phase==='trick'?trickScreen():state.phase==='treat'?treat():state.phase==='leaderboard'?leaderboard():results();
 app.innerHTML=page+modal();
}
function shuffle(list){return [...list].sort(()=>Math.random()-.5)}
function startGame() {
 const names=[...document.querySelectorAll('#teamInputs input')].map((x,i)=>x.value.trim()||`Team ${i+1}`);
 const score=Math.max(0,Number(document.querySelector('#startingScore').value)||0);
 const count=Math.min(30,Math.max(1,Number(document.querySelector('#pumpkinCount').value)||12));
 questionSource=document.querySelector('#questionSource')?.value||'built-in';localStorage.setItem(QUESTION_SOURCE_KEY,questionSource);const sourcePool=questionSource==='custom'?customQuestions:QUESTIONS;if(!sourcePool.length){notify('Add some questions first.');return;}const pool=sourcePool.map(q=>({...q,hint:q.hint||QUESTION_HINTS[q.id]||''}));const playableCount=Math.min(count,pool.length);if(playableCount<count)notify(`This set has ${pool.length} questions, so the game will use ${playableCount} pumpkins.`);
 state={version:1,phase:'board',soundEnabled,questionPool:clone(pool),teams:names.map((name,i)=>({id:`team-${i}`,name,score,skipTurns:0})),currentTeamId:'team-0',pumpkinCount:playableCount,requestedPumpkinCount:count,used:[],questionOrder:shuffle(pool.map((_,i)=>i)),history:[],modal:null,roundNumber:1};state.previousLeaderboard=standingsSnapshot(state.teams);
 save(state);render();
}
function advance() {
 const previousIndex=state.teams.findIndex(team=>team.id===state.currentTeamId),next=nextTeam(state),nextIndex=next.teams.findIndex(team=>team.id===next.currentTeamId),wrapped=nextIndex<=previousIndex;
 next.question=null;next.outcome=null;next.cards=null;next.resolved=null;next.answerRevealed=false;next.hintRevealed=false;next.chosenCard=null;next.effectApplied=false;next.modal=null;
 if(wrapped&&next.phase==='board'){next.phase='leaderboard';next.roundNumber=state.roundNumber||1;next.leaderboardPrevious=state.previousLeaderboard||standingsSnapshot(state.teams);next.leaderboardCurrent=standingsSnapshot(next.teams);}
 selectedWords=[];selectedChoice=null;commit(next);if(next.phase==='leaderboard')playSound('reveal');else if(next.phase==='board')playSound('turn');
}
render();
document.addEventListener('change',e=>{
 if(e.target.matches('.odds-input')){const group=e.target.dataset.oddsGroup,id=e.target.dataset.oddsId,items=group==='trick'?OUTCOMES:TRICK_PRIZES;let selected=Math.max(0,Math.min(100,Math.round(Number(e.target.value)||0)));const others=items.filter(item=>item.id!==id),remaining=100-selected,oldTotal=others.reduce((sum,item)=>sum+chanceFor(group,item.id),0);prizeOdds[group][id]=selected;const shares=others.map(item=>({id:item.id,share:oldTotal?chanceFor(group,item.id)/oldTotal*remaining:remaining/others.length}));let assigned=0;shares.forEach(item=>{const value=Math.floor(item.share);prizeOdds[group][item.id]=value;item.remainder=item.share-value;assigned+=value});shares.sort((a,b)=>b.remainder-a.remainder).slice(0,remaining-assigned).forEach(item=>prizeOdds[group][item.id]++);localStorage.setItem(PRIZE_ODDS_KEY,JSON.stringify(prizeOdds));document.querySelectorAll(`.odds-input[data-odds-group="${group}"]`).forEach(input=>{input.value=chanceFor(group,input.dataset.oddsId);const output=document.querySelector(`[data-odds-value="${group}-${input.dataset.oddsId}"]`);if(output)output.textContent=`${chanceFor(group,input.dataset.oddsId)}%`});return;}
 if(e.target.id==='questionSource'){questionSource=e.target.value;localStorage.setItem(QUESTION_SOURCE_KEY,questionSource);}
 if(e.target.id==='questionSetName'){questionSetName=e.target.value.trim()||'My Halloween questions';localStorage.setItem(QUESTION_SET_NAME_KEY,questionSetName);e.target.value=questionSetName;}
 if(e.target.id==='customType'){const choices=['vocab','grammar'].includes(e.target.value);document.querySelector('#customOptions').hidden=!choices;document.querySelector('#customFreeAnswer').hidden=choices;document.querySelector('#customTileChunks').hidden=e.target.value!=='build';document.querySelector('#customExplanationLabel').textContent='OPTIONAL GRAMMAR EXPLANATION · WHY IS IT WRONG?';document.querySelector('#customPromptLabel').textContent=({build:'JAPANESE CLUE',vocab:'JAPANESE WORD OR MEANING',grammar:'ENGLISH SENTENCE WITH A BLANK',mistake:'SENTENCE WITH THE MISTAKE',translate:'JAPANESE SENTENCE TO TRANSLATE'})[e.target.value];}
 if(e.target.id==='questionFile'&&e.target.files?.[0]){const file=e.target.files[0],reader=new FileReader();reader.onload=()=>{try{const list=parseQuestionSet(String(reader.result));if(customQuestions.length&&!confirm('Replace your current custom question set with this file?'))return;customQuestions=list;if(list.setName){questionSetName=list.setName;localStorage.setItem(QUESTION_SET_NAME_KEY,questionSetName);}persistCustomQuestions();questionSource='custom';localStorage.setItem(QUESTION_SOURCE_KEY,'custom');editorOpen=true;render();notify('Question file uploaded.');}catch(err){notify(err.message||'Could not load that file.');}};reader.readAsText(file);e.target.value='';}
});
document.addEventListener('click', e => {
 const button=e.target.closest('[data-action]'); if(!button) return;
 const action=button.dataset.action;
 if(action==='reset-odds'){prizeOdds={trick:{...defaultPrizeOdds.trick},treat:{...defaultPrizeOdds.treat}};localStorage.setItem(PRIZE_ODDS_KEY,JSON.stringify(prizeOdds));document.querySelectorAll('.odds-input').forEach(input=>{input.value=chanceFor(input.dataset.oddsGroup,input.dataset.oddsId);const output=document.querySelector(`[data-odds-value="${input.dataset.oddsGroup}-${input.dataset.oddsId}"]`);if(output)output.textContent=`${input.value}%`;});notify('Prize chances reset to default.');return;}
 if(action==='fullscreen'){if(!document.fullscreenElement)document.documentElement.requestFullscreen?.();else document.exitFullscreen?.();return;}
 if(action==='sound-toggle'){soundEnabled=!soundEnabled;localStorage.setItem('midnight-candy-sound',soundEnabled?'on':'off');button.setAttribute('aria-pressed',String(soundEnabled));button.innerHTML=(soundEnabled?'&#128266;':'&#128263;')+' <span>Sound '+(soundEnabled?'on':'off')+'</span>';return;}
 if(action==='motion-toggle'){reducedMotion=!reducedMotion;localStorage.setItem('midnight-candy-motion',reducedMotion?'reduced':'full');document.documentElement.classList.toggle('reduce-motion',reducedMotion);button.setAttribute('aria-pressed',String(reducedMotion));button.innerHTML='&#10024; <span>Motion '+(reducedMotion?'reduced':'full')+'</span>';return;}
 if(action==='team-plus'||action==='team-minus'){
  const count=document.querySelector('#teamCount');count.textContent=Math.max(2,Math.min(6,Number(count.textContent)+(action==='team-plus'?1:-1)));renderTeamInputs();return;
 }
 if(action==='open-setup'){pregameScreen='setup';render();return;}
 if(action==='return-intro'){pregameScreen='intro';render();return;}
 if(action==='return-setup'){state=null;localStorage.removeItem('midnight-candy-game-v1');selectedWords=[];selectedChoice=null;pregameScreen='setup';render();return;}
 if(action==='start'){startGame();return;}
 if(action==='open-editor'){editorOpen=true;editingQuestionIndex=null;render();return;}
 if(action==='close-editor'){editorOpen=false;editingQuestionIndex=null;render();return;}
 if(action==='use-custom-questions'){if(!customQuestions.length)return;questionSource='custom';localStorage.setItem(QUESTION_SOURCE_KEY,'custom');editorOpen=false;render();notify('Your question set is ready for the next game.');return;}
 if(action==='edit-custom-question'){editingQuestionIndex=Number(button.dataset.i);render();document.querySelector('.editor-form-card')?.scrollIntoView({behavior:'smooth',block:'start'});document.querySelector('#customPrompt')?.focus();return;}
 if(action==='cancel-custom-edit'){editingQuestionIndex=null;render();return;}
 if(action==='add-custom-question'||action==='save-custom-question'){try{const updated=makeCustomQuestion({type:document.querySelector('#customType').value,prompt:document.querySelector('#customPrompt').value.trim(),answer:document.querySelector('#customAnswer').value.trim(),choicesText:document.querySelector('#customChoiceList')?.value||'',answerIndex:document.querySelector('#customAnswerIndex')?.value||1,level:document.querySelector('#customLevel').value,explanation:document.querySelector('#customExplanation')?.value||'',hint:document.querySelector('#customHint')?.value||'',tileChunksText:document.querySelector('#customTileChunksInput')?.value||''});if(action==='save-custom-question'){updated.id=customQuestions[editingQuestionIndex].id;customQuestions[editingQuestionIndex]=updated;editingQuestionIndex=null;}else customQuestions.push(updated);persistCustomQuestions();render();notify(action==='save-custom-question'?'Question changes saved.':'Question added to your set.');}catch(err){notify(err.message);}return;}
 if(action==='remove-custom-question'){customQuestions.splice(Number(button.dataset.i),1);persistCustomQuestions();if(!customQuestions.length)questionSource='built-in';render();notify('Question removed.');return;}
 if(action==='download-questions'){if(!customQuestions.length){notify('Add a question before saving a file.');return;}downloadQuestionSet(customQuestions,questionSetName);notify('Question file downloaded.');return;}
 if(action==='import-questions'){document.querySelector('#questionFile')?.click();return;}
 if(action==='pause'){state.modal='pause';save(state);render();return;}
 if(action==='resume'||action==='close-modal'){state.modal=null;save(state);render();return;}
 if(action==='end-game'){state.modal='end';render();return;}
 if(action==='new-game'){state.modal='new';render();return;}
 if(action==='confirm-end'){const next=clone(state);next.modal=null;next.phase='results';next.endReason='teacher';next.previousLeaderboard=next.previousLeaderboard||standingsSnapshot(next.teams);next.leaderboardPrevious=next.previousLeaderboard;commit(next);return;}
 if(action==='confirm-new'){state=null;localStorage.removeItem('midnight-candy-game-v1');selectedWords=[];selectedChoice=null;pregameScreen='setup';render();return;}
 if(action==='adjust'){state.modal='adjust';render();return;}
 if(action==='apply-adjust'){
  const before=clone(state),teamId=document.querySelector('#adjustTeam').value,amount=Number(document.querySelector('#adjustAmount').value)||0;
  const team=before.teams.find(t=>t.id===teamId);team.score=Math.max(0,team.score+amount);before.modal=null;commit(before);notify(`${team.name}'s score adjusted.`);return;
 }
 if(action==='undo'){
  if(!state.history?.length)return;
  const history=[...state.history],previous=history.pop();previous.history=history;
  if(previous.phase==='treat'&&previous.outcome&&!previous.effectApplied){previous.outcome=null;previous.chosenCard=null;previous.effectApplied=false;}
  state=previous;save(state);selectedWords=[];selectedChoice=null;render();notify('Last action undone.');return;
 }
 if(action==='choose-pumpkin'){
  const index=Number(button.dataset.index);if(state.used.includes(index))return;
  const questionIndex=state.questionOrder[state.used.length%state.questionOrder.length],next=clone(state);
  next.used.push(index);next.selectedPumpkin=index;next.question=(next.questionPool||QUESTIONS)[questionIndex];next.phase='question';next.resolved=null;next.answerRevealed=false;next.hintRevealed=false;next.selectedChoice=null;
  selectedWords=[];selectedChoice=null;commit(next);return;
 }
 if(action==='add-word'){const i=Number(button.dataset.i);if(!selectedWords.includes(i))selectedWords.push(i);render();return;}
 if(action==='remove-word'){selectedWords.splice(Number(button.dataset.i),1);render();return;}
 if(action==='clear-words'){selectedWords=[];render();return;}
 if(action==='choose-answer'){selectedChoice=Number(button.dataset.i);render();return;}
 if(action==='reveal-hint'){if(!state.question?.hint)return;state.hintRevealed=true;save(state);render();return;}
 if(action==='reveal'){state.answerRevealed=true;save(state);render();return;}
 if(action==='grade-yes'||action==='grade-no'){if(state.resolved!==null)return;state.resolved=action==='grade-yes';save(state);if(state.resolved)playSound('correct');render();return;}
 if(action==='question-continue'){
  if(state.resolved){const next=clone(state);next.phase='choice';next.cards=null;next.outcome=null;next.chosenCard=null;next.effectApplied=false;commit(next);}
  else advance();return;
 }
 if(action==='choose-trick'){
  const next=clone(state);next.phase='treat';next.cards=Array.from({length:6},()=>chooseByChance(OUTCOMES,'trick'));next.outcome=null;next.chosenCard=null;next.effectApplied=false;commit(next);return;
 }
 if(action==='choose-treat'){
  const next=clone(state),prize=chooseByChance(TRICK_PRIZES,'treat'),reward=prize.points;
  const team=next.teams.find(t=>t.id===next.currentTeamId);team.score+=reward;next.trickReward={points:reward,icon:prize.icon};next.phase='trick';recordHistory(next,state);commit(next,false);playSound('trick');return;
 }
 if(action==='continue-leaderboard'){const next=clone(state);next.phase='board';next.previousLeaderboard=next.leaderboardCurrent||standingsSnapshot(next.teams);next.leaderboardPrevious=null;next.leaderboardCurrent=null;next.roundNumber=(next.roundNumber||1)+1;commit(next);playSound('turn');return;}
 if(action==='finish-trick'){advance();return;}
 if(action==='pick-treat'){
  if(state.outcome)return;
  const before=clone(state),index=Number(button.dataset.i),outcome=before.cards[index];
  if(['swap','steal'].includes(outcome.effect)){state.outcome=outcome;state.chosenCard=index;state.effectApplied=false;state.eventImpact='CHOOSE A TEAM TO REVEAL THE CONSEQUENCE';save(state);render();playPrizeSound(outcome.id);return;}
  const next=applyOutcome(before,outcome);next.outcome=outcome;next.chosenCard=index;next.cards=before.cards;next.eventImpact=effectMessage(outcome,before,next);next.effectApplied=true;recordHistory(next,before);commit(next,false);playPrizeSound(outcome.id);notify('Outcome revealed. Scores updated.');return;
 }
 if(action==='apply-target'){
  if(state.effectApplied)return;
  const targetId=document.querySelector('#targetTeam').value;if(!targetId){notify('Choose a team first.');return;}
  const before=clone(state),next=applyOutcome(before,before.outcome,targetId);next.eventImpact=effectMessage(before.outcome,before,next,targetId);next.outcome=before.outcome;next.chosenCard=before.chosenCard;next.cards=before.cards;next.effectApplied=true;recordHistory(next,before);commit(next,false);notify('Effect applied. Scores updated.');return;
 }
 if(action==='finish-treat'){if(state.effectApplied)advance();return;}
});

