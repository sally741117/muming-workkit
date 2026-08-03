(function(){
  const tools = () => Array.isArray(window.WorkKitTools) ? window.WorkKitTools : [];
  const byStatus = { "正式可用": 0, "測試版": 1, "即將推出": 2, "開發中": 3 };
  const plannedStatuses = new Set(["開發中", "即將推出"]);
  function escapeHtml(value){ return String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char])); }
  function formatDate(value){ const parts = String(value || "").split("-"); return parts.length === 3 ? `${parts[0]}/${parts[1]}/${parts[2]}` : String(value || ""); }
  function toolUrl(tool){ if (!tool || tool.url === "#planned") return `tools.html?q=${encodeURIComponent(tool?.name || "")}`; return tool.url; }
  function actionLabel(tool){ if (!tool || tool.url === "#planned") return "查看狀態"; return "開始使用"; }
  function renderToolCard(tool){
    return `<article class="home-tool-card"><div class="home-tool-card__top"><span class="home-tool-icon" aria-hidden="true">${escapeHtml(tool.icon || "工")}</span><div class="home-tool-meta"><span>${escapeHtml(tool.status || "")}</span><span>${escapeHtml(tool.category || "")}</span></div></div><h3>${escapeHtml(tool.name)}</h3><p>${escapeHtml(tool.description)}</p><a class="button button-small ${plannedStatuses.has(tool.status) ? "button-outline" : "button-primary"}" href="${escapeHtml(toolUrl(tool))}" ${plannedStatuses.has(tool.status) ? "" : `data-open-tool="${escapeHtml(tool.tool_id)}"`}>${actionLabel(tool)} →</a></article>`;
  }
  function renderFeatured(){
    const target = document.querySelector("[data-home-featured-tools]");
    if (!target) return;
    const selected = tools().filter(tool => !plannedStatuses.has(tool.status)).sort((a, b) => (byStatus[a.status] ?? 9) - (byStatus[b.status] ?? 9) || Number(b.featured) - Number(a.featured) || (b.updated_at || "").localeCompare(a.updated_at || "")).slice(0, 3);
    target.innerHTML = selected.length ? selected.map(renderToolCard).join("") : `<p class="empty-state">目前尚無可顯示的工具資料。</p>`;
  }
  function renderLatest(){
    const target = document.querySelector("[data-home-latest-tools]");
    if (!target) return;
    const selected = tools().filter(tool => tool.updated_at).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, 4);
    target.innerHTML = selected.map(tool => `<a class="home-latest-card" href="${escapeHtml(toolUrl(tool))}"><span>${escapeHtml(tool.status || "")}</span><h3>${escapeHtml(tool.name)}</h3><p>${escapeHtml(tool.category || "")} · ${escapeHtml(tool.industry || "")}</p><strong class="home-latest-date">${escapeHtml(formatDate(tool.updated_at))}</strong></a>`).join("");
  }
  function initSearch(){
    const form = document.querySelector("[data-work-search-form]");
    const input = document.querySelector("[data-work-search]");
    const toast = document.querySelector("[data-home-toast]");
    let timer = null;
    if (!form || !input) return;
    function showToast(message){ if (!toast) return; toast.textContent = message; toast.classList.add("is-visible"); window.clearTimeout(timer); timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600); }
    form.addEventListener("submit", event => {
      event.preventDefault();
      const query = input.value.trim();
      if (query) {
        window.WorkKitAnalytics?.search_tool?.({ action: "home_work_search", page: location.pathname });
        location.href = `tools.html?q=${encodeURIComponent(query)}`;
        return;
      }
      showToast("搜尋功能持續建置中，先從常見工作開始。");
      document.querySelector("#common-work")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  document.addEventListener("DOMContentLoaded", () => { initSearch(); renderFeatured(); renderLatest(); });
})();
