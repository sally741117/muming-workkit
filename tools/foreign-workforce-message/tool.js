(function () {
  const config = window.ForeignWorkforceMessageTemplates;
  const loc = window.ForeignWorkforceMessageLocalization;
  const root = document.querySelector('[data-foreign-workforce-tool]');
  if (!root || !config || !loc) return;
  const TOOL_ID = 'foreign-workforce-message';
  const PACK_ID = 'foreign-workforce';
  const state = { scenario: config.scenarios[0].id, language: 'id', tone: 'formal', displayMode: 'zh-first', selectedPhrases: new Set() };
  const els = { scenarioList: root.querySelector('[data-scenario-list]'), language: root.querySelector('[data-language-select]'), toneList: root.querySelector('[data-tone-list]'), fields: root.querySelector('[data-dynamic-fields]'), optionalSection: root.querySelector('[data-optional-section]'), optionalPhrases: root.querySelector('[data-optional-phrases]'), output: root.querySelector('[data-message-output]'), status: root.querySelector('[data-review-status]'), warning: root.querySelector('[data-localization-warnings]') };
  function scenario() { return config.scenarios.find((item) => item.id === state.scenario) || config.scenarios[0]; }
  function language() { return loc.languages.find((item) => item.id === state.language) || loc.languages[0]; }
  function template(lang, tone) { return config.data[state.scenario]?.[lang]?.[tone] || config.data[state.scenario]?.[lang]?.formal; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }
  function track(eventName, action) { window.WorkKitAnalytics?.[eventName]?.({ tool_id: TOOL_ID, pack_id: PACK_ID, language: state.language, scenario: state.scenario, action, page: location.pathname }); }
  function getFormValues() {
    const values = {};
    root.querySelectorAll('[data-dynamic-fields] input, [data-dynamic-fields] select').forEach((el) => {
      if (el.type === 'checkbox') { if (!values[el.name]) values[el.name] = []; if (el.checked) values[el.name].push(el.value); }
      else values[el.name] = el.value.trim();
    });
    return values;
  }
  function interpolate(text, values) { return text.replace(/\{([a-z0-9_]+)\}/g, (_, key) => values[key] ?? ''); }
  function buildContext(lang) { return loc.buildValues(scenario().fields, getFormValues(), lang); }
  function optionalText(lang) { const phrases = loc.optionalPhrases[lang] || {}; return Array.from(state.selectedPhrases).map((id) => phrases[id]).filter(Boolean).join('\n'); }
  function buildMessage(lang) {
    const context = buildContext(lang);
    const item = template(lang, state.tone);
    const base = interpolate(item.template, context.values).replace(/\s+([,.])/g, '$1').replace(/ +/g, ' ').trim();
    const extras = optionalText(lang);
    return { text: extras ? `${base}\n${extras}` : base, warnings: context.warnings, review: item.review_status };
  }
  function composeBilingual() { const zh = buildMessage('zh').text; const foreign = buildMessage(state.language).text; if (state.displayMode === 'foreign-only') return foreign; if (state.displayMode === 'foreign-first') return `${foreign}\n\n${zh}`; return `${zh}\n\n${foreign}`; }
  function fieldShell(label, body, extraClass = '') { return `<div class="field ${extraClass}"><label>${escapeHtml(label)}</label>${body}</div>`; }
  function renderNameField(field) {
    const zhLabel = config.fieldLabels[`${field.base}_zh`] || '中文姓名';
    const latinLabel = config.fieldLabels[`${field.base}_latin`] || '外語／護照英文姓名';
    return `<div class="fw-name-grid">${fieldShell(zhLabel, `<input class="control" name="${field.base}_zh" type="text" autocomplete="off" placeholder="例如：安妮">`)}${fieldShell(latinLabel, `<input class="control" name="${field.base}_latin" type="text" autocomplete="off" placeholder="例如：ANNI">`)}</div>`;
  }
  function renderPlaceField(field) {
    const options = Object.keys(loc.options.places);
    const selected = field.default || options[0];
    const optionHtml = options.map((id) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${escapeHtml(loc.optionLabel('places', id, 'zh'))}</option>`).join('');
    return fieldShell(config.fieldLabels[field.id] || field.id, `<select class="control" name="${field.id}_choice" data-place-choice="${field.id}">${optionHtml}</select><div class="fw-custom-place" data-custom-place="${field.id}" hidden><input class="control" name="${field.id}_zh" type="text" autocomplete="off" placeholder="中文地點"><input class="control" name="${field.id}_foreign" type="text" autocomplete="off" placeholder="外語或英文地點"></div>`);
  }
  function renderField(field) {
    const label = config.fieldLabels[field.id] || field.id;
    if (field.kind === 'name') return renderNameField(field);
    if (field.kind === 'date') return fieldShell(label, `<input class="control" name="${field.id}" type="date" autocomplete="off">`);
    if (field.kind === 'time') return fieldShell(label, `<input class="control" name="${field.id}" type="time" autocomplete="off">`);
    if (field.kind === 'text') return fieldShell(label, `<input class="control" name="${field.id}" type="text" autocomplete="off" value="${escapeHtml(field.default || '')}">`);
    if (field.kind === 'place') return renderPlaceField(field);
    if (field.kind === 'option') return fieldShell(label, `<select class="control" name="${field.id}">${field.options.map((id) => `<option value="${id}" ${id === field.default ? 'selected' : ''}>${escapeHtml(loc.optionLabel(field.group, id, 'zh'))}</option>`).join('')}</select>`);
    if (field.kind === 'multiOption') return fieldShell(label, `<div class="fw-check-list fw-option-list">${field.options.map((id) => `<label class="fw-check-item"><input type="checkbox" name="${field.id}" value="${id}" ${(field.default || []).includes(id) ? 'checked' : ''}> <span>${escapeHtml(loc.optionLabel(field.group, id, 'zh'))}</span></label>`).join('')}</div>`);
    return '';
  }
  function renderScenarios() { els.scenarioList.innerHTML = config.scenarios.map((item) => `<button class="${item.id === state.scenario ? 'is-active' : ''}" type="button" data-scenario-id="${item.id}">${escapeHtml(item.name)}</button>`).join(''); }
  function renderLanguages() { els.language.innerHTML = loc.languages.map((item) => `<option value="${item.id}">${escapeHtml(item.label)}</option>`).join(''); els.language.value = state.language; }
  function renderTones() { const allowed = scenario().tones; if (!allowed.includes(state.tone)) state.tone = allowed[0]; els.toneList.innerHTML = allowed.map((id) => `<button class="${id === state.tone ? 'is-active' : ''}" type="button" data-tone-id="${id}">${escapeHtml(config.tones[id])}</button>`).join(''); }
  function renderFields() { els.fields.innerHTML = `<p class="fw-field-note">外語姓名請填護照英文姓名或羅馬拼音；系統不會自動翻譯姓名、公司名稱與自訂地址。</p>${scenario().fields.map(renderField).join('')}`; }
  function renderOptionalPhrases() { const phraseIds = scenario().optional_phrases || []; els.optionalSection.hidden = phraseIds.length === 0; state.selectedPhrases = new Set(Array.from(state.selectedPhrases).filter((id) => phraseIds.includes(id))); els.optionalPhrases.innerHTML = phraseIds.map((id) => `<label class="fw-check-item"><input type="checkbox" value="${id}" ${state.selectedPhrases.has(id) ? 'checked' : ''}> <span>${escapeHtml(loc.optionalPhrases.zh[id])}</span></label>`).join(''); }
  function renderWarnings(warnings) { const unique = Array.from(new Map(warnings.map((warning) => [warning.type + warning.field, warning])).values()); els.warning.hidden = unique.length === 0; els.warning.innerHTML = unique.map((warning) => `<p>${escapeHtml(warning.message)}</p>`).join(''); }
  function renderOutput() {
    const zh = buildMessage('zh'); const foreign = buildMessage(state.language); const lang = language();
    els.status.textContent = foreign.review === 'reviewed' ? '已校對' : '待母語確認';
    renderWarnings(foreign.warnings);
    const cards = { zh: `<article class="fw-message-card"><h3>中文 <span class="fw-lang-tag">reviewed</span></h3><pre>${escapeHtml(zh.text)}</pre></article>`, foreign: `<article class="fw-message-card"><h3>${escapeHtml(lang.foreignLabel)} <span class="fw-lang-tag">${escapeHtml(foreign.review)}</span></h3><pre>${escapeHtml(foreign.text)}</pre></article>` };
    els.output.innerHTML = state.displayMode === 'foreign-only' ? cards.foreign : state.displayMode === 'foreign-first' ? cards.foreign + cards.zh : cards.zh + cards.foreign;
  }
  function renderCustomPlaces() { root.querySelectorAll('[data-place-choice]').forEach((select) => { const id = select.dataset.placeChoice; const custom = root.querySelector(`[data-custom-place="${id}"]`); if (custom) custom.hidden = select.value !== 'other'; }); }
  async function copyText(text, button, action, warnings = []) {
    if (warnings.length && !window.confirm('外語訊息仍有缺漏：\n' + Array.from(new Set(warnings.map((item) => item.message))).join('\n') + '\n\n仍要複製嗎？')) return;
    try { await navigator.clipboard.writeText(text); const original = button.textContent; button.textContent = '已複製'; setTimeout(() => { button.textContent = original; }, 1400); track('tool_copy', action); } catch (_) { track('tool_error', `${action}_failed`); }
  }
  async function shareTool(button) { try { await navigator.clipboard.writeText(location.href.split('#')[0]); const original = button.textContent; button.textContent = '已複製網址'; setTimeout(() => { button.textContent = original; }, 1400); track('tool_share', 'share_url'); } catch (_) { track('tool_error', 'share_failed'); } }
  function addRecentTool() { try { const recent = JSON.parse(localStorage.getItem('wk_recent_tools') || '[]').filter((id) => id !== TOOL_ID); recent.unshift(TOOL_ID); localStorage.setItem('wk_recent_tools', JSON.stringify(recent.slice(0, 8))); } catch (_) {} }
  function renderAll(action) { renderScenarios(); renderTones(); renderFields(); renderOptionalPhrases(); renderCustomPlaces(); renderOutput(); if (action) track('tool_generate', action); }
  root.addEventListener('click', (event) => {
    const scenarioButton = event.target.closest('[data-scenario-id]'); if (scenarioButton) { state.scenario = scenarioButton.dataset.scenarioId; state.selectedPhrases.clear(); renderAll('scenario_change'); return; }
    const toneButton = event.target.closest('[data-tone-id]'); if (toneButton) { state.tone = toneButton.dataset.toneId; renderTones(); renderOutput(); track('tool_generate', 'tone_change'); return; }
    const displayButton = event.target.closest('[data-display-mode]'); if (displayButton) { state.displayMode = displayButton.dataset.displayMode; root.querySelectorAll('[data-display-mode]').forEach((button) => button.classList.toggle('is-active', button === displayButton)); renderOutput(); track('tool_generate', `display_${state.displayMode}`); return; }
    if (event.target.closest('[data-generate-message]')) { renderOutput(); track('tool_generate', 'generate'); return; }
    if (event.target.closest('[data-clear-message]')) { root.querySelector('[data-message-form]').reset(); state.selectedPhrases.clear(); state.language = 'id'; state.tone = scenario().tones[0]; renderLanguages(); renderAll('clear'); return; }
    const copyBilingual = event.target.closest('[data-copy-bilingual]'); if (copyBilingual) { const foreign = buildMessage(state.language); copyText(composeBilingual(), copyBilingual, 'copy_bilingual', foreign.warnings); return; }
    const copyForeign = event.target.closest('[data-copy-foreign]'); if (copyForeign) { const foreign = buildMessage(state.language); copyText(foreign.text, copyForeign, 'copy_foreign', foreign.warnings); return; }
    const share = event.target.closest('[data-share-tool]'); if (share) shareTool(share);
  });
  root.addEventListener('change', (event) => {
    if (event.target.matches('[data-language-select]')) { state.language = event.target.value; renderOutput(); track('tool_generate', 'language_change'); return; }
    if (event.target.matches('[data-place-choice]')) { renderCustomPlaces(); renderOutput(); return; }
    if (event.target.closest('[data-optional-phrases]') && event.target.type === 'checkbox') { if (event.target.checked) state.selectedPhrases.add(event.target.value); else state.selectedPhrases.delete(event.target.value); renderOutput(); track('tool_generate', 'optional_phrase_change'); return; }
    if (event.target.closest('[data-dynamic-fields]')) renderOutput();
  });
  root.addEventListener('input', (event) => { if (event.target.closest('[data-dynamic-fields]')) renderOutput(); });
  renderScenarios(); renderLanguages(); renderAll(); addRecentTool(); track('tool_view', 'view');
})();
