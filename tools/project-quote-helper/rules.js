(function () {
  const PROJECT_TYPES = [
    { id: 'plumbing_electrical', label: '水電' },
    { id: 'painting', label: '油漆' },
    { id: 'waterproofing', label: '防水' },
    { id: 'masonry', label: '泥作' },
    { id: 'ac_cleaning', label: '冷氣清洗' },
    { id: 'home_repair', label: '居家修繕' },
    { id: 'furniture_install', label: '家具安裝' },
    { id: 'small_renovation', label: '小型裝修' },
    { id: 'other', label: '其他' }
  ];
  const FEATURES = [
    { id: 'demolition', label: '需要拆除' },
    { id: 'disposal', label: '需要清運' },
    { id: 'height_work', label: '需要高處作業' },
    { id: 'equipment_rental', label: '需要租用設備' },
    { id: 'cross_city', label: '需要跨縣市移動' },
    { id: 'overnight', label: '需要過夜' },
    { id: 'possible_extra_material', label: '可能追加材料' },
    { id: 'warranty', label: '需要保固' },
    { id: 'occupied_site', label: '施工中有人居住' },
    { id: 'scope_unconfirmed', label: '客戶尚未確認完整範圍' }
  ];
  const COST_ITEMS = [
    { id: 'laborCost', label: '人力', source: 'labor' },
    { id: 'material_cost', label: '材料' },
    { id: 'subcontract_cost', label: '外包' },
    { id: 'demolition_cost', label: '拆除', feature: 'demolition' },
    { id: 'transport_cost', label: '交通', feature: 'cross_city' },
    { id: 'parking_cost', label: '停車' },
    { id: 'disposal_cost', label: '清運', feature: 'disposal' },
    { id: 'height_work_cost', label: '高處作業／吊車／鷹架', feature: 'height_work' },
    { id: 'equipment_cost', label: '設備租用', feature: 'equipment_rental' },
    { id: 'consumable_cost', label: '耗材' },
    { id: 'lodging_cost', label: '住宿', feature: 'overnight' },
    { id: 'meal_cost', label: '餐費' },
    { id: 'reserved_material_cost', label: '預留材料', feature: 'possible_extra_material' },
    { id: 'warranty_reserve_cost', label: '保固／回訪預留', feature: 'warranty' },
    { id: 'protection_cleaning_cost', label: '防護／清潔', feature: 'occupied_site' },
    { id: 'other_cost', label: '其他' }
  ];
  const FEATURE_COSTS = {
    demolition: 'demolition_cost',
    disposal: 'disposal_cost',
    height_work: 'height_work_cost',
    equipment_rental: 'equipment_cost',
    cross_city: 'transport_cost',
    overnight: 'lodging_cost',
    possible_extra_material: 'reserved_material_cost',
    warranty: 'warranty_reserve_cost',
    occupied_site: 'protection_cleaning_cost'
  };
  function alert(type, severity, message) { return { type, severity, message }; }
  function amount(data, id) {
    return Number.isFinite(data[id]) ? data[id] : 0;
  }
  function activeCost(data, id, featureId) {
    if (featureId && !data.features[featureId]) return 0;
    return amount(data, id);
  }
  function riskLevel(data, totals, alerts) {
    if (alerts.some((item) => item.severity === 'need')) return 'incomplete';
    if (totals.margin < 0) return 'negative';
    if (totals.margin === 0) return 'zero';
    if (data.quote_amount <= 0) return 'incomplete';
    if (totals.marginRatio > 0 && totals.marginRatio < 10) return 'low';
    if (totals.marginRatio >= 10 && totals.marginRatio <= 20) return 'medium';
    return 'higher_buffer';
  }
  function evaluate(data) {
    data.features = data.features || {};
    const alerts = [];
    const quoteAmount = amount(data, 'quote_amount');
    const crewCount = amount(data, 'crew_count');
    const workDays = amount(data, 'work_days');
    const dailyLaborCost = amount(data, 'daily_labor_cost');
    if (quoteAmount <= 0) alerts.push(alert('必要資料', 'need', '預計報價未填或為 0，請先補上報價金額。'));
    if (crewCount <= 0) alerts.push(alert('必要資料', 'need', '施工人數未填或為 0，請先確認投入人數。'));
    if (workDays <= 0) alerts.push(alert('必要資料', 'need', '工作天數未填或為 0，請先估算施工天數。'));
    if (dailyLaborCost <= 0) alerts.push(alert('必要資料', 'need', '每人每日人力成本未填或為 0，請先確認人力成本。'));
    if (amount(data, 'material_cost') === 0) alerts.push(alert('必要資料', 'check', '目前材料費為 0，若此工程確實不需材料可忽略；否則請再次確認。'));
    Object.keys(FEATURE_COSTS).forEach((featureId) => {
      if (data.features[featureId] && amount(data, FEATURE_COSTS[featureId]) === 0) alerts.push(alert('可能漏項', 'check', '請確認此項費用是否已包含在人力費或外包費中；若已包含可維持 0。'));
    });
    if (data.features.demolition && !data.features.disposal) alerts.push(alert('可能漏項', 'check', '拆除後是否會產生廢料？建議確認是否需要清運。'));
    if (workDays > 1 && amount(data, 'meal_cost') === 0) alerts.push(alert('可能漏項', 'check', '工作天數超過 1 天，但餐費為 0，請確認是否需編列餐費。'));
    const laborCost = crewCount * workDays * dailyLaborCost;
    const totalCost = laborCost + amount(data, 'material_cost') + amount(data, 'subcontract_cost') + amount(data, 'parking_cost') + amount(data, 'consumable_cost') + amount(data, 'meal_cost') + amount(data, 'other_cost')
      + activeCost(data, 'demolition_cost', 'demolition')
      + activeCost(data, 'disposal_cost', 'disposal')
      + activeCost(data, 'height_work_cost', 'height_work')
      + activeCost(data, 'equipment_cost', 'equipment_rental')
      + activeCost(data, 'transport_cost', 'cross_city')
      + activeCost(data, 'lodging_cost', 'overnight')
      + activeCost(data, 'reserved_material_cost', 'possible_extra_material')
      + activeCost(data, 'warranty_reserve_cost', 'warranty')
      + activeCost(data, 'protection_cleaning_cost', 'occupied_site');
    const margin = quoteAmount - totalCost;
    const marginRatio = quoteAmount > 0 ? (margin / quoteAmount) * 100 : null;
    const totals = { laborCost, totalCost, margin, marginRatio };
    if (data.features.possible_extra_material && margin <= 0) alerts.push(alert('可能漏項', 'risk', '已勾選可能追加材料，且目前差額小於或等於 0，建議重新確認材料補購空間。'));
    if (data.features.warranty) alerts.push(alert('一般提醒', 'info', '請確認保固、回訪與可能重工成本是否已納入考量。'));
    if (data.features.occupied_site) alerts.push(alert('一般提醒', 'info', '施工中有人居住，請確認防護、清潔與施工時間限制。'));
    if (data.features.scope_unconfirmed) alerts.push(alert('一般提醒', 'info', '客戶尚未確認完整範圍，報價範圍可能變動，建議保留書面說明。'));
    if (margin < 0) alerts.push(alert('報價風險', 'risk', '目前報價可能無法涵蓋已輸入的預估支出，建議重新檢查報價或支出項目。'));
    else if (margin === 0 && quoteAmount > 0) alerts.push(alert('報價風險', 'risk', '目前報價與已輸入支出相同，尚未保留材料波動、工期延長、保固、管理與臨時狀況空間。'));
    else if (marginRatio !== null && marginRatio > 0 && marginRatio < 10) alerts.push(alert('報價風險', 'check', '目前差額空間較低，材料波動、工期延長或臨時狀況可能使實際支出超出報價。'));
    else if (marginRatio !== null && marginRatio >= 10 && marginRatio <= 20) alerts.push(alert('報價風險', 'info', '目前仍有一定調整空間，建議確認是否已納入現勘、溝通、保固與重工風險。'));
    else if (marginRatio !== null && marginRatio > 20) alerts.push(alert('報價風險', 'info', '目前報價與已輸入支出之間仍有空間，請確認支出是否填寫完整；本工具不判斷市場價格或合理收費。'));
    return { totals, alerts, risk_level: riskLevel(data, totals, alerts) };
  }
  window.ProjectQuoteRules = { PROJECT_TYPES, FEATURES, COST_ITEMS, evaluate };
})();
