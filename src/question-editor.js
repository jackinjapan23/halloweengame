export function renderQuestionEditor(list, escapeHtml, headerMarkup) {
  const typeNames = { build: 'Sentence building', vocab: 'Vocabulary', grammar: 'Grammar', mistake: 'Fix the mistake', translate: 'Translation' };
  const rows = list.length ? list.map((q, i) => `
    <article class="custom-question-row">
      <span class="custom-question-number">${String(i + 1).padStart(2, '0')}</span>
      <div><small>${typeNames[q.type] || 'Question'} · ${escapeHtml(q.level || 'MEDIUM')}</small>
      <strong>${escapeHtml((q.jp || q.prompt || '').slice(0, 100))}</strong>
      <p>${escapeHtml(q.type === 'vocab' || q.type === 'grammar' ? q.choices?.[q.answer] || '' : q.answer || '')}</p></div>
      <button class="remove-question" data-action="remove-custom-question" data-i="${i}" aria-label="Remove question ${i + 1}">&#215;</button>
    </article>`).join('') : '<div class="editor-empty"><span>&#127875;</span><strong>Your question book is empty</strong><p>Add your first question or upload a saved set.</p></div>';
  return `${headerMarkup}<main class="editor-screen">
    <div class="editor-heading"><span class="eyebrow orange">TEACHER TOOL</span><h1>Your <em>question book</em></h1>
    <p>Questions save on this device. Download a file to keep a backup or upload it later.</p></div>
    <div class="editor-columns">
      <section class="editor-form-card"><h2>Add a question</h2>
        <label class="editor-field"><span>QUESTION TYPE</span><select id="customType">
          <option value="build">Sentence building</option><option value="vocab">Vocabulary</option><option value="grammar">Grammar multiple choice</option><option value="mistake">Fix the mistake</option><option value="translate">Translation</option>
        </select></label>
        <label class="editor-field"><span id="customPromptLabel">JAPANESE CLUE</span><textarea id="customPrompt" rows="3" maxlength="240" placeholder="Write your question or clue"></textarea></label>
        <label class="editor-field" id="customFreeAnswer"><span>CORRECT ANSWER</span><textarea id="customAnswer" rows="2" maxlength="240" placeholder="Write the answer students should give"></textarea></label>
        <label class="editor-field" id="customExplanationField"><span id="customExplanationLabel">OPTIONAL GRAMMAR EXPLANATION</span><textarea id="customExplanation" rows="3" maxlength="500" placeholder="Explain the grammar rule in simple language (optional)"></textarea></label>
        <div id="customOptions" hidden>
          <label class="editor-field"><span>FOUR ANSWER CHOICES · ONE PER LINE</span><textarea id="customChoiceList" rows="4" placeholder="Write one answer choice on each line"></textarea></label>
          <label class="editor-field"><span>NUMBER OF CORRECT CHOICE (1–4)</span><input id="customAnswerIndex" type="number" min="1" max="4" value="1"></label>
        </div>
        <label class="editor-field"><span>DIFFICULTY</span><select id="customLevel"><option>EASY</option><option selected>MEDIUM</option><option>HARD</option></select></label>
        <button class="primary-btn" data-action="add-custom-question">Add this question <span>&#43;</span></button>
        <p class="editor-note">For multiple choice, add exactly four options on separate lines and choose the correct option number. For build questions, the answer is split into word tiles automatically.</p>
      </section>
      <section class="editor-list-card"><div class="editor-list-heading"><div><span class="eyebrow orange">MY QUESTION SET</span><h2>${list.length} questions</h2></div>
        <div class="editor-file-actions"><button class="outline-btn" data-action="download-questions">&#8595; Save file</button><button class="outline-btn" data-action="import-questions">&#8593; Upload file</button><input id="questionFile" type="file" accept=".json,application/json" hidden></div>
      </div><p class="editor-note">Uploading a file replaces this custom set.</p><div class="custom-question-list">${rows}</div></section>
    </div>
    <div class="editor-bottom-actions"><button class="outline-btn" data-action="close-editor">&#8592; Back to game setup</button>
      <button class="primary-btn editor-use-btn" data-action="use-custom-questions" ${list.length ? '' : 'disabled'}>Use my questions in the next game <span>&#8594;</span></button>
    </div>
  </main>`;
}

export function makeCustomQuestion({ type, prompt, answer, choicesText, answerIndex, level, explanation = '' }) {
  if (!prompt || ((!['vocab', 'grammar'].includes(type)) && !answer)) throw new Error('Please fill in the question and correct answer.');
  const q = { id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, type, level, answer };
  if (type === 'build') { q.jp = prompt; q.words = answer.split(/\s+/).filter(Boolean).sort(() => Math.random() - 0.5); }
  else if (type === 'vocab' || type === 'grammar') {
    q.choices = choicesText.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    q.answer = Number(answerIndex) - 1;
    if (q.choices.length !== 4) throw new Error('Enter exactly four answer choices, one on each line.');
    if (q.answer < 0 || q.answer > 3) throw new Error('The correct choice number must be from 1 to 4.');
    if (type === 'vocab') q.jp = prompt; else q.prompt = prompt;
  } else if (type === 'mistake') q.prompt = prompt;
  else q.jp = prompt;
  if (explanation.trim()) q.note = explanation.trim();
  return q;
}

export function downloadQuestionSet(list) {
  const data = { format: 'midnight-candy-question-set', version: 1, questions: list };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'midnight-candy-questions.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseQuestionSet(text) {
  const parsed = JSON.parse(text), list = Array.isArray(parsed) ? parsed : parsed.questions;
  if (!Array.isArray(list) || !list.length) throw new Error('No questions were found in that file.');
  const valid = list.every(q => {
    if (!q || !['build', 'vocab', 'grammar', 'mistake', 'translate'].includes(q.type)) return false;
    if (q.type === 'vocab') return Boolean(q.jp && Array.isArray(q.choices) && q.choices.length === 4 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4);
    if (q.type === 'grammar') return Boolean(q.prompt && Array.isArray(q.choices) && q.choices.length === 4 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4);
    if (typeof q.answer !== 'string') return false;
    if (q.type === 'build') return Boolean(q.jp && Array.isArray(q.words) && q.words.length);
    if (q.type === 'mistake') return Boolean(q.prompt);
    return Boolean(q.jp);
  });
  if (!valid) throw new Error('That file contains a question the game cannot use.');
  return list.map((q, i) => ({ ...q, id: q.id || `imported-${Date.now()}-${i}`, level: ['EASY', 'MEDIUM', 'HARD'].includes(String(q.level).toUpperCase()) ? String(q.level).toUpperCase() : 'MEDIUM' }));
}
