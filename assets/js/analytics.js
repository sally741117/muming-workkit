(function () {
  const allowedKeys = new Set(["tool_id", "pack_id", "language", "scenario", "action", "page", "project_type", "risk_level"]);
  const eventNames = [
    "tool_view",
    "tool_start",
    "tool_generate",
    "tool_copy",
    "tool_download",
    "tool_share",
    "tool_favorite",
    "tool_error",
    "search_tool",
    "search_no_result"
  ];

  function sanitize(payload) {
    const clean = {};
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (allowedKeys.has(key) && value !== undefined && value !== null) {
        clean[key] = String(value).slice(0, 80);
      }
    });
    return clean;
  }

  function track(eventName, payload) {
    if (!eventNames.includes(eventName)) return;
    const cleanPayload = sanitize(payload);
    console.info("[MUMING WorkKit analytics]", eventName, cleanPayload);
  }

  window.WorkKitAnalytics = {
    track,
    tool_view: (payload) => track("tool_view", payload),
    tool_start: (payload) => track("tool_start", payload),
    tool_generate: (payload) => track("tool_generate", payload),
    tool_copy: (payload) => track("tool_copy", payload),
    tool_download: (payload) => track("tool_download", payload),
    tool_share: (payload) => track("tool_share", payload),
    tool_favorite: (payload) => track("tool_favorite", payload),
    tool_error: (payload) => track("tool_error", payload),
    search_tool: (payload) => track("search_tool", payload),
    search_no_result: (payload) => track("search_no_result", payload)
  };
})();

