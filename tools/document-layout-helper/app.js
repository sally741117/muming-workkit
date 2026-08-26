const MM = 72 / 25.4;
const CARD_W_MM = 85;
const CARD_H_MM = 54;
const A4_W = 210;
const A4_H = 297;
const TOOL_CANONICAL_URL = "https://sally741117.github.io/muming-workkit/tools/document-layout-helper/";
const TOOL_LINE_SHARE_URL = `${TOOL_CANONICAL_URL}?openExternalBrowser=1`;
const state = {
  cards: [],
  cases: [],
  activeCropId: null,
  cropPoints: [],
  cropCandidates: [],
  cropCandidateIndex: 0,
  cropRotation: 0,
  cropInitialSnapshot: null,
  cropOpenSnapshot: null,
  cropDirty: false,
  cropManuallyAdjusted: false,
  activeCropHandle: null,
  cropOpener: null,
  cropRestoreFocus: true,
  cropFocusBeforeDiscard: null,
  cropPageScrollY: 0,
  viewerId: null,
  viewerMode: "original",
  selectedCardId: null,
  slotChoice: null,
  replaceRequest: null,
  fileChooserCallbacks: {},
  pointerDrag: null,
  cvReady: false,
  pdfReady: false,
  pdfCache: new Map(),
  pdfWarmTimers: new Map()
};

const el = {
  engineStatus: document.querySelector("#engineStatus"),
  statusLog: document.querySelector("#statusLog"),
  diagnosticPanel: document.querySelector("#diagnosticPanel"),
  diagnosticOutput: document.querySelector("#diagnosticOutput"),
  refreshDiagnosticBtn: document.querySelector("#refreshDiagnosticBtn"),
  testUrlShareBtn: document.querySelector("#testUrlShareBtn"),
  testPdfShareBtn: document.querySelector("#testPdfShareBtn"),
  testImageShareBtn: document.querySelector("#testImageShareBtn"),
  diagnosticImagePreview: document.querySelector("#diagnosticImagePreview"),
  diagnosticImagePreviewImg: document.querySelector("#diagnosticImagePreviewImg"),
  testBlobDownloadBtn: document.querySelector("#testBlobDownloadBtn"),
  testBlobOpenBtn: document.querySelector("#testBlobOpenBtn"),
  copyDiagnosticBtn: document.querySelector("#copyDiagnosticBtn"),
  androidUploadHint: document.querySelector("#androidUploadHint"),
  slotGalleryInput: document.querySelector("#slotGalleryInput"),
  slotPdfInput: document.querySelector("#slotPdfInput"),
  slotMixedInput: document.querySelector("#slotMixedInput"),
  lineAndroidFallbackDialog: document.querySelector("#lineAndroidFallbackDialog"),
  openExternalBrowserLink: document.querySelector("#openExternalBrowserLink"),
  copyExternalUrlBtn: document.querySelector("#copyExternalUrlBtn"),
  closeLineFallbackBtn: document.querySelector("#closeLineFallbackBtn"),
  cases: document.querySelector("#cases"),
  addCaseBtn: document.querySelector("#addCaseBtn"),
  cropDialog: document.querySelector("#cropDialog"),
  cropAssignmentContext: document.querySelector("#cropAssignmentContext"),
  cropCanvas: document.querySelector("#cropCanvas"),
  cropOverlay: document.querySelector("#cropOverlay"),
  cropHandleHint: document.querySelector("#cropHandleHint"),
  cropCorrectionPreviewCanvas: document.querySelector("#cropCorrectionPreviewCanvas"),
  autoCropBtn: document.querySelector("#autoCropBtn"),
  redetectFrameBtn: document.querySelector("#redetectFrameBtn"),
  nextFrameBtn: document.querySelector("#nextFrameBtn"),
  rotateLeftBtn: document.querySelector("#rotateLeftBtn"),
  rotateRightBtn: document.querySelector("#rotateRightBtn"),
  rotate180Btn: document.querySelector("#rotate180Btn"),
  resetCropBtn: document.querySelector("#resetCropBtn"),
  applyCropBtn: document.querySelector("#applyCropBtn"),
  discardCropPrompt: document.querySelector("#discardCropPrompt"),
  keepEditingCropBtn: document.querySelector("#keepEditingCropBtn"),
  discardCropBtn: document.querySelector("#discardCropBtn"),
  cardChoiceDialog: document.querySelector("#cardChoiceDialog"),
  cardChoiceContext: document.querySelector("#cardChoiceContext"),
  cardChoiceOptions: document.querySelector("#cardChoiceOptions"),
  cancelCardChoiceBtn: document.querySelector("#cancelCardChoiceBtn"),
  replaceDialog: document.querySelector("#replaceDialog"),
  cancelReplaceBtn: document.querySelector("#cancelReplaceBtn"),
  confirmReplaceBtn: document.querySelector("#confirmReplaceBtn"),
  viewerDialog: document.querySelector("#viewerDialog"),
  viewerImage: document.querySelector("#viewerImage"),
  viewOriginalBtn: document.querySelector("#viewOriginalBtn"),
  viewEnhancedBtn: document.querySelector("#viewEnhancedBtn")
};

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function log(message) {
  const line = document.createElement("div");
  line.textContent = message;
  el.statusLog.prepend(line);
}

function showToast(message) {
  let toast = document.querySelector("#workkitToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "workkitToast";
    toast.className = "workkit-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function inAppBrowserInfo(userAgent = window.navigator.userAgent) {
  const ua = userAgent || "";
  if (/\bLine\/|\bLIFF\b/i.test(ua)) return { id: "line", name: "LINE" };
  if (/FBAN|FBAV|FB_IAB|FB4A|FBIOS|MessengerForiOS|Orca-Android/i.test(ua)) {
    return { id: "facebook", name: /MessengerForiOS|Orca-Android/i.test(ua) ? "Messenger" : "Facebook" };
  }
  if (/Instagram/i.test(ua)) return { id: "instagram", name: "Instagram" };
  return null;
}

async function copyText(text) {
  try {
    if (window.navigator.clipboard?.writeText) {
      await window.navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {
    // LINE and other embedded browsers may deny the Clipboard API.
  }
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  input.setSelectionRange(0, input.value.length);
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch (_) {
    copied = false;
  }
  input.remove();
  return copied;
}


const diagnosticEnabled = new URLSearchParams(window.location.search).get("debug") === "1";
let diagnosticReadyPdfBundle = null;
let diagnosticReadyImageFile = null;
let diagnosticImagePreviewUrl = null;
const diagnosticState = {
  inputs: {
    gallery: { pickerRequested: false, changeEvent: false, fileReceived: false, type: "", size: 0 },
    pdf: { pickerRequested: false, changeEvent: false, fileReceived: false, type: "", size: 0 }
  },
  urlShare: {
    result: "not-tested",
    activationIsActive: null,
    activationHasBeenActive: null,
    clickToShareMs: null,
    errorName: "",
    errorMessage: ""
  },
  pdf: {
    blobCreated: false,
    blobType: "",
    blobSize: 0,
    fileCreated: false,
    fileName: "",
    fileType: "",
    fileSize: 0,
    canShareFiles: null,
    canShareFilesErrorName: "",
    canShareFilesErrorMessage: "",
    canShareUrl: null,
    canShareUrlErrorName: "",
    canShareUrlErrorMessage: "",
    readyBeforeClick: false,
    readyCreatedAt: "",
    shareActivationIsActive: null,
    shareActivationHasBeenActive: null,
    clickToShareMs: null,
    shareResult: "not-tested",
    shareErrorName: "",
    shareErrorMessage: "",
    blobDownload: "not-tested",
    blobOpen: "not-tested"
  },
  image: {
    fileCreated: false,
    fileName: "",
    fileType: "",
    fileSize: 0,
    width: 600,
    height: 400,
    canShareFiles: null,
    canShareFilesErrorName: "",
    canShareFilesErrorMessage: "",
    readyBeforeClick: false,
    readyCreatedAt: "",
    shareActivationIsActive: null,
    shareActivationHasBeenActive: null,
    clickToShareMs: null,
    result: "not-tested",
    errorName: "",
    errorMessage: ""
  },
  formalShare: {
    result: "not-tested",
    cacheReadyAtClick: null,
    activationAtClickIsActive: null,
    activationAtClickHasBeenActive: null,
    activationBeforeShareIsActive: null,
    activationBeforeShareHasBeenActive: null,
    clickToShareMs: null,
    errorName: "",
    errorMessage: ""
  }
};

function userActivationSnapshot() {
  return {
    isActive: navigator.userActivation?.isActive ?? null,
    hasBeenActive: navigator.userActivation?.hasBeenActive ?? null
  };
}

function webSharePolicyAllowed() {
  const policy = document.permissionsPolicy || document.featurePolicy;
  if (typeof policy?.allowsFeature !== "function") return null;
  try {
    return policy.allowsFeature("web-share");
  } catch (_) {
    return null;
  }
}

function createDiagnosticPdfBundle() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  pdf.setFontSize(18);
  pdf.text("MUMING PDF Share Test", 20, 30);
  const outputBlob = pdf.output("blob");
  const blob = outputBlob.type === "application/pdf"
    ? outputBlob
    : new Blob([outputBlob], { type: "application/pdf" });
  const file = typeof File === "function"
    ? new File([blob], "muming-share-test.pdf", { type: "application/pdf" })
    : null;
  return { blob, file };
}

function createDiagnosticImageFile() {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 400;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#0b6b5f";
  context.font = "700 68px Arial, sans-serif";
  context.fillText("MUMING", 300, 135);
  context.fillStyle = "#1f2933";
  context.font = "600 46px Arial, sans-serif";
  context.fillText("Image Share Test", 300, 215);
  context.fillStyle = "#66736f";
  context.font = "24px Arial, sans-serif";
  context.fillText("Samsung Internet Web Share Test", 300, 315);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to create diagnostic PNG."));
        return;
      }
      resolve(new File([blob], "muming-image-share-test.png", { type: "image/png" }));
    }, "image/png");
  });
}

function diagnosticSnapshot() {
  const inApp = inAppBrowserInfo();
  return {
    browser: {
      userAgent: navigator.userAgent,
      platform: navigator.platform || "",
      secureContext: window.isSecureContext,
      navigatorShare: typeof navigator.share === "function",
      navigatorCanShare: typeof navigator.canShare === "function",
      userActivation: userActivationSnapshot(),
      webSharePolicyAllowed: webSharePolicyAllowed(),
      inAppBrowser: inApp?.id || false,
      isLineInAppBrowser: inApp?.id === "line",
      isSamsungInternet: isSamsungInternet(),
      isAndroid: /Android/i.test(navigator.userAgent),
      isIOS: /iPad|iPhone|iPod/i.test(navigator.userAgent)
        || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
    },
    urlShare: { ...diagnosticState.urlShare },
    pdf: { ...diagnosticState.pdf },
    image: { ...diagnosticState.image },
    formalShare: { ...diagnosticState.formalShare },
    fileInputs: {
      gallery: { ...diagnosticState.inputs.gallery },
      pdf: { ...diagnosticState.inputs.pdf }
    }
  };
}

function renderDiagnostic() {
  if (!diagnosticEnabled) return;
  el.diagnosticOutput.textContent = JSON.stringify(diagnosticSnapshot(), null, 2);
}

function refreshDiagnosticCapabilities(bundle = null) {
  if (!diagnosticEnabled) return;
  try {
    const { blob, file } = bundle || diagnosticReadyPdfBundle || createDiagnosticPdfBundle();
    diagnosticState.pdf.blobCreated = blob instanceof Blob;
    diagnosticState.pdf.blobType = blob.type;
    diagnosticState.pdf.blobSize = blob.size;
    diagnosticState.pdf.fileCreated = file instanceof File;
    diagnosticState.pdf.fileName = file?.name || "";
    diagnosticState.pdf.fileType = file?.type || "";
    diagnosticState.pdf.fileSize = file?.size || 0;
    diagnosticState.pdf.canShareFiles = false;
    diagnosticState.pdf.canShareFilesErrorName = "";
    diagnosticState.pdf.canShareFilesErrorMessage = "";
    if (typeof navigator.canShare === "function" && file) {
      try {
        diagnosticState.pdf.canShareFiles = Boolean(navigator.canShare({ files: [file] }));
      } catch (error) {
        diagnosticState.pdf.canShareFilesErrorName = error?.name || "Error";
        diagnosticState.pdf.canShareFilesErrorMessage = error?.message || String(error);
      }
    }
    diagnosticState.pdf.canShareUrl = false;
    diagnosticState.pdf.canShareUrlErrorName = "";
    diagnosticState.pdf.canShareUrlErrorMessage = "";
    if (typeof navigator.canShare === "function") {
      try {
        diagnosticState.pdf.canShareUrl = Boolean(navigator.canShare({
          title: "MUMING",
          text: "PDF Share Test",
          url: TOOL_LINE_SHARE_URL
        }));
      } catch (error) {
        diagnosticState.pdf.canShareUrlErrorName = error?.name || "Error";
        diagnosticState.pdf.canShareUrlErrorMessage = error?.message || String(error);
      }
    }
  } catch (error) {
    diagnosticState.pdf.shareResult = "capability-check-error";
    diagnosticState.pdf.shareErrorName = error?.name || "Error";
    diagnosticState.pdf.shareErrorMessage = error?.message || String(error);
  }
  renderDiagnostic();
}

function refreshDiagnosticImageCapabilities(file = diagnosticReadyImageFile) {
  if (!diagnosticEnabled) return;
  diagnosticState.image.fileCreated = file instanceof File;
  diagnosticState.image.fileName = file?.name || "";
  diagnosticState.image.fileType = file?.type || "";
  diagnosticState.image.fileSize = file?.size || 0;
  diagnosticState.image.canShareFiles = false;
  diagnosticState.image.canShareFilesErrorName = "";
  diagnosticState.image.canShareFilesErrorMessage = "";
  if (file && typeof navigator.canShare === "function") {
    try {
      diagnosticState.image.canShareFiles = Boolean(navigator.canShare({ files: [file] }));
    } catch (error) {
      diagnosticState.image.canShareFilesErrorName = error?.name || "Error";
      diagnosticState.image.canShareFilesErrorMessage = error?.message || String(error);
    }
  }
  renderDiagnostic();
}

function settleDiagnosticShare(promise, target, button) {
  promise.then(() => {
    target.result = "share-sheet-completed";
    target.errorName = "";
    target.errorMessage = "";
  }).catch((error) => {
    target.result = error?.name === "AbortError" ? "user-cancelled" : "share-error";
    target.errorName = error?.name || "Error";
    target.errorMessage = error?.message || String(error);
  }).finally(() => {
    button.disabled = false;
    renderDiagnostic();
  });
}

function testDiagnosticUrlShare() {
  if (el.testUrlShareBtn.disabled) return;
  const startedAt = performance.now();
  const activation = userActivationSnapshot();
  Object.assign(diagnosticState.urlShare, {
    result: "calling-share",
    activationIsActive: activation.isActive,
    activationHasBeenActive: activation.hasBeenActive,
    clickToShareMs: null,
    errorName: "",
    errorMessage: ""
  });
  try {
    if (typeof navigator.share !== "function") {
      diagnosticState.urlShare.result = "navigator.share-missing";
      renderDiagnostic();
      return;
    }
    const sharePromise = navigator.share({
      title: "MUMING Share Test",
      url: window.location.href
    });
    diagnosticState.urlShare.clickToShareMs = Number((performance.now() - startedAt).toFixed(2));
    el.testUrlShareBtn.disabled = true;
    renderDiagnostic();
    settleDiagnosticShare(sharePromise, diagnosticState.urlShare, el.testUrlShareBtn);
  } catch (error) {
    diagnosticState.urlShare.result = "share-error";
    diagnosticState.urlShare.errorName = error?.name || "Error";
    diagnosticState.urlShare.errorMessage = error?.message || String(error);
    renderDiagnostic();
  }
}

function testDiagnosticPdfShare() {
  if (el.testPdfShareBtn.disabled) return;
  const startedAt = performance.now();
  const activation = userActivationSnapshot();
  const file = diagnosticReadyPdfBundle?.file || null;
  Object.assign(diagnosticState.pdf, {
    readyBeforeClick: Boolean(file),
    shareActivationIsActive: activation.isActive,
    shareActivationHasBeenActive: activation.hasBeenActive,
    clickToShareMs: null,
    shareResult: "calling-share",
    shareErrorName: "",
    shareErrorMessage: ""
  });
  try {
    if (typeof navigator.share !== "function") {
      diagnosticState.pdf.shareResult = "navigator.share-missing";
      renderDiagnostic();
      return;
    }
    if (!file || typeof navigator.canShare !== "function" || !navigator.canShare({ files: [file] })) {
      diagnosticState.pdf.shareResult = "file-share-not-supported";
      renderDiagnostic();
      return;
    }
    const sharePromise = navigator.share({ files: [file], title: "MUMING PDF Share Test" });
    diagnosticState.pdf.clickToShareMs = Number((performance.now() - startedAt).toFixed(2));
    el.testPdfShareBtn.disabled = true;
    renderDiagnostic();
    settleDiagnosticShare(sharePromise, {
      get result() { return diagnosticState.pdf.shareResult; },
      set result(value) { diagnosticState.pdf.shareResult = value; },
      get errorName() { return diagnosticState.pdf.shareErrorName; },
      set errorName(value) { diagnosticState.pdf.shareErrorName = value; },
      get errorMessage() { return diagnosticState.pdf.shareErrorMessage; },
      set errorMessage(value) { diagnosticState.pdf.shareErrorMessage = value; }
    }, el.testPdfShareBtn);
  } catch (error) {
    diagnosticState.pdf.shareResult = error?.name === "AbortError" ? "user-cancelled" : "share-error";
    diagnosticState.pdf.shareErrorName = error?.name || "Error";
    diagnosticState.pdf.shareErrorMessage = error?.message || String(error);
    renderDiagnostic();
  }
}

function testDiagnosticImageShare() {
  if (el.testImageShareBtn.disabled) return;
  const startedAt = performance.now();
  const activation = userActivationSnapshot();
  const file = diagnosticReadyImageFile;
  Object.assign(diagnosticState.image, {
    readyBeforeClick: file instanceof File,
    shareActivationIsActive: activation.isActive,
    shareActivationHasBeenActive: activation.hasBeenActive,
    clickToShareMs: null,
    result: "calling-share",
    errorName: "",
    errorMessage: ""
  });
  try {
    if (typeof navigator.share !== "function") {
      diagnosticState.image.result = "navigator.share-missing";
      renderDiagnostic();
      return;
    }
    if (!file || typeof navigator.canShare !== "function" || !navigator.canShare({ files: [file] })) {
      diagnosticState.image.result = "file-share-not-supported";
      renderDiagnostic();
      return;
    }
    const sharePromise = navigator.share({ files: [file], title: "MUMING Image Share Test" });
    diagnosticState.image.clickToShareMs = Number((performance.now() - startedAt).toFixed(2));
    el.testImageShareBtn.disabled = true;
    renderDiagnostic();
    settleDiagnosticShare(sharePromise, diagnosticState.image, el.testImageShareBtn);
  } catch (error) {
    diagnosticState.image.result = error?.name === "AbortError" ? "user-cancelled" : "share-error";
    diagnosticState.image.errorName = error?.name || "Error";
    diagnosticState.image.errorMessage = error?.message || String(error);
    renderDiagnostic();
  }
}

function testDiagnosticBlobDownload() {
  try {
    const { blob } = createDiagnosticPdfBundle();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "muming-share-test.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    diagnosticState.pdf.blobDownload = "download-triggered";
  } catch (error) {
    diagnosticState.pdf.blobDownload = `error:${error?.name || "Error"}`;
  }
  renderDiagnostic();
}

function testDiagnosticBlobOpen() {
  try {
    const { blob } = createDiagnosticPdfBundle();
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, "_blank");
    diagnosticState.pdf.blobOpen = opened ? "window-opened" : "popup-blocked";
    if (opened) {
      try { opened.opener = null; } catch (_) { /* Cross-window restrictions are harmless here. */ }
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    diagnosticState.pdf.blobOpen = `error:${error?.name || "Error"}`;
  }
  renderDiagnostic();
}

function recordDiagnosticInput(kind, files) {
  if (!diagnosticEnabled || !diagnosticState.inputs[kind]) return;
  const file = files[0];
  diagnosticState.inputs[kind] = {
    pickerRequested: true,
    changeEvent: true,
    fileReceived: Boolean(file),
    type: file?.type || "",
    size: file?.size || 0
  };
  renderDiagnostic();
}

async function prepareDiagnosticImage() {
  el.testImageShareBtn.disabled = true;
  el.testImageShareBtn.textContent = "準備測試圖片…";
  try {
    diagnosticReadyImageFile = await createDiagnosticImageFile();
    diagnosticState.image.readyBeforeClick = true;
    diagnosticState.image.readyCreatedAt = new Date().toISOString();
    if (diagnosticImagePreviewUrl) URL.revokeObjectURL(diagnosticImagePreviewUrl);
    diagnosticImagePreviewUrl = URL.createObjectURL(diagnosticReadyImageFile);
    el.diagnosticImagePreviewImg.src = diagnosticImagePreviewUrl;
    el.diagnosticImagePreview.hidden = false;
    refreshDiagnosticImageCapabilities(diagnosticReadyImageFile);
  } catch (error) {
    diagnosticReadyImageFile = null;
    diagnosticState.image.readyBeforeClick = false;
    diagnosticState.image.result = "image-creation-error";
    diagnosticState.image.errorName = error?.name || "Error";
    diagnosticState.image.errorMessage = error?.message || String(error);
    renderDiagnostic();
  } finally {
    el.testImageShareBtn.disabled = !diagnosticReadyImageFile;
    el.testImageShareBtn.textContent = diagnosticReadyImageFile
      ? "立即分享測試圖片"
      : "測試圖片建立失敗";
  }
}

function initDiagnostics() {
  if (!diagnosticEnabled) return;
  el.diagnosticPanel.hidden = false;
  diagnosticReadyPdfBundle = createDiagnosticPdfBundle();
  diagnosticState.pdf.readyBeforeClick = Boolean(diagnosticReadyPdfBundle.file);
  diagnosticState.pdf.readyCreatedAt = new Date().toISOString();
  refreshDiagnosticCapabilities(diagnosticReadyPdfBundle);
  el.refreshDiagnosticBtn.addEventListener("click", () => {
    refreshDiagnosticCapabilities();
    refreshDiagnosticImageCapabilities();
  });
  el.testUrlShareBtn.addEventListener("click", testDiagnosticUrlShare);
  el.testPdfShareBtn.addEventListener("click", testDiagnosticPdfShare);
  el.testImageShareBtn.addEventListener("click", testDiagnosticImageShare);
  el.testBlobDownloadBtn.addEventListener("click", testDiagnosticBlobDownload);
  el.testBlobOpenBtn.addEventListener("click", testDiagnosticBlobOpen);
  el.copyDiagnosticBtn.addEventListener("click", async () => {
    const copied = await copyText(el.diagnosticOutput.textContent);
    showToast(copied ? "診斷結果已複製。" : "無法自動複製診斷結果。");
  });
  void prepareDiagnosticImage();
}

function shouldShowLineAndroidFallback(options = {}) {
  const userAgent = options.userAgent ?? navigator.userAgent;
  const shareAvailable = options.shareAvailable ?? (typeof navigator.share === "function");
  const debugMode = options.debugMode ?? diagnosticEnabled;
  return !debugMode
    && /Android/i.test(userAgent)
    && inAppBrowserInfo(userAgent)?.id === "line"
    && !shareAvailable;
}

function initLineAndroidFallback() {
  el.openExternalBrowserLink.href = TOOL_LINE_SHARE_URL;
  if (!shouldShowLineAndroidFallback()) return;
  el.lineAndroidFallbackDialog.showModal();
  requestAnimationFrame(() => el.openExternalBrowserLink.focus());
}

el.copyExternalUrlBtn.addEventListener("click", async () => {
  const copied = await copyText(TOOL_LINE_SHARE_URL);
  showToast(copied
    ? "網址已複製，請貼到 Chrome 或其他瀏覽器開啟。"
    : "無法自動複製，請長按網址後複製。"
  );
});

el.closeLineFallbackBtn.addEventListener("click", () => {
  if (el.lineAndroidFallbackDialog.open) el.lineAndroidFallbackDialog.close();
});

function isMobilePdfEnvironment() {
  return window.matchMedia?.("(pointer: coarse)").matches
    || /Android|iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

function isSamsungInternet(userAgent = navigator.userAgent) {
  return /SamsungBrowser\//i.test(userAgent || "");
}

function pdfPrimaryButtonLabel(userAgent = navigator.userAgent) {
  return isSamsungInternet(userAgent) ? "下載 PDF" : "產生 PDF";
}

function shouldShowPdfShareAction(options = {}) {
  const userAgent = options.userAgent ?? navigator.userAgent;
  const shareAvailable = options.shareAvailable ?? (typeof navigator.share === "function");
  const canShareAvailable = options.canShareAvailable ?? (typeof navigator.canShare === "function");
  // Samsung Internet 30 reports PDF sharing support but rejects PDF Files with NotAllowedError.
  return !isSamsungInternet(userAgent) && shareAvailable && canShareAvailable;
}

function updatePdfActions() {
  el.cases.querySelectorAll('[data-action="pdf-case"]').forEach((button) => {
    button.textContent = pdfPrimaryButtonLabel();
  });
}

function invalidatePdfCache(caseId = null) {
  const entries = caseId
    ? [[caseId, state.pdfCache.get(caseId)]]
    : [...state.pdfCache.entries()];
  entries.forEach(([key, bundle]) => {
    if (bundle?.objectUrl) URL.revokeObjectURL(bundle.objectUrl);
    state.pdfCache.delete(key);
  });
  updatePdfActions();
}

function waitForCv() {
  return new Promise((resolve) => {
    const check = () => {
      if (window.cv && cv.Mat) {
        if (cv.getBuildInformation) resolve();
        else cv.onRuntimeInitialized = resolve;
      } else {
        setTimeout(check, 120);
      }
    };
    check();
  });
}

async function initEngines() {
  try {
    await waitForCv();
    state.cvReady = true;
    el.engineStatus.textContent = "影像引擎已就緒";
    if (el.cropDialog.open && state.cropPoints.length === 4) updateCropCorrectionPreview();
  } catch {
    el.engineStatus.textContent = "影像引擎載入失敗，仍可人工裁切";
  }

  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.js";
    state.pdfReady = true;
  }
}

function addDefaultCase() {
  invalidatePdfCache();
  const caseItem = {
    id: uid("case"),
    title: `案件 ${state.cases.length + 1}`,
    people: [
      { id: uid("person"), role: "雇主", front: null, back: null, fixed: true },
      { id: uid("person"), role: "被照顧人", front: null, back: null, fixed: true }
    ]
  };
  state.cases.push(caseItem);
}

function renderAll() {
  renderCases();
}

function cardNode(card, compact = false) {
  const node = document.createElement("article");
  node.className = "card";
  if (state.selectedCardId === card.id) node.classList.add("selected-card");
  node.draggable = true;
  node.dataset.cardId = card.id;
  const showSideHint = compact && !findSlotForCard(card.id);
  const badges = [
    ...card.quality,
    ...(showSideHint && card.faceHint ? [{ text: card.faceHint, warn: card.faceHint === "正反面請確認" }] : [])
  ];
  node.innerHTML = `
    ${compact
      ? `<img src="${card.currentDataUrl}" alt="${card.name}">`
      : `<div class="slot-card-preview"><img src="${card.currentDataUrl}" alt="${card.name}"><span>點擊調整裁切</span></div>`}
    <div class="card-title"><span>${card.name}</span><span>${card.sourceIndex || ""}</span></div>
    <div class="badges">${badges.map((q) => `<span class="badge ${q.warn ? "warn" : ""}">${q.text}</span>`).join("")}</div>
    <div class="card-actions">
      ${compact
        ? '<button type="button" data-action="view">查看</button><button type="button" data-action="crop">調整裁切</button><button type="button" data-action="rotater">右轉</button><button type="button" data-action="rotatel">左轉</button><button type="button" data-action="remove">刪除</button>'
        : '<button type="button" data-action="crop">調整裁切</button><button type="button" data-action="redetect">重新自動裁切</button><button type="button" data-action="rotatel">左轉</button><button type="button" data-action="rotater">右轉</button><button type="button" data-action="replace">替換</button><button type="button" data-action="slotremove">移除</button>'}
    </div>`;
  node.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", card.id);
    event.dataTransfer.effectAllowed = "move";
  });
  node.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    state.pointerDrag = { cardId: card.id, x: event.clientX, y: event.clientY, moved: false };
    node.setPointerCapture(event.pointerId);
  });
  node.addEventListener("pointermove", (event) => {
    if (!state.pointerDrag || state.pointerDrag.cardId !== card.id) return;
    const moved = Math.hypot(event.clientX - state.pointerDrag.x, event.clientY - state.pointerDrag.y) > 12;
    if (moved) {
      state.pointerDrag.moved = true;
      node.classList.add("dragging-card");
    }
  });
  node.addEventListener("pointerup", (event) => {
    if (!state.pointerDrag || state.pointerDrag.cardId !== card.id) return;
    const drag = state.pointerDrag;
    state.pointerDrag = null;
    node.classList.remove("dragging-card");
    if (!drag.moved) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const slot = target?.closest(".slot");
    if (slot) {
      assignCard(card.id, slot.dataset.caseId, slot.dataset.personId, slot.dataset.side);
    }
  });
  node.addEventListener("click", (event) => {
    const action = event.target.closest("button")?.dataset.action;
    if (!action) {
      if (!compact && event.target.closest(".slot-card-preview")) {
        openCrop(card.id, event.target.closest(".slot-card-preview"));
      }
      return;
    }
    if (action === "view") openViewer(card.id);
    if (action === "crop") openCrop(card.id, event.target.closest("button"));
    if (action === "rotater") rotateCard(card.id, 90);
    if (action === "rotatel") rotateCard(card.id, -90);
    if (action === "redetect") autoCropCard(card.id);
    if (action === "replace") replaceCardImage(card.id);
    if (action === "remove") removeCard(card.id);
    if (action === "slotremove") removeCard(card.id);
  });
  node.addEventListener("click", (event) => {
    if (event.target.closest("button") || (!compact && event.target.closest(".slot-card-preview"))) return;
    state.selectedCardId = state.selectedCardId === card.id ? null : card.id;
    renderAll();
  });
  return node;
}

function renderCases() {
  el.cases.innerHTML = "";
  state.cases.forEach((item, caseIndex) => {
    const box = document.createElement("section");
    box.className = "case";
    box.innerHTML = `
      <div class="case-head">
        <h3>${item.title}</h3>
        <div class="case-head-actions">
          <button type="button" class="primary" data-action="pdf-case" data-case-id="${item.id}">${pdfPrimaryButtonLabel()}</button>
          ${isSamsungInternet()
            ? `<button type="button" data-action="share-pdf-viewer-case" data-case-id="${item.id}">分享 PDF</button>`
            : (shouldShowPdfShareAction()
              ? `<button type="button" data-action="share-pdf-case" data-case-id="${item.id}">分享 PDF</button>`
              : "")}
          ${caseIndex > 0 ? '<button type="button" data-action="delete-case">刪除案件</button>' : ""}
        </div>
      </div>
      <div class="people"></div>
      <div class="case-actions"><button type="button" data-action="add-person">＋新增人員</button></div>`;
    const people = box.querySelector(".people");
    item.people.forEach((person) => people.appendChild(personNode(item.id, person)));
    box.addEventListener("click", (event) => {
      const action = event.target.closest("button")?.dataset.action;
      if (action === "add-person") addPerson(item.id);
      if (action === "delete-case") deleteCase(item.id);
      if (action === "pdf-case") generatePdf(item.id);
      if (action === "share-pdf-viewer-case") sharePdfViaViewer(item.id);
      if (action === "share-pdf-case") void sharePdf(item.id, event.target.closest("button"));
    });
    el.cases.appendChild(box);
  });
  updatePdfActions();
  state.cases.forEach((item) => schedulePdfCacheWarm(item.id));
}

function personNode(caseId, person) {
  const wrap = document.createElement("div");
  wrap.className = "person";
  wrap.innerHTML = `
    <div class="person-head">
      <strong>${person.role}</strong>
      ${person.fixed ? "" : '<button type="button" data-action="delete-person">刪除</button>'}
    </div>
    <div class="slots">
      <div class="slot" data-case-id="${caseId}" data-person-id="${person.id}" data-side="front">
        <div class="slot-label">正面</div>
        ${slotEmptyMarkup()}
      </div>
      <div class="slot" data-case-id="${caseId}" data-person-id="${person.id}" data-side="back">
        <div class="slot-label">反面</div>
        ${slotEmptyMarkup()}
      </div>
    </div>`;
  wrap.querySelectorAll(".slot").forEach((slot) => wireSlot(slot));
  if (!person.fixed) {
    wrap.querySelector("[data-action='delete-person']").addEventListener("click", () => deletePerson(caseId, person.id));
  }
  ["front", "back"].forEach((side) => {
    const id = person[side];
    if (id) {
      const card = state.cards.find((item) => item.id === id);
      const slot = wrap.querySelector(`[data-side="${side}"]`);
      if (card) slot.appendChild(cardNode(card, false));
    }
  });
  return wrap;
}

function slotEmptyMarkup() {
  return `<div class="slot-empty">
    <span class="desktop-slot-prompt">拖入或點擊加入證件</span>
    <span class="mobile-slot-prompt">點擊加入證件</span>
    <button type="button" class="slot-pdf-link" data-file-kind="pdf">選擇 PDF</button>
  </div>`;
}

function usesMobileImageChooser() {
  // V1 intentionally delegates photo-source selection to the native image chooser.
  return window.matchMedia?.("(pointer: coarse)").matches
    || /Android|iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

function initUploadEnvironment() {
  document.documentElement.classList.toggle("mobile-upload-ui", usesMobileImageChooser());
  el.androidUploadHint.hidden = !/Android/i.test(navigator.userAgent);
}

function wireSlot(slot) {
  slot.addEventListener("click", (event) => {
    if (event.target.closest(".card")) return;
    const picker = event.target.closest("[data-file-kind='pdf']");
    if (picker) {
      event.stopPropagation();
      chooseFilesForSlot(slot, "pdf");
      return;
    }
    if (!state.selectedCardId) {
      if (slot.querySelector(".card")) return;
      chooseFilesForSlot(slot, usesMobileImageChooser() ? "gallery" : "mixed");
      return;
    }
    assignCard(state.selectedCardId, slot.dataset.caseId, slot.dataset.personId, slot.dataset.side);
    state.selectedCardId = null;
  });
  slot.addEventListener("dragover", (event) => {
    event.preventDefault();
    slot.classList.add("drag-over");
  });
  slot.addEventListener("dragleave", () => slot.classList.remove("drag-over"));
  slot.addEventListener("drop", (event) => {
    event.preventDefault();
    slot.classList.remove("drag-over");
    const files = [...event.dataTransfer.files].filter(isSupportedFile);
    if (files.length) {
      handleSlotFiles(files, slot);
      return;
    }
    assignCard(event.dataTransfer.getData("text/plain"), slot.dataset.caseId, slot.dataset.personId, slot.dataset.side);
  });
}

function isSupportedFile(file) {
  return /^image\//.test(file.type) || file.type === "application/pdf" || /\.(jpe?g|png|webp|pdf)$/i.test(file.name);
}

function chooseFiles(callback, kind = "mixed") {
  const inputs = {
    gallery: el.slotGalleryInput,
    pdf: el.slotPdfInput,
    mixed: el.slotMixedInput
  };
  const input = inputs[kind] || inputs.mixed;
  if (!input.dataset.wired) {
    input.dataset.wired = "true";
    input.addEventListener("change", () => {
      const rawFiles = [...input.files];
      const files = rawFiles.filter(isSupportedFile);
      if (kind !== "mixed") recordDiagnosticInput(kind, rawFiles);
      input.value = "";
      const handler = state.fileChooserCallbacks[kind];
      delete state.fileChooserCallbacks[kind];
      if (handler) handler(files);
    });
    input.addEventListener("cancel", () => {
      delete state.fileChooserCallbacks[kind];
    });
  }
  state.fileChooserCallbacks[kind] = callback;
  if (kind !== "mixed" && diagnosticEnabled) {
    diagnosticState.inputs[kind] = {
      pickerRequested: true,
      changeEvent: false,
      fileReceived: false,
      type: "",
      size: 0
    };
    renderDiagnostic();
  }
  input.value = "";
  input.click();
}

function chooseFilesForSlot(slot, kind = "mixed") {
  chooseFiles((files) => handleSlotFiles(files, slot), kind);
}

async function handleSlotFiles(files, slot) {
  if (!files.length) return;
  const caseId = slot.dataset.caseId;
  const added = await processFiles(files.slice(0, 1), { render: false });
  if (!added.length) return;
  added.forEach((card) => {
    card.sourceType = "slot";
    card.locationState = "staged";
  });
  const target = {
    caseId,
    personId: slot.dataset.personId,
    side: slot.dataset.side
  };
  if (added.length > 1) {
    openCardChoice(added, target);
    return;
  }
  const card = added[0];
  const afterAssign = card.autoDetected ? null : () => openCrop(card.id, slot);
  assignCard(card.id, target.caseId, target.personId, target.side, { confirmReplace: true, afterAssign });
}

function slotDetails(caseId, personId, side) {
  const caseItem = state.cases.find((item) => item.id === caseId);
  const person = caseItem?.people.find((item) => item.id === personId);
  if (!caseItem || !person) return null;
  return { caseItem, person, label: `${caseItem.title}｜${person.role}｜${sideText(side)}` };
}

function openCardChoice(cards, target, options = {}) {
  const details = slotDetails(target.caseId, target.personId, target.side);
  state.slotChoice = { ...target, ...options, cardIds: cards.map((card) => card.id) };
  el.cardChoiceContext.textContent = details?.label || "";
  el.cardChoiceOptions.innerHTML = "";
  cards.forEach((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card-choice";
    button.innerHTML = `<img src="${card.currentDataUrl}" alt="證件 ${index + 1}"><span>證件 ${index + 1}</span>`;
    button.addEventListener("click", () => selectCardChoice(card.id));
    el.cardChoiceOptions.appendChild(button);
  });
  el.cardChoiceDialog.showModal();
  el.cardChoiceOptions.querySelector("button")?.focus();
}

function selectCardChoice(cardId) {
  const choice = state.slotChoice;
  if (!choice || !choice.cardIds.includes(cardId)) return;
  if (choice.replaceCardId) {
    const target = state.cards.find((card) => card.id === choice.replaceCardId);
    const replacement = state.cards.find((card) => card.id === cardId);
    if (target && replacement) applyReplacementCard(target, replacement, choice.cardIds);
  } else {
    state.cards = state.cards.filter((card) => !choice.cardIds.includes(card.id) || card.id === cardId);
  }
  state.slotChoice = null;
  el.cardChoiceOptions.innerHTML = "";
  el.cardChoiceContext.textContent = "";
  el.cardChoiceDialog.close();
  if (choice.replaceCardId) {
    renderAll();
    const replaced = state.cards.find((card) => card.id === choice.replaceCardId);
    if (replaced && !replaced.autoDetected) openCrop(replaced.id);
    return;
  }
  assignCard(cardId, choice.caseId, choice.personId, choice.side, { confirmReplace: true });
}

function cancelCardChoice() {
  const choice = state.slotChoice;
  state.slotChoice = null;
  if (choice) state.cards = state.cards.filter((card) => !choice.cardIds.includes(card.id));
  el.cardChoiceOptions.innerHTML = "";
  el.cardChoiceContext.textContent = "";
  if (el.cardChoiceDialog.open) el.cardChoiceDialog.close("cancel");
  renderAll();
}

el.cancelCardChoiceBtn.addEventListener("click", cancelCardChoice);
el.cardChoiceDialog.querySelectorAll("[data-choice-cancel]").forEach((button) => {
  button.addEventListener("click", cancelCardChoice);
});
el.cardChoiceDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  cancelCardChoice();
});

function addPerson(caseId) {
  invalidatePdfCache();
  const found = state.cases.find((item) => item.id === caseId);
  const count = found.people.filter((p) => !p.fixed).length + 1;
  found.people.push({ id: uid("person"), role: `其他家屬 ${count}`, front: null, back: null, fixed: false });
  renderAll();
}

function deletePerson(caseId, personId) {
  invalidatePdfCache();
  const found = state.cases.find((item) => item.id === caseId);
  const person = found?.people.find((item) => item.id === personId);
  const removedIds = new Set(person ? [person.front, person.back].filter(Boolean) : []);
  state.cards = state.cards.filter((card) => !removedIds.has(card.id));
  found.people = found.people.filter((p) => p.id !== personId);
  renderAll();
}

function deleteCase(caseId) {
  invalidatePdfCache();
  const found = state.cases.find((item) => item.id === caseId);
  const removedIds = new Set(found?.people.flatMap((person) => [person.front, person.back]).filter(Boolean) || []);
  state.cards = state.cards.filter((card) => !removedIds.has(card.id));
  state.cases = state.cases.filter((item) => item.id !== caseId);
  renderAll();
}

function setCardAssignment(cardId, caseId, personId, side) {
  const card = state.cards.find((item) => item.id === cardId);
  if (!card) return;
  card.assignedCaseId = caseId;
  card.assignedPersonId = personId;
  card.assignedSide = side;
  card.locationState = "assigned";
}

function clearCardAssignment(cardId) {
  const card = state.cards.find((item) => item.id === cardId);
  if (!card) return;
  card.assignedCaseId = null;
  card.assignedPersonId = null;
  card.assignedSide = null;
  if (card.locationState !== "staged") card.locationState = "unassigned";
}

function assignCard(cardId, caseId, personId, side, options = {}) {
  if (!cardId) return;
  const confirmReplace = options.confirmReplace ?? true;
  const origin = findSlotForCard(cardId);
  const target = state.cases.find((c) => c.id === caseId)?.people.find((p) => p.id === personId);
  if (!target) return;
  const old = target[side];
  if (old && old !== cardId && !origin && confirmReplace) {
    requestReplace(cardId, caseId, personId, side, options.afterAssign);
    return false;
  }
  unassignCard(cardId, false);
  if (old && origin) {
    const originPerson = state.cases.find((c) => c.id === origin.caseId)?.people.find((p) => p.id === origin.personId);
    if (originPerson) {
      originPerson[origin.side] = old;
      setCardAssignment(old, origin.caseId, origin.personId, origin.side);
    }
  } else if (old) {
    unassignCard(old, false);
    state.cards = state.cards.filter((item) => item.id !== old);
  }
  target[side] = cardId;
  setCardAssignment(cardId, caseId, personId, side);
  invalidatePdfCache();
  renderAll();
  options.afterAssign?.();
  return true;
}

function requestReplace(cardId, caseId, personId, side, afterAssign = null) {
  state.replaceRequest = { cardId, caseId, personId, side, afterAssign };
  el.replaceDialog.showModal();
}

el.cancelReplaceBtn.addEventListener("click", () => {
  const stagedCardId = state.replaceRequest?.cardId;
  state.replaceRequest = null;
  el.replaceDialog.close();
  const stagedCard = state.cards.find((item) => item.id === stagedCardId);
  if (stagedCard?.locationState === "staged") {
    state.cards = state.cards.filter((item) => item.id !== stagedCardId);
    renderAll();
  }
});

el.confirmReplaceBtn.addEventListener("click", () => {
  const req = state.replaceRequest;
  state.replaceRequest = null;
  el.replaceDialog.close();
  if (req) assignCard(req.cardId, req.caseId, req.personId, req.side, {
    confirmReplace: false,
    afterAssign: req.afterAssign
  });
});

function findSlotForCard(cardId) {
  const card = state.cards.find((item) => item.id === cardId);
  if (card?.assignedCaseId && card.assignedPersonId && card.assignedSide) {
    const assignedPerson = state.cases
      .find((item) => item.id === card.assignedCaseId)
      ?.people.find((person) => person.id === card.assignedPersonId);
    if (assignedPerson?.[card.assignedSide] === cardId) {
      return { caseId: card.assignedCaseId, personId: card.assignedPersonId, side: card.assignedSide };
    }
  }
  for (const c of state.cases) for (const p of c.people) {
    if (p.front === cardId) {
      setCardAssignment(cardId, c.id, p.id, "front");
      return { caseId: c.id, personId: p.id, side: "front" };
    }
    if (p.back === cardId) {
      setCardAssignment(cardId, c.id, p.id, "back");
      return { caseId: c.id, personId: p.id, side: "back" };
    }
  }
  clearCardAssignment(cardId);
  return null;
}

function unassignCard(cardId, rerender = true) {
  state.cases.forEach((c) => c.people.forEach((p) => {
    if (p.front === cardId) p.front = null;
    if (p.back === cardId) p.back = null;
  }));
  clearCardAssignment(cardId);
  if (rerender) renderAll();
}

function removeCard(cardId) {
  unassignCard(cardId, false);
  state.cards = state.cards.filter((card) => card.id !== cardId);
  invalidatePdfCache();
  renderAll();
}

el.addCaseBtn.addEventListener("click", () => { addDefaultCase(); renderAll(); });

async function processFiles(files, options = {}) {
  if (!files.length) return [];
  const addedCards = [];
  log(`開始處理 ${files.length} 個檔案`);
  for (const file of files) {
    try {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        addedCards.push(...await processPdf(file));
      } else {
        const canvas = await fileToCanvas(file);
        addedCards.push(...await detectAndAddCards(canvas, file.name));
      }
    } catch (error) {
      console.error(error);
      log(`${file.name} 處理失敗，已略過`);
    }
  }
  if (options.render !== false) renderAll();
  return addedCards;
}

function fileToCanvas(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(imageToCanvas(img));
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function imageToCanvas(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  canvas.getContext("2d").drawImage(img, 0, 0);
  return canvas;
}

async function processPdf(file) {
  if (!state.pdfReady || !window.pdfjsLib) throw new Error("PDF engine not ready");
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const addedCards = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    addedCards.push(...await detectAndAddCards(canvas, `${file.name} p.${i}`));
  }
  return addedCards;
}

async function detectAndAddCards(sourceCanvas, name) {
  const sourceDataUrl = sourceCanvas.toDataURL("image/jpeg", 0.92);
  const candidates = state.cvReady ? detectCardCandidates(sourceCanvas, { includeVariants: false, limit: 12 }) : [];
  const quads = candidates.map((candidate) => ({ points: candidate.points, area: candidate.area, source: candidate.source, score: candidate.score }));
  const usable = quads.length ? quads : [fallbackQuad(sourceCanvas)];
  const addedCards = [];
  let index = 1;
  for (const quad of usable) {
    const cropped = state.cvReady ? warpCanvas(sourceCanvas, quad.points) : cloneCanvas(sourceCanvas);
    const card = {
      id: uid("card"),
      name: `${name}${usable.length > 1 ? ` #${index}` : ""}`,
      sourceName: name,
      sourceDataUrl,
      sourceCanvas,
      originalWidth: sourceCanvas.width,
      originalHeight: sourceCanvas.height,
      points: quad.points,
      currentDataUrl: cropped.toDataURL("image/jpeg", 0.92),
      enhancedDataUrl: null,
      assignedCaseId: null,
      assignedPersonId: null,
      assignedSide: null,
      sourceType: "slot",
      locationState: "staged",
      autoDetected: quads.length > 0,
      sourceIndex: quads.length ? "自動裁切" : "建議確認",
      frameCandidates: candidates.slice(0, 3).map((candidate) => candidate.points),
      frameCandidateIndex: Math.max(0, candidates.findIndex((candidate) => candidate.points === quad.points)),
      faceHint: suggestCardSide(cropped),
      quality: qualityBadges(cropped, quads.length > 0)
    };
    const initialCrop = normalizedOriginalPoints(quad.points, sourceCanvas.width, sourceCanvas.height);
    card.initialCrop = { points: clonePoints(initialCrop), rotation: 0 };
    card.lastAppliedCrop = { points: clonePoints(initialCrop), rotation: 0 };
    card.rotation = 0;
    card.manuallyAdjusted = false;
    card.lastCropResult = card.currentDataUrl;
    state.cards.push(card);
    addedCards.push(card);
    index += 1;
  }
  log(`${name} 偵測到 ${quads.length || 0} 張證件${quads.length ? "" : "，已保留原圖供調整"}`);
  return addedCards;
}

function fallbackQuad(canvas) {
  return { points: [{ x: 0, y: 0 }, { x: canvas.width, y: 0 }, { x: canvas.width, y: canvas.height }, { x: 0, y: canvas.height }], area: canvas.width * canvas.height };
}

function detectCardCandidates(canvas, options = {}) {
  const imageArea = canvas.width * canvas.height;
  const limit = options.limit || 3;
  const candidates = [
    ...detectContourCandidates(canvas),
    ...detectLineCandidates(canvas)
  ].map((candidate) => scoreCandidate(candidate, canvas)).filter(Boolean);
  const ranked = suppressPaperAndDuplicates(candidates, imageArea);
  if (options.includeVariants !== false && ranked.length === 1 && ranked[0].area / imageArea > 0.35) {
    ranked.push(...makeFrameVariants(ranked[0], canvas).map((candidate) => scoreCandidate(candidate, canvas)).filter(Boolean));
  }
  return suppressPaperAndDuplicates(ranked, imageArea).slice(0, limit);
}

function makeFrameVariants(candidate, canvas) {
  const center = candidate.points.reduce((acc, p) => ({ x: acc.x + p.x / 4, y: acc.y + p.y / 4 }), { x: 0, y: 0 });
  return [0.94, 1.045].map((scale) => ({
    source: "variant",
    lineCoverage: Math.max(0.25, (candidate.lineCoverage || 0.5) * 0.82),
    points: candidate.points.map((p) => ({
      x: Math.min(canvas.width, Math.max(0, center.x + (p.x - center.x) * scale)),
      y: Math.min(canvas.height, Math.max(0, center.y + (p.y - center.y) * scale))
    }))
  }));
}

function detectContourCandidates(canvas) {
  const scale = Math.min(1, 1600 / Math.max(canvas.width, canvas.height));
  const work = document.createElement("canvas");
  work.width = Math.round(canvas.width * scale);
  work.height = Math.round(canvas.height * scale);
  work.getContext("2d").drawImage(canvas, 0, 0, work.width, work.height);
  const src = cv.imread(work);
  const gray = new cv.Mat();
  const blur = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  const candidates = [];
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
    cv.Canny(blur, edges, 35, 125);
    const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
    cv.dilate(edges, edges, kernel);
    kernel.delete();
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const peri = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.025 * peri, true);
      if (approx.rows === 4 && cv.isContourConvex(approx)) {
        const points = [];
        for (let j = 0; j < 4; j++) points.push({ x: approx.intPtr(j, 0)[0] / scale, y: approx.intPtr(j, 0)[1] / scale });
        candidates.push({ points: orderPoints(points), source: "contour", lineCoverage: 0.35 });
      }
      contour.delete();
      approx.delete();
    }
  } finally {
    src.delete(); gray.delete(); blur.delete(); edges.delete(); contours.delete(); hierarchy.delete();
  }
  return candidates;
}

function detectLineCandidates(canvas) {
  const scale = Math.min(1, 1800 / Math.max(canvas.width, canvas.height));
  const work = document.createElement("canvas");
  work.width = Math.round(canvas.width * scale);
  work.height = Math.round(canvas.height * scale);
  work.getContext("2d").drawImage(canvas, 0, 0, work.width, work.height);
  const src = cv.imread(work);
  const gray = new cv.Mat();
  const blur = new cv.Mat();
  const edges = new cv.Mat();
  const lines = new cv.Mat();
  const candidates = [];
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(3, 3), 0);
    cv.Canny(blur, edges, 28, 110);
    const minLineLength = Math.min(work.width, work.height) * 0.28;
    cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 45, minLineLength, 28);
    const horizontal = [];
    const vertical = [];
    for (let i = 0; i < lines.rows; i++) {
      const [x1, y1, x2, y2] = lines.intPtr(i, 0);
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.hypot(dx, dy);
      if (length < minLineLength) continue;
      const line = { x1: x1 / scale, y1: y1 / scale, x2: x2 / scale, y2: y2 / scale, length: length / scale };
      if (Math.abs(dy) <= Math.abs(dx) * 0.45) horizontal.push(line);
      if (Math.abs(dx) <= Math.abs(dy) * 0.45) vertical.push(line);
    }
    const top = pickOuterLine(horizontal, "top");
    const bottom = pickOuterLine(horizontal, "bottom");
    const left = pickOuterLine(vertical, "left");
    const right = pickOuterLine(vertical, "right");
    if (top && bottom && left && right) {
      const points = [
        intersectLines(top, left),
        intersectLines(top, right),
        intersectLines(bottom, right),
        intersectLines(bottom, left)
      ];
      if (points.every(Boolean)) {
        const coverage = (top.length + bottom.length + left.length + right.length) / (2 * (canvas.width + canvas.height));
        candidates.push({ points: orderPoints(points), source: "line", lineCoverage: coverage });
      }
    }
  } finally {
    src.delete(); gray.delete(); blur.delete(); edges.delete(); lines.delete();
  }
  return candidates;
}

function pickOuterLine(lines, side) {
  if (!lines.length) return null;
  const sorted = lines.slice().sort((a, b) => {
    if (side === "top") return ((a.y1 + a.y2) / 2) - ((b.y1 + b.y2) / 2);
    if (side === "bottom") return ((b.y1 + b.y2) / 2) - ((a.y1 + a.y2) / 2);
    if (side === "left") return ((a.x1 + a.x2) / 2) - ((b.x1 + b.x2) / 2);
    return ((b.x1 + b.x2) / 2) - ((a.x1 + a.x2) / 2);
  });
  return sorted.slice(0, 5).sort((a, b) => b.length - a.length)[0];
}

function intersectLines(a, b) {
  const x1 = a.x1, y1 = a.y1, x2 = a.x2, y2 = a.y2;
  const x3 = b.x1, y3 = b.y1, x4 = b.x2, y4 = b.y2;
  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(den) < 0.001) return null;
  return {
    x: ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / den,
    y: ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / den
  };
}

function scoreCandidate(candidate, canvas) {
  const points = orderPoints(candidate.points);
  if (!isValidCardQuad(points, canvas)) return null;
  const area = polygonArea(points);
  const areaRatio = area / (canvas.width * canvas.height);
  const ratio = quadRatio(points);
  const ratioScore = Math.max(0, 1 - Math.abs(ratio - (CARD_W_MM / CARD_H_MM)) / 0.52);
  const sizeScore = areaRatio > 0.55 ? 1 : areaRatio > 0.18 ? 0.82 : areaRatio > 0.055 ? 0.46 : 0.12;
  const borderScore = Math.min(1, candidate.lineCoverage || (candidate.source === "line" ? 0.75 : 0.38));
  const outerScore = outerFrameScore(points, canvas);
  const internalPenalty = areaRatio < 0.08 ? 0.65 : areaRatio < 0.18 ? 0.34 : 0;
  const score = ratioScore * 2.1 + sizeScore * 2.4 + borderScore * 1.4 + outerScore * 1.8 - internalPenalty + (candidate.source === "line" ? 0.25 : 0);
  return { ...candidate, points, area, ratio, score };
}

function isValidCardQuad(points, canvas) {
  if (points.length !== 4 || points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return false;
  const margin = Math.max(canvas.width, canvas.height) * 0.08;
  if (points.some((p) => p.x < -margin || p.y < -margin || p.x > canvas.width + margin || p.y > canvas.height + margin)) return false;
  if (!isConvex(points) || isSelfIntersecting(points)) return false;
  const [tl, tr, br, bl] = points;
  if (!(tl.x < tr.x && bl.x < br.x && tl.y < bl.y && tr.y < br.y)) return false;
  const area = polygonArea(points);
  if (area < canvas.width * canvas.height * 0.012) return false;
  const ratio = quadRatio(points);
  return ratio > 1.08 && ratio < 2.12;
}

function isConvex(points) {
  let sign = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], c = points[(i + 2) % points.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1) continue;
    const current = Math.sign(cross);
    if (!sign) sign = current;
    if (sign !== current) return false;
  }
  return true;
}

function isSelfIntersecting(points) {
  return segmentsIntersect(points[0], points[1], points[2], points[3]) || segmentsIntersect(points[1], points[2], points[3], points[0]);
}

function segmentsIntersect(a, b, c, d) {
  const ccw = (p1, p2, p3) => (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

function polygonArea(points) {
  return Math.abs(points.reduce((sum, p, i) => {
    const next = points[(i + 1) % points.length];
    return sum + p.x * next.y - next.x * p.y;
  }, 0) / 2);
}

function outerFrameScore(points, canvas) {
  const box = bounding(points);
  const left = box.l / canvas.width;
  const right = 1 - box.r / canvas.width;
  const top = box.t / canvas.height;
  const bottom = 1 - box.b / canvas.height;
  const edgeCloseness = 1 - Math.min(1, (left + right + top + bottom) / 1.25);
  const areaRatio = polygonArea(points) / (canvas.width * canvas.height);
  return Math.max(edgeCloseness, areaRatio > 0.55 ? 0.95 : areaRatio);
}

function detectCardQuads(canvas) {
  return detectCardCandidates(canvas).map((candidate) => ({ points: candidate.points, area: candidate.area, score: candidate.score, source: candidate.source }));
  const scale = Math.min(1, 1600 / Math.max(canvas.width, canvas.height));
  const work = document.createElement("canvas");
  work.width = Math.round(canvas.width * scale);
  work.height = Math.round(canvas.height * scale);
  work.getContext("2d").drawImage(canvas, 0, 0, work.width, work.height);

  const src = cv.imread(work);
  const gray = new cv.Mat();
  const blur = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  const candidates = [];
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
    cv.Canny(blur, edges, 45, 135);
    const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
    cv.dilate(edges, edges, kernel);
    kernel.delete();
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    const imageArea = work.width * work.height;
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const peri = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.025 * peri, true);
      const area = Math.abs(cv.contourArea(approx));
      if (approx.rows === 4 && area > imageArea * 0.012 && area < imageArea * 0.88 && cv.isContourConvex(approx)) {
        const points = [];
        for (let j = 0; j < 4; j++) points.push({ x: approx.intPtr(j, 0)[0] / scale, y: approx.intPtr(j, 0)[1] / scale });
        const ordered = orderPoints(points);
        const ratio = quadRatio(ordered);
        if (ratio > 1.18 && ratio < 1.95) candidates.push({ points: ordered, area: area / (scale * scale), ratio });
      }
      contour.delete();
      approx.delete();
    }
  } finally {
    src.delete(); gray.delete(); blur.delete(); edges.delete(); contours.delete(); hierarchy.delete();
  }
  return suppressPaperAndDuplicates(candidates, canvas.width * canvas.height).slice(0, 12);
}

function suppressPaperAndDuplicates(candidates, imageArea) {
  const sorted = candidates.sort((a, b) => (b.score || 0) - (a.score || 0));
  const filtered = [];
  for (const c of sorted) {
    const duplicate = filtered.some((o) => {
      const overlap = intersectionOverSmallest(bounding(c.points), bounding(o.points));
      const areaSimilarity = Math.min(c.area, o.area) / Math.max(c.area, o.area);
      return overlap > 0.72 && areaSimilarity > 0.9;
    });
    if (!duplicate) filtered.push(c);
  }
  return filtered;
}

function bounding(points) {
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  return { l: Math.min(...xs), t: Math.min(...ys), r: Math.max(...xs), b: Math.max(...ys) };
}

function intersectionOverSmallest(a, b) {
  const w = Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l));
  const h = Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
  const inter = w * h;
  const areaA = (a.r - a.l) * (a.b - a.t);
  const areaB = (b.r - b.l) * (b.b - b.t);
  return inter / Math.max(1, Math.min(areaA, areaB));
}

function pointsInside(inner, outer) {
  return inner.filter((p) => pointInPoly(p, outer)).length;
}

function pointInPoly(point, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const hit = ((yi > point.y) !== (yj > point.y)) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (hit) inside = !inside;
  }
  return inside;
}

function orderPoints(points) {
  const center = points.reduce((acc, p) => ({ x: acc.x + p.x / 4, y: acc.y + p.y / 4 }), { x: 0, y: 0 });
  const sorted = points.slice().sort((a, b) => Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x));
  const start = sorted.reduce((best, p, i) => (p.x + p.y < sorted[best].x + sorted[best].y ? i : best), 0);
  return [...sorted.slice(start), ...sorted.slice(0, start)];
}

function quadRatio(points) {
  const w = (dist(points[0], points[1]) + dist(points[3], points[2])) / 2;
  const h = (dist(points[0], points[3]) + dist(points[1], points[2])) / 2;
  return Math.max(w, h) / Math.max(1, Math.min(w, h));
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function warpCanvas(sourceCanvas, points) {
  const src = cv.imread(sourceCanvas);
  const dst = new cv.Mat();
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, points.flatMap((p) => [p.x, p.y]));
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, 850, 0, 850, 540, 0, 540]);
  const matrix = cv.getPerspectiveTransform(srcTri, dstTri);
  cv.warpPerspective(src, dst, matrix, new cv.Size(850, 540), cv.INTER_LINEAR, cv.BORDER_REPLICATE);
  const canvas = document.createElement("canvas");
  canvas.width = 850;
  canvas.height = 540;
  cv.imshow(canvas, dst);
  src.delete(); dst.delete(); srcTri.delete(); dstTri.delete(); matrix.delete();
  return canvas;
}

function cloneCanvas(canvas) {
  const copy = document.createElement("canvas");
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext("2d").drawImage(canvas, 0, 0);
  return copy;
}

function suggestCardSide(canvas) {
  try {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const left = regionStats(ctx, w * 0.05, h * 0.18, w * 0.28, h * 0.62);
    const topLeft = regionStats(ctx, w * 0.05, h * 0.05, w * 0.24, h * 0.18);
    const bottom = regionStats(ctx, w * 0.08, h * 0.64, w * 0.84, h * 0.26);
    const portraitLike = left.saturation > 32 && left.variance > 850;
    const flagLike = topLeft.redBias > 18 && topLeft.saturation > 28;
    const barcodeLike = bottom.variance > 1800 && bottom.saturation < 38;
    if ((portraitLike && flagLike) || (portraitLike && !barcodeLike)) return "疑似正面";
    if (barcodeLike && !portraitLike) return "疑似反面";
  } catch {
    return "正反面請確認";
  }
  return "正反面請確認";
}

function regionStats(ctx, x, y, w, h) {
  const sx = Math.max(0, Math.round(x));
  const sy = Math.max(0, Math.round(y));
  const sw = Math.max(1, Math.round(w));
  const sh = Math.max(1, Math.round(h));
  const data = ctx.getImageData(sx, sy, sw, sh).data;
  let saturation = 0;
  let redBias = 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const gray = (r + g + b) / 3;
    saturation += max - min;
    redBias += r - (g + b) / 2;
    sum += gray;
    sumSq += gray * gray;
    n++;
  }
  const mean = sum / Math.max(1, n);
  return {
    saturation: saturation / Math.max(1, n),
    redBias: redBias / Math.max(1, n),
    variance: sumSq / Math.max(1, n) - mean * mean
  };
}

function qualityBadges(canvas, cropped) {
  const badges = [{ text: cropped ? "已完成裁切" : "建議確認裁切", warn: !cropped }];
  if (canvas.width < 650 || canvas.height < 410) badges.push({ text: "解析度偏低", warn: true });
  if (state.cvReady && blurScore(canvas) < 45) badges.push({ text: "疑似模糊", warn: true });
  if (exposureRatio(canvas) > 0.18) badges.push({ text: "疑似過度曝光", warn: true });
  return badges;
}

function blurScore(canvas) {
  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  const lap = new cv.Mat();
  const mean = new cv.Mat();
  const std = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  cv.Laplacian(gray, lap, cv.CV_64F);
  cv.meanStdDev(lap, mean, std);
  const score = std.doubleAt(0, 0) ** 2;
  src.delete(); gray.delete(); lap.delete(); mean.delete(); std.delete();
  return score;
}

function exposureRatio(canvas) {
  const ctx = canvas.getContext("2d");
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let bright = 0;
  for (let i = 0; i < data.length; i += 16) {
    if ((data[i] + data[i + 1] + data[i + 2]) / 3 > 246) bright++;
  }
  return bright / (data.length / 16);
}

function rotatedSourceCanvas(source, rotation) {
  const normalizedRotation = normalizeRotation(rotation);
  const rightAngle = normalizedRotation === 90 || normalizedRotation === 270;
  const out = document.createElement("canvas");
  out.width = rightAngle ? source.height : source.width;
  out.height = rightAngle ? source.width : source.height;
  const ctx = out.getContext("2d");
  if (normalizedRotation === 90) {
    ctx.translate(out.width, 0);
    ctx.rotate(Math.PI / 2);
  } else if (normalizedRotation === 180) {
    ctx.translate(out.width, out.height);
    ctx.rotate(Math.PI);
  } else if (normalizedRotation === 270) {
    ctx.translate(0, out.height);
    ctx.rotate(-Math.PI / 2);
  }
  ctx.drawImage(source, 0, 0);
  return out;
}

async function rebuildCardFromCropState(card) {
  ensureCardCropState(card);
  const original = await canvasFromDataUrl(card.sourceDataUrl);
  const rotation = normalizeRotation(card.lastAppliedCrop.rotation || 0);
  const rotated = rotatedSourceCanvas(original, rotation);
  const points = normalizedToRotatedPoints(
    card.lastAppliedCrop.points,
    rotation,
    card.originalWidth,
    card.originalHeight
  );
  const out = state.cvReady ? warpCanvas(rotated, points) : rotated;
  card.currentDataUrl = out.toDataURL("image/jpeg", 0.92);
  card.lastCropResult = card.currentDataUrl;
  card.enhancedDataUrl = null;
  card.quality = qualityBadges(out, true);
}

async function rotateCard(cardId, degrees) {
  const card = state.cards.find((item) => item.id === cardId);
  if (!card) return;
  ensureCardCropState(card);
  card.rotation = normalizeRotation(card.rotation + degrees);
  card.lastAppliedCrop.rotation = card.rotation;
  await rebuildCardFromCropState(card);
  invalidatePdfCache();
  renderAll();
}

async function autoCropCard(cardId) {
  const card = state.cards.find((item) => item.id === cardId);
  if (!card || !state.cvReady) return;
  const original = await canvasFromDataUrl(card.sourceDataUrl);
  const candidates = detectCardCandidates(original);
  if (!candidates.length) return;
  const best = candidates[0];
  const out = warpCanvas(original, best.points);
  const normalized = normalizedOriginalPoints(best.points, original.width, original.height);
  card.originalWidth = original.width;
  card.originalHeight = original.height;
  card.sourceCanvas = original;
  card.points = clonePoints(best.points);
  card.lastAppliedCrop = { points: clonePoints(normalized), rotation: 0 };
  card.rotation = 0;
  card.manuallyAdjusted = false;
  card.currentDataUrl = out.toDataURL("image/jpeg", 0.92);
  card.lastCropResult = card.currentDataUrl;
  card.enhancedDataUrl = null;
  card.quality = qualityBadges(out, true);
  card.sourceIndex = "一鍵自動裁切";
  card.frameCandidates = candidates.slice(0, 3).map((candidate) => clonePoints(candidate.points));
  card.frameCandidatesNormalized = card.frameCandidates.map((candidate) =>
    normalizedOriginalPoints(candidate, original.width, original.height)
  );
  card.frameCandidateIndex = 0;
  card.faceHint = suggestCardSide(out);
  invalidatePdfCache();
  renderAll();
}

function replaceCardImage(cardId) {
  chooseFiles((files) => handleCardReplacement(cardId, files));
}

async function handleCardReplacement(cardId, files) {
  if (!files.length) return;
  const target = state.cards.find((item) => item.id === cardId);
  if (!target) return;
  const added = await processFiles(files.slice(0, 1), { render: false });
  if (!added.length) return;
  const assignment = findSlotForCard(cardId);
  if (added.length > 1 && assignment) {
    openCardChoice(added, assignment, { replaceCardId: cardId });
    return;
  }
  const replacement = added[0];
  const addedIds = new Set(added.map((item) => item.id));
  applyReplacementCard(target, replacement, addedIds);
  renderAll();
  if (!target.autoDetected) openCrop(target.id);
}

function applyReplacementCard(target, replacement, addedIds) {
  target.name = replacement.name;
  target.sourceName = replacement.sourceName;
  target.sourceDataUrl = replacement.sourceDataUrl;
  target.sourceCanvas = replacement.sourceCanvas;
  target.originalWidth = replacement.originalWidth;
  target.originalHeight = replacement.originalHeight;
  target.points = clonePoints(replacement.points);
  target.currentDataUrl = replacement.currentDataUrl;
  target.enhancedDataUrl = null;
  target.sourceIndex = replacement.sourceIndex;
  target.frameCandidates = (replacement.frameCandidates || []).map(clonePoints);
  target.frameCandidatesNormalized = (replacement.frameCandidatesNormalized || []).map(clonePoints);
  target.frameCandidateIndex = replacement.frameCandidateIndex;
  target.autoDetected = replacement.autoDetected;
  target.faceHint = replacement.faceHint;
  target.quality = replacement.quality.map((item) => ({ ...item }));
  target.initialCrop = {
    points: clonePoints(replacement.initialCrop.points),
    rotation: replacement.initialCrop.rotation
  };
  target.lastAppliedCrop = {
    points: clonePoints(replacement.lastAppliedCrop.points),
    rotation: replacement.lastAppliedCrop.rotation
  };
  target.rotation = replacement.rotation;
  target.manuallyAdjusted = replacement.manuallyAdjusted;
  target.lastCropResult = replacement.lastCropResult;
  const ids = addedIds instanceof Set ? addedIds : new Set(addedIds);
  state.cards = state.cards.filter((item) => !ids.has(item.id));
  invalidatePdfCache();
}

function canvasFromDataUrl(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(imageToCanvas(img));
    img.src = dataUrl;
  });
}

async function openViewer(cardId) {
  state.viewerId = cardId;
  state.viewerMode = "original";
  await updateViewerImage();
  el.viewerDialog.showModal();
}

function sideText(side) {
  return side === "front" ? "正面" : "反面";
}

el.viewOriginalBtn.addEventListener("click", async () => {
  state.viewerMode = "original";
  await updateViewerImage();
});
el.viewEnhancedBtn.addEventListener("click", async () => {
  state.viewerMode = "enhanced";
  await updateViewerImage();
});

async function updateViewerImage() {
  const card = state.cards.find((item) => item.id === state.viewerId);
  if (!card) return;
  if (state.viewerMode === "enhanced") {
    if (!card.enhancedDataUrl) card.enhancedDataUrl = await enhancedImage(card.currentDataUrl);
    el.viewerImage.src = card.enhancedDataUrl;
  } else {
    el.viewerImage.src = card.currentDataUrl;
  }
  el.viewOriginalBtn.classList.toggle("active", state.viewerMode === "original");
  el.viewEnhancedBtn.classList.toggle("active", state.viewerMode === "enhanced");
}

async function enhancedImage(dataUrl) {
  const canvas = await canvasFromDataUrl(dataUrl);
  if (!state.cvReady) {
    const ctx = canvas.getContext("2d");
    ctx.filter = "brightness(1.06) contrast(1.12) saturate(1.02)";
    ctx.drawImage(canvas, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.92);
  }
  const src = cv.imread(canvas);
  const dst = new cv.Mat();
  src.convertTo(dst, -1, 1.12, 8);
  const blur = new cv.Mat();
  cv.GaussianBlur(dst, blur, new cv.Size(0, 0), 1.0);
  cv.addWeighted(dst, 1.35, blur, -0.35, 0, dst);
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  cv.imshow(out, dst);
  src.delete(); dst.delete(); blur.delete();
  return out.toDataURL("image/jpeg", 0.92);
}

function clonePoints(points) {
  return (points || []).map((point) => ({ x: point.x, y: point.y }));
}

function normalizeRotation(rotation) {
  return ((rotation % 360) + 360) % 360;
}

function normalizedOriginalPoints(points, width, height) {
  return orderPoints(points).map((point) => ({
    x: Math.min(1, Math.max(0, point.x / width)),
    y: Math.min(1, Math.max(0, point.y / height))
  }));
}

function originalPixelsFromNormalized(points, width, height) {
  return clonePoints(points).map((point) => ({ x: point.x * width, y: point.y * height }));
}

function originalPointToRotated(point, rotation, width, height) {
  if (rotation === 90) return { x: height - point.y, y: point.x };
  if (rotation === 180) return { x: width - point.x, y: height - point.y };
  if (rotation === 270) return { x: point.y, y: width - point.x };
  return { ...point };
}

function rotatedPointToOriginal(point, rotation, width, height) {
  if (rotation === 90) return { x: point.y, y: height - point.x };
  if (rotation === 180) return { x: width - point.x, y: height - point.y };
  if (rotation === 270) return { x: width - point.y, y: point.x };
  return { ...point };
}

function normalizedToRotatedPoints(points, rotation, width, height) {
  const original = originalPixelsFromNormalized(points, width, height);
  return orderPoints(original.map((point) => originalPointToRotated(point, rotation, width, height)));
}

function rotatedToNormalizedOriginalPoints(points, rotation, width, height) {
  const original = points.map((point) => rotatedPointToOriginal(point, rotation, width, height));
  return normalizedOriginalPoints(original, width, height);
}

function ensureCardCropState(card) {
  card.originalWidth ||= card.sourceCanvas?.width || 1;
  card.originalHeight ||= card.sourceCanvas?.height || 1;
  if (!card.initialCrop) {
    const initial = normalizedOriginalPoints(card.points || fallbackQuad(card.sourceCanvas).points, card.originalWidth, card.originalHeight);
    card.initialCrop = { points: clonePoints(initial), rotation: 0 };
  }
  if (!card.lastAppliedCrop) {
    card.lastAppliedCrop = {
      points: clonePoints(card.initialCrop.points),
      rotation: normalizeRotation(card.rotation || 0)
    };
  }
  card.rotation = normalizeRotation(card.lastAppliedCrop.rotation || 0);
  card.manuallyAdjusted = Boolean(card.manuallyAdjusted);
  card.lastCropResult ||= card.currentDataUrl;
}

function candidateNormalizedPoints(card) {
  if (card.frameCandidatesNormalized?.length) {
    return card.frameCandidatesNormalized.map(clonePoints);
  }
  return (card.frameCandidates || []).map((candidate) =>
    normalizedOriginalPoints(candidate, card.originalWidth, card.originalHeight)
  );
}

function sameNormalizedCrop(a, b) {
  return a.length === b.length && a.every((point, index) =>
    Math.abs(point.x - b[index].x) < 0.00001 && Math.abs(point.y - b[index].y) < 0.00001
  );
}

function assignmentDetails(cardId) {
  const assignment = findSlotForCard(cardId);
  if (!assignment) return null;
  const caseItem = state.cases.find((item) => item.id === assignment.caseId);
  const person = caseItem?.people.find((item) => item.id === assignment.personId);
  if (!caseItem || !person) return null;
  return {
    ...assignment,
    label: `${caseItem.title}｜${person.role}｜${sideText(assignment.side)}`
  };
}

function lockCropBackground() {
  if (document.body.classList.contains("crop-modal-open")) return;
  state.cropPageScrollY = window.scrollY;
  document.body.style.top = `-${state.cropPageScrollY}px`;
  document.body.classList.add("crop-modal-open");
}

function unlockCropBackground() {
  if (!document.body.classList.contains("crop-modal-open")) return;
  const scrollY = state.cropPageScrollY;
  document.body.classList.remove("crop-modal-open", "crop-handle-dragging");
  document.body.style.top = "";
  window.scrollTo(0, scrollY);
}

async function openCrop(cardId, opener = document.activeElement) {
  const card = state.cards.find((item) => item.id === cardId);
  if (!card) return;
  const assignment = assignmentDetails(cardId);
  ensureCardCropState(card);
  const applied = card.lastAppliedCrop;
  const storedCandidates = candidateNormalizedPoints(card);
  const normalizedCandidates = [clonePoints(applied.points)];
  storedCandidates.forEach((candidate) => {
    if (normalizedCandidates.length < 3 && !normalizedCandidates.some((saved) => sameNormalizedCrop(saved, candidate))) {
      normalizedCandidates.push(clonePoints(candidate));
    }
  });

  state.activeCropId = cardId;
  state.cropOpener = opener;
  state.cropRestoreFocus = true;
  state.cropRotation = normalizeRotation(applied.rotation || 0);
  state.cropInitialSnapshot = {
    points: clonePoints(card.initialCrop.points),
    rotation: normalizeRotation(card.initialCrop.rotation || 0)
  };
  state.cropOpenSnapshot = {
    points: clonePoints(applied.points),
    rotation: state.cropRotation
  };
  state.cropDirty = false;
  state.cropManuallyAdjusted = card.manuallyAdjusted;
  state.activeCropHandle = null;
  updateCropHandleHint();
  el.cropAssignmentContext.hidden = !assignment;
  el.cropAssignmentContext.textContent = assignment?.label || "";
  el.discardCropPrompt.hidden = true;
  await drawOriginalCropImage(state.cropRotation);
  state.cropPoints = normalizedToRotatedPoints(applied.points, state.cropRotation, card.originalWidth, card.originalHeight);
  state.cropCandidates = normalizedCandidates.map((candidate) =>
    normalizedToRotatedPoints(candidate, state.cropRotation, card.originalWidth, card.originalHeight)
  );
  state.cropCandidateIndex = 0;
  lockCropBackground();
  el.cropDialog.showModal();
  requestAnimationFrame(() => {
    fitOverlay();
    updateNextFrameButton();
    drawCropOverlay();
    updateCropCorrectionPreview();
    el.applyCropBtn.focus();
  });
}

function updateNextFrameButton() {
  el.nextFrameBtn.hidden = state.cropCandidates.length < 2;
}

function setCropCandidate(index, markDirty = true) {
  if (!state.cropCandidates.length) return;
  state.cropCandidateIndex = ((index % state.cropCandidates.length) + state.cropCandidates.length) % state.cropCandidates.length;
  state.cropPoints = state.cropCandidates[state.cropCandidateIndex].map((p) => ({ ...p }));
  if (markDirty) {
    state.cropDirty = true;
    state.cropManuallyAdjusted = false;
  }
  updateNextFrameButton();
  drawCropOverlay();
  updateCropCorrectionPreview();
}

function redetectCropCandidates() {
  if (!state.cvReady) return [];
  const candidates = detectCardCandidates(el.cropCanvas);
  state.cropCandidates = candidates.map((candidate) => candidate.points.map((p) => ({ ...p })));
  state.cropCandidateIndex = 0;
  if (state.cropCandidates.length) setCropCandidate(0, true);
  return candidates;
}

function drawOriginalCropImage(rotation = state.cropRotation) {
  const card = state.cards.find((item) => item.id === state.activeCropId);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const normalizedRotation = normalizeRotation(rotation);
      const rightAngle = normalizedRotation === 90 || normalizedRotation === 270;
      el.cropCanvas.width = rightAngle ? img.naturalHeight : img.naturalWidth;
      el.cropCanvas.height = rightAngle ? img.naturalWidth : img.naturalHeight;
      const ctx = el.cropCanvas.getContext("2d");
      if (normalizedRotation === 90) {
        ctx.translate(el.cropCanvas.width, 0);
        ctx.rotate(Math.PI / 2);
      } else if (normalizedRotation === 180) {
        ctx.translate(el.cropCanvas.width, el.cropCanvas.height);
        ctx.rotate(Math.PI);
      } else if (normalizedRotation === 270) {
        ctx.translate(0, el.cropCanvas.height);
        ctx.rotate(-Math.PI / 2);
      }
      ctx.drawImage(img, 0, 0);
      fitOverlay();
      resolve();
    };
    img.src = card.sourceDataUrl;
  });
}

function applyCropCandidateToCard(candidateIndex = state.cropCandidateIndex) {
  setCropCandidate(candidateIndex);
  return applyCropChanges();
}

function fitOverlay() {
  const rect = el.cropCanvas.getBoundingClientRect();
  el.cropOverlay.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
}

function displayPoint(point) {
  const rect = el.cropCanvas.getBoundingClientRect();
  return { x: point.x * rect.width / el.cropCanvas.width, y: point.y * rect.height / el.cropCanvas.height };
}

function imagePoint(point) {
  const rect = el.cropCanvas.getBoundingClientRect();
  return {
    x: Math.min(el.cropCanvas.width, Math.max(0, point.x * el.cropCanvas.width / rect.width)),
    y: Math.min(el.cropCanvas.height, Math.max(0, point.y * el.cropCanvas.height / rect.height))
  };
}

function drawCropOverlay() {
  const rect = el.cropCanvas.getBoundingClientRect();
  const stageRect = el.cropCanvas.parentElement.getBoundingClientRect();
  el.cropOverlay.style.left = `${rect.left - stageRect.left}px`;
  el.cropOverlay.style.top = `${rect.top - stageRect.top}px`;
  el.cropOverlay.style.width = `${rect.width}px`;
  el.cropOverlay.style.height = `${rect.height}px`;
  const pts = state.cropPoints.map(displayPoint);
  const labels = ["左上角", "右上角", "右下角", "左下角"];
  if (el.cropOverlay.querySelectorAll(".handle").length !== 4) {
    el.cropOverlay.innerHTML = `
      <polygon fill="rgba(17,97,93,.18)" stroke="#30c2b3" stroke-width="2"></polygon>
      ${pts.map((p, i) => `<g class="handle" data-index="${i}" tabindex="0" role="slider" aria-label="${labels[i]}"><circle class="handle-hit" r="22"></circle><circle class="handle-dot" r="9" fill="#fff" stroke="#11615d" stroke-width="3"></circle></g>`).join("")}`;
  }
  el.cropOverlay.querySelector("polygon").setAttribute("points", pts.map((p) => `${p.x},${p.y}`).join(" "));
  el.cropOverlay.querySelectorAll(".handle").forEach((handle, index) => {
    handle.setAttribute("transform", `translate(${pts[index].x} ${pts[index].y})`);
    handle.setAttribute("aria-valuetext", `x ${Math.round(state.cropPoints[index].x)}，y ${Math.round(state.cropPoints[index].y)}`);
    handle.classList.toggle("active", state.activeCropHandle === index);
  });
}

let draggingHandle = null;
let draggingPointerId = null;
let draggingCaptureTarget = null;
let draggingTouchId = null;
let activeCropInputMode = null;
let cropDragStart = null;
let cropDragMoved = false;
let suppressCropClickUntil = 0;
const cropHandleLabels = ["左上角", "右上角", "右下角", "左下角"];

function setCropDragging(active) {
  el.cropDialog.classList.toggle("crop-dragging", active);
  el.cropCanvas.parentElement.classList.toggle("crop-dragging", active);
  document.body.classList.toggle("crop-handle-dragging", active);
}

function clearCropPointerDrag(pointerId = draggingPointerId) {
  const captureTarget = draggingCaptureTarget;
  draggingHandle = null;
  draggingPointerId = null;
  draggingCaptureTarget = null;
  draggingTouchId = null;
  activeCropInputMode = null;
  cropDragStart = null;
  setCropDragging(false);
  if (captureTarget && pointerId !== null) {
    try {
      if (captureTarget.hasPointerCapture(pointerId)) captureTarget.releasePointerCapture(pointerId);
    } catch (_) {
      // Pointer capture may already be released after cancellation.
    }
  }
}

function updateCropHandleHint() {
  const label = cropHandleLabels[state.activeCropHandle];
  const prefix = label ? `目前：${label}｜` : "";
  el.cropHandleHint.querySelector(".keyboard-crop-hint").textContent = `${prefix}使用方向鍵微調，Shift＋方向鍵快速移動`;
  el.cropHandleHint.querySelector(".touch-crop-hint").textContent = `${prefix}拖曳四角調整裁切範圍`;
}

function setActiveCropHandle(index, focus = false) {
  state.activeCropHandle = index;
  el.cropOverlay.querySelectorAll(".handle").forEach((handle, handleIndex) => {
    handle.classList.toggle("active", handleIndex === index);
  });
  updateCropHandleHint();
  if (focus) el.cropOverlay.querySelector(`.handle[data-index="${index}"]`)?.focus({ preventScroll: true });
}

function moveActiveCropHandle(key, fast = false) {
  const index = state.activeCropHandle;
  if (index === null || !state.cropPoints[index]) return;
  const step = fast ? 10 : 1;
  const delta = {
    ArrowUp: { x: 0, y: -step },
    ArrowDown: { x: 0, y: step },
    ArrowLeft: { x: -step, y: 0 },
    ArrowRight: { x: step, y: 0 }
  }[key];
  if (!delta) return;
  const point = state.cropPoints[index];
  state.cropPoints[index] = {
    x: Math.min(el.cropCanvas.width, Math.max(0, point.x + delta.x)),
    y: Math.min(el.cropCanvas.height, Math.max(0, point.y + delta.y))
  };
  state.cropDirty = true;
  state.cropManuallyAdjusted = true;
  drawCropOverlay();
  updateCropCorrectionPreview();
}

function updateDraggedCropPoint(clientX, clientY) {
  if (draggingHandle === null) return;
  if (cropDragStart && Math.hypot(clientX - cropDragStart.x, clientY - cropDragStart.y) > 4) {
    cropDragMoved = true;
  }
  const rect = el.cropCanvas.getBoundingClientRect();
  state.cropPoints[draggingHandle] = imagePoint({ x: clientX - rect.left, y: clientY - rect.top });
  state.cropDirty = true;
  state.cropManuallyAdjusted = true;
  drawCropOverlay();
  updateCropCorrectionPreview();
}

function blockCropSurfaceTouch(event) {
  if (event.cancelable) event.preventDefault();
  event.stopPropagation();
}

[el.cropCanvas, el.cropCanvas.parentElement].forEach((surface) => {
  surface.addEventListener("touchstart", blockCropSurfaceTouch, { passive: false });
  surface.addEventListener("touchmove", blockCropSurfaceTouch, { passive: false });
});

el.cropOverlay.addEventListener("pointerdown", (event) => {
  const handle = event.target.closest?.(".handle");
  if (!handle) return;
  if (event.cancelable) event.preventDefault();
  event.stopPropagation();
  if (activeCropInputMode === "touch" || draggingHandle !== null) return;
  activeCropInputMode = "pointer";
  draggingHandle = Number(handle.dataset.index);
  draggingPointerId = event.pointerId;
  draggingCaptureTarget = handle;
  cropDragStart = { x: event.clientX, y: event.clientY };
  cropDragMoved = false;
  setActiveCropHandle(draggingHandle, event.pointerType !== "touch");
  setCropDragging(true);
  try {
    handle.setPointerCapture(event.pointerId);
  } catch (_) {
    // Synthetic events may not represent an active pointer; real input still uses capture.
  }
}, { passive: false });
el.cropOverlay.addEventListener("pointermove", (event) => {
  if (activeCropInputMode !== "pointer" || draggingHandle === null || event.pointerId !== draggingPointerId) return;
  if (event.cancelable) event.preventDefault();
  event.stopPropagation();
  updateDraggedCropPoint(event.clientX, event.clientY);
}, { passive: false });
function endCropPointer(event) {
  if (activeCropInputMode !== "pointer" || draggingPointerId === null || event.pointerId !== draggingPointerId) return;
  if (event.cancelable) event.preventDefault();
  event.stopPropagation();
  if (cropDragMoved) suppressCropClickUntil = performance.now() + 500;
  clearCropPointerDrag(event.pointerId);
}

el.cropOverlay.addEventListener("pointerup", endCropPointer);
el.cropOverlay.addEventListener("pointercancel", endCropPointer);
el.cropOverlay.addEventListener("lostpointercapture", () => {
  if (activeCropInputMode === "pointer" && draggingHandle !== null) clearCropPointerDrag();
});
el.cropOverlay.addEventListener("touchstart", (event) => {
  blockCropSurfaceTouch(event);
  const handle = event.target.closest?.(".handle");
  if (!handle || activeCropInputMode === "pointer" || draggingHandle !== null) return;
  const touch = event.changedTouches[0];
  if (!touch) return;
  activeCropInputMode = "touch";
  draggingHandle = Number(handle.dataset.index);
  draggingTouchId = touch.identifier;
  cropDragStart = { x: touch.clientX, y: touch.clientY };
  cropDragMoved = false;
  setActiveCropHandle(draggingHandle);
  setCropDragging(true);
}, { passive: false });
el.cropOverlay.addEventListener("touchmove", (event) => {
  blockCropSurfaceTouch(event);
  if (activeCropInputMode !== "touch" || draggingHandle === null) return;
  const touch = Array.from(event.touches).find((item) => item.identifier === draggingTouchId);
  if (!touch) return;
  updateDraggedCropPoint(touch.clientX, touch.clientY);
}, { passive: false });
function endCropTouch(event) {
  blockCropSurfaceTouch(event);
  if (activeCropInputMode !== "touch" || draggingHandle === null) return;
  const ended = event.type === "touchcancel"
    || Array.from(event.changedTouches).some((touch) => touch.identifier === draggingTouchId);
  if (!ended) return;
  if (cropDragMoved) suppressCropClickUntil = performance.now() + 500;
  clearCropPointerDrag(null);
}
el.cropOverlay.addEventListener("touchend", endCropTouch, { passive: false });
el.cropOverlay.addEventListener("touchcancel", endCropTouch, { passive: false });
el.cropOverlay.addEventListener("click", (event) => {
  if (performance.now() > suppressCropClickUntil) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  suppressCropClickUntil = 0;
}, true);
el.cropOverlay.addEventListener("contextmenu", (event) => {
  if (draggingHandle !== null) event.preventDefault();
});
el.cropOverlay.addEventListener("focusin", (event) => {
  const handle = event.target.closest(".handle");
  if (handle) setActiveCropHandle(Number(handle.dataset.index));
});

function createCropCorrectionResult() {
  const orderedCrop = orderPoints(state.cropPoints);
  return state.cvReady ? warpCanvas(el.cropCanvas, orderedCrop) : cloneCanvas(el.cropCanvas);
}

function updateCropCorrectionPreview() {
  if (state.cropPoints.length !== 4) return null;
  const output = createCropCorrectionResult();
  const preview = el.cropCorrectionPreviewCanvas;
  preview.width = output.width;
  preview.height = output.height;
  const context = preview.getContext("2d");
  context.clearRect(0, 0, preview.width, preview.height);
  context.drawImage(output, 0, 0);
  return output;
}

function applyCropChanges() {
  const card = state.cards.find((item) => item.id === state.activeCropId);
  ensureCardCropState(card);
  const orderedCrop = orderPoints(state.cropPoints);
  const normalizedCrop = rotatedToNormalizedOriginalPoints(
    orderedCrop,
    state.cropRotation,
    card.originalWidth,
    card.originalHeight
  );
  const out = createCropCorrectionResult();
  card.points = originalPixelsFromNormalized(normalizedCrop, card.originalWidth, card.originalHeight);
  card.lastAppliedCrop = { points: clonePoints(normalizedCrop), rotation: state.cropRotation };
  card.rotation = state.cropRotation;
  card.manuallyAdjusted = state.cropManuallyAdjusted;
  card.currentDataUrl = out.toDataURL("image/jpeg", 0.92);
  card.lastCropResult = card.currentDataUrl;
  card.enhancedDataUrl = null;
  card.quality = qualityBadges(out, true);
  card.sourceIndex = "已手動校正";
  card.frameCandidatesNormalized = state.cropCandidates.slice(0, 3).map((candidate) =>
    rotatedToNormalizedOriginalPoints(candidate, state.cropRotation, card.originalWidth, card.originalHeight)
  );
  card.frameCandidates = card.frameCandidatesNormalized.map((candidate) =>
    originalPixelsFromNormalized(candidate, card.originalWidth, card.originalHeight)
  );
  card.frameCandidateIndex = state.cropCandidateIndex;
  card.faceHint = suggestCardSide(out);
  invalidatePdfCache();
  state.cropOpenSnapshot = { points: clonePoints(normalizedCrop), rotation: state.cropRotation };
  state.cropDirty = false;
  return card;
}

el.autoCropBtn.addEventListener("click", async () => {
  state.cropRotation = 0;
  await drawOriginalCropImage(0);
  const candidates = redetectCropCandidates();
  if (!candidates.length) return;
  const card = applyCropCandidateToCard(0);
  card.sourceIndex = "一鍵自動裁切";
  state.cropRestoreFocus = true;
  el.cropDialog.close();
  renderAll();
});

el.redetectFrameBtn.addEventListener("click", async () => {
  state.cropRotation = 0;
  await drawOriginalCropImage(0);
  redetectCropCandidates();
});

el.nextFrameBtn.addEventListener("click", () => {
  setCropCandidate(state.cropCandidateIndex + 1);
});

el.applyCropBtn.addEventListener("click", () => {
  applyCropChanges();
  state.cropRestoreFocus = true;
  el.cropDialog.close();
  renderAll();
});

el.resetCropBtn.addEventListener("click", async () => {
  const card = state.cards.find((item) => item.id === state.activeCropId);
  const candidateNormalized = state.cropCandidates.map((candidate) =>
    rotatedToNormalizedOriginalPoints(candidate, state.cropRotation, card.originalWidth, card.originalHeight)
  );
  state.cropRotation = state.cropInitialSnapshot.rotation;
  await drawOriginalCropImage(state.cropRotation);
  state.cropPoints = normalizedToRotatedPoints(
    state.cropInitialSnapshot.points,
    state.cropRotation,
    card.originalWidth,
    card.originalHeight
  );
  state.cropCandidates = candidateNormalized.map((candidate) =>
    normalizedToRotatedPoints(candidate, state.cropRotation, card.originalWidth, card.originalHeight)
  );
  state.cropDirty = true;
  state.cropManuallyAdjusted = false;
  fitOverlay();
  drawCropOverlay();
  updateCropCorrectionPreview();
});
el.rotateLeftBtn.addEventListener("click", () => rotateSourceForCrop(-90));
el.rotateRightBtn.addEventListener("click", () => rotateSourceForCrop(90));
el.rotate180Btn.addEventListener("click", () => rotateSourceForCrop(180));

async function rotateSourceForCrop(degrees) {
  const card = state.cards.find((item) => item.id === state.activeCropId);
  const cropNormalized = rotatedToNormalizedOriginalPoints(
    state.cropPoints,
    state.cropRotation,
    card.originalWidth,
    card.originalHeight
  );
  const candidatesNormalized = state.cropCandidates.map((candidate) =>
    rotatedToNormalizedOriginalPoints(candidate, state.cropRotation, card.originalWidth, card.originalHeight)
  );
  state.cropRotation = normalizeRotation(state.cropRotation + degrees);
  await drawOriginalCropImage(state.cropRotation);
  state.cropPoints = normalizedToRotatedPoints(cropNormalized, state.cropRotation, card.originalWidth, card.originalHeight);
  state.cropCandidates = candidatesNormalized.map((candidate) =>
    normalizedToRotatedPoints(candidate, state.cropRotation, card.originalWidth, card.originalHeight)
  );
  state.cropDirty = true;
  updateNextFrameButton();
  fitOverlay();
  drawCropOverlay();
  updateCropCorrectionPreview();
}

function cropFocusableElements() {
  if (!el.discardCropPrompt.hidden) {
    return [...el.discardCropPrompt.querySelectorAll("button:not([disabled])")]
      .filter((node) => node.getClientRects().length > 0);
  }
  return [...el.cropDialog.querySelectorAll('button:not([disabled]):not([tabindex="-1"]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((node) => !node.hidden && !node.closest("[hidden]") && node.getClientRects().length > 0);
}

function showDiscardCropPrompt() {
  state.cropFocusBeforeDiscard = document.activeElement;
  el.discardCropPrompt.hidden = false;
  el.keepEditingCropBtn.focus();
}

function hideDiscardCropPrompt() {
  el.discardCropPrompt.hidden = true;
  const previousFocus = state.cropFocusBeforeDiscard;
  state.cropFocusBeforeDiscard = null;
  if (previousFocus?.isConnected) previousFocus.focus();
  else el.applyCropBtn.focus();
}

function requestCropClose(force = false) {
  if (state.cropDirty && !force) {
    showDiscardCropPrompt();
    return;
  }
  state.cropDirty = false;
  state.cropRestoreFocus = true;
  el.discardCropPrompt.hidden = true;
  el.cropDialog.close("cancel");
}

el.cropDialog.querySelectorAll("[data-crop-cancel]").forEach((button) => {
  button.addEventListener("click", () => requestCropClose());
});

el.cropDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  if (!el.discardCropPrompt.hidden) {
    hideDiscardCropPrompt();
    return;
  }
  requestCropClose();
});

el.keepEditingCropBtn.addEventListener("click", hideDiscardCropPrompt);
el.discardCropBtn.addEventListener("click", () => requestCropClose(true));

el.cropDialog.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    if (!el.discardCropPrompt.hidden) hideDiscardCropPrompt();
    else requestCropClose();
    return;
  }
  const activeElement = document.activeElement;
  const activeHandle = activeElement?.closest?.(".handle");
  if (activeHandle && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
    event.stopPropagation();
    setActiveCropHandle(Number(activeHandle.dataset.index));
    moveActiveCropHandle(event.key, event.shiftKey);
    return;
  }
  if (event.key === "Enter" && (activeHandle || activeElement === el.cropCanvas)) {
    event.preventDefault();
    el.applyCropBtn.click();
    return;
  }
  if ((event.key === "Enter" || event.key === " " || event.key === "Spacebar") && activeElement?.matches("button")) {
    event.preventDefault();
    activeElement.click();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = cropFocusableElements();
  if (!focusable.length) return;
  event.preventDefault();
  const currentIndex = focusable.indexOf(document.activeElement);
  const nextIndex = event.shiftKey
    ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
    : (currentIndex < 0 || currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
  focusable[nextIndex].focus();
});

el.cropDialog.addEventListener("close", () => {
  const opener = state.cropOpener;
  const cardId = state.activeCropId;
  const shouldRestore = state.cropRestoreFocus;
  clearCropPointerDrag();
  unlockCropBackground();
  state.activeCropId = null;
  state.cropOpener = null;
  if (!shouldRestore) return;
  setTimeout(() => {
    if (opener?.isConnected) {
      opener.focus();
      return;
    }
    const card = [...document.querySelectorAll(".card")].find((node) => node.dataset.cardId === cardId);
    card?.querySelector('[data-action="crop"]')?.focus();
  }, 0);
});

window.addEventListener("resize", () => {
  if (!el.cropDialog.open) return;
  requestAnimationFrame(() => {
    fitOverlay();
    drawCropOverlay();
  });
});

function rowsForCase(caseId) {
  const caseItem = state.cases.find((item) => item.id === caseId);
  if (!caseItem) return [];
  return caseItem.people.map((p) => ({
    label: `${caseItem.title} ${p.role}`,
    front: state.cards.find((card) => card.id === p.front),
    back: state.cards.find((card) => card.id === p.back)
  })).filter((row) => row.front || row.back);
}

function buildCasePages(caseId) {
  const rows = rowsForCase(caseId);
  const rowsPerPage = 4;
  const pages = [];
  for (let i = 0; i < rows.length; i += rowsPerPage) {
    pages.push(rows.slice(i, i + rowsPerPage));
  }
  return pages;
}

function pdfFilename(caseItem) {
  const caseName = caseItem.title.replace(/\s+/g, "");
  return `${caseName}_證件影本.pdf`;
}

function buildPdfBundle(caseId) {
  const caseItem = state.cases.find((item) => item.id === caseId);
  const pages = buildCasePages(caseId);
  if (!caseItem || !pages.length) return null;
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const marginX = 12;
  const marginY = 14;
  const gapX = 8;
  const gapY = 8;
  const rowH = CARD_H_MM + gapY;
  pages.forEach((rows, pageIndex) => {
    if (pageIndex > 0) pdf.addPage();
    rows.forEach((row, rowIndex) => {
      const y = marginY + rowIndex * rowH;
      if (row.front) pdf.addImage(row.front.currentDataUrl, "JPEG", marginX, y, CARD_W_MM, CARD_H_MM);
      if (row.back) pdf.addImage(row.back.currentDataUrl, "JPEG", marginX + CARD_W_MM + gapX, y, CARD_W_MM, CARD_H_MM);
    });
  });
  const outputBlob = pdf.output("blob");
  const blob = outputBlob.type === "application/pdf"
    ? outputBlob
    : new Blob([outputBlob], { type: "application/pdf" });
  const filename = pdfFilename(caseItem);
  const file = typeof File === "function"
    ? new File([blob], filename, { type: "application/pdf" })
    : null;
  const bundle = { caseId, blob, file, filename, objectUrl: null };
  state.pdfCache.set(caseId, bundle);
  updatePdfActions();
  return bundle;
}

function getPdfBundle(caseId) {
  return state.pdfCache.get(caseId) || buildPdfBundle(caseId);
}

function schedulePdfCacheWarm(caseId) {
  if (state.pdfCache.has(caseId) || state.pdfWarmTimers.has(caseId) || !rowsForCase(caseId).length) return;
  const warm = () => {
    state.pdfWarmTimers.delete(caseId);
    if (!state.pdfCache.has(caseId) && rowsForCase(caseId).length) {
      try {
        buildPdfBundle(caseId);
      } catch (error) {
        console.warn("PDF cache preparation failed.", error);
      }
    }
  };
  const timer = typeof window.requestIdleCallback === "function"
    ? window.requestIdleCallback(warm, { timeout: 1200 })
    : window.setTimeout(warm, 0);
  state.pdfWarmTimers.set(caseId, timer);
}

function pdfObjectUrl(bundle) {
  if (!bundle.objectUrl) bundle.objectUrl = URL.createObjectURL(bundle.blob);
  return bundle.objectUrl;
}

function openPdfPreview(bundle) {
  const url = pdfObjectUrl(bundle);
  const opened = window.open(url, "_blank");
  if (opened) {
    try { opened.opener = null; } catch (_) { /* Cross-window restrictions are harmless here. */ }
    return;
  }
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadPdf(bundle) {
  const link = document.createElement("a");
  link.href = pdfObjectUrl(bundle);
  link.download = bundle.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function generatePdf(caseId) {
  const bundle = getPdfBundle(caseId);
  if (!bundle) return;
  if (isSamsungInternet()) {
    downloadPdf(bundle);
    log(`已下載 ${bundle.filename}`);
    return;
  }
  if (isMobilePdfEnvironment()) {
    openPdfPreview(bundle);
    log("PDF 已開啟，可使用瀏覽器分享或儲存到檔案");
    return;
  }
  downloadPdf(bundle);
  log(`已產生 ${bundle.filename}`);
}

function sharePdfViaViewer(caseId) {
  const bundle = getPdfBundle(caseId);
  if (!bundle) return;
  openPdfPreview(bundle);
  const message = "PDF 已開啟，請使用閱讀器的分享功能傳送。";
  log(message);
  showToast(message);
}

async function sharePdf(caseId, button) {
  if (button?.disabled) return;
  if (isSamsungInternet()) {
    sharePdfViaViewer(caseId);
    return;
  }
  const shareStartedAt = performance.now();
  if (diagnosticEnabled) {
    const activation = userActivationSnapshot();
    Object.assign(diagnosticState.formalShare, {
      result: "preparing",
      cacheReadyAtClick: state.pdfCache.has(caseId),
      activationAtClickIsActive: activation.isActive,
      activationAtClickHasBeenActive: activation.hasBeenActive,
      activationBeforeShareIsActive: null,
      activationBeforeShareHasBeenActive: null,
      clickToShareMs: null,
      errorName: "",
      errorMessage: ""
    });
    renderDiagnostic();
  }
  const originalLabel = button?.textContent || "分享 PDF";
  if (button) {
    button.disabled = true;
    button.textContent = "準備分享…";
  }
  let bundle = null;
  try {
    bundle = getPdfBundle(caseId);
    if (!bundle) {
      showToast("此案件尚未放入任何證件。");
      return;
    }
    const caseItem = state.cases.find((item) => item.id === caseId);
    const shareData = bundle.file ? {
      files: [bundle.file],
      title: "證件影本",
      text: `${caseItem?.title || "案件"}證件影本`
    } : null;
    let canShareFiles = false;
    try {
      canShareFiles = Boolean(
        shareData
        && typeof navigator.share === "function"
        && typeof navigator.canShare === "function"
        && navigator.canShare({ files: shareData.files })
      );
    } catch (error) {
      console.warn("PDF file sharing capability check failed.", error);
    }
    if (!canShareFiles) {
      if (diagnosticEnabled) {
        diagnosticState.formalShare.result = "file-share-not-supported";
        renderDiagnostic();
      }
      downloadPdf(bundle);
      const message = "此瀏覽器不支援直接分享，已改為下載 PDF。";
      showToast(message);
      return;
    }
    if (diagnosticEnabled) {
      const activation = userActivationSnapshot();
      diagnosticState.formalShare.activationBeforeShareIsActive = activation.isActive;
      diagnosticState.formalShare.activationBeforeShareHasBeenActive = activation.hasBeenActive;
      diagnosticState.formalShare.clickToShareMs = Number((performance.now() - shareStartedAt).toFixed(2));
      diagnosticState.formalShare.result = "calling-share";
    }
    const sharePromise = navigator.share({
      files: shareData.files,
      title: shareData.title,
      text: shareData.text
    });
    renderDiagnostic();
    await sharePromise;
    if (diagnosticEnabled) {
      diagnosticState.formalShare.result = "share-sheet-completed";
      renderDiagnostic();
    }
  } catch (error) {
    if (diagnosticEnabled) {
      diagnosticState.formalShare.result = error?.name === "AbortError" ? "user-cancelled" : "share-error";
      diagnosticState.formalShare.errorName = error?.name || "Error";
      diagnosticState.formalShare.errorMessage = error?.message || String(error);
      renderDiagnostic();
    }
    if (error?.name === "AbortError") return;
    console.error("PDF share failed.", error);
    if (bundle) downloadPdf(bundle);
    const message = bundle
      ? "無法開啟分享，已改為下載 PDF。"
      : "無法產生 PDF，請稍後再試。";
    showToast(message);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }
}

initUploadEnvironment();
addDefaultCase();
renderAll();
initLineAndroidFallback();
initDiagnostics();
initEngines();
