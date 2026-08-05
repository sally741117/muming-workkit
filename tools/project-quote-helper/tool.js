
(function () {
  const rules = window.ProjectQuoteRules;
  const root = document.querySelector('[data-project-quote-tool]');
  if (!root || !rules) return;

  const TOOL_ID = 'project-quote-helper';
  const PACK_ID = 'trade-services';
  const fmt = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });
  const groups = {
    labor: { label: '人力', mergeLabel: '人工作業費' },
    material: { label: '材料', mergeLabel: '材料費' },
    subcontract: { label: '外包', mergeLabel: '外包工程費' },
    other: { label: '其他', mergeLabel: '其他費用' }
  };
  const mergeGroups = ['人工作業費', '材料費', '外包工程費', '設備與交通', '其他費用', '自訂分類'];
  const MATERIAL_UNIT_SUGGESTIONS = [
    { keywords: ['油漆', '底漆', '防水漆', '黏著劑'], unit: '桶' },
    { keywords: ['水泥', '砂', '石粉', '填縫劑'], unit: '包' },
    { keywords: ['磁磚', '地磚', '壁磚'], unit: '片' },
    { keywords: ['木板', '矽酸鈣板', '石膏板'], unit: '片' },
    { keywords: ['鋼筋', '角鐵', '管材'], unit: '支' },
    { keywords: ['電線', '網線', '管線'], unit: '米' },
    { keywords: ['螺絲', '釘子', '零件'], unit: '個' },
    { keywords: ['砂石', '廢料'], unit: '立方米' },
    { keywords: ['防水布', '帆布', '保護布'], unit: '捲' },
    { keywords: ['耗材', '雜料'], unit: '式' }
  ];
  const featureDrafts = {
    demolition: { name: '拆除費', note: '已加入拆除費，請填寫預估成本。' },
    disposal: { name: '廢棄物清運費', note: '已加入廢棄物清運費，請填寫預估成本。' },
    height_work: { name: '高處作業設備／安全費', note: '已加入高處作業設備／安全費，請填寫預估成本。' },
    equipment_rental: { name: '設備租借費', note: '已加入設備租借費，請填寫預估成本。' },
    cross_city: { name: '交通與差旅費', note: '已加入交通與差旅費，請填寫預估成本。' },
    overnight: { name: '住宿費', note: '已加入住宿費，請填寫預估成本。' },
    possible_extra_material: { name: '材料預備項目', note: '已加入材料預備項目，請填寫預估成本。' },
    warranty: { name: '保固準備金', note: '已加入保固準備金，請填寫預估成本。' },
    occupied_site: { name: '防護／清潔費', note: '已加入防護／清潔費，請填寫預估成本。' }
  };

  let uid = 0;
  let showAllCosts = false;
  let outputMode = 'internal';
  let expandedCustomerRowId = '';
  const confirmedChecks = new Set();
  const state = { labor: [], material: [], subcontract: [], other: [] };
  const customerLabor = {
    id: 'customer-labor',
    type: 'laborGroup',
    presentation: 'show',
    clientName: '',
    clientQtyMode: 'person_day',
    clientQty: '',
    clientUnit: '',
    clientAmount: '',
    clientNote: '',
    suggestedClientQty: '',
    suggestedClientUnit: '',
    suggestedClientAmount: '',
    isClientQtyManual: false,
    isClientUnitManual: false,
    isClientAmountManual: false,
    mergeGroup: '人工作業費',
    customGroup: ''
  };
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
    customerPreview: root.querySelector('[data-customer-preview]'),
    customerList: root.querySelector('[data-customer-list]'),
    stepLabel: root.querySelector('[data-step-label]'),
    stepProgress: root.querySelector('[data-step-progress]'),
    crewSummary: root.querySelector('[data-crew-summary]'),
    crewNote: root.querySelector('[data-crew-note]'),
    featureSummary: root.querySelector('[data-feature-summary]'),
    goPendingCosts: root.querySelector('[data-go-pending-costs]')
  };

  function id(prefix) { uid += 1; return prefix + '-' + Date.now().toString(36) + '-' + uid; }
  function n(value) {
    value = String(value || '').replace(/,/g, '').trim();
    if (!value) return 0;
    value = Number(value);
    return Number.isFinite(value) ? value : 0;
  }
  function validNumber(value) {
    value = String(value ?? '').replace(/,/g, '').trim();
    if (!value) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  function positive(value) { return Math.max(0, n(value)); }
  function cur(value) { return fmt.format(Math.max(0, Math.round(value || 0))) + ' 元'; }
  function signedCur(value) {
    const amount = Math.round(value || 0);
    return (amount < 0 ? '-' : '') + fmt.format(Math.abs(amount)) + ' 元';
  }
  function money(value) { return fmt.format(Math.max(0, Math.round(value || 0))); }
  function pct(value) { return value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(1) + '%'; }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function q(selector) { return root.querySelector(selector); }
  function field(name) { return q('[name="' + name + '"]'); }
  function fv(name) { return field(name)?.value.trim() || ''; }
  function mv(name) { return positive(fv(name)); }
  function prefersReducedMotion() { return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; }

  function projectTypeLabel() {
    const selected = rules.PROJECT_TYPES.find(item => item.id === els.type.value);
    return els.type.value === 'other' ? (fv('custom_project_type') || '其他') : (selected?.label || '未選擇');
  }
  function track(eventName, action, risk) {
    window.WorkKitAnalytics?.[eventName]?.({
      tool_id: TOOL_ID,
      pack_id: PACK_ID,
      action,
      page: location.pathname,
      project_type: els.type.value === 'other' ? 'other' : els.type.value,
      risk_level: risk || currentResult().risk_level
    });
  }

  function addRow(type, seed = {}) {
    const row = {
      id: id(type),
      type,
      name: seed.name || '',
      qty: seed.qty ?? (type === 'labor' ? 1 : ''),
      unit: seed.unit ?? (type === 'labor' ? '人' : ''),
      unitAutoSuggested: seed.unitAutoSuggested || '',
      unitCost: seed.unitCost ?? '',
      days: seed.days ?? (type === 'labor' ? (mv('work_days') || '') : ''),
      vendor: seed.vendor || '',
      includeCost: seed.includeCost !== false,
      presentation: seed.presentation || 'show',
      clientName: seed.clientName || '',
      clientQty: seed.clientQty ?? '',
      clientUnit: seed.clientUnit ?? '',
      clientAmount: seed.clientAmount ?? '',
      clientNote: seed.clientNote || '',
      suggestedClientQty: seed.suggestedClientQty ?? '',
      suggestedClientUnit: seed.suggestedClientUnit ?? '',
      suggestedClientAmount: seed.suggestedClientAmount ?? '',
      isClientQtyManual: seed.isClientQtyManual ?? (seed.clientQty !== undefined && String(seed.clientQty).trim() !== ''),
      isClientUnitManual: seed.isClientUnitManual ?? (seed.clientUnit !== undefined && String(seed.clientUnit).trim() !== ''),
      isClientAmountManual: seed.isClientAmountManual ?? (seed.clientAmount !== undefined && String(seed.clientAmount).trim() !== ''),
      mergeGroup: seed.mergeGroup || groups[type].mergeLabel,
      customGroup: seed.customGroup || '',
      note: seed.note || '',
      featureId: seed.featureId || ''
    };
    state[type].push(row);
    return row;
  }
  function ensureRows() { if (!state.labor.length) addRow('labor'); }
  function allRows() { return ['labor', 'material', 'subcontract', 'other'].flatMap(type => state[type]); }
  function findRow(rowId) {
    for (const type of Object.keys(state)) {
      const row = state[type].find(item => item.id === rowId);
      if (row) return row;
    }
    return null;
  }
  function findCustomerTarget(rowId) {
    if (rowId === customerLabor.id) return customerLabor;
    return findRow(rowId);
  }
  function draftRows() { return state.other.filter(row => row.featureId); }
  function isExpenseItemComplete(item) {
    const amount = validNumber(item?.unitCost);
    return amount !== null && amount > 0;
  }
  function pendingDraftRows() { return draftRows().filter(row => !isExpenseItemComplete(row)); }
  function crewCount() { return state.labor.filter(row => row.includeCost).reduce((sum, row) => sum + positive(row.qty), 0); }

  function rawCost(row) {
    if (row.type === 'labor') return positive(row.qty) * positive(row.unitCost) * positive(row.days);
    if (row.type === 'other') return positive(row.unitCost);
    return positive(row.qty) * positive(row.unitCost);
  }
  function rowCost(row) { return row.includeCost ? rawCost(row) : 0; }
  function clientField(row, key, manualKey, suggestedKey) {
    const value = row?.[key];
    if (String(value ?? '').trim() !== '') return value;
    return row?.[manualKey] ? '' : (row?.[suggestedKey] ?? '');
  }
  function rowClientAmount(row) {
    return positive(clientField(row, 'clientAmount', 'isClientAmountManual', 'suggestedClientAmount'));
  }
  function laborRowsWithContent() {
    return state.labor.filter(row => row.name || positive(row.qty) > 0 || positive(row.unitCost) > 0 || positive(row.days) > 0);
  }
  function laborInternalCost() { return state.labor.reduce((sum, row) => sum + rowCost(row), 0); }
  function laborPersonCount() { return state.labor.reduce((sum, row) => sum + positive(row.qty), 0); }
  function laborPersonDays() { return state.labor.reduce((sum, row) => sum + positive(row.qty) * positive(row.days), 0); }
  function hasCustomerLabor() { return laborRowsWithContent().length > 0; }
  function compactAmount(value) { return fmt.format(Math.max(0, Math.round(value || 0))) + ' 元'; }
  function laborSuggestedQtyUnit() {
    if (customerLabor.clientQtyMode === 'person') return { qty: laborPersonCount() || 1, unit: '人' };
    if (customerLabor.clientQtyMode === 'package') return { qty: 1, unit: '式' };
    return { qty: laborPersonDays() || laborPersonCount() || 1, unit: '人日' };
  }
  function rowSuggestedQtyUnit(row) {
    if (row.presentation === 'merge' || row.type === 'other') return { qty: 1, unit: '式' };
    const qty = positive(row.qty) || 1;
    const unit = row.unit || '式';
    return { qty, unit };
  }
  function syncSuggestedClientFields(row, suggestion = {}) {
    if (!row) return;
    const suggestedQty = suggestion.qty === '' || suggestion.qty === undefined ? '' : String(suggestion.qty);
    const suggestedUnit = suggestion.unit || '';
    const suggestedAmount = Math.max(0, Math.round(suggestion.amount || 0));
    row.suggestedClientQty = suggestedQty;
    row.suggestedClientUnit = suggestedUnit;
    row.suggestedClientAmount = suggestedAmount ? String(suggestedAmount) : '';
    if (!row.isClientQtyManual) row.clientQty = row.suggestedClientQty;
    if (!row.isClientUnitManual) row.clientUnit = row.suggestedClientUnit;
    if (!row.isClientAmountManual) row.clientAmount = row.suggestedClientAmount;
  }
  function syncSuggestedClientAmounts() {
    const laborQtyUnit = laborSuggestedQtyUnit();
    syncSuggestedClientFields(customerLabor, {
      qty: hasCustomerLabor() ? laborQtyUnit.qty : '',
      unit: hasCustomerLabor() ? laborQtyUnit.unit : '',
      amount: hasCustomerLabor() ? laborInternalCost() : 0
    });
    ['material', 'subcontract', 'other'].forEach(type => {
      state[type].forEach(row => syncSuggestedClientFields(row, { ...rowSuggestedQtyUnit(row), amount: rowCost(row) }));
    });
  }
  function customerLaborLabel() { return customerLabor.clientName || '施工人力費'; }
  function customerLaborQty() {
    return clientField(customerLabor, 'clientQty', 'isClientQtyManual', 'suggestedClientQty');
  }
  function customerLaborUnit() {
    return clientField(customerLabor, 'clientUnit', 'isClientUnitManual', 'suggestedClientUnit') || '人日';
  }
  function laborWorkSummary() {
    const rows = state.labor
      .map(row => ({ people: positive(row.qty), days: positive(row.days) }))
      .filter(item => item.people > 0 || item.days > 0);
    if (!rows.length) return '尚未設定人力';
    const usable = rows.filter(item => item.people > 0 && item.days > 0);
    if (!usable.length) return fmt.format(laborPersonCount()) + ' 人';
    const uniqueDays = [...new Set(usable.map(item => item.days))];
    const totalPeople = usable.reduce((sum, item) => sum + item.people, 0);
    const totalPersonDays = usable.reduce((sum, item) => sum + item.people * item.days, 0);
    if (uniqueDays.length === 1 && usable.length === rows.length) {
      return fmt.format(totalPeople) + ' 人 × ' + fmt.format(uniqueDays[0]) + ' 天，共 ' + fmt.format(totalPersonDays) + ' 人日';
    }
    return usable.map(item => fmt.format(item.people) + ' 人 × ' + fmt.format(item.days) + ' 天').join('＋') + '，共 ' + fmt.format(totalPersonDays) + ' 人日';
  }
  function rowClientLabel(row) {
    if (row.presentation === 'merge') return row.mergeGroup === '自訂分類' ? (row.customGroup || groups[row.type].mergeLabel) : row.mergeGroup;
    return row.clientName || row.name || groups[row.type].label;
  }
  function rowClientQty(row) {
    if (row.presentation === 'merge') return 1;
    return clientField(row, 'clientQty', 'isClientQtyManual', 'suggestedClientQty');
  }
  function rowClientUnit(row) {
    if (row.presentation === 'merge') return '式';
    return clientField(row, 'clientUnit', 'isClientUnitManual', 'suggestedClientUnit') || '式';
  }
  function rowCustomerSummary(row) {
    if (row.type === 'laborGroup') return laborWorkSummary();
    const qty = rowClientQty(row);
    return (String(qty).trim() ? fmt.format(positive(qty)) : '未填數量') + ' ' + rowClientUnit(row);
  }
  function customerAmountText(row) {
    const value = clientField(row, 'clientAmount', 'isClientAmountManual', 'suggestedClientAmount');
    const amount = positive(value);
    if (String(value ?? '').trim() === '' || amount <= 0) return '未填金額';
    return compactAmount(amount);
  }
  function customerStatusLabel(row) {
    if (row.presentation === 'hide') return '未顯示';
    const value = clientField(row, 'clientAmount', 'isClientAmountManual', 'suggestedClientAmount');
    if (String(value ?? '').trim() === '' || positive(value) <= 0) return '待填寫';
    if (row.isClientQtyManual || row.isClientUnitManual || row.isClientAmountManual) return '已調整';
    return '建議值';
  }
  function customerAmountSummary(row) {
    const value = clientField(row, 'clientAmount', 'isClientAmountManual', 'suggestedClientAmount');
    const amount = positive(value);
    if (row.isClientAmountManual) return String(row.clientAmount ?? '').trim() === '' ? '報價未填' : '報價 ' + compactAmount(amount);
    const suggested = positive(row.suggestedClientAmount);
    return suggested > 0 ? '建議 ' + compactAmount(suggested) : '尚無建議金額';
  }
  function applyCustomerSuggestion(row, kind) {
    if (!row) return;
    syncSuggestedClientAmounts();
    if (kind === 'qtyUnit') {
      row.isClientQtyManual = false;
      row.isClientUnitManual = false;
      row.clientQty = row.suggestedClientQty || '';
      row.clientUnit = row.suggestedClientUnit || '';
    }
    if (kind === 'amount') {
      row.isClientAmountManual = false;
      row.clientAmount = row.suggestedClientAmount || '';
    }
  }
  function rowTitle(row, index) { return row.name || groups[row.type].label + '項目 ' + (index + 1); }
  function materialUnitSuggestion(name) {
    const text = String(name || '').trim();
    if (!text) return '';
    const found = MATERIAL_UNIT_SUGGESTIONS.find(rule => rule.keywords.some(keyword => text.includes(keyword)));
    return found?.unit || '';
  }
  function applyMaterialUnitSuggestion(row) {
    if (!row || row.type !== 'material') return;
    const suggestion = materialUnitSuggestion(row.name);
    const canUpdate = !row.unit || (row.unitAutoSuggested && row.unit === row.unitAutoSuggested);
    if (suggestion && canUpdate) {
      row.unit = suggestion;
      row.unitAutoSuggested = suggestion;
    } else if (!suggestion && row.unitAutoSuggested && row.unit === row.unitAutoSuggested) {
      row.unit = '';
      row.unitAutoSuggested = '';
    }
  }

  function customerItems() {
    const items = [];
    const merged = new Map();
    if (hasCustomerLabor() && customerLabor.presentation !== 'hide') {
      const amount = positive(customerLabor.clientAmount);
      if (amount > 0) items.push({ name: customerLaborLabel(), qty: customerLaborQty(), unit: customerLaborUnit(), unitPrice: amount, amount, note: customerLabor.clientNote || '' });
    }
    ['material', 'subcontract', 'other'].flatMap(type => state[type]).forEach(row => {
      if (row.presentation === 'hide') return;
      const amount = rowClientAmount(row);
      if (amount <= 0) return;
      if (row.presentation === 'merge') {
        const label = rowClientLabel(row);
        if (!merged.has(label)) merged.set(label, { name: label, qty: 1, unit: '式', unitPrice: 0, amount: 0, notes: [] });
        const item = merged.get(label);
        item.amount += amount;
        item.unitPrice = item.amount;
        const note = String(row.clientNote || '').trim();
        if (note && !item.notes.includes(note)) item.notes.push(note);
      } else {
        items.push({ name: rowClientLabel(row), qty: rowClientQty(row), unit: rowClientUnit(row), unitPrice: amount, amount, note: row.clientNote || '' });
      }
    });
    return items.concat([...merged.values()].map(item => ({ ...item, note: item.notes.join('；') }))).filter(item => item.amount > 0);
  }
  function customerMissingItems() {
    const missing = [];
    if (hasCustomerLabor() && customerLabor.presentation !== 'hide' && positive(customerLabor.clientAmount) <= 0) missing.push(customerLabor);
    return missing.concat(['material', 'subcontract', 'other'].flatMap(type => state[type]).filter(row => row.presentation !== 'hide' && rowClientAmount(row) <= 0));
  }

  function totals() {
    const laborCost = state.labor.reduce((sum, row) => sum + rowCost(row), 0);
    const materialCost = state.material.reduce((sum, row) => sum + rowCost(row), 0);
    const subcontractCost = state.subcontract.reduce((sum, row) => sum + rowCost(row), 0);
    const otherCost = state.other.reduce((sum, row) => sum + rowCost(row), 0);
    const internalCostTotal = laborCost + materialCost + subcontractCost + otherCost;
    const estimatedQuoteAmount = mv('quote_amount');
    const estimatedProfit = estimatedQuoteAmount - internalCostTotal;
    const estimatedMarginRate = estimatedQuoteAmount > 0 ? estimatedProfit / estimatedQuoteAmount * 100 : null;
    const customerItemSubtotal = customerItems().reduce((sum, item) => sum + item.amount, 0);
    const customerEntryAmount = customerItemSubtotal;
    const taxRate = mv('tax_rate');
    const taxMode = fv('tax_mode') === 'inclusive' ? 'inclusive' : 'exclusive';
    const divisor = 1 + taxRate / 100;
    const customerSubtotal = taxMode === 'inclusive' && divisor > 0 ? customerEntryAmount / divisor : customerEntryAmount;
    const tax = taxMode === 'inclusive' ? customerEntryAmount - customerSubtotal : customerSubtotal * taxRate / 100;
    const grandTotal = taxMode === 'inclusive' ? customerEntryAmount : customerSubtotal + tax;
    return {
      laborCost,
      materialCost,
      subcontractCost,
      otherCost,
      internalCostTotal,
      estimatedQuoteAmount,
      estimatedProfit,
      estimatedMarginRate,
      customerItemSubtotal,
      customerEntryAmount,
      customerSubtotal,
      taxMode,
      taxRate,
      tax,
      grandTotal
    };
  }

  function currentData() {
    const t = totals();
    const crew = crewCount();
    const days = mv('work_days');
    const data = {
      features: {},
      quote_amount: t.estimatedQuoteAmount,
      crew_count: crew,
      work_days: days,
      daily_labor_cost: t.laborCost && crew && days ? t.laborCost / crew / days : t.laborCost,
      material_cost: t.materialCost,
      subcontract_cost: t.subcontractCost,
      parking_cost: 0,
      consumable_cost: 0,
      meal_cost: 0,
      other_cost: t.otherCost
    };
    rules.FEATURES.forEach(feature => { data.features[feature.id] = !!q('[name="feature_' + feature.id + '"]')?.checked; });
    return data;
  }
  function riskFromTotals(t) {
    if (t.estimatedQuoteAmount <= 0) return 'incomplete';
    if (t.estimatedProfit < 0) return 'negative';
    if (t.estimatedProfit === 0) return 'zero';
    if (t.estimatedMarginRate !== null && t.estimatedMarginRate < 10) return 'low';
    if (t.estimatedMarginRate !== null && t.estimatedMarginRate <= 20) return 'medium';
    return 'higher_buffer';
  }
  function currentResult() {
    const result = rules.evaluate(currentData());
    const t = totals();
    result.totals = {
      ...result.totals,
      laborCost: t.laborCost,
      materialCost: t.materialCost,
      subcontractCost: t.subcontractCost,
      otherCost: t.otherCost,
      totalCost: t.internalCostTotal,
      internalCostTotal: t.internalCostTotal,
      estimatedQuoteAmount: t.estimatedQuoteAmount,
      estimatedProfit: t.estimatedProfit,
      estimatedMarginRate: t.estimatedMarginRate,
      customerSubtotal: t.customerSubtotal,
      customerItemSubtotal: t.customerItemSubtotal,
      customerEntryAmount: t.customerEntryAmount,
      taxMode: t.taxMode,
      tax: t.tax,
      grandTotal: t.grandTotal,
      margin: t.estimatedProfit,
      marginRatio: t.estimatedMarginRate
    };
    result.risk_level = riskFromTotals(t);
    return result;
  }

  function renderProjectTypes() { els.type.innerHTML = rules.PROJECT_TYPES.map(item => '<option value="' + esc(item.id) + '">' + esc(item.label) + '</option>').join(''); }
  function renderFeatures() {
    els.features.innerHTML = rules.FEATURES.map(feature => '<div class="pq-check" data-feature-item="' + esc(feature.id) + '"><label><input type="checkbox" name="feature_' + esc(feature.id) + '"> <span>' + esc(feature.label) + '</span></label></div>').join('');
  }
  function normMoney(input) { const value = positive(input.value); input.value = input.value.trim() ? fmt.format(value) : ''; }
  function normNumber(input) { const value = positive(input.value); input.value = input.value.trim() ? String(value) : ''; }
  function sectionCollapsed(section, collapsed) {
    if (!section) return;
    section.classList.toggle('is-collapsed', collapsed);
    const button = section.querySelector('[data-section-toggle]');
    if (button) button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    const settings = section.querySelector('[data-customer-settings]');
    if (settings) settings.hidden = collapsed;
  }
  function setDetailOpen(type, open) {
    ['labor', 'material', 'subcontract', 'other'].forEach(item => {
      const shouldOpen = item === type && open;
      const panel = q('[data-detail-panel="' + item + '"]');
      const button = q('[data-detail-toggle="' + item + '"]');
      if (panel) panel.hidden = !shouldOpen;
      if (button) button.setAttribute('aria-expanded', String(shouldOpen));
    });
  }
  function detailOpen(type) { return !q('[data-detail-panel="' + type + '"]')?.hidden; }
  function openDetail(type, shouldScroll = false) {
    if (!state[type].length) addRow(type);
    sectionCollapsed(q('[data-step="2"]'), false);
    setDetailOpen(type, true);
    renderAll('open_' + type);
    if (shouldScroll) q('[data-detail-panel="' + type + '"]')?.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  function presentationOptions(type, value) {
    const map = type === 'other'
      ? [['show', '顯示'], ['merge', '合併至其他費用'], ['hide', '隱藏']]
      : [['show', '獨立顯示'], ['merge', type === 'labor' ? '合併至人工作業費' : type === 'material' ? '合併為材料費' : '合併為外包工程費'], ['hide', '僅內部使用']];
    return map.map(item => '<option value="' + item[0] + '" ' + (value === item[0] ? 'selected' : '') + '>' + item[1] + '</option>').join('');
  }
  function customerQtyModeOptions(value) {
    return [['person', '人數'], ['person_day', '人日'], ['package', '一式']].map(item => '<option value="' + item[0] + '" ' + (value === item[0] ? 'selected' : '') + '>' + item[1] + '</option>').join('');
  }
  function customerRowLabel(row, index) {
    return row.type === 'laborGroup' ? customerLaborLabel() : rowClientLabel(row);
  }
  function customerRowCost(row) {
    return row.type === 'laborGroup' ? laborInternalCost() : rowCost(row);
  }
  function customerRowQty(row) {
    return row.type === 'laborGroup' ? customerLaborQty() : rowClientQty(row);
  }
  function customerRowUnit(row) {
    return row.type === 'laborGroup' ? customerLaborUnit() : rowClientUnit(row);
  }
  function customerRows() {
    return (hasCustomerLabor() ? [customerLabor] : []).concat(['material', 'subcontract', 'other'].flatMap(type => state[type]));
  }
  function customerRowPlaceholder(row) {
    if (row.type === 'laborGroup') return '施工人力費';
    return row.name || groups[row.type].mergeLabel;
  }
  function customerSourceNote(row, index) {
    if (row.type === 'laborGroup') return '內部成本合計：' + cur(laborInternalCost()) + '，僅供內部參考，不會顯示給客戶。';
    return '內部成本：' + cur(rowCost(row)) + '，僅供內部參考，不會顯示給客戶。';
  }
  function customerAdvancedSource(row, index) {
    if (row.type === 'laborGroup') {
      const lines = laborRowsWithContent().map((item, itemIndex) => '<li>' + esc(rowTitle(item, itemIndex)) + '｜' + esc(String(positive(item.qty) || 0)) + ' 人 × ' + esc(String(positive(item.days) || 0)) + ' 天</li>').join('');
      return lines ? '<ul class="pq-customer-source-list">' + lines + '</ul>' : '<p class="pq-empty">尚未建立人力來源。</p>';
    }
    return '<p class="pq-customer-source-note">內部來源：' + esc(rowTitle(row, index)) + '</p>';
  }
  function renderCustomerRow(row, index) {
    const isExpanded = expandedCustomerRowId === row.id;
    const opts = mergeGroups.map(group => '<option value="' + esc(group) + '" ' + (row.mergeGroup === group ? 'selected' : '') + '>' + esc(group) + '</option>').join('');
    const visible = row.presentation !== 'hide';
    const moveButtons = row.type === 'laborGroup' ? '' : '<button type="button" data-move-row="' + row.id + '" data-dir="up">上移</button><button type="button" data-move-row="' + row.id + '" data-dir="down">下移</button>';
    const suggestionActions = '<div class="pq-customer-suggestion-actions"><button type="button" data-apply-customer-suggestion="' + row.id + ':qtyUnit">套用建議數量與單位</button><button type="button" data-apply-customer-suggestion="' + row.id + ':amount">套用建議金額</button></div>';
    const qtyControl = row.type === 'laborGroup'
      ? '<div><label>客戶數量呈現</label><select class="control" data-customer-field="' + row.id + ':clientQtyMode">' + customerQtyModeOptions(row.clientQtyMode) + '</select></div><div><label>數量</label><input class="control" inputmode="decimal" data-customer-field="' + row.id + ':clientQty" value="' + esc(row.clientQty) + '" placeholder="' + esc(String(row.suggestedClientQty || customerLaborQty())) + '"></div><div><label>單位</label><input class="control" data-customer-field="' + row.id + ':clientUnit" value="' + esc(row.clientUnit) + '" placeholder="' + esc(row.suggestedClientUnit || customerLaborUnit()) + '"></div>'
      : '<div><label>數量</label><input class="control" inputmode="decimal" data-customer-field="' + row.id + ':clientQty" value="' + esc(row.clientQty) + '" placeholder="' + esc(String(row.suggestedClientQty || customerRowQty(row))) + '"></div><div><label>單位</label><input class="control" data-customer-field="' + row.id + ':clientUnit" value="' + esc(row.clientUnit) + '" placeholder="' + esc(row.suggestedClientUnit || customerRowUnit(row)) + '"></div>';
    const advancedPresentation = row.type === 'laborGroup' ? '' : '<div><label>呈現方式</label><select class="control" data-customer-field="' + row.id + ':presentation">' + presentationOptions(row.type, row.presentation) + '</select></div><div><label>合併分類</label><select class="control" data-customer-field="' + row.id + ':mergeGroup">' + opts + '</select></div><div><label>自訂分類</label><input class="control" data-customer-field="' + row.id + ':customGroup" value="' + esc(row.customGroup) + '" placeholder="自訂分類時填寫"></div>';
    return '<div class="pq-customer-row ' + (isExpanded ? 'is-expanded' : 'is-collapsed') + '" data-customer-row="' + row.id + '"><div class="pq-customer-summary" data-customer-expand="' + row.id + '"><div class="pq-customer-summary-top"><label class="pq-customer-summary-check" onclick="event.stopPropagation()"><input type="checkbox" data-customer-field="' + row.id + ':customerVisible" ' + (visible ? 'checked' : '') + '><span>' + (visible ? '顯示' : '隱藏') + '</span></label><strong>' + esc(customerRowLabel(row, index)) + '</strong><button type="button" data-customer-expand="' + row.id + '" aria-expanded="' + (isExpanded ? 'true' : 'false') + '">' + (isExpanded ? '收合' : '編輯') + '</button></div><div class="pq-customer-summary-bottom"><span class="pq-customer-summary-qty">' + esc(rowCustomerSummary(row)) + '</span><b class="pq-customer-summary-amount">' + esc(customerAmountText(row)) + '</b><em class="pq-customer-status">' + esc(customerStatusLabel(row)) + '</em></div></div><div class="pq-customer-edit" ' + (isExpanded ? '' : 'hidden') + '><strong class="pq-customer-item-title">' + esc(customerRowLabel(row, index)) + '</strong><div class="pq-customer-top"><label class="pq-customer-visible"><input type="checkbox" data-customer-field="' + row.id + ':customerVisible" ' + (visible ? 'checked' : '') + '><span>顯示在報價單</span></label><div class="pq-customer-name"><label>顯示名稱</label><input class="control" data-customer-field="' + row.id + ':clientName" value="' + esc(row.clientName) + '" placeholder="' + esc(customerRowPlaceholder(row)) + '"></div><div class="pq-customer-actions">' + moveButtons + '</div></div><div class="pq-customer-bottom">' + qtyControl + '<div><label>客戶報價金額</label><input class="control" inputmode="decimal" data-customer-field="' + row.id + ':clientAmount" value="' + esc(row.clientAmount) + '" placeholder="' + esc(customerAmountSummary(row)) + '"></div><div class="pq-customer-note"><label>客戶報價備註</label><textarea class="control" rows="2" data-customer-field="' + row.id + ':clientNote" placeholder="選填，只顯示於客戶報價單">' + esc(row.clientNote) + '</textarea></div></div>' + suggestionActions + '<p class="pq-customer-cost-note">' + esc(customerSourceNote(row, index)) + '</p><details class="pq-customer-advanced"><summary>進階設定</summary><div class="pq-customer-advanced-grid">' + advancedPresentation + '<div class="pq-customer-source-detail"><label>內部來源明細</label>' + customerAdvancedSource(row, index) + '</div></div></details></div></div>';
  }
  function rowHead(row, index) {
    const draft = row.featureId ? '<span class="pq-draft-badge ' + (isExpenseItemComplete(row) ? 'is-complete' : 'is-pending') + '">' + (isExpenseItemComplete(row) ? '已填寫' : '待填寫') + '</span>' : '';
    return '<div class="pq-detail-card-head"><strong>' + esc(rowTitle(row, index)) + '</strong>' + draft + '<div class="pq-detail-actions"><button type="button" data-move-row="' + row.id + '" data-dir="up">上移</button><button type="button" data-move-row="' + row.id + '" data-dir="down">下移</button><button type="button" data-delete-row="' + row.id + '">刪除</button></div></div>';
  }
  function fld(label, body, wide = false) { return '<div class="field ' + (wide ? 'is-wide' : '') + '"><label>' + label + '</label>' + body + '</div>'; }
  function inp(row, key, placeholder = '', mode = '') { return '<input class="control" ' + (mode ? 'inputmode="' + mode + '" ' : '') + 'data-row-field="' + row.id + ':' + key + '" value="' + esc(row[key]) + '" placeholder="' + esc(placeholder) + '">'; }
  function materialUnitInput(row) {
    const hint = row.unitAutoSuggested && row.unit === row.unitAutoSuggested ? '目前建議：' + row.unitAutoSuggested + '，可自行修改。' : '系統依項目名稱建議，可自行修改。';
    return '<input class="control" list="pq-material-unit-options" data-row-field="' + row.id + ':unit" value="' + esc(row.unit) + '" placeholder="可選常用單位或自行輸入"><small class="pq-unit-hint">' + esc(hint) + '</small>';
  }
  function syncMaterialUnitInput(row) {
    if (!row || row.type !== 'material') return;
    const unitInput = root.querySelector('[data-row-field="' + row.id + ':unit"]');
    if (!unitInput) return;
    unitInput.value = row.unit;
    const hint = unitInput.parentElement?.querySelector('.pq-unit-hint');
    if (hint) hint.textContent = row.unitAutoSuggested && row.unit === row.unitAutoSuggested ? '目前建議：' + row.unitAutoSuggested + '，可自行修改。' : '系統依項目名稱建議，可自行修改。';
  }
  function includeLine(row) {
    const pending = row.featureId && !isExpenseItemComplete(row) ? '<span class="pq-pending-text">尚未填入成本，不納入成本總額</span>' : '';
    return '<div class="pq-toggle-line"><label><input type="checkbox" data-row-field="' + row.id + ':includeCost" ' + (row.includeCost ? 'checked' : '') + '> 納入成本</label><span>成本小計：<b class="pq-subtotal">' + cur(rowCost(row)) + '</b></span>' + pending + '</div>';
  }
  function renderRow(row, index) {
    let body = '';
    if (row.type === 'labor') body = fld('工種名稱', inp(row, 'name', '例如：油漆師傅'), true) + fld('人數', inp(row, 'qty', '', 'decimal')) + fld('每人每日成本', inp(row, 'unitCost', '', 'decimal')) + fld('工作天數', inp(row, 'days', '', 'decimal'));
    else if (row.type === 'material') body = fld('項目名稱', inp(row, 'name', '例如：油漆、補土材料'), true) + fld('數量', inp(row, 'qty', '', 'decimal')) + fld('單位', materialUnitInput(row)) + fld('成本單價', inp(row, 'unitCost', '', 'decimal'));
    else if (row.type === 'subcontract') body = fld('外包項目', inp(row, 'name', '例如：清運')) + fld('廠商或說明（選填）', inp(row, 'vendor')) + fld('數量', inp(row, 'qty', '', 'decimal')) + fld('單位', inp(row, 'unit')) + fld('成本單價', inp(row, 'unitCost', '', 'decimal')) + fld('僅內部備註', inp(row, 'note'), true);
    else body = fld('項目名稱', inp(row, 'name', '例如：交通、設備租借'), true) + fld('成本金額', inp(row, 'unitCost', '', 'decimal')) + fld('備註', inp(row, 'note'), true);
    return '<article class="pq-detail-card ' + (row.featureId ? 'is-feature-draft' : '') + '" data-row-id="' + row.id + '">' + rowHead(row, index) + '<div class="pq-detail-grid">' + body + '</div>' + includeLine(row) + '</article>';
  }
  function renderDetailLists() {
    ['labor', 'material', 'subcontract', 'other'].forEach(type => {
      const list = q('[data-detail-list="' + type + '"]');
      if (!list) return;
      list.className = 'pq-detail-list';
      list.innerHTML = state[type].length ? state[type].map(renderRow).join('') : '<p class="pq-empty">尚未新增明細。</p>';
    });
  }
  function renderCustomerSettings() {
    syncSuggestedClientAmounts();
    const rows = customerRows();
    if (expandedCustomerRowId && !rows.some(row => row.id === expandedCustomerRowId)) expandedCustomerRowId = '';
    if (!rows.length) {
      els.customerList.innerHTML = '<p class="pq-empty">新增成本明細後，這裡會出現客戶報價項目設定。</p>';
      return;
    }
    const visibleCount = rows.filter(row => row.presentation !== 'hide').length;
    const missingCount = customerMissingItems().length;
    const subtotal = customerItems().reduce((sum, item) => sum + item.amount, 0);
    const toolbar = '<div class="pq-customer-list-toolbar">顯示 ' + visibleCount + ' 項｜未填 ' + missingCount + ' 項｜報價合計 ' + cur(subtotal) + '</div>';
    els.customerList.innerHTML = '<div class="pq-customer-list-shell">' + toolbar + '<div class="pq-customer-list-scroll">' + rows.map(renderCustomerRow).join('') + '</div></div>';
  }
  function renderInlineCustomerSummaries() {
    const rows = customerRows();
    const toolbar = root.querySelector('.pq-customer-list-toolbar');
    if (toolbar) {
      const visibleCount = rows.filter(row => row.presentation !== 'hide').length;
      const missingCount = customerMissingItems().length;
      const subtotal = customerItems().reduce((sum, item) => sum + item.amount, 0);
      toolbar.textContent = '顯示 ' + visibleCount + ' 項｜未填 ' + missingCount + ' 項｜報價合計 ' + cur(subtotal);
    }
    rows.forEach((row, index) => {
      const item = root.querySelector('[data-customer-row="' + row.id + '"]');
      if (!item) return;
      const summary = item.querySelector('.pq-customer-summary');
      if (!summary) return;
      const label = summary.querySelector('strong');
      const qty = summary.querySelector('.pq-customer-summary-qty');
      const amount = summary.querySelector('.pq-customer-summary-amount');
      const status = summary.querySelector('.pq-customer-status');
      const visibleText = summary.querySelector('.pq-customer-summary-check span');
      if (label) label.textContent = customerRowLabel(row, index);
      if (qty) qty.textContent = rowCustomerSummary(row);
      if (amount) amount.textContent = customerAmountText(row);
      if (status) status.textContent = customerStatusLabel(row);
      if (visibleText) visibleText.textContent = row.presentation !== 'hide' ? '顯示' : '隱藏';
      [
        ['clientQty', 'isClientQtyManual'],
        ['clientUnit', 'isClientUnitManual'],
        ['clientAmount', 'isClientAmountManual']
      ].forEach(([field, manualField]) => {
        if (row[manualField]) return;
        const input = item.querySelector('[data-customer-field="' + row.id + ':' + field + '"]');
        if (input) input.value = row[field] || '';
      });
    });
  }
  function renderInlineRowTotals() {
    root.querySelectorAll('[data-row-id]').forEach(card => {
      const row = findRow(card.dataset.rowId);
      if (!row) return;
      const subtotal = card.querySelector('.pq-subtotal');
      if (subtotal) subtotal.textContent = cur(rowCost(row));
      const pending = card.querySelector('.pq-pending-text');
      if (pending) pending.hidden = !(row.featureId && !isExpenseItemComplete(row));
      const badge = card.querySelector('.pq-draft-badge');
      if (badge && row.featureId) {
        const complete = isExpenseItemComplete(row);
        badge.hidden = false;
        badge.classList.toggle('is-complete', complete);
        badge.classList.toggle('is-pending', !complete);
        badge.textContent = complete ? '已填寫' : '待填寫';
      }
    });
  }
  function renderTotals() {
    const t = totals();
    q('[data-total="labor"]').textContent = cur(t.laborCost);
    q('[data-total="material"]').textContent = cur(t.materialCost);
    q('[data-total="subcontract"]').textContent = cur(t.subcontractCost);
    q('[data-total="other"]').textContent = cur(t.otherCost);
    const crew = crewCount();
    if (els.crewSummary) els.crewSummary.textContent = fmt.format(crew) + ' 人';
    if (els.crewNote) els.crewNote.textContent = crew > 0 ? '由人力明細自動加總' : '請新增人力項目';
    renderInlineRowTotals();
  }
  function renderFeatureSummary() {
    const pending = pendingDraftRows();
    if (!els.featureSummary) return;
    if (pending.length) {
      els.featureSummary.textContent = '已建立 ' + pending.length + ' 個待確認支出';
      els.goPendingCosts.hidden = false;
    } else {
      els.featureSummary.textContent = draftRows().length ? '工程特徵支出皆已填寫或保留。' : '尚未建立待確認支出。';
      els.goPendingCosts.hidden = true;
    }
  }
  function marginDisplay(result) {
    const profit = result.totals.estimatedProfit;
    if (profit > 0) return { title: '預估尚有空間', value: '預估差額 ' + cur(profit), note: '此結果僅依目前已輸入資料估算，不代表正式會計、稅務或市場報價建議。' };
    if (profit === 0) return { title: '目前報價與預估支出相同', value: '預估差額 0 元', note: '目前尚未保留材料波動、工期延長、保固、重工及其他臨時狀況的空間。此結果僅供報價前檢查。' };
    return { title: '目前報價可能不足', value: '預估不足 ' + cur(Math.abs(profit)), note: '目前報價可能無法涵蓋已輸入的預估支出，建議重新確認報價或費用項目。此結果僅供報價前檢查。' };
  }
  function riskLabel(level) { return { incomplete: '資料待補', negative: '支出可能不足', zero: '建議確認', low: '建議確認', medium: '建議確認', higher_buffer: '已完成試算' }[level] || '資料待補'; }
  function pinPosition(result) {
    if (result.risk_level === 'incomplete') return 15;
    if (result.risk_level === 'negative') return 8;
    if (result.risk_level === 'zero') return 34;
    if (result.risk_level === 'low') return 48;
    if (result.risk_level === 'medium') return 64;
    return 84;
  }
  function renderMain(result) {
    const p = marginDisplay(result);
    const t = result.totals;
    els.mainResult.innerHTML = '<p>' + esc(p.title) + '</p><strong>' + esc(p.value) + '</strong><em>' + esc(p.note) + '</em>';
    els.secondary.innerHTML = [
      ['預計報價金額', cur(t.estimatedQuoteAmount)],
      ['內部成本總額', cur(t.internalCostTotal)],
      ['預估毛利率', pct(t.estimatedMarginRate)]
    ].map(item => '<span>' + esc(item[0]) + '<b>' + esc(item[1]) + '</b></span>').join('');
    const pending = pendingDraftRows();
    const pendingText = pending.length ? '<p>尚有 ' + pending.length + ' 項支出待填寫：</p><ul>' + pending.map(row => '<li>' + esc(row.name) + '</li>').join('') + '</ul>' : '';
    els.workNote.innerHTML = '<b>工務備註</b><p>' + esc(p.note) + '</p>' + pendingText;
    els.ruler.style.setProperty('--pin-position', pinPosition(result) + '%');
  }
  function renderBreakdown() {
    const sections = [['人力明細', state.labor], ['材料成本明細', state.material], ['外包成本明細', state.subcontract], ['其他成本', state.other]];
    const body = sections.map(([title, rows]) => {
      const visible = rows.filter(row => showAllCosts || rowCost(row) > 0 || row.name || row.featureId);
      const lines = visible.length ? visible.map(row => {
        const qty = row.type === 'other' ? '' : (positive(row.qty) || 0);
        const unit = row.type === 'labor' ? (positive(row.days) || 0) + ' 天' : (row.unit || '');
        const complete = row.featureId ? isExpenseItemComplete(row) : rowCost(row) > 0;
        const unitCost = row.type === 'other' && !complete ? '尚未填入成本' : cur(positive(row.unitCost));
        const vendor = row.vendor ? '｜' + row.vendor : '';
        const status = complete ? (row.featureId ? '已填寫' : '已計入') : '待填寫';
        return '<div class="pq-breakdown-line ' + (complete ? 'is-counted' : 'is-pending') + '"><span>' + esc((row.name || groups[row.type].label) + vendor) + '</span><span>' + esc(String(qty)) + '</span><span>' + esc(unit) + '</span><span class="num">' + esc(unitCost) + '</span><span class="num">' + esc(rowCost(row) > 0 ? cur(rowCost(row)) : '不納入') + '</span><span class="status">' + esc(status) + '</span></div>';
      }).join('') : '<p class="pq-empty">尚未列入。</p>';
      return '<div class="pq-breakdown-group"><h3>' + esc(title) + '</h3>' + lines + '</div>';
    }).join('');
    els.breakdown.innerHTML = '<div class="pq-breakdown-tools"><button class="pq-inline-button" type="button" data-toggle-all-costs>' + (showAllCosts ? '收合明細' : '展開全部') + '</button></div><div class="pq-breakdown-table">' + body + '</div>';
  }
  function checklistText(alert) {
    const text = alert.message;
    if (text.includes('材料')) return '是否已確認材料成本與追加空間';
    if (text.includes('施工人數')) return '是否已設定人力明細與人數';
    if (text.includes('工作天數')) return '是否已確認工程預估工作天數';
    if (text.includes('報價')) return '是否需要重新確認報價或支出項目';
    if (text.includes('保固') || text.includes('回訪')) return '是否已考慮保固與回訪';
    if (text.includes('範圍') || text.includes('客戶')) return '客戶是否已確認完整施工範圍';
    return text;
  }
  function renderAlerts(result) {
    const pending = pendingDraftRows().map(row => ({ id: 'pending-' + row.id, severity: 'need', text: row.name + '尚未填入成本', doneText: row.name + '已填寫或確認' }));
    const seen = new Set();
    const ruleItems = result.alerts.map(alert => {
      const text = checklistText(alert);
      return { id: 'alert-' + text, severity: alert.severity, text, doneText: text + '已確認' };
    });
    const items = pending.concat(ruleItems).filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    els.alerts.innerHTML = items.length ? items.map((item, index) => {
      const checked = confirmedChecks.has(item.id);
      const inputId = 'project-quote-confirm-' + index;
      return '<label class="pq-confirmation-item ' + esc(item.severity) + ' ' + (checked ? 'is-confirmed' : '') + '" for="' + inputId + '"><input class="pq-confirmation-checkbox" id="' + inputId + '" type="checkbox" data-confirm-check="' + esc(item.id) + '" ' + (checked ? 'checked' : '') + '><span class="pq-confirmation-text">' + esc(checked ? item.doneText : item.text) + '</span></label>';
    }).join('') : '<p class="pq-empty">目前沒有待確認項目。</p>';
  }
  function renderCustomerPreview() {
    const items = customerItems();
    const missing = customerMissingItems();
    const t = totals();
    const title = fv('quote_title') || '工程報價單';
    const taxModeNote = t.taxMode === 'inclusive' ? '輸入金額已含稅，以下反推未稅與稅額。' : '輸入金額為未稅，稅額另計。';
    const itemName = item => esc(item.name) + (String(item.note || '').trim() ? '<small class="pq-quote-item-note">' + esc(item.note) + '</small>' : '');
    const pricedRows = items.map((item, index) => '<tr><td>' + (index + 1) + '</td><td>' + itemName(item) + '</td><td class="num">' + esc(item.qty) + '</td><td>' + esc(item.unit) + '</td><td class="num">' + esc(money(item.unitPrice)) + '</td><td class="num">' + esc(money(item.amount)) + '</td></tr>').join('');
    const missingRows = missing.map(row => '<tr class="pq-quote-missing"><td>!</td><td>' + itemName({ name: row.type === 'laborGroup' ? customerLaborLabel() : rowClientLabel(row), note: row.clientNote }) + '</td><td colspan="4">尚未填寫報價，不列入總額。</td></tr>').join('');
    const rows = pricedRows || missingRows ? pricedRows + missingRows : '<tr><td colspan="6">尚未設定客戶報價項目。</td></tr>';
    els.customerPreview.innerHTML = '<div class="pq-quote-title"><div><h3>' + esc(title) + '</h3><p>' + esc(fv('company_title')) + '</p></div><strong>' + esc(fv('quote_date')) + '</strong></div><div class="pq-quote-meta"><div><span>客戶名稱：</span>' + esc(fv('customer_name')) + '</div><div><span>工程名稱：</span>' + esc(fv('project_name')) + '</div><div><span>工程地址：</span>' + esc(fv('project_address')) + '</div><div><span>有效期限：</span>' + esc(fv('valid_until')) + '</div></div><table class="pq-quote-table"><thead><tr><th>項次</th><th>報價項目</th><th>數量</th><th>單位</th><th>報價金額</th><th>小計</th></tr></thead><tbody>' + rows + '</tbody></table><p class="pq-tax-note">' + esc(taxModeNote) + '</p><div class="pq-quote-total"><div><span>未稅金額</span><b>' + esc(cur(t.customerSubtotal)) + '</b></div><div><span>稅額 ' + esc(String(t.taxRate || 0)) + '%</span><b>' + esc(cur(t.tax)) + '</b></div><div><strong>含稅總額</strong><strong>' + esc(cur(t.grandTotal)) + '</strong></div></div><p>' + esc(fv('customer_note')) + '</p><div class="pq-sign-area"><div>客戶簽章</div><div>承攬方簽章</div></div>';
  }
  function copySummary(result) {
    const t = result.totals;
    if (outputMode === 'customer') return '【客戶報價單】\n' + (fv('quote_title') || '工程報價單') + '\n客戶：' + fv('customer_name') + '\n工程：' + fv('project_name') + '\n稅額計算：' + (t.taxMode === 'inclusive' ? '輸入金額已含稅' : '未稅金額另加稅') + '\n未稅金額：' + cur(t.customerSubtotal) + '\n稅額：' + cur(t.tax) + '\n含稅總額：' + cur(t.grandTotal);
    return '【內部成本評估】\n工程類型：' + projectTypeLabel() + '\n預計報價金額：' + cur(t.estimatedQuoteAmount) + '\n人力成本：' + cur(t.laborCost) + '\n材料成本：' + cur(t.materialCost) + '\n外包成本：' + cur(t.subcontractCost) + '\n其他成本：' + cur(t.otherCost) + '\n內部成本總額：' + cur(t.internalCostTotal) + '\n預估毛利／差額：' + signedCur(t.estimatedProfit) + '\n毛利率：' + pct(t.estimatedMarginRate) + '\n內部備註：' + fv('internal_note');
  }
  function renderMode() {
    root.querySelectorAll('[data-output-mode]').forEach(button => {
      const active = button.dataset.outputMode === outputMode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    root.querySelectorAll('[data-output-panel]').forEach(panel => { panel.hidden = panel.dataset.outputPanel !== outputMode; });
    root.querySelectorAll('[data-internal-only]').forEach(section => { section.hidden = outputMode !== 'internal'; });
    root.querySelectorAll('[data-customer-only]').forEach(section => { section.hidden = outputMode !== 'customer'; });
  }
  function renderAll(action, skipLists = false) {
    syncSuggestedClientAmounts();
    if (!skipLists) { renderDetailLists(); renderCustomerSettings(); }
    renderTotals();
    renderFeatureSummary();
    const result = currentResult();
    els.risk.dataset.risk = result.risk_level;
    els.risk.textContent = riskLabel(result.risk_level);
    renderMain(result);
    renderBreakdown();
    renderAlerts(result);
    renderCustomerPreview();
    if (skipLists) renderInlineCustomerSummaries();
    renderMode();
    els.copyText.textContent = copySummary(result);
    if (els.stepLabel) els.stepLabel.textContent = '完整盤點表｜明細可展開收合';
    if (els.stepProgress) els.stepProgress.style.width = '100%';
    if (action) track('tool_generate', action, result.risk_level);
  }

  function updateTarget(target, source = 'sync') {
    const spec = target.dataset.rowField || target.dataset.customerField;
    if (!spec) return false;
    const [rowId, key] = spec.split(':');
    const row = findCustomerTarget(rowId);
    if (!row) return false;
    if (key === 'order') return false;
    if (key === 'customerVisible') {
      row.presentation = target.checked ? (row.presentation === 'hide' ? 'show' : row.presentation) : 'hide';
      return true;
    }
    if (key === 'presentation' && target.tagName === 'SELECT') {
      const visibleInput = root.querySelector('[data-customer-field="' + row.id + ':customerVisible"]');
      if (visibleInput && !visibleInput.checked) return true;
    }
    if (key === 'clientQty' && source === 'user') row.isClientQtyManual = true;
    if (key === 'clientUnit' && source === 'user') row.isClientUnitManual = true;
    if (key === 'clientAmount' && source === 'user') row.isClientAmountManual = true;
    row[key] = target.type === 'checkbox' ? target.checked : target.value;
    if (row.type === 'material' && key === 'unit' && row.unitAutoSuggested && row.unit !== row.unitAutoSuggested) {
      row.unitAutoSuggested = '';
      syncMaterialUnitInput(row);
    }
    if (row.type === 'material' && key === 'name') {
      applyMaterialUnitSuggestion(row);
      syncMaterialUnitInput(row);
    }
    if (key === 'clientQtyMode') syncSuggestedClientAmounts();
    return true;
  }
  function readRows() { root.querySelectorAll('[data-row-field],[data-customer-field]').forEach(target => updateTarget(target, 'sync')); }
  function deleteRow(rowId) {
    for (const type of Object.keys(state)) {
      const index = state[type].findIndex(row => row.id === rowId);
      if (index >= 0) {
        state[type].splice(index, 1);
        if (type === 'labor' && !state[type].length) addRow('labor');
        return;
      }
    }
  }
  function moveRow(rowId, dir) {
    for (const type of Object.keys(state)) {
      const index = state[type].findIndex(row => row.id === rowId);
      if (index < 0) continue;
      const nextIndex = dir === 'up' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= state[type].length) return;
      const [row] = state[type].splice(index, 1);
      state[type].splice(nextIndex, 0, row);
      return;
    }
  }
  function orderRow(rowId, value) {
    const row = findRow(rowId);
    if (!row) return;
    const type = row.type;
    const from = state[type].findIndex(item => item.id === rowId);
    const to = Math.max(0, Math.min(state[type].length - 1, Math.round(positive(value) || 1) - 1));
    if (from === to) return;
    const [moved] = state[type].splice(from, 1);
    state[type].splice(to, 0, moved);
  }
  function scrollResult() { root.querySelector('[data-step="6"]')?.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' }); }
  function scrollOther() { openDetail('other', true); }
  function matchingFeatureRow(featureId) { return state.other.find(row => row.featureId === featureId) || null; }
  function ensureFeatureDraft(featureId) {
    const draft = featureDrafts[featureId];
    if (!draft || matchingFeatureRow(featureId)) return;
    addRow('other', { name: draft.name, unitCost: '', note: draft.note, featureId, presentation: 'hide' });
  }
  function removeFeatureDraftIfEmpty(featureId) {
    const draft = featureDrafts[featureId];
    const index = state.other.findIndex(row => row.featureId === featureId);
    if (!draft || index < 0) return;
    const row = state.other[index];
    const unchangedName = row.name === draft.name;
    const unchangedNote = !row.note || row.note === draft.note;
    if (!isExpenseItemComplete(row) && unchangedName && unchangedNote) state.other.splice(index, 1);
    else row.featureId = '';
  }
  function syncFeatureDrafts(input) {
    const featureId = input?.name?.replace('feature_', '');
    if (!featureId || !(featureId in featureDrafts)) return;
    if (input.checked) {
      ensureFeatureDraft(featureId);
      sectionCollapsed(q('[data-step="3"]'), false);
    } else {
      removeFeatureDraftIfEmpty(featureId);
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(els.copyText.textContent);
      track('tool_copy', outputMode === 'customer' ? 'copy_customer' : 'copy_internal');
      const btn = q('[data-copy-summary]');
      const old = btn.textContent;
      btn.textContent = '已複製';
      setTimeout(() => { btn.textContent = old; }, 1400);
    } catch (_) { track('tool_error', 'copy_failed'); }
  }
  async function shareTool(button) {
    try {
      await navigator.clipboard.writeText(location.href.split('#')[0]);
      track('tool_share', 'share_url');
      const old = button.textContent;
      button.textContent = '已複製網址';
      setTimeout(() => { button.textContent = old; }, 1400);
    } catch (_) { track('tool_error', 'share_failed'); }
  }
  function printMode(mode) {
    outputMode = mode;
    renderAll();
    if (mode === 'customer') {
      const missing = customerMissingItems();
      if (missing.length) window.alert?.('客戶報價單仍有 ' + missing.length + ' 個顯示項目尚未填寫報價金額，列印預覽會標示未填項目且不列入總額。');
    }
    document.body.classList.toggle('pq-print-mode-customer', mode === 'customer');
    document.body.classList.toggle('pq-print-mode-internal', mode === 'internal');
    track('tool_download', mode === 'customer' ? 'print_customer' : 'print_internal');
    window.print();
    setTimeout(() => document.body.classList.remove('pq-print-mode-customer', 'pq-print-mode-internal'), 400);
  }
  function clearAll() {
    els.form.reset();
    root.querySelectorAll('[name="tax_mode"], [name="tax_rate"], [name="customer_note"]').forEach(input => {
      if (input.name === 'tax_mode') input.value = 'exclusive';
      else if (input.name === 'tax_rate') input.value = '5';
      else input.value = '';
    });
    state.labor = [];
    state.material = [];
    state.subcontract = [];
    state.other = [];
    customerLabor.presentation = 'show';
    customerLabor.clientName = '';
    customerLabor.clientQtyMode = 'person_day';
    customerLabor.clientQty = '';
    customerLabor.clientUnit = '';
    customerLabor.clientAmount = '';
    customerLabor.clientNote = '';
    customerLabor.suggestedClientQty = '';
    customerLabor.suggestedClientUnit = '';
    customerLabor.suggestedClientAmount = '';
    customerLabor.isClientQtyManual = false;
    customerLabor.isClientUnitManual = false;
    customerLabor.isClientAmountManual = false;
    customerLabor.mergeGroup = '人工作業費';
    customerLabor.customGroup = '';
    confirmedChecks.clear();
    showAllCosts = false;
    outputMode = 'internal';
    expandedCustomerRowId = '';
    addRow('labor');
    els.customType.hidden = true;
    setDetailOpen('', false);
    root.querySelectorAll('[data-step="3"], [data-step="4"], [data-step="5"]').forEach(section => sectionCollapsed(section, true));
    root.querySelectorAll('[data-step="1"], [data-step="2"]').forEach(section => sectionCollapsed(section, false));
    renderAll('clear');
  }

  renderProjectTypes();
  renderFeatures();
  ensureRows();
  renderAll();
  track('tool_view', 'view');

  root.addEventListener('input', event => {
    if (event.target.matches('[data-customer-field]')) { updateTarget(event.target, 'user'); renderAll('customer_input', true); return; }
    if (event.target.matches('[data-row-field]')) { updateTarget(event.target, 'user'); renderAll('detail_input', true); return; }
    if (event.target.matches('[name="tax_rate"], [name="customer_note"]')) { renderAll('customer_input'); return; }
    if (event.target.closest('[data-quote-form]')) renderAll('input_update');
  });
  root.addEventListener('change', event => {
    if (event.target === els.type) els.customType.hidden = els.type.value !== 'other';
    if (event.target.name?.startsWith('feature_')) { syncFeatureDrafts(event.target); renderAll('feature_change'); return; }
    if (event.target.dataset.customerField?.endsWith(':order')) { const [rowId] = event.target.dataset.customerField.split(':'); orderRow(rowId, event.target.value); renderAll('reorder_customer'); return; }
    if (event.target.matches('[data-customer-field]')) { updateTarget(event.target, 'user'); renderAll('customer_change'); return; }
    if (event.target.matches('[data-row-field]')) { updateTarget(event.target, 'user'); renderAll('detail_change', true); return; }
    if (event.target.matches('[name="tax_mode"], [name="tax_rate"], [name="customer_note"]')) { renderAll('customer_change'); return; }
    if (event.target.closest('[data-quote-form]')) renderAll('change_update');
  });
  root.addEventListener('blur', event => {
    if (event.target.matches('[data-money]')) { normMoney(event.target); renderAll('format_money'); }
    if (event.target.matches('[data-number]')) { normNumber(event.target); renderAll('format_number'); }
  }, true);
  root.addEventListener('click', event => {
    readRows();
    if (event.target.closest('[data-edit-labor]')) { openDetail('labor', true); return; }
    if (event.target.closest('[data-go-pending-costs]')) { scrollOther(); return; }
    const detailToggle = event.target.closest('[data-detail-toggle]');
    if (detailToggle) {
      const type = detailToggle.dataset.detailToggle;
      const open = !detailOpen(type);
      if (open && !state[type].length) addRow(type);
      setDetailOpen(type, open);
      renderAll('toggle_detail');
      return;
    }
    const add = event.target.closest('[data-add-row]');
    if (add) {
      const type = add.dataset.addRow;
      const row = addRow(type);
      expandedCustomerRowId = type === 'labor' ? customerLabor.id : row.id;
      setDetailOpen(type, true);
      renderAll('add_' + type);
      return;
    }
    const del = event.target.closest('[data-delete-row]');
    if (del) { deleteRow(del.dataset.deleteRow); renderAll('delete_row'); return; }
    const mvBtn = event.target.closest('[data-move-row]');
    if (mvBtn) { moveRow(mvBtn.dataset.moveRow, mvBtn.dataset.dir); renderAll('move_row'); return; }
    const suggestion = event.target.closest('[data-apply-customer-suggestion]');
    if (suggestion) {
      const [rowId, kind] = suggestion.dataset.applyCustomerSuggestion.split(':');
      applyCustomerSuggestion(findCustomerTarget(rowId), kind);
      renderAll('apply_customer_suggestion');
      return;
    }
    const customerExpand = event.target.closest('[data-customer-expand]');
    if (customerExpand) {
      expandedCustomerRowId = expandedCustomerRowId === customerExpand.dataset.customerExpand ? '' : customerExpand.dataset.customerExpand;
      renderAll('toggle_customer_row');
      return;
    }
    const mode = event.target.closest('[data-output-mode]');
    if (mode) { outputMode = mode.dataset.outputMode; renderAll('mode_' + outputMode); return; }
    if (event.target.closest('[data-calculate]')) { readRows(); renderAll('calculate'); scrollResult(); return; }
    if (event.target.closest('[data-reset]')) { clearAll(); return; }
    if (event.target.closest('[data-copy-summary]')) { copyText(); return; }
    if (event.target.closest('[data-print-internal]')) { printMode('internal'); return; }
    if (event.target.closest('[data-print-customer]')) { printMode('customer'); return; }
    const share = event.target.closest('[data-share-tool]');
    if (share) { shareTool(share); return; }
    if (event.target.closest('[data-toggle-all-costs]')) { showAllCosts = !showAllCosts; renderAll(); return; }
    const check = event.target.closest('[data-confirm-check]');
    if (check) { if (check.checked) confirmedChecks.add(check.dataset.confirmCheck); else confirmedChecks.delete(check.dataset.confirmCheck); renderAll(); return; }
    const toggle = event.target.closest('[data-section-toggle]');
    if (toggle) { const section = toggle.closest('.pq-section'); if (section) sectionCollapsed(section, !section.classList.contains('is-collapsed')); return; }
    if (event.target.closest('[data-expand-all]')) { root.querySelectorAll('.pq-section').forEach(section => sectionCollapsed(section, false)); return; }
    if (event.target.closest('[data-collapse-costs]')) { root.querySelectorAll('[data-step="2"], [data-step="3"], [data-step="4"], [data-step="5"]').forEach(section => sectionCollapsed(section, true)); setDetailOpen('', false); return; }
    if (event.target.closest('[data-show-result]')) scrollResult();
  });
})();
