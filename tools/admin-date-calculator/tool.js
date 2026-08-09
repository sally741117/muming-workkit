(function () {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const modeText = {
    probation: "輸入到職日期與試用期間，快速取得試用期到期日。",
    contract: "輸入契約開始日與期間，快速取得契約到期日。",
    seniority: "輸入到職日期與計算日期，取得真正的年月日年資。",
    document: "輸入文件日期、有效期間與提醒天數，快速取得到期與建議提醒日期。"
  };

  let activeMode = "probation";
  let latestCopy = "";

  const tabs = Array.from(document.querySelectorAll(".tab"));
  const forms = Array.from(document.querySelectorAll(".form-mode"));
  const form = document.getElementById("toolForm");
  const advanced = document.querySelector(".advanced");
  const inputHint = document.getElementById("inputHint");
  const emptyResult = document.getElementById("emptyResult");
  const resultContent = document.getElementById("resultContent");
  const resultLabel = document.getElementById("resultLabel");
  const resultMain = document.getElementById("resultMain");
  const secondaryDate = document.getElementById("secondaryDate");
  const summaryList = document.getElementById("summaryList");
  const calculationNote = document.getElementById("calculationNote");
  const copyText = document.getElementById("copyText");
  const copyStatus = document.getElementById("copyStatus");

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function todayLocal() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function toInputValue(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseDate(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function cloneDate(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function addDays(date, days) {
    const result = cloneDate(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function addMonths(date, months) {
    const targetMonthIndex = date.getMonth() + months;
    const targetYear = date.getFullYear() + Math.floor(targetMonthIndex / 12);
    const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
    const targetDay = Math.min(date.getDate(), daysInMonth(targetYear, normalizedMonth));
    return new Date(targetYear, normalizedMonth, targetDay);
  }

  function addYears(date, years) {
    const targetYear = date.getFullYear() + years;
    const targetMonth = date.getMonth();
    const targetDay = Math.min(date.getDate(), daysInMonth(targetYear, targetMonth));
    return new Date(targetYear, targetMonth, targetDay);
  }

  function addPeriod(date, period) {
    let result = cloneDate(date);
    result = addYears(result, period.years);
    result = addMonths(result, period.months);
    result = addDays(result, period.days);
    return result;
  }

  function calculateEndDate(start, period, method) {
    const added = addPeriod(start, period);
    return method === "inclusive" ? addDays(added, -1) : added;
  }

  function compareDates(a, b) {
    const left = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
    const right = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
    return Math.sign(left - right);
  }

  function diffDays(start, end) {
    const left = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const right = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.round((right - left) / MS_PER_DAY);
  }

  function formatSlash(date) {
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
  }

  function formatDisplay(date) {
    return `${date.getFullYear()} / ${pad(date.getMonth() + 1)} / ${pad(date.getDate())}`;
  }

  function formatRoc(date, compact) {
    const year = date.getFullYear() - 1911;
    if (compact) return `民國 ${year}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
    return `民國 ${year} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  }

  function formatWesternLong(date) {
    return `西元 ${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  }

  function getDateDisplayMode() {
    return getCheckedValue("dateDisplay") || "both";
  }

  function formatDate(date, variant) {
    const mode = getDateDisplayMode();
    if (variant === "main") {
      if (mode === "roc") return formatRoc(date);
      return formatDisplay(date);
    }
    if (variant === "secondary") {
      if (mode === "both") return formatRoc(date);
      return "";
    }
    if (variant === "summary") {
      if (mode === "western") return formatSlash(date);
      if (mode === "roc") return formatRoc(date, true);
      return `${formatSlash(date)}（${formatRoc(date)}）`;
    }
    if (mode === "western") return formatSlash(date);
    if (mode === "roc") return formatRoc(date);
    return `${formatSlash(date)}（${formatRoc(date)}）`;
  }

  function formatDateHelper(date) {
    return getDateDisplayMode() === "roc" ? formatWesternLong(date) : formatRoc(date);
  }

  function methodText(method) {
    return method === "inclusive" ? "包含起始日計算" : "日期直接往後推";
  }

  function periodText(period) {
    const parts = [];
    if (period.years) parts.push(`${period.years} 年`);
    if (period.months) parts.push(`${period.months} 個月`);
    if (period.days) parts.push(`${period.days} 天`);
    return parts.join(" ") || "0 天";
  }

  function periodForExample(period) {
    if (period.years === 0 && period.months > 0 && period.days === 0) return `${period.months} 個月`;
    return periodText(period);
  }

  function methodNote(start, expiry, period, method) {
    const shortStart = `${start.getMonth() + 1}/${pad(start.getDate())}`;
    const shortEnd = `${expiry.getMonth() + 1}/${pad(expiry.getDate())}`;
    if (method === "inclusive") {
      return `目前採用「包含起始日計算」，${shortStart} 起算 ${periodForExample(period)} 為 ${shortEnd}。`;
    }
    return `目前採用「日期直接往後推」，${shortStart} 往後 ${periodForExample(period)} 為 ${shortEnd}。`;
  }

  function getCheckedValue(name) {
    const selected = document.querySelector(`input[name="${name}"]:checked`);
    return selected ? selected.value : "";
  }

  function clearErrors() {
    document.querySelectorAll(".field-error").forEach((error) => {
      error.textContent = "";
    });
  }

  function setError(id, message) {
    const error = document.getElementById(id);
    if (error) error.textContent = message;
  }

  function readNonNegativeInteger(id, errorId) {
    const raw = document.getElementById(id).value;
    const value = raw === "" ? 0 : Number(raw);
    if (!Number.isInteger(value) || value < 0) {
      setError(errorId, "請輸入 0 以上的有效整數。");
      return null;
    }
    return value;
  }

  function getPeriod(presetName, prefix, errorId) {
    const preset = getCheckedValue(presetName);
    if (preset === "custom") {
      const years = readNonNegativeInteger(`${prefix}Years`, errorId);
      const months = readNonNegativeInteger(`${prefix}Months`, errorId);
      const days = readNonNegativeInteger(`${prefix}Days`, errorId);
      if (years === null || months === null || days === null) return null;
      if (years === 0 && months === 0 && days === 0) {
        setError(errorId, "自訂期間不可全部為 0。");
        return null;
      }
      return { years, months, days };
    }

    const [years, months, days] = preset.split(":").map(Number);
    return { years, months, days };
  }

  function getReminder() {
    const preset = getCheckedValue("reminderPreset");
    if (preset === "none") return null;
    if (preset === "custom") {
      const raw = document.getElementById("reminderCustomValue").value;
      const value = raw === "" ? null : Number(raw);
      if (!Number.isInteger(value) || value < 0) {
        setError("reminderError", "請輸入 0 以上的有效整數。");
        return undefined;
      }
      return value;
    }
    return Number(preset);
  }

  function getRequiredDate(inputId, errorId, label) {
    const date = parseDate(document.getElementById(inputId).value);
    if (!date) {
      setError(errorId, `請輸入有效的${label}。`);
      return null;
    }
    return date;
  }

  function statusText(expiry) {
    const today = todayLocal();
    const days = diffDays(today, expiry);
    if (days >= 0) return `距離到期還有 ${days} 天`;
    return `已到期 ${Math.abs(days)} 天`;
  }

  function renderSummary(items) {
    summaryList.innerHTML = items.map((item) => (
      `<div class="summary-row"><span>${item.label}</span><strong>${item.value}</strong></div>`
    )).join("");
  }

  function autoResizeCopyBox() {
    copyText.style.height = "auto";
    copyText.style.height = `${copyText.scrollHeight}px`;
  }

  function showResult(result) {
    resultLabel.textContent = result.label;
    resultMain.textContent = result.main;
    secondaryDate.textContent = result.secondary || "";
    secondaryDate.hidden = !result.secondary;
    calculationNote.textContent = result.note || "";
    calculationNote.hidden = !result.note;
    renderSummary(result.summary);
    latestCopy = result.copy;
    copyText.value = latestCopy;
    copyStatus.textContent = "";
    emptyResult.hidden = true;
    resultContent.hidden = false;
    autoResizeCopyBox();
  }

  function hideResult() {
    latestCopy = "";
    copyText.value = "";
    copyStatus.textContent = "";
    emptyResult.hidden = false;
    resultContent.hidden = true;
  }

  function calculateProbation() {
    const start = getRequiredDate("probationStart", "probationStartError", "到職日期");
    const period = getPeriod("probationPreset", "probationCustom", "probationPeriodError");
    if (!start || !period) return null;
    const method = getCheckedValue("method");
    const expiry = calculateEndDate(start, period, method);
    return {
      label: "試用期到期日",
      main: formatDate(expiry, "main"),
      secondary: formatDate(expiry, "secondary"),
      note: methodNote(start, expiry, period, method),
      summary: [
        { label: "到職日期", value: formatDate(start, "summary") },
        { label: "試用期間", value: periodText(period) },
        { label: "距離到期", value: statusText(expiry) }
      ],
      copy: [
        `到職日：${formatDate(start, "copy")}`,
        `試用期間：${periodText(period)}`,
        `試用期到期日：${formatDate(expiry, "copy")}`,
        `計算方式：${methodText(method)}`
      ].join("\n")
    };
  }

  function calculateContract() {
    const start = getRequiredDate("contractStart", "contractStartError", "契約開始日");
    const period = getPeriod("contractPreset", "contractCustom", "contractPeriodError");
    if (!start || !period) return null;
    const method = getCheckedValue("method");
    const expiry = calculateEndDate(start, period, method);
    return {
      label: "契約到期日",
      main: formatDate(expiry, "main"),
      secondary: formatDate(expiry, "secondary"),
      note: methodNote(start, expiry, period, method),
      summary: [
        { label: "契約開始日", value: formatDate(start, "summary") },
        { label: "契約期間", value: periodText(period) },
        { label: "契約到期日", value: formatDate(expiry, "summary") },
        { label: "距離到期", value: statusText(expiry) }
      ],
      copy: [
        `契約開始日：${formatDate(start, "copy")}`,
        `契約期間：${periodText(period)}`,
        `契約到期日：${formatDate(expiry, "copy")}`,
        `距離到期：${statusText(expiry)}`,
        `計算方式：${methodText(method)}`
      ].join("\n")
    };
  }

  function calendarDateDiff(start, end) {
    if (compareDates(end, start) < 0) return null;
    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();

    if (days < 0) {
      months -= 1;
      const previousMonthLastDay = new Date(end.getFullYear(), end.getMonth(), 0).getDate();
      days += previousMonthLastDay;
    }

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    return { years, months, days };
  }

  function nextAnniversary(start, end) {
    let years = 0;
    while (compareDates(addYears(start, years), end) <= 0) years += 1;
    return addYears(start, years);
  }

  function calculateSeniority() {
    const start = getRequiredDate("seniorityStart", "seniorityStartError", "到職日期");
    const end = getRequiredDate("seniorityEnd", "seniorityEndError", "計算日期");
    if (!start || !end) return null;
    if (compareDates(end, start) < 0) {
      setError("seniorityEndError", "計算日不可早於到職日。");
      return null;
    }

    const diff = calendarDateDiff(start, end);
    const totalDays = diffDays(start, end);
    const anniversary = nextAnniversary(start, end);
    const main = `${diff.years} 年 ${diff.months} 個月 ${diff.days} 天`;
    return {
      label: "年資",
      main,
      secondary: "",
      note: "年資使用 calendar date difference 計算年月日，不以總天數除以 365 估算。",
      summary: [
        { label: "到職日期", value: formatDate(start, "summary") },
        { label: "計算日期", value: formatDate(end, "summary") },
        { label: "總日數", value: `${totalDays} 天` },
        { label: "完整年資", value: `${diff.years} 年` },
        { label: "下一個到職週年日", value: formatDate(anniversary, "summary") }
      ],
      copy: [
        `到職日期：${formatDate(start, "copy")}`,
        `計算日期：${formatDate(end, "copy")}`,
        `年資：${main}`,
        `總日數：${totalDays} 天`,
        `完整年資：${diff.years} 年`,
        `下一個到職週年日：${formatDate(anniversary, "copy")}`
      ].join("\n")
    };
  }

  function calculateDocument() {
    const start = getRequiredDate("documentStart", "documentStartError", "起始日期／核發日期");
    const period = getPeriod("documentPreset", "documentCustom", "documentPeriodError");
    const reminder = getReminder();
    if (!start || !period || reminder === undefined) return null;

    const method = getCheckedValue("method");
    const expiry = calculateEndDate(start, period, method);
    const reminderDate = reminder === null ? null : addDays(expiry, -reminder);
    const name = document.getElementById("documentName").value.trim();
    const reminderValue = reminderDate ? formatDate(reminderDate, "summary") : "不計算";
    const reminderCopy = reminderDate ? formatDate(reminderDate, "copy") : "不計算";
    return {
      label: "文件到期日",
      main: formatDate(expiry, "main"),
      secondary: formatDate(expiry, "secondary"),
      note: `${methodNote(start, expiry, period, method)} 僅計算建議提醒日期，不會主動發送通知。`,
      summary: [
        { label: "文件名稱", value: name || "未填寫" },
        { label: "起始日期／核發日期", value: formatDate(start, "summary") },
        { label: "有效期間", value: periodText(period) },
        { label: "文件到期日", value: formatDate(expiry, "summary") },
        { label: "建議提醒日期", value: reminderValue },
        { label: "距離到期", value: statusText(expiry) }
      ],
      copy: [
        name ? `文件名稱：${name}` : "",
        `起始日期／核發日期：${formatDate(start, "copy")}`,
        `有效期間：${periodText(period)}`,
        `文件到期日：${formatDate(expiry, "copy")}`,
        `建議提醒日期：${reminderCopy}`,
        `計算方式：${methodText(method)}`,
        "提醒說明：僅計算建議提醒日期，不會主動發送通知。"
      ].filter(Boolean).join("\n")
    };
  }

  function calculate() {
    clearErrors();
    const calculator = {
      probation: calculateProbation,
      contract: calculateContract,
      seniority: calculateSeniority,
      document: calculateDocument
    }[activeMode];
    const result = calculator();
    if (!result) {
      hideResult();
      updateDateHelpers();
      return;
    }
    showResult(result);
    updateDateHelpers();
  }

  function setMode(mode) {
    activeMode = mode;
    tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === mode));
    forms.forEach((section) => section.classList.toggle("is-active", section.dataset.form === mode));
    inputHint.textContent = modeText[mode];
    advanced.hidden = mode === "seniority";
    hideResult();
    clearErrors();
    updateCustomVisibility();
    updateDateHelpers();
  }

  function updateCustomVisibility() {
    [
      ["probationPreset", "probationCustom"],
      ["contractPreset", "contractCustom"],
      ["documentPreset", "documentCustom"],
      ["reminderPreset", "reminderCustom"]
    ].forEach(([name, rowId]) => {
      const row = document.getElementById(rowId);
      if (row) row.classList.toggle("is-visible", getCheckedValue(name) === "custom");
    });
  }

  function updateDateHelpers() {
    document.querySelectorAll("[data-date-input]").forEach((input) => {
      const helper = document.querySelector(`[data-date-helper-for="${input.id}"]`);
      if (!helper) return;
      const date = parseDate(input.value);
      helper.textContent = date ? formatDateHelper(date) : "";
    });
  }

  function clearCurrent() {
    const section = document.querySelector(`[data-form="${activeMode}"]`);
    section.querySelectorAll("input").forEach((input) => {
      if (input.type === "radio") return;
      if (input.type === "number") input.value = input.closest(".custom-period") ? "0" : "";
      else input.value = "";
    });
    if (activeMode === "probation") document.querySelector('input[name="probationPreset"][value="0:3:0"]').checked = true;
    if (activeMode === "contract") document.querySelector('input[name="contractPreset"][value="0:6:0"]').checked = true;
    if (activeMode === "document") {
      document.querySelector('input[name="documentPreset"][value="1:0:0"]').checked = true;
      document.querySelector('input[name="reminderPreset"][value="30"]').checked = true;
    }
    if (activeMode === "seniority") document.getElementById("seniorityEnd").value = toInputValue(todayLocal());
    updateCustomVisibility();
    updateDateHelpers();
    clearErrors();
    hideResult();
  }

  function copyLatest() {
    if (!latestCopy) return;
    navigator.clipboard.writeText(latestCopy).then(() => {
      copyStatus.textContent = "已複製結果。";
    }).catch(() => {
      copyText.focus();
      copyText.select();
      document.execCommand("copy");
      copyStatus.textContent = "已複製結果。";
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => setMode(tab.dataset.tab));
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    calculate();
  });

  form.addEventListener("input", () => {
    updateDateHelpers();
    autoResizeCopyBox();
  });
  form.addEventListener("change", () => {
    updateCustomVisibility();
    updateDateHelpers();
  });
  document.querySelectorAll('input[name="dateDisplay"]').forEach((input) => {
    input.addEventListener("change", () => {
      updateDateHelpers();
      if (!resultContent.hidden) calculate();
    });
  });

  document.getElementById("copyButton").addEventListener("click", copyLatest);
  document.getElementById("recalculateButton").addEventListener("click", calculate);
  document.getElementById("clearButton").addEventListener("click", clearCurrent);
  document.getElementById("clearResultButton").addEventListener("click", clearCurrent);

  document.getElementById("seniorityEnd").value = toInputValue(todayLocal());
  updateCustomVisibility();
  updateDateHelpers();

  window.adminDateCalculator = {
    parseDate,
    addDays,
    addMonths,
    addYears,
    addPeriod,
    calculateEndDate,
    calendarDateDiff,
    formatSlash,
    formatRoc,
    periodText
  };
})();
