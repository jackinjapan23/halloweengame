export function renderQuestionEditor(list, escapeHtml, headerMarkup, editingIndex = null, setName = 'My Halloween questions', sets = [], activeSetId = '', confirmDelete = false) {
  const typeNames = { build: 'Sentence building', vocab: 'Vocabulary', grammar: 'Grammar', picture: 'Picture multiple choice', 'picture-open': 'Picture question · spoken answer', short: 'Simple spoken question', mistake: 'Fix the mistake', translate: 'Translation' };
  const rows = list.length ? list.map((q, i) => `
    <article class="custom-question-row">
      <span class="custom-question-number">${String(i + 1).padStart(2, '0')}</span>
      <button class="custom-question-edit" data-action="edit-custom-question" data-i="${i}" aria-label="Edit question ${i + 1}"><small>${typeNames[q.type] || 'Question'} · ${escapeHtml(q.level || 'MEDIUM')}</small>
      <strong>${escapeHtml((q.jp || q.prompt || '').slice(0, 100))}</strong>
      <p>${escapeHtml(['vocab', 'grammar', 'picture'].includes(q.type) ? q.choices?.[q.answer] || '' : q.answer || '')}</p><span class="edit-question-hint">Click to edit</span></button>
      <button class="remove-question" data-action="remove-custom-question" data-i="${i}" aria-label="Remove question ${i + 1}">&#215;</button>
    </article>`).join('') : '<div class="editor-empty"><span>&#127875;</span><strong>Your question book is empty</strong><p>Add your first question or upload a saved set.</p></div>';
  const editing = editingIndex === null ? null : list[editingIndex];
  const selected = value => (editing?.type || 'build') === value ? 'selected' : '';
  const choices = editing?.choices || [];
  const prompt = editing ? (editing.jp || editing.prompt || '') : '';
  const freeAnswer = editing && !['vocab', 'grammar', 'picture'].includes(editing.type) ? editing.answer : '';
  const tileChunks = editing?.tileGroups?.join('\n') || '';
  const choiceText = choices.length ? choices.join('\n') : '';
  const choiceNumber = editing && ['vocab', 'grammar', 'picture'].includes(editing.type) ? editing.answer + 1 : 1;
  return `${headerMarkup}<main class="editor-screen">
    <div class="editor-heading"><span class="eyebrow orange">TEACHER TOOL</span><h1>Your <em>question book</em></h1>
    <p>Questions save on this device. Make separate sets for different classes or lessons.</p></div>
    <div class="question-set-toolbar"><label class="editor-field"><span>OPEN A SAVED SET</span><select id="savedQuestionSet">${sets.map(s => `<option value="${escapeHtml(s.id)}" ${s.id === activeSetId ? 'selected' : ''}>${escapeHtml(s.name)} (${s.questions.length})</option>`).join('')}</select></label><button class="outline-btn new-question-set-btn" data-action="new-question-set">＋ Start a new question set</button><button class="outline-btn delete-question-set-btn" data-action="confirm-delete-question-set">Delete this set</button></div>
    ${confirmDelete ? `<section class="delete-set-warning" role="alertdialog" aria-labelledby="deleteSetTitle"><strong id="deleteSetTitle">Are you sure you want to delete “${escapeHtml(setName)}”?</strong><p>This permanently removes its ${list.length} question${list.length === 1 ? '' : 's'} from this browser. You can’t undo this.</p><div><button class="delete-set-confirm" data-action="delete-question-set">Yes, delete this set</button><button class="outline-btn" data-action="cancel-delete-question-set">Keep this set</button></div></section>` : ''}
    <div class="editor-columns">
      <section class="editor-form-card"><h2>${editing ? 'Edit question' : 'Add a question'}</h2>
        <label class="editor-field"><span>QUESTION TYPE</span><select id="customType">
          <option value="build" ${selected('build')}>Sentence building</option><option value="vocab" ${selected('vocab')}>Vocabulary multiple choice</option><option value="grammar" ${selected('grammar')}>Grammar multiple choice</option><option value="picture" ${selected('picture')}>Picture multiple choice</option><option value="short" ${selected('short')}>Simple question · spoken answer</option><option value="picture-open" ${selected('picture-open')}>Picture question · spoken answer</option><option value="mistake" ${selected('mistake')}>Fix the mistake</option><option value="translate" ${selected('translate')}>Translation</option>
        </select></label>
        <label class="editor-field"><span id="customPromptLabel">${({'build':'JAPANESE CLUE',vocab:'JAPANESE WORD OR MEANING',grammar:'ENGLISH SENTENCE WITH A BLANK',picture:'QUESTION FOR THE PICTURE',short:'QUESTION · STUDENTS ANSWER ALOUD', 'picture-open':'QUESTION FOR THE PICTURE · STUDENTS ANSWER ALOUD',mistake:'SENTENCE WITH THE MISTAKE',translate:'JAPANESE SENTENCE TO TRANSLATE'})[editing?.type || 'build']}</span><textarea id="customPrompt" rows="3" maxlength="240" placeholder="Write your question or clue">${escapeHtml(prompt)}</textarea></label>
        <div class="editor-field editor-picture-upload" id="customPictureField" ${['picture','picture-open'].includes(editing?.type) ? '' : 'hidden'}><span>UPLOAD A PICTURE FROM YOUR DEVICE</span><input id="customImageFile" type="file" accept="image/*"><textarea id="customImageData" hidden>${escapeHtml(editing?.image || '')}</textarea><img id="customImagePreview" class="editor-image-preview" src="${escapeHtml(editing?.image || '')}" alt="Question picture preview" ${editing?.image ? '' : 'hidden'}><small>Images are resized for the question set. The picture is saved with your questions and works offline.</small></div>
        <label class="editor-field"><span>OPTIONAL HINT · DOES NOT REVEAL THE ANSWER</span><textarea id="customHint" rows="2" maxlength="240" placeholder="Add a helpful clue for learners (optional)">${escapeHtml(editing?.hint || '')}</textarea></label>
        <label class="editor-field" id="customFreeAnswer" ${['vocab', 'grammar', 'picture'].includes(editing?.type) ? 'hidden' : ''}><span>CORRECT ANSWER</span><textarea id="customAnswer" rows="2" maxlength="240" placeholder="Write the answer students should give">${escapeHtml(freeAnswer)}</textarea></label>
        <label class="editor-field" id="customTileChunks" ${editing?.type === 'build' ? '' : 'hidden'}><span>ANSWER TILE CHUNKS · ONE SECTION PER LINE</span><textarea id="customTileChunksInput" rows="4" maxlength="400" placeholder="The boy&#10;riding the unicycle">${escapeHtml(tileChunks)}</textarea><small>Leave blank to make one tile per word. Keep the chunks in the same order as the correct answer.</small></label>
        <label class="editor-field" id="customExplanationField"><span id="customExplanationLabel">OPTIONAL GRAMMAR EXPLANATION · WHY IS IT WRONG?</span><textarea id="customExplanation" rows="3" maxlength="500" placeholder="Explain the grammar or why the answer is correct (optional)">${escapeHtml(editing?.note || '')}</textarea></label>
        <div id="customOptions" ${['vocab', 'grammar', 'picture'].includes(editing?.type) ? '' : 'hidden'}>
          <label class="editor-field"><span>FOUR ANSWER CHOICES · ONE PER LINE</span><textarea id="customChoiceList" rows="4" placeholder="Write one answer choice on each line">${escapeHtml(choiceText)}</textarea></label>
          <label class="editor-field"><span>NUMBER OF CORRECT CHOICE (1–4)</span><input id="customAnswerIndex" type="number" min="1" max="4" value="${choiceNumber}"></label>
        </div>
        <label class="editor-field"><span>DIFFICULTY</span><select id="customLevel"><option ${editing?.level === 'EASY' ? 'selected' : ''}>EASY</option><option ${!editing || editing.level === 'MEDIUM' ? 'selected' : ''}>MEDIUM</option><option ${editing?.level === 'HARD' ? 'selected' : ''}>HARD</option></select></label>
        <button class="primary-btn" data-action="${editing ? 'save-custom-question' : 'add-custom-question'}">${editing ? 'Save changes' : 'Add this question'} <span>${editing ? '&#10003;' : '&#43;'}</span></button>
        ${editing ? '<button class="outline-btn cancel-edit-btn" data-action="cancel-custom-edit">Cancel editing</button>' : ''}
        <p class="editor-note">For multiple choice, add exactly four options on separate lines and choose the correct option number. For sentence building, you can leave tiles as single words or enter your own larger chunks, one per line.</p>
      </section>
      <section class="editor-list-card"><div class="editor-list-heading"><div><span class="eyebrow orange">MY QUESTION SET</span><label class="set-name-field"><span>QUESTION SET NAME</span><input id="questionSetName" maxlength="60" value="${escapeHtml(setName)}"></label><h2>${list.length} questions</h2></div>
        <div class="editor-file-actions"><button class="outline-btn" data-action="download-questions">&#8595; Save file</button><button class="outline-btn" data-action="import-questions">&#8593; Upload file</button><input id="questionFile" type="file" accept=".json,application/json" hidden></div>
      </div><p class="editor-note">Uploading a file replaces this custom set.</p><div class="custom-question-list">${rows}</div></section>
    </div>
    <div class="editor-bottom-actions"><button class="outline-btn" data-action="close-editor">&#8592; Back to game setup</button>
      <button class="primary-btn editor-use-btn" data-action="use-custom-questions" ${list.length ? '' : 'disabled'}>Use my questions in the next game <span>&#8594;</span></button>
    </div>
  </main>`;
}

export function makeCustomQuestion({ type, prompt, answer, choicesText, answerIndex, level, explanation = '', hint = '', tileChunksText = '', image = '' }) {
  if (!prompt || ((!['vocab', 'grammar', 'picture'].includes(type)) && !answer)) throw new Error('Please fill in the question and correct answer.');
  const q = { id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, type, level, answer };
  if (type === 'build') {
    q.jp = prompt;
    const groups = tileChunksText.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    if (groups.length) {
      const compact = value => value.replace(/\s+/g, '').toLocaleLowerCase();
      if (compact(groups.join(' ')) !== compact(answer)) throw new Error('Your tile chunks must make the correct answer in order. Check the words and punctuation.');
      q.tileGroups = groups;
    }
    q.words = (groups.length ? groups : answer.split(/\s+/).filter(Boolean)).sort(() => Math.random() - 0.5);
  }
  else if (type === 'vocab' || type === 'grammar' || type === 'picture') {
    q.choices = choicesText.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    q.answer = Number(answerIndex) - 1;
    if (q.choices.length !== 4) throw new Error('Enter exactly four answer choices, one on each line.');
    if (q.answer < 0 || q.answer > 3) throw new Error('The correct choice number must be from 1 to 4.');
    if (type === 'vocab') q.jp = prompt; else q.prompt = prompt;
    if (type === 'picture') { if (!image.startsWith('data:image/')) throw new Error('Upload a picture for this question.'); q.image = image; }
  } else if (type === 'short') q.prompt = prompt;
  else if (type === 'picture-open') { q.prompt = prompt; if (!image.startsWith('data:image/')) throw new Error('Upload a picture for this question.'); q.image = image; }
  else if (type === 'mistake') q.prompt = prompt;
  else q.jp = prompt;
  if (explanation.trim()) q.note = explanation.trim();
  if (hint.trim()) q.hint = hint.trim();
  return q;
}

export function downloadQuestionSet(list, name = 'My Halloween questions') {
  const data = { format: 'midnight-candy-question-set', version: 1, name, questions: list };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'midnight-candy-questions.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseQuestionSet(text) {
  const parsed = JSON.parse(text), list = Array.isArray(parsed) ? parsed : parsed.questions;
  if (!Array.isArray(list) || !list.length) throw new Error('No questions were found in that file.');
  const valid = list.every(q => {
    if (!q || !['build', 'vocab', 'grammar', 'picture', 'picture-open', 'short', 'mistake', 'translate'].includes(q.type)) return false;
    if (q.hint !== undefined && typeof q.hint !== 'string') return false;
    if (q.tileGroups !== undefined && (!Array.isArray(q.tileGroups) || q.tileGroups.some(group => typeof group !== 'string' || !group.trim()))) return false;
    if (q.type === 'vocab') return Boolean(q.jp && Array.isArray(q.choices) && q.choices.length === 4 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4);
    if (q.type === 'grammar') return Boolean(q.prompt && Array.isArray(q.choices) && q.choices.length === 4 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4);
    if (q.type === 'picture') return Boolean(q.prompt && typeof q.image === 'string' && q.image.length <= 350000 && /^data:image\/(?:webp|png|jpeg|gif);base64,/i.test(q.image) && Array.isArray(q.choices) && q.choices.length === 4 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4);
    if (q.type === 'picture-open') return Boolean(q.prompt && typeof q.image === 'string' && q.image.length <= 350000 && /^data:image\/(?:webp|png|jpeg|gif);base64,/i.test(q.image) && typeof q.answer === 'string' && q.answer.trim());
    if (q.type === 'short') return Boolean(q.prompt && typeof q.answer === 'string' && q.answer.trim());
    if (typeof q.answer !== 'string') return false;
    if (q.type === 'build') return Boolean(q.jp && Array.isArray(q.words) && q.words.length);
    if (q.type === 'mistake') return Boolean(q.prompt);
    return Boolean(q.jp);
  });
  if (!valid) throw new Error('That file contains a question the game cannot use.');
  const questions = list.map((q, i) => ({ ...q, id: q.id || `imported-${Date.now()}-${i}`, level: ['EASY', 'MEDIUM', 'HARD'].includes(String(q.level).toUpperCase()) ? String(q.level).toUpperCase() : 'MEDIUM' }));
  questions.setName = typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim().slice(0, 60) : '';
  return questions;
}
