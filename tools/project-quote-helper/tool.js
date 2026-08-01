(function () {
  const rules = window.ProjectQuoteRules;
  const root = document.querySelector('[data-project-quote-tool]');
  if (!root || !rules) return;
  const TOOL_ID = 'project-quote-helper';
  const PACK_ID = 'trade-services';
  const fields = ['quote_amount','crew_count','work_days','daily_labor_cost','material_cost','subcontract_cost','parking_cost','consumable_cost','meal_cost','other_cost','demolition_cost','disposal_cost','height_work_cost','equipment_cost','transport_cost','lodging_cost','reserved_material_cost','warranty_reserve_cost','protection_cleaning_cost'];
  const featureCosts = {
    demolition: { id: 'demolition_cost', label: '拆除費' },
    disposal: { id: 'disposal_cost', label: '清運費' },
    height_work: { id: 'height_work_cost', label: '高處作業／吊車／鷹架費' },
    equipment_rental: { id: 'equipment_cost', label: '設備租用費' },
    cross_city: { id: 'transport_cost', label: '交通／車馬費' },
    overnight: { id: 'lodging_cost', label: '住宿費' },
    possible_extra_material: { id: 'reserved_material_cost', label: '預留材料費' },
    warranty: { id: 'warranty_reserve_cost', label: '保固／回訪預留費' },
    occupied_site: { id: 'protection_cleaning_cost', label: '防護／清潔費' }
  };
  const fmt = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });
  let showAllCosts = false;
  const confirmedChecks = new Set();
  const els = {
    form: root.querySelector('[data-quote-form]'),
    type: root.querySelector('[data-project-type]'),
    customType: root.querySelector('[data-custom-project-type]'),
    features: root.querySelector('[data-feature-list]'),
    mainResult: root.querySelector('[data-main-result]'),
    secondary: root.querySelector('[data-secondary-numbers]'),
    breakdown: root.querySelector('[data-breakdown]'),
    alerts: root.querySelector('[data-alerts]'),
    copyText: root.querySelector('[data-copy-text]'),
    risk: root.querySelector('[data-risk-level]'),
    ruler: root.querySelector('[data-ruler]'),
    workNote: root.querySelector('[data-work-note]'),
    stepLabel: root.querySelector('[data-step-label]'),
    stepProgress: root.querySelector('[data-step-progress]'),
    showResult: root.querySelector('[data-show-result]'), sectionToggles: root.querySelectorAll('[data-section-toggle]'), expandAll: root.querySelector('[data-expand-all]'), collapseCosts: root.querySelector('[data-collapse-costs]')
  };
  function parseAmount(value) { const clean = String(value || '').replace(/,/g, '').trim(); if (!clean) return 0; const num = Number(clean); if (!Number.isFinite(num) || num < 0) return 0; return num; }
  function currency(value) { return `${fmt.format(Math.max(0, Math.round(value || 0)))} 元`; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
  function projectTypeLabel() { const selected = rules.PROJECT_TYPES.find((item) => item.id === els.type.value); if (els.type.value === 'other') return root.querySelector('[name="custom_project_type"]')?.value.trim() || '其他'; return selected?.label || '未選擇'; }
  function analyticsType() { return els.type.value === 'other' ? 'other' : els.type.value; }
  function currentData() {
    const data = { features: {} };
    fields.forEach((id) => data[id] = parseAmount(root.querySelector(`[name="${id}"]`)?.value));
    rules.FEATURES.forEach((feature) => data.features[feature.id] = !!root.querySelector(`[name="feature_${feature.id}"]`)?.checked);
    return data;
  }
  function currentResult() { return rules.evaluate(currentData()); }
  function track(eventName, action, riskLevel) { window.WorkKitAnalytics?.[eventName]?.({ tool_id: TOOL_ID, pack_id: PACK_ID, action, page: location.pathname, project_type: analyticsType(), risk_level: riskLevel || currentResult().risk_level }); }
  function normalizeMoneyInput(input) { const value = parseAmount(input.value); input.value = input.value.trim() ? fmt.format(value) : ''; }
  function renderProjectTypes() { els.type.innerHTML = rules.PROJECT_TYPES.map((item) => `<option value="${item.id}">${escapeHtml(item.label)}</option>`).join(''); }
  function renderFeatures() {
    els.features.innerHTML = rules.FEATURES.map((item) => {
      const cost = featureCosts[item.id];
      const costField = cost ? `<div class="pq-feature-cost" data-feature-cost="${escapeHtml(item.id)}"><label for="${escapeHtml(cost.id)}">${escapeHtml(cost.label)}</label><input class="control" id="${escapeHtml(cost.id)}" name="${escapeHtml(cost.id)}" inputmode="decimal" placeholder="若已含在人力或外包費，可填 0" data-money><small>若已包含在人力費或外包費中，可填 0。</small></div><p class="pq-feature-stashed" data-feature-stashed="${escapeHtml(item.id)}" hidden>已暫存此項金額，重新勾選可查看；清除全部才會清空。</p>` : '';
      return `<div class="pq-check" data-feature-item="${escapeHtml(item.id)}"><label><input type="checkbox" name="feature_${escapeHtml(item.id)}"> <span>${escapeHtml(item.label)}</span></label>${costField}</div>`;
    }).join('');
  }
  function renderFeatureCosts() {
    rules.FEATURES.forEach((feature) => {
      const box = root.querySelector(`[data-feature-cost="${feature.id}"]`);
      const checked = !!root.querySelector(`[name="feature_${feature.id}"]`)?.checked;
      const notice = root.querySelector(`[data-feature-stashed="${feature.id}"]`);
      if (box) box.hidden = !checked;
      if (notice) {
        const cost = featureCosts[feature.id];
        const amount = cost ? parseAmount(root.querySelector(`[name="${cost.id}"]`)?.value) : 0;
        notice.hidden = checked || amount <= 0;
      }
    });
  }
  function marginDisplay(result) {
    const margin = result.totals.margin;
    if (margin > 0) return { state: 'positive', title: '扣除目前預估支出後', value: `還剩 ${currency(margin)}`, note: '這筆金額可用來應付尚未列入的費用、材料波動、工期延長、保固或臨時狀況。' };
    if (margin === 0) return { state: 'zero', title: '目前報價與預估支出剛好相同', value: '0 元', note: '目前尚未保留材料波動、工期延長、保固、重工及其他臨時狀況的空間。' };
    return { state: 'negative', title: '目前報價還差', value: currency(Math.abs(margin)), note: '目前報價可能無法涵蓋已輸入的預估支出，建議重新確認報價或費用項目。' };
  }
  function riskLabel(level) { return { incomplete: '資料待補', negative: '支出可能不足', zero: '建議確認', low: '建議確認', medium: '建議確認', higher_buffer: '已完成試算' }[level] || '資料待補'; }
  function displayRiskLevel(result, pendingItems) {
    if (result.risk_level === 'incomplete' || result.risk_level === 'negative') return result.risk_level;
    return pendingItems.length ? 'medium' : 'higher_buffer';
  }
  function pinPosition(result) {
    if (result.risk_level === 'incomplete') return 15;
    if (result.risk_level === 'negative') return 8;
    if (result.risk_level === 'zero') return 34;
    if (result.risk_level === 'low') return 48;
    if (result.risk_level === 'medium') return 64;
    return 84;
  }
  function renderMainResult(result) {
    const plain = marginDisplay(result);
    els.mainResult.innerHTML = `<p>${escapeHtml(plain.title)}</p><strong>${escapeHtml(plain.value)}</strong><em>${escapeHtml(plain.note)}</em>`;
    els.secondary.innerHTML = [
      ['預計報價', currency(currentData().quote_amount)],
      ['預估人力費', currency(result.totals.laborCost)],
      ['預估總支出', currency(result.totals.totalCost)]
    ].map(([label, value]) => `<span>${escapeHtml(label)}<b>${escapeHtml(value)}</b></span>`).join('');
    els.workNote.innerHTML = `<b>工務備註</b><p>${escapeHtml(plain.note)}</p>`;
    els.ruler.style.setProperty('--pin-position', `${pinPosition(result)}%`);
  }
  function costValue(item, data, result) {
    if (item.source === 'labor') return result.totals.laborCost;
    if (item.feature && !data.features[item.feature]) return 0;
    return data[item.id];
  }
  function costRows(result) {
    const data = currentData();
    return rules.COST_ITEMS.map((item) => ({ item, amount: costValue(item, data, result), data }));
  }
  function renderBreakdown(result) {
    const rows = costRows(result).filter(({ amount }) => showAllCosts || amount > 0);
    const body = rows.length ? rows.map(({ item, amount, data }) => {
      const note = item.source === 'labor' ? `${data.crew_count || 0} 人 × ${data.work_days || 0} 天 × ${currency(data.daily_labor_cost).replace(' 元','')}` : (amount > 0 ? '已列入估算' : '未列入估算');
      return `<div class="pq-cost-row"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(note)}</small><span class="num">${escapeHtml(currency(amount).replace(' 元',''))}</span><span class="mark">${amount > 0 ? '✓' : '-'}</span></div>`;
    }).join('') : '<p class="pq-empty">尚未列入支出金額。</p>';
    els.breakdown.innerHTML = `<div class="pq-breakdown-tools"><button class="pq-inline-button" type="button" data-toggle-all-costs>${showAllCosts ? '收合明細' : '展開全部'}</button></div>${body}`;
  }
  function checkedFeatureCostConfirmations(data) {
    return Object.entries(featureCosts)
      .filter(([featureId, cost]) => data.features[featureId] && parseAmount(root.querySelector(`[name="${cost.id}"]`)?.value) === 0)
      .map(([featureId, cost]) => ({
        id: `feature-cost-${featureId}`,
        severity: 'check',
        text: `請確認${cost.label}是否已包含在人力費或外包費中；若已包含可維持 0。`,
        doneText: `${cost.label}已確認`
      }));
  }
  function alertConfirmations(result, data) {
    const seen = new Set();
    return result.alerts.filter((item) => item.message !== '請確認此項費用是否已包含在人力費或外包費中；若已包含可維持 0。').map((item) => {
      const text = checklistText(item);
      return { id: `alert-${text}`, severity: item.severity, text, doneText: doneText(item.message, text) };
    }).concat(checkedFeatureCostConfirmations(data)).filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }
  function doneText(message, text) {
    if (message.includes('預計報價')) return '預計報價已確認';
    if (message.includes('施工人數')) return '施工人數已確認';
    if (message.includes('工作天數')) return '工作天數已確認';
    if (message.includes('每人每日人力成本')) return '人力成本已確認';
    if (message.includes('材料費') || text.includes('材料')) return '材料費已確認';
    if (message.includes('拆除後')) return '清運需求已確認';
    if (text.includes('拆除')) return '拆除費已確認';
    if (text.includes('清運')) return '清運費已確認';
    if (text.includes('高處')) return '高處作業費已確認';
    if (text.includes('設備')) return '設備租用費已確認';
    if (text.includes('交通') || text.includes('停車')) return '交通費已確認';
    if (text.includes('住宿')) return '住宿費已確認';
    if (text.includes('餐費')) return '餐費已確認';
    if (text.includes('保固') || text.includes('回訪')) return '保固與回訪已確認';
    if (text.includes('範圍') || text.includes('客戶')) return '施工範圍已確認';
    if (text.includes('報價')) return '報價與支出已確認';
    return '提醒項目已確認';
  }
  function pendingConfirmationItems(result) {
    return alertConfirmations(result, currentData()).filter((item) => !confirmedChecks.has(item.id));
  }
  function checklistText(alertItem) {
    const text = alertItem.message;
    if (text === '請確認拆除作業是否已包含在人力費或外包費中。') return text;
    if (text === '請確認廢料搬運及處理費是否已計入。') return text;
    if (text === '拆除後是否會產生廢料？建議確認是否需要清運。') return text;
    if (text.includes('清運')) return '是否已包含清運費';
    if (text.includes('拆除')) return '是否已確認拆除費';
    if (text.includes('交通') || text.includes('停車') || text.includes('跨縣市')) return '是否已計入交通與停車';
    if (text.includes('設備') || text.includes('高處')) return '是否已考慮設備租用';
    if (text.includes('材料')) return '是否已保留材料補購空間';
    if (text.includes('保固') || text.includes('回訪') || text.includes('重工')) return '是否已考慮保固與回訪';
    if (text.includes('範圍') || text.includes('客戶')) return '客戶是否已確認完整施工範圍';
    if (text.includes('餐費')) return '是否已計入餐費';
    if (text.includes('住宿')) return '是否已計入住宿安排';
    if (text.includes('報價')) return '是否需要重新確認報價或支出項目';
    return text;
  }
  function renderAlerts(result) {
    const items = alertConfirmations(result, currentData());
    const pending = items.filter((item) => !confirmedChecks.has(item.id));
    const checklistHtml = items.length
      ? items.map((item) => {
        const checked = confirmedChecks.has(item.id);
        return `<label class="pq-check-item ${escapeHtml(item.severity)} ${checked ? 'is-confirmed' : ''}"><input type="checkbox" data-confirm-check="${escapeHtml(item.id)}" ${checked ? 'checked' : ''}><p>${escapeHtml(checked ? item.doneText : item.text)}</p></label>`;
      }).join('')
      : '<p class="pq-empty">目前沒有待確認項目。</p>';
    const status = items.length && !pending.length ? '<p class="pq-empty">目前提醒項目均已確認。</p>' : '';
    els.alerts.innerHTML = `${checklistHtml}${status}`;
  }
  function copySummary(result) {
    const data = currentData();
    const plain = marginDisplay(result);
    const optionalCosts = rules.COST_ITEMS
      .filter((item) => item.source !== 'labor')
      .map((item) => [item.label, costValue(item, data, result) || 0])
      .filter(([, amount]) => amount > 0)
      .map(([label, amount]) => `${label}：${currency(amount)}`);
    const costLines = optionalCosts.length ? `\n\n支出明細：\n${optionalCosts.join('\n')}` : '';
    const checks = alertConfirmations(result, data);
    const pending = checks.filter((item) => !confirmedChecks.has(item.id)).map((item) => `□ ${item.text}`);
    const pendingLines = pending.length ? `\n\n待確認：\n${pending.join('\n')}` : '\n\n待確認：\n目前提醒項目均已確認。';
    return `【接案報價試算】\n\n工程類型：${projectTypeLabel()}\n預計報價：${currency(data.quote_amount)}\n預估人力費：${currency(result.totals.laborCost)}\n預估總支出：${currency(result.totals.totalCost)}${costLines}\n\n${plain.title}：${plain.value}${pendingLines}\n\n提醒：\n${plain.note}`;
  }
  function setSectionCollapsed(section, collapsed) {
    section.classList.toggle('is-collapsed', collapsed);
    const button = section.querySelector('[data-section-toggle]');
    if (button) button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }
  function renderSections() {
    if (els.stepLabel) els.stepLabel.textContent = '完整盤點表｜可展開收合';
    if (els.stepProgress) els.stepProgress.style.width = '100%';
  }
  function scrollToResult() { root.querySelector('[data-step="4"]')?.scrollIntoView({ block: 'start' }); }
  function renderAll(action) {
    const result = currentResult();
    const displayLevel = displayRiskLevel(result, pendingConfirmationItems(result));
    els.risk.dataset.risk = displayLevel;
    els.risk.textContent = riskLabel(displayLevel);
    renderMainResult(result);
    renderBreakdown(result);
    renderAlerts(result);
    renderFeatureCosts();
    els.copyText.textContent = copySummary(result);
    if (action) track('tool_generate', action, displayLevel);
  }  async function copyText() { try { await navigator.clipboard.writeText(els.copyText.textContent); track('tool_copy', 'copy_summary'); const btn = root.querySelector('[data-copy-summary]'); const original = btn.textContent; btn.textContent = '已複製'; setTimeout(() => btn.textContent = original, 1400); } catch (_) { track('tool_error', 'copy_failed'); } }
  async function shareTool(button) { try { await navigator.clipboard.writeText(location.href.split('#')[0]); track('tool_share', 'share_url'); const original = button.textContent; button.textContent = '已複製網址'; setTimeout(() => button.textContent = original, 1400); } catch (_) { track('tool_error', 'share_failed'); } }
  function clearAll() { els.form.reset(); confirmedChecks.clear(); showAllCosts = false; els.customType.hidden = true; root.querySelectorAll('[data-money],[data-number]').forEach((input) => input.value = ''); renderAll('clear'); renderSections(); root.querySelectorAll('.pq-section.is-collapsed').forEach((section) => setSectionCollapsed(section, false)); }
  renderProjectTypes(); renderFeatures(); renderAll(); renderSections(); track('tool_view', 'view');
  root.addEventListener('input', (event) => { if (event.target.closest('[data-quote-form]')) renderAll('input_update'); });
  root.addEventListener('change', (event) => { if (event.target === els.type) els.customType.hidden = els.type.value !== 'other'; if (event.target.closest('[data-quote-form]')) renderAll('change_update'); });
  root.addEventListener('blur', (event) => { if (event.target.matches('[data-money]')) { normalizeMoneyInput(event.target); renderAll('format_money'); } }, true);
  root.addEventListener('click', (event) => {
    const calculate = event.target.closest('[data-calculate]'); if (calculate) { renderAll('calculate'); scrollToResult(); return; }
    const reset = event.target.closest('[data-reset]'); if (reset) { clearAll(); return; }
    const copy = event.target.closest('[data-copy-summary]'); if (copy) { copyText(); return; }
    const print = event.target.closest('[data-print]'); if (print) { track('tool_download', 'print'); window.print(); return; }
    const share = event.target.closest('[data-share-tool]'); if (share) { shareTool(share); return; }
    const toggleCosts = event.target.closest('[data-toggle-all-costs]'); if (toggleCosts) { showAllCosts = !showAllCosts; renderAll(); return; }
    const confirmCheck = event.target.closest('[data-confirm-check]'); if (confirmCheck) { if (confirmCheck.checked) confirmedChecks.add(confirmCheck.dataset.confirmCheck); else confirmedChecks.delete(confirmCheck.dataset.confirmCheck); renderAll(); return; }
    const toggle = event.target.closest('[data-section-toggle]');
    if (toggle) { const section = toggle.closest('.pq-section'); if (section) setSectionCollapsed(section, !section.classList.contains('is-collapsed')); return; }
    if (event.target.closest('[data-expand-all]')) { root.querySelectorAll('.pq-section').forEach((section) => setSectionCollapsed(section, false)); return; }
    if (event.target.closest('[data-collapse-costs]')) { root.querySelectorAll('[data-step="2"], [data-step="3"]').forEach((section) => setSectionCollapsed(section, true)); return; }
    if (event.target.closest('[data-show-result]')) scrollToResult();
  });
})();


