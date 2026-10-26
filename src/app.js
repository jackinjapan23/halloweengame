import { QUESTIONS, TYPE_LABEL } from './questions.js';
import { OUTCOMES } from './outcomes.js';
import { applyOutcome, nextTeam, save, load, clone } from './engine.js';

const app = document.querySelector('#app');
const toastEl = document.querySelector('#toast');
let state = load() || null;
let selectedWords = [];
let selectedChoice = null;
let toastTimer;
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const current = () => state?.teams.find(t => t.id === state.currentTeamId);
function commit(next, undo = true) {
  if (undo && state) next.history = [...(state.history || []), clone(state)].slice(-30);
  state = next; save(state); render();
}
function notify(message) {
  toastEl.textContent = message; toastEl.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}
const pumpkin = (n, used = false) => `<span class="pumpkin ${used?'is-used':''}"><span class="pumpkin-shape">&#127875;</span><b>${String(n).padStart(2,'0')}</b></span>`;
function header() {
 return `<header class="topbar"><a class="brand" href="#"><span class="brand-icon">&#127875;</span><span><strong>MIDNIGHT CANDY</strong><small>A LITTLE ENGLISH. A LOT OF HALLOWEEN.</small></span></a><div class="top-actions"><button class="icon-btn" data-action="fullscreen">&#x26F6; <span>Full screen</span></button>${state&&state.phase!=='setup'?'<button class="icon-btn" data-action="pause">&#x275A;&#x275A; <span>Pause</span></button>':''}</div></header>`;
}
function setup() {
 return `${header()}<main class="setup-layout"><section class="hero"><div class="eyebrow"><span class="dot"></span> HALLOWEEN ENGLISH CHALLENGE <span class="dot"></span></div><h1>Midnight<br><em>Candy</em></h1><p class="hero-copy">A little English. A lot of Halloween.<br>Pick a pumpkin, answer together, and see what the night has in store.</p><div class="hero-art"><span class="hero-moon"></span><span class="hero-ghost ghost-a">&#128123;</span><span class="hero-ghost ghost-b">&#129415;</span><span class="hero-pumpkin">&#127875;</span><span class="spark s1">&#10022;</span><span class="spark s2">&#10023;</span><span class="hero-grass"></span></div><div class="feature-row"><span>&#10022; 24 classroom-ready questions</span><span>&#10022; 10 spooky outcomes</span><span>&#10022; Works offline</span></div></section><section class="setup-card"><div class="card-heading"><div><span class="eyebrow orange">TEACHER SETUP</span><h2>Prepare your game</h2></div><div class="setup-badge">About 1 minute</div></div><label class="field-label">NUMBER OF TEAMS</label><div class="stepper"><button data-action="team-minus" aria-label="Fewer teams">&#8722;</button><strong id="teamCount">4</strong><button data-action="team-plus" aria-label="More teams">+</button><span>teams - choose 2&#8211;6</span></div><div class="team-inputs" id="teamInputs"></div><div class="field-grid"><label><span>STARTING CANDY</span><div class="input-wrap"><input id="startingScore" type="number" min="0" max="999" value="0"><b>&#127852;</b></div></label><label><span>NUMBER OF PUMPKINS</span><div class="input-wrap"><input id="pumpkinCount" type="number" min="1" max="20" value="12"><b>&#127875;</b></div></label></div><button class="primary-btn start-btn" data-action="start">Start the game <span>&#8594;</span></button><p class="microcopy">Your game saves automatically on this device.</p></section></main>`;
}
function renderTeamInputs() {
 const count = +(document.querySelector('#teamCount')?.textContent || 4);
 const el = document.querySelector('#teamInputs'); if (!el) return;
 const old = [...el.querySelectorAll('input')].map(x => x.value);
 el.innerHTML = Array.from({length:count},(_,i)=>`<label class="team-field"><span class="team-dot t${i}"></span><span class="sr-only">Team ${i+1} name</span><input maxlength="18" value="${esc(old[i]||`Team ${i+1}`)}" aria-label="Team ${i+1} name"></label>`).join('');
}
function scoreboard() {
 return `<aside class="score-panel"><div class="panel-title"><span>THE SCOREBOARD</span><span class="score-live"><i></i> LIVE</span></div><div class="score-list">${state.teams.map((t,i)=>`<div class="score-row ${t.id===state.currentTeamId?'active':''}"><span class="team-dot t${i%6}"></span><span class="score-team">${esc(t.name)}${t.skipTurns?'<small>Haunted turn</small>':''}</span><strong>${t.score}<small> candy</small></strong></div>`).join('')}</div><div class="score-footer"><button data-action="adjust">+ Adjust scores</button><button data-action="undo" ${state.history?.length?'':'disabled'}>Undo last action</button></div></aside>`;
}
function board() {
 const used = new Set(state.used), team = current();
 return `${header()}<main class="game-layout"><section class="board-area"><div class="turn-banner"><div><span class="eyebrow orange">THE NIGHT IS YOUNG</span><h1>${esc(team.name)}<span>'s turn</span></h1></div><div class="turn-candy">&#127852; <b>${team.score}</b><small>CANDY</small></div></div><div class="board-instruction"><span class="instruction-icon">&#10022;</span><span>Choose a pumpkin to reveal your team's question.</span><span class="progress-count">${used.size} / ${state.pumpkinCount} OPENED</span></div><div class="pumpkin-grid">${Array.from({length:state.pumpkinCount},(_,i)=>`<button class="pumpkin-tile ${used.has(i)?'used':''}" data-action="choose-pumpkin" data-index="${i}" ${used.has(i)?'disabled':''} aria-label="${used.has(i)?'Used':'Choose'} pumpkin ${i+1}">${pumpkin(i+1,used.has(i))}<span>${used.has(i)?'OPENED':'PICK ME'}</span></button>`).join('')}</div></section>${scoreboard()}</main><footer class="game-footer"><span>&#10022; Choose wisely. The night is full of surprises.</span><button data-action="new-game" class="subtle-btn">Start new game</button></footer>`;
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
 else if(q.type==='mistake') body = `<div class="prompt-text mistake-prompt">${esc(q.prompt)}</div><div class="teacher-hint">Read the sentence carefully. Can you find the mistake?</div>`;
 else body = `<div class="jp-prompt translate-prompt"><small>TRANSLATE THIS SENTENCE INTO ENGLISH</small><strong>${esc(q.jp)}</strong></div><div class="teacher-hint">Say your answer aloud. Your teacher will decide if it is correct.</div>`;
 const answer = q.type==='vocab'||q.type==='grammar' ? `${'ABCD'[q.answer]}. ${q.choices[q.answer]}` : q.answer;
 return `${header()}<main class="question-layout">${scoreboard()}<section class="question-card"><div class="question-meta"><span class="question-type">${TYPE_LABEL[q.type]}</span><span class="level ${q.level.toLowerCase()}">${q.level}</span><span class="q-number">PUMPKIN ${String(state.selectedPumpkin+1).padStart(2,'0')}</span></div><div class="question-team">${pumpkin(state.selectedPumpkin+1)}<span><small>IT'S YOUR TURN</small><b>${esc(team.name)}</b></span></div>${body}${state.answerRevealed?`<div class="model-answer"><span>MODEL ANSWER</span><strong>${esc(answer)}</strong>${q.note?`<small>${esc(q.note)}</small>`:''}</div>`:''}${state.resolved===null?`<div class="question-controls"><button class="outline-btn" data-action="reveal">Reveal answer</button><div class="grade-buttons"><button class="wrong-btn" data-action="grade-no">Incorrect</button><button class="right-btn" data-action="grade-yes" ${q.type==='build'&&!selectedWords.length?'disabled':''}>Correct</button></div></div>`:`<div class="resolved-note ${state.resolved?'good':'bad'}">${state.resolved?'Correct! Choose a Trick or Treat next.':'Not quite. No Candy this time.'}</div><button class="primary-btn continue-btn" data-action="question-continue">${state.resolved?'Choose a Trick or Treat':'Continue'} <span>&#8594;</span></button>`}</section></main>`;
}
function treat() {
 return `${header()}<main class="treat-screen"><div class="treat-scoreboard">${scoreboard()}</div><div class="treat-top"><span class="eyebrow orange">ANSWER ACCEPTED</span><h1>Choose your <em>Trick or Treat</em></h1><p>${esc(current().name)} earned the right to choose. What is hiding inside?</p></div><div class="treat-grid">${state.cards.map((c,i)=>`<button class="treat-card ${state.outcome&&state.chosenCard===i?'revealed':''}" data-action="pick-treat" data-i="${i}" ${state.outcome?'disabled':''}><span class="treat-number">${String(i+1).padStart(2,'0')}</span><span class="treat-object">${state.outcome&&state.chosenCard===i?c.icon:['&#127875;','&#127852;','&#128367;','&#129514;','&#128376;','&#128123;'][i]}</span><strong>${state.outcome&&state.chosenCard===i?esc(c.name):'Mystery treat'}</strong><small>${state.outcome&&state.chosenCard===i?esc(c.description):'Tap to reveal'}</small></button>`).join('')}</div>${state.outcome?`${['swap','steal'].includes(state.outcome.effect)?`<div class="target-picker"><label for="targetTeam">${state.outcome.effect==='swap'?'Choose a team to swap scores with':'Choose a team to steal from'}</label><select id="targetTeam"><option value="">Choose team...</option>${state.teams.filter(t=>t.id!==state.currentTeamId).map(t=>`<option value="${t.id}">${esc(t.name)} (${t.score} Candy)</option>`).join('')}</select><button class="small-primary" data-action="apply-target" ${state.effectApplied?'disabled':''}>Apply effect</button></div>`:''}<div class="treat-result"><span class="result-icon">${state.outcome.icon}</span><div><b>${esc(state.outcome.name)}</b><p>${esc(state.outcome.description)} ${state.effectApplied?'<span class="applied-tag">SCORES UPDATED</span>':''}</p></div></div><button class="primary-btn continue-btn" data-action="finish-treat" ${!state.effectApplied?'disabled':''}>Continue <span>&#8594;</span></button>`:`<div class="skip-hint">Choose one object to uncover its secret.</div>`}</main>`;
}
function results() {
 const high=Math.max(...state.teams.map(t=>t.score)), winners=state.teams.filter(t=>t.score===high);
 return `${header()}<main class="results-screen"><div class="result-confetti">&#10022; &#10023; &#10022; &#10023; &#10022;</div><span class="eyebrow orange">THE NIGHT IS OVER</span><h1>${winners.length===1?'The winner is...':'It is a tie!'}</h1><div class="winner-name">${winners.map(t=>esc(t.name)).join(' & ')}</div><div class="winner-candy">&#127852; &nbsp;${high} Candy</div><section class="final-scores"><h2>FINAL SCOREBOARD</h2>${[...state.teams].sort((a,b)=>b.score-a.score).map((t,i)=>`<div class="final-row"><span class="rank">${String(i+1).padStart(2,'0')}</span><span>${i===0?'&#127942; ':''}${esc(t.name)}</span><b>${t.score} <small>candy</small></b></div>`).join('')}</section><button class="primary-btn" data-action="new-game">Start a new game <span>&#8594;</span></button><p class="microcopy">What a wickedly good game. See you next Halloween!</p></main>`;
}
function modal() {
 if(!state?.modal) return '';
 if(state.modal==='pause') return `<div class="modal-backdrop"><section class="modal"><span class="modal-icon">&#127769;</span><h2>Game paused</h2><p>Take a breath. Your progress is saved on this device.</p><button class="primary-btn" data-action="resume">Resume game <span>&#8594;</span></button><button class="text-btn" data-action="new-game">Start a new game</button></section></div>`;
 if(state.modal==='adjust') return `<div class="modal-backdrop"><section class="modal"><button class="modal-close" data-action="close-modal">&#215;</button><span class="eyebrow orange">TEACHER CONTROL</span><h2>Adjust Candy</h2><label class="modal-label">TEAM<select id="adjustTeam">${state.teams.map(t=>`<option value="${t.id}">${esc(t.name)} - ${t.score} Candy</option>`).join('')}</select></label><label class="modal-label">CHANGE (+ / -)<input id="adjustAmount" type="number" value="10"></label><button class="primary-btn" data-action="apply-adjust">Apply adjustment <span>&#8594;</span></button></section></div>`;
 return `<div class="modal-backdrop"><section class="modal"><span class="modal-icon">&#127875;</span><h2>Start a new game?</h2><p>Your current game will be replaced. This cannot be undone.</p><button class="primary-btn" data-action="confirm-new">Yes, start fresh <span>&#8594;</span></button><button class="text-btn" data-action="close-modal">Keep playing</button></section></div>`;
}
function render() {
 if(!state){app.innerHTML=setup();renderTeamInputs();return;}
 const page=state.phase==='board'?board():state.phase==='question'?question():state.phase==='treat'?treat():results();
 app.innerHTML=page+modal();
}
function shuffle(list){return [...list].sort(()=>Math.random()-.5)}
function startGame() {
 const names=[...document.querySelectorAll('#teamInputs input')].map((x,i)=>x.value.trim()||`Team ${i+1}`);
 const score=Math.max(0,Number(document.querySelector('#startingScore').value)||0);
 const count=Math.min(20,Math.max(1,Number(document.querySelector('#pumpkinCount').value)||12));
 state={version:1,phase:'board',teams:names.map((name,i)=>({id:`team-${i}`,name,score,skipTurns:0})),currentTeamId:'team-0',pumpkinCount:count,used:[],questionOrder:shuffle(QUESTIONS.map((_,i)=>i)),history:[],modal:null};
 save(state);render();
}
function advance() {
 const next=nextTeam(state);next.question=null;next.outcome=null;next.cards=null;next.resolved=null;next.answerRevealed=false;next.chosenCard=null;next.effectApplied=false;next.modal=null;
 selectedWords=[];selectedChoice=null;commit(next);
}
render();
document.addEventListener('click', e => {
 const button=e.target.closest('[data-action]'); if(!button) return;
 const action=button.dataset.action;
 if(action==='fullscreen'){if(!document.fullscreenElement)document.documentElement.requestFullscreen?.();else document.exitFullscreen?.();return;}
 if(action==='team-plus'||action==='team-minus'){
  const count=document.querySelector('#teamCount');count.textContent=Math.max(2,Math.min(6,Number(count.textContent)+(action==='team-plus'?1:-1)));renderTeamInputs();return;
 }
 if(action==='start'){startGame();return;}
 if(action==='pause'){state.modal='pause';save(state);render();return;}
 if(action==='resume'||action==='close-modal'){state.modal=null;save(state);render();return;}
 if(action==='new-game'){state.modal='new';render();return;}
 if(action==='confirm-new'){state=null;localStorage.removeItem('midnight-candy-game-v1');selectedWords=[];selectedChoice=null;render();return;}
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
  next.used.push(index);next.selectedPumpkin=index;next.question=QUESTIONS[questionIndex];next.phase='question';next.resolved=null;next.answerRevealed=false;next.selectedChoice=null;
  selectedWords=[];selectedChoice=null;commit(next);return;
 }
 if(action==='add-word'){const i=Number(button.dataset.i);if(!selectedWords.includes(i))selectedWords.push(i);render();return;}
 if(action==='remove-word'){selectedWords.splice(Number(button.dataset.i),1);render();return;}
 if(action==='clear-words'){selectedWords=[];render();return;}
 if(action==='choose-answer'){selectedChoice=Number(button.dataset.i);render();return;}
 if(action==='reveal'){state.answerRevealed=true;save(state);render();return;}
 if(action==='grade-yes'||action==='grade-no'){if(state.resolved!==null)return;state.resolved=action==='grade-yes';save(state);render();return;}
 if(action==='question-continue'){
  if(state.resolved){const next=clone(state);next.phase='treat';next.cards=shuffle(OUTCOMES).slice(0,6);next.outcome=null;next.chosenCard=null;next.effectApplied=false;commit(next);}
  else advance();return;
 }
 if(action==='pick-treat'){
  if(state.outcome)return;
  const before=clone(state),index=Number(button.dataset.i),outcome=before.cards[index];
  if(['swap','steal'].includes(outcome.effect)){state.outcome=outcome;state.chosenCard=index;state.effectApplied=false;save(state);render();return;}
  const next=applyOutcome(before,outcome);next.outcome=outcome;next.chosenCard=index;next.cards=before.cards;next.effectApplied=true;next.history=[...(before.history||[]),before].slice(-30);commit(next,false);notify('Outcome revealed. Scores updated.');return;
 }
 if(action==='apply-target'){
  if(state.effectApplied)return;
  const targetId=document.querySelector('#targetTeam').value;if(!targetId){notify('Choose a team first.');return;}
  const before=clone(state),next=applyOutcome(before,before.outcome,targetId);next.outcome=before.outcome;next.chosenCard=before.chosenCard;next.cards=before.cards;next.effectApplied=true;next.history=[...(before.history||[]),before].slice(-30);commit(next,false);notify('Effect applied. Scores updated.');return;
 }
 if(action==='finish-treat'){if(state.effectApplied)advance();return;}
});

