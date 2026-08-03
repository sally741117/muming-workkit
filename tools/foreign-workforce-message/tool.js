(function () {
  const config = window.ForeignWorkforceMessageTemplates;
  const loc = window.ForeignWorkforceMessageLocalization;
  const root = document.querySelector('[data-foreign-workforce-tool]');
  if (!root || !config || !loc) return;

  const TOOL_ID = 'foreign-workforce-message';
  const PACK_ID = 'foreign-workforce';
  const scenarioIcons = { onboarding: '到', interview: '面', medical: '檢', passport_arc: '證', missing_documents: '補', pickup: '接' };
  const state = { scenario: config.scenarios[0].id, language: 'id', tone: 'formal', displayMode: 'zh-first', selectedPhrases: new Set(), generated: false, activeStep: 1 };
  const els = {
    scenarioList: root.querySelector('[data-scenario-list]'),
    moreScenarios: root.querySelector('[data-more-scenarios]'),
    language: root.querySelector('[data-language-select]'),
    languageSummary: root.querySelector('[data-language-summary]'),
    languagePanel: root.querySelector('[data-language-panel]'),
    toneList: root.querySelector('[data-tone-list]'),
    fields: root.querySelector('[data-dynamic-fields]'),
    optionalFields: root.querySelector('[data-optional-fields]'),
    optionalSection: root.querySelector('[data-optional-section]'),
    optionalPhrases: root.querySelector('[data-optional-phrases]'),
    warning: root.querySelector('[data-localization-warnings]'),
    resultZh: root.querySelector('[data-result-card="zh"]'),
    resultForeign: root.querySelector('[data-result-card="foreign"]'),
    fieldContext: root.querySelector('[data-field-context]')
  };

  function scenario() { return config.scenarios.find((item) => item.id === state.scenario) || config.scenarios[0]; }
  function language() { return loc.languages.find((item) => item.id === state.language) || loc.languages[0]; }
  function template(lang, tone) { return config.data[state.scenario]?.[lang]?.[tone] || config.data[state.scenario]?.[lang]?.formal; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }
  function track(eventName, action) { window.WorkKitAnalytics?.[eventName]?.({ tool_id: TOOL_ID, pack_id: PACK_ID, language: state.language, scenario: state.scenario, action, page: location.pathname }); }

  function focusCard() {
    const card = root.querySelector('.fw-flow-card');
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) card?.animate([{ opacity: .7 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
    card?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  }
  function setStep(step, shouldFocus = true) {
    state.activeStep = step;
    root.querySelectorAll('[data-step-view]').forEach((view) => { view.hidden = Number(view.dataset.stepView) !== step; });
    root.querySelectorAll('[data-step-item]').forEach((item) => {
      const itemStep = Number(item.dataset.stepItem);
      item.classList.toggle('is-active', itemStep === step);
      item.classList.toggle('is-complete', itemStep < step);
    });
    if (shouldFocus) focusCard();
  }

  function hasHan(value) { return /[\u3400-\u9fff]/.test(String(value || '')); }
  function normalizeDateValue(value) {
    if (!value) return value;
    const match = String(value).trim().match(/^(\d{2,4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (!match) return value;
    let year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!year || !month || !day) return value;
    if (year < 1912) year += 1911;
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  function findPresetPlaceByChinese(label) {
    const normalized = String(label || '').trim();
    if (!normalized) return '';
    const alias = loc.locationAliases?.[normalized];
    if (alias) return Object.keys(loc.options.places || {}).find((id) => loc.optionLabel('places', id, 'zh') === alias) || '';
    return Object.keys(loc.options.places || {}).find((id) => loc.optionLabel('places', id, 'zh') === normalized) || '';
  }
  function targetLanguageName(lang = state.language) {
    return loc.languageNames?.[lang] || language().foreignLabel || '目標語言';
  }
  function targetPlaceFieldName(id, lang = state.language) {
    return `${id}_${lang}`;
  }
  function commonPlaceOptions() {
    return Object.entries(loc.options.places || {}).filter(([id]) => id !== 'other');
  }
  function rocToIso(year, month, day) {
    const rocYear = Number(year);
    const monthNum = Number(month);
    const dayNum = Number(day);
    if (!rocYear || !monthNum || !dayNum) return '';
    const fullYear = rocYear + 1911;
    const date = new Date(fullYear, monthNum - 1, dayNum);
    if (date.getFullYear() !== fullYear || date.getMonth() !== monthNum - 1 || date.getDate() !== dayNum) return '';
    return `${fullYear}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
  }
  function syncSegmentedDate(group) {
    const year = group.querySelector('[data-date-part="year"]');
    const month = group.querySelector('[data-date-part="month"]');
    const day = group.querySelector('[data-date-part="day"]');
    const target = root.querySelector(`[name="${group.dataset.dateTarget}"]`);
    if (!year || !month || !day || !target) return;
    const iso = rocToIso(year.value, month.value, day.value);
    target.value = iso;
    const complete = year.value.length === 3 && month.value.length >= 1 && day.value.length >= 1;
    const valid = !complete || !!iso;
    [year, month, day].forEach((input) => input.setCustomValidity(valid ? '' : '請輸入有效日期'));
  }
  function hydrateSegmentedDate(group, raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (digits.length < 7) return false;
    const year = digits.slice(0, 3);
    const month = digits.slice(3, 5);
    const day = digits.slice(5, 7);
    group.querySelector('[data-date-part="year"]').value = year;
    group.querySelector('[data-date-part="month"]').value = month;
    group.querySelector('[data-date-part="day"]').value = day;
    syncSegmentedDate(group);
    return true;
  }
  function prepareValues(values) {
    scenario().fields.forEach((field) => {
      if (field.kind === 'date') values[field.id] = normalizeDateValue(values[field.id]);
      if (field.kind === 'place') {
        const zh = values[`${field.id}_zh`] || '';
        const preset = findPresetPlaceByChinese(zh);
        values[`${field.id}_choice`] = preset || 'other';
      }
    });
    return values;
  }
  function getFormValues() {
    const values = {};
    root.querySelectorAll('[data-message-form] input, [data-message-form] select').forEach((el) => {
      if (!el.name) return;
      if (el.type === 'checkbox') {
        if (!values[el.name]) values[el.name] = [];
        if (el.checked) values[el.name].push(el.value);
      } else values[el.name] = el.value.trim();
    });
    return prepareValues(values);
  }
  function interpolate(text, values) { return text.replace(/\{([a-z0-9_]+)\}/g, (_, key) => values[key] ?? ''); }
  function cleanMessage(text) {
    return text
      .replace(/，並攜帶。/g, '。')
      .replace(/請攜帶。/g, '')
      .replace(/請記得攜帶。/g, '')
      .replace(/攜帶：。/g, '')
      .replace(/聯絡人：。/g, '')
      .replace(/Narahubung: \./g, '')
      .replace(/Kontak: \./g, '')
      .replace(/Bawa: \./g, '')
      .replace(/Mohon membawa \./g, '')
      .replace(/\bdi \./gi, '.')
      .replace(/Lokasi: \./g, '')
      .replace(/\bdi di\b/gi, 'di')
      .replace(/Người liên hệ: \./g, '')
      .replace(/Liên hệ: \./g, '')
      .replace(/Mang theo: \./g, '')
      .replace(/Vui lòng mang theo \./g, '')
      .replace(/\btại \./gi, '.')
      .replace(/Địa điểm: \./g, '')
      .replace(/ผู้ติดต่อ: ?/g, '')
      .replace(/ติดต่อ: ?/g, '')
      .replace(/เอกสาร: ?/g, '')
      .replace(/กรุณานำ\s*มาด้วย/g, '')
      .replace(/ที่\s+(กรุณา|ผู้ติดต่อ|เอกสาร|ติดต่อ|$)/g, '$1')
      .replace(/สถานที่:\s*(เอกสาร|ติดต่อ|$)/g, '$1')
      .replace(/\s+([,.。])/g, '$1')
      .replace(/。+/g, '。')
      .replace(/ +/g, ' ')
      .trim();
  }
  function buildContext(lang) { return loc.buildValues(scenario().fields, getFormValues(), lang); }
  function optionalText(lang) { const phrases = loc.optionalPhrases[lang] || {}; return Array.from(state.selectedPhrases).map((id) => phrases[id]).filter(Boolean).join('\n'); }
  function buildMessage(lang) {
    const context = buildContext(lang);
    const item = template(lang, state.tone);
    const base = cleanMessage(interpolate(item.template, context.values));
    const extras = optionalText(lang);
    const warnings = context.warnings.filter((warning) => warning.type !== 'missing_foreign_name');
    return { text: extras ? `${base}\n${extras}` : base, warnings, review: item.review_status };
  }
  function composeBilingual() {
    const zh = buildMessage('zh').text;
    const foreign = buildMessage(state.language).text;
    if (state.displayMode === 'foreign-only') return foreign;
    if (state.displayMode === 'foreign-first') return `${foreign}\n\n${zh}`;
    return `${zh}\n\n${foreign}`;
  }

  function requiredMark(required) { return required ? ' <small>必填</small>' : ' <small>選填</small>'; }
  function fieldShell(label, body, required = true, extraClass = '') { return `<div class="field ${extraClass}"><label>${escapeHtml(label)}${requiredMark(required)}</label>${body}</div>`; }
  function isPrimaryField(field, index) {
    if (field.kind === 'name' && field.base === 'recipient') return true;
    if (field.kind === 'date' || field.kind === 'time') return true;
    if (field.kind === 'place') return scenario().fields.findIndex((item) => item.kind === 'place') === index;
    return false;
  }
  function renderMainNameField(field) {
    return fieldShell('姓名', `<input class="control" name="${field.base}_zh" type="text" autocomplete="name" placeholder="例如：安妮" required>`, true);
  }
  function renderOptionalNameField(field) {
    if (field.base === 'recipient') return fieldShell('護照英文姓名', `<input class="control" name="${field.base}_latin" type="text" autocomplete="off" placeholder="例如：ANNI">`, false);
    const label = config.fieldLabels[`${field.base}_zh`] || '中文聯絡人';
    const latinLabel = config.fieldLabels[`${field.base}_latin`] || '外語／英文聯絡人';
    return `<div class="fw-name-grid">${fieldShell(label, `<input class="control" name="${field.base}_zh" type="text" autocomplete="off">`, false)}${fieldShell(latinLabel, `<input class="control" name="${field.base}_latin" type="text" autocomplete="off">`, false)}</div>`;
  }
  function renderOptionalNameField(field) {
    if (field.base === 'recipient') return fieldShell('護照英文姓名／羅馬拼音姓名', `<input class="control" name="${field.base}_latin" type="text" autocomplete="off" placeholder="例如：ANNI">`, false);
    const label = config.fieldLabels[`${field.base}_zh`] || '中文聯絡人';
    const latinLabel = config.fieldLabels[`${field.base}_latin`] || '羅馬拼音姓名';
    return `<div class="fw-name-grid">${fieldShell(label, `<input class="control" name="${field.base}_zh" type="text" autocomplete="off">`, false)}${fieldShell(latinLabel, `<input class="control" name="${field.base}_latin" type="text" autocomplete="off">`, false)}</div>`;
  }
  function renderMainPlaceField(field) {
    const label = config.fieldLabels[field.id] || '地點';
    return fieldShell(label, `<input type="hidden" name="${field.id}_choice" value="other"><input class="control" name="${field.id}_zh" type="text" autocomplete="off" placeholder="例如：公司一樓" required>`, true);
  }
  function renderLanguagePlaceField(field, lang) {
    const languageName = targetLanguageName(lang);
    const label = `${languageName}地點`;
    const hint = `系統無法自動翻譯自由輸入的地點，請補充${languageName}寫法。`;
    return `<div class="field" data-place-lang-field="${field.id}" data-lang="${lang}" ${lang === state.language ? '' : 'hidden'}><label><span data-place-lang-label>${escapeHtml(label)}</span> <small>選填</small></label><input class="control" name="${targetPlaceFieldName(field.id, lang)}" type="text" autocomplete="off" data-place-lang-input="${field.id}" data-lang="${lang}" placeholder="${escapeHtml(label)}"><p class="fw-field-hint">${escapeHtml(hint)}</p></div>`;
  }
  function renderOptionalPlaceField(field) {
    return loc.languages.map((item) => renderLanguagePlaceField(field, item.id)).join('');
  }
  function renderMainPlaceField(field) {
    const label = config.fieldLabels[field.id] || '地點';
    const options = commonPlaceOptions().map(([id, item]) => `<option value="${id}" ${id === field.default ? 'selected' : ''}>${escapeHtml(item['zh-Hant'])}</option>`).join('');
    const defaultLabel = loc.optionLabel('places', field.default, 'zh') || '';
    return fieldShell(label, `<input type="hidden" name="${field.id}_choice" value="${escapeHtml(field.default || 'other')}"><select class="control" data-common-place="${field.id}"><option value="other">其他地點</option>${options}</select><input class="control" name="${field.id}_zh" type="text" autocomplete="off" placeholder="例如：公司一樓" value="${escapeHtml(defaultLabel)}" required>`, true, 'fw-place-field');
  }
  function renderDateField(field, required = true) {
    const label = config.fieldLabels[field.id] || field.id;
    const body = `<input type="hidden" name="${field.id}"><div class="fw-date-parts" data-date-control data-date-target="${field.id}"><input class="control" data-date-part="year" type="text" inputmode="numeric" maxlength="3" placeholder="民國年" ${required ? 'required' : ''}><span>/</span><input class="control" data-date-part="month" type="text" inputmode="numeric" maxlength="2" placeholder="月" ${required ? 'required' : ''}><span>/</span><input class="control" data-date-part="day" type="text" inputmode="numeric" maxlength="2" placeholder="日" ${required ? 'required' : ''}></div>`;
    return fieldShell(label, body, required, 'fw-field--date');
  }
  function renderField(field, required = true) {
    const label = config.fieldLabels[field.id] || field.id;
    if (field.kind === 'name') return required ? renderMainNameField(field) : renderOptionalNameField(field);
    if (field.kind === 'date') return renderDateField(field, required);
    if (field.kind === 'time') return fieldShell(label, `<input class="control" name="${field.id}" type="time" autocomplete="off" step="60" data-time-picker ${required ? 'required' : ''}>`, required, 'fw-field--time');
    if (field.kind === 'text') return fieldShell(label, `<input class="control" name="${field.id}" type="text" autocomplete="off" value="${escapeHtml(required ? field.default || '' : '')}">`, required);
    if (field.kind === 'place') return required ? renderMainPlaceField(field) : renderOptionalPlaceField(field);
    if (field.kind === 'option') return fieldShell(label, `<select class="control" name="${field.id}"><option value="">不指定</option>${field.options.map((id) => `<option value="${id}" ${id === field.default ? 'selected' : ''}>${escapeHtml(loc.optionLabel(field.group, id, 'zh'))}</option>`).join('')}</select>`, required);
    if (field.kind === 'multiOption') return fieldShell(label, `<div class="fw-check-list fw-option-list">${field.options.map((id) => `<label class="fw-check-item"><input type="checkbox" name="${field.id}" value="${id}"> <span>${escapeHtml(loc.optionLabel(field.group, id, 'zh'))}</span></label>`).join('')}</div>`, required);
    return '';
  }

  function renderScenarios() {
    const primary = config.scenarios.slice(0, 6);
    const extra = config.scenarios.slice(6);
    const scenarioButton = (item, extraClass = '') => `<button class="${item.id === state.scenario ? 'is-active' : ''} ${extraClass}" type="button" data-scenario-id="${item.id}"><span class="fw-scenario-icon">${escapeHtml(scenarioIcons[item.id] || item.name.slice(0, 1))}</span><span>${escapeHtml(item.name)}</span></button>`;
    els.scenarioList.innerHTML = primary.map((item) => scenarioButton(item)).join('') + extra.map((item) => scenarioButton(item, 'is-extra-scenario')).join('');
    if (els.moreScenarios) els.moreScenarios.hidden = extra.length === 0;
  }
  function syncLanguageSpecificFields() {
    root.querySelectorAll('[data-place-lang-field]').forEach((field) => {
      field.hidden = field.dataset.lang !== state.language;
      const languageName = targetLanguageName(field.dataset.lang);
      const label = field.querySelector('[data-place-lang-label]');
      const input = field.querySelector('[data-place-lang-input]');
      const hint = field.querySelector('.fw-field-hint');
      if (label) label.textContent = `${languageName}地點`;
      if (input) input.placeholder = `${languageName}地點`;
      if (hint) hint.textContent = `系統無法自動翻譯自由輸入的地點，請補充${languageName}寫法。`;
      if (field.hidden && input) clearFieldError(input);
    });
  }
  function renderLanguages() {
    els.language.innerHTML = loc.languages.map((item) => `<option value="${item.id}">${escapeHtml(item.label)}</option>`).join('');
    els.language.value = state.language;
    els.languageSummary.textContent = language().label;
    syncLanguageSpecificFields();
  }
  function renderTones() {
    const allowed = scenario().tones;
    if (!allowed.includes(state.tone)) state.tone = allowed[0];
    els.toneList.innerHTML = allowed.map((id) => `<button class="${id === state.tone ? 'is-active' : ''}" type="button" data-tone-id="${id}">${escapeHtml(config.tones[id])}</button>`).join('');
  }
  function renderFields() {
    const fields = scenario().fields;
    const primary = [];
    const optional = [];
    fields.forEach((field, index) => (isPrimaryField(field, index) ? primary : optional).push(field));
    const optionalCompanions = primary.map((field) => {
      if (field.kind === 'name') return renderOptionalNameField(field);
      if (field.kind === 'place') return renderOptionalPlaceField(field);
      return '';
    }).filter(Boolean);
    els.fieldContext.textContent = `${scenario().name}只需要先填主要資料，其他內容可稍後補充。`;
    els.fields.innerHTML = primary.map((field) => renderField(field, true)).join('');
    els.optionalFields.innerHTML = optionalCompanions.join('') + optional.map((field) => renderField(field, false)).join('');
    els.optionalSection.open = false;
    els.optionalSection.hidden = optional.length === 0 && !(scenario().optional_phrases || []).length && scenario().tones.length <= 1;
  }
  function renderOptionalPhrases() {
    const phraseIds = scenario().optional_phrases || [];
    state.selectedPhrases = new Set(Array.from(state.selectedPhrases).filter((id) => phraseIds.includes(id)));
    els.optionalPhrases.innerHTML = phraseIds.length ? `<div class="field"><label>備註 <small>選填</small></label>${phraseIds.map((id) => `<label class="fw-check-item"><input type="checkbox" value="${id}" ${state.selectedPhrases.has(id) ? 'checked' : ''}> <span>${escapeHtml(loc.optionalPhrases.zh[id])}</span></label>`).join('')}</div>` : '';
  }
  function renderWarnings(warnings) {
    const unique = Array.from(new Map(warnings.map((warning) => [warning.type + warning.field, warning])).values());
    els.warning.hidden = unique.length === 0;
    els.warning.innerHTML = unique.map((warning) => {
      if (warning.type === 'missing_place_translation') {
        return `<p>${escapeHtml(warning.message)}</p><button class="button button-small button-outline" type="button" data-supplement-place="${escapeHtml(warning.field)}">補充${escapeHtml(targetLanguageName())}地點</button>`;
      }
      return `<p>${escapeHtml(warning.message)}</p>`;
    }).join('');
  }
  function renderWarnings(warnings) {
    const unique = Array.from(new Map(warnings.map((warning) => [warning.type + warning.field, warning])).values());
    els.warning.hidden = unique.length === 0;
    els.warning.innerHTML = unique.map((warning) => {
      if (warning.type === 'missing_place_translation') {
        return `<p>${escapeHtml(warning.message)}</p><button class="button button-small button-outline" type="button" data-supplement-place="${escapeHtml(warning.field)}">補充${escapeHtml(targetLanguageName())}地點</button>`;
      }
      return `<p>${escapeHtml(warning.message)}</p>`;
    }).join('');
  }
  function fieldSelector(name) {
    return `[name="${String(name).replace(/"/g, '\\"')}"]`;
  }
  function clearFieldError(input) {
    if (!input?.name) return;
    input.classList.remove('is-error');
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
    const field = input.closest('.field') || input.parentElement;
    field?.querySelectorAll(`[data-field-error="${input.name}"]`).forEach((item) => item.remove());
  }
  function clearValidationErrors() {
    root.querySelectorAll('[data-message-form] .is-error').forEach((input) => {
      input.classList.remove('is-error');
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    });
    root.querySelectorAll('[data-field-error]').forEach((item) => item.remove());
  }
  function showFieldError(issue) {
    const input = root.querySelector(fieldSelector(issue.field));
    if (!input) return null;
    const field = input.closest('.field') || input.parentElement;
    clearFieldError(input);
    input.classList.add('is-error');
    input.setAttribute('aria-invalid', 'true');
    const errorId = `fw-error-${issue.field}`;
    input.setAttribute('aria-describedby', errorId);
    const message = document.createElement('p');
    message.id = errorId;
    message.className = 'fw-field-error';
    message.dataset.fieldError = issue.field;
    message.textContent = issue.message;
    field?.appendChild(message);
    return input;
  }
  function showValidationIssues(issues) {
    clearValidationErrors();
    if (!issues.length) return false;
    if (els.optionalSection) els.optionalSection.open = true;
    const inputs = issues.map((issue) => showFieldError(issue)).filter(Boolean);
    const firstInput = inputs[0];
    if (firstInput) {
      firstInput.scrollIntoView({
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'center'
      });
      window.setTimeout(() => firstInput.focus({ preventScroll: true }), 80);
    }
    return true;
  }
  function foreignValidationIssues() {
    const values = getFormValues();
    const issues = [];
    scenario().fields.forEach((field) => {
      if (field.kind === 'place') {
        const isOther = values[`${field.id}_choice`] === 'other';
        const hasChinesePlace = !!values[`${field.id}_zh`];
        const targetField = targetPlaceFieldName(field.id);
        const hasTargetPlace = !!values[targetField];
        if (isOther && hasChinesePlace && !hasTargetPlace) {
          issues.push({
            field: targetField,
            message: `請補充${targetLanguageName()}地點，避免訊息混入中文。`
          });
        }
      }
      if (field.kind === 'text' && hasHan(values[field.id])) {
        issues.push({
          field: field.id,
          message: `${config.fieldLabels[field.id] || field.id} 含有中文，請改用英文或外語內容。`
        });
      }
    });
    return issues.filter((issue, index, list) => list.findIndex((item) => item.field === issue.field && item.message === issue.message) === index);
  }
  function foreignValidationIssues() {
    const values = getFormValues();
    const issues = [];
    scenario().fields.forEach((field) => {
      if (field.kind === 'place') {
        const isOther = values[`${field.id}_choice`] === 'other';
        const hasChinesePlace = !!values[`${field.id}_zh`];
        const targetField = targetPlaceFieldName(field.id);
        const hasTargetPlace = !!values[targetField];
        if (isOther && hasChinesePlace && !hasTargetPlace) {
          const languageName = targetLanguageName();
          issues.push({
            field: targetField,
            message: `請補充${languageName}地點，避免訊息混入中文。`
          });
        }
      }
      if (field.kind === 'text' && hasHan(values[field.id])) {
        issues.push({
          field: field.id,
          message: `${config.fieldLabels[field.id] || field.id} 含有中文，請改用目標語言內容。`
        });
      }
    });
    return issues.filter((issue, index, list) => list.findIndex((item) => item.field === issue.field && item.message === issue.message) === index);
  }
  function unusedLegacyForeignValidationMessages() {
    const values = getFormValues();
    const messages = [];
    scenario().fields.forEach((field) => {
      if (field.kind === 'place') {
        const isOther = values[`${field.id}_choice`] === 'other';
        const hasChinesePlace = !!values[`${field.id}_zh`];
        const hasTargetPlace = !!values[targetPlaceFieldName(field.id)];
        if (isOther && hasChinesePlace && !hasTargetPlace) messages.push(`請補充${targetLanguageName()}地點，避免訊息混入中文。`);
      }
      if (field.kind === 'text' && hasHan(values[field.id])) messages.push(`${config.fieldLabels[field.id] || field.id} 含有中文，請改用英文或外語內容。`);
    });
    return Array.from(new Set(messages));
  }
  function foreignValidationIssues() {
    const values = getFormValues();
    const issues = [];
    scenario().fields.forEach((field) => {
      if (field.kind === 'text' && hasHan(values[field.id])) {
        issues.push({
          field: field.id,
          message: `${config.fieldLabels[field.id] || field.id} 含有中文，請改用目標語言內容。`
        });
      }
    });
    return issues.filter((issue, index, list) => list.findIndex((item) => item.field === issue.field && item.message === issue.message) === index);
  }
  function renderOutput() {
    if (!state.generated) {
      els.resultZh.innerHTML = '';
      els.resultForeign.innerHTML = '';
      els.warning.hidden = true;
      return;
    }
    const zh = buildMessage('zh');
    const foreign = buildMessage(state.language);
    renderWarnings(foreign.warnings);
    els.resultZh.innerHTML = `<h3>中文 <span class="fw-lang-tag">中文範本已確認</span></h3><pre>${escapeHtml(zh.text)}</pre><button class="button button-small button-secondary" type="button" data-copy-lang="zh">複製中文</button>`;
    els.resultForeign.innerHTML = `<h3>${escapeHtml(language().foreignLabel)} <span class="fw-lang-tag">外語待母語確認</span></h3><pre>${escapeHtml(foreign.text)}</pre><button class="button button-small button-secondary" type="button" data-copy-lang="${state.language}">複製外語</button>`;
  }
  function validateForm() { return root.querySelector('[data-message-form]').reportValidity(); }
  function generateMessage() {
    if (!validateForm()) return;
    if (showValidationIssues(foreignValidationIssues())) return;
    state.generated = true;
    renderOutput();
    setStep(3);
    track('tool_generate', 'generate');
  }
  async function copyText(text, button, action, warnings = []) {
    warnings = warnings.filter((item) => item.type !== 'missing_place_translation');
    if (warnings.length && !window.confirm('外語訊息仍有缺漏：\n' + Array.from(new Set(warnings.map((item) => item.message))).join('\n') + '\n\n仍要複製嗎？')) return;
    try {
      await navigator.clipboard.writeText(text);
      const original = button.textContent;
      button.textContent = '已複製';
      setTimeout(() => { button.textContent = original; }, 1400);
      track('tool_copy', action);
    } catch (_) { track('tool_error', `${action}_failed`); }
  }
  async function shareTool(button) {
    try {
      await navigator.clipboard.writeText(location.href.split('#')[0]);
      const original = button.textContent;
      button.textContent = '已複製網址';
      setTimeout(() => { button.textContent = original; }, 1400);
      track('tool_share', 'share_url');
    } catch (_) { track('tool_error', 'share_failed'); }
  }
  function addRecentTool() {
    try {
      const recent = JSON.parse(localStorage.getItem('wk_recent_tools') || '[]').filter((id) => id !== TOOL_ID);
      recent.unshift(TOOL_ID);
      localStorage.setItem('wk_recent_tools', JSON.stringify(recent.slice(0, 8)));
    } catch (_) {}
  }
  function renderAll() {
    renderScenarios();
    renderLanguages();
    renderTones();
    renderFields();
    renderOptionalPhrases();
    renderOutput();
  }

  root.addEventListener('click', (event) => {
    const scenarioButton = event.target.closest('[data-scenario-id]');
    if (scenarioButton) {
      state.scenario = scenarioButton.dataset.scenarioId;
      state.selectedPhrases.clear();
      state.generated = false;
      renderAll();
      setStep(2);
      track('tool_generate', 'scenario_change');
      return;
    }
    if (event.target.closest('[data-prev-step]')) { setStep(1); return; }
    if (event.target.closest('[data-generate-message]')) { generateMessage(); return; }
    if (event.target.closest('[data-return-edit]')) { state.generated = false; setStep(2); return; }
    const timeInput = event.target.closest('[data-time-picker]');
    if (timeInput?.showPicker) {
      try { timeInput.showPicker(); } catch (_) {}
      return;
    }
    const toneButton = event.target.closest('[data-tone-id]');
    if (toneButton) {
      state.tone = toneButton.dataset.toneId;
      root.querySelectorAll('[data-tone-id]').forEach((button) => button.classList.toggle('is-active', button === toneButton));
      state.generated = false;
      track('tool_generate', 'tone_change');
      return;
    }
    const languageToggle = event.target.closest('[data-language-toggle]');
    if (languageToggle) {
      els.languagePanel.hidden = !els.languagePanel.hidden;
      languageToggle.setAttribute('aria-expanded', String(!els.languagePanel.hidden));
      return;
    }
    const displayButton = event.target.closest('[data-display-mode]');
    if (displayButton) {
      state.displayMode = displayButton.dataset.displayMode;
      root.querySelectorAll('[data-display-mode]').forEach((button) => button.classList.toggle('is-active', button === displayButton));
      renderOutput();
      track('tool_generate', `display_${state.displayMode}`);
      return;
    }
    const supplementPlace = event.target.closest('[data-supplement-place]');
    if (supplementPlace) {
      state.generated = false;
      setStep(2);
      if (els.optionalSection) els.optionalSection.open = true;
      const input = root.querySelector(fieldSelector(supplementPlace.dataset.supplementPlace));
      if (input) {
        input.scrollIntoView({
          behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'center'
        });
        window.setTimeout(() => input.focus({ preventScroll: true }), 80);
      }
      return;
    }
    const copyAll = event.target.closest('[data-copy-bilingual]');
    if (copyAll) { const foreign = buildMessage(state.language); copyText(composeBilingual(), copyAll, 'copy_all', foreign.warnings); return; }
    const copyLang = event.target.closest('[data-copy-lang]');
    if (copyLang) {
      const lang = copyLang.dataset.copyLang;
      const msg = buildMessage(lang);
      copyText(msg.text, copyLang, `copy_${lang}`, lang === 'zh' ? [] : msg.warnings);
      return;
    }
    const share = event.target.closest('[data-share-tool]');
    if (share) shareTool(share);
  });
  root.addEventListener('change', (event) => {
    const commonPlace = event.target.closest('[data-common-place]');
    if (commonPlace) {
      const id = commonPlace.dataset.commonPlace;
      const input = root.querySelector(`[name="${id}_zh"]`);
      const hidden = root.querySelector(`[name="${id}_choice"]`);
      if (hidden) hidden.value = commonPlace.value;
      if (input) {
        input.value = commonPlace.value === 'other' ? '' : loc.optionLabel('places', commonPlace.value, 'zh');
        input.readOnly = commonPlace.value !== 'other';
      }
      state.generated = false;
      return;
    }
    if (event.target.matches('[data-language-select]')) {
      state.language = event.target.value;
      state.generated = false;
      renderLanguages();
      track('tool_generate', 'language_change');
      return;
    }
    if (event.target.closest('[data-optional-phrases]') && event.target.type === 'checkbox') {
      if (event.target.checked) state.selectedPhrases.add(event.target.value);
      else state.selectedPhrases.delete(event.target.value);
      state.generated = false;
      return;
    }
    if (event.target.closest('[data-message-form]')) {
      state.generated = false;
      clearFieldError(event.target);
    }
  });
  root.addEventListener('input', (event) => {
    const dateInput = event.target.closest('[data-date-part]');
    if (dateInput) {
      dateInput.value = dateInput.value.replace(/\D/g, '');
      const group = dateInput.closest('[data-date-control]');
      syncSegmentedDate(group);
      if (dateInput.dataset.datePart === 'year' && dateInput.value.length >= 3) group.querySelector('[data-date-part="month"]')?.focus();
      if (dateInput.dataset.datePart === 'month' && dateInput.value.length >= 2) group.querySelector('[data-date-part="day"]')?.focus();
    }
    if (event.target.closest('[data-message-form]')) {
      state.generated = false;
      clearFieldError(event.target);
    }
  });
  root.addEventListener('keydown', (event) => {
    const part = event.target.closest('[data-date-part]');
    if (!part || event.key !== 'Backspace' || part.value) return;
    const group = part.closest('[data-date-control]');
    if (part.dataset.datePart === 'month') group.querySelector('[data-date-part="year"]')?.focus();
    if (part.dataset.datePart === 'day') group.querySelector('[data-date-part="month"]')?.focus();
  });
  root.addEventListener('paste', (event) => {
    const part = event.target.closest('[data-date-part]');
    if (!part) return;
    const text = event.clipboardData?.getData('text') || '';
    const group = part.closest('[data-date-control]');
    if (hydrateSegmentedDate(group, text)) event.preventDefault();
  });

  renderAll();
  setStep(1, false);
  addRecentTool();
  track('tool_view', 'view');
})();
