(() => {
  "use strict";

  const documentState = {
    mode: "identity",
    pages: [],
    activePageId: null,
    selectedItemId: null,
    cvReady: false,
    activeId: null,
    cropPoints: [],
    cropCandidates: [],
    candidateIndex: 0,
    rotation: 0,
    openSnapshot: null,
    initialSnapshot: null,
    dirty: false,
    activeHandle: null,
    opener: null,
    pageScrollY: 0,
    dragHandle: null,
    dragPointerId: null,
    dragTouchId: null,
    dragCaptureTarget: null,
    inputMode: null,
    dragStart: null,
    dragMoved: false,
    suppressClickUntil: 0,
    pdfBundle: null,
    pdfWarmTimer: null,
    pdfWarmIdle: null,
    layoutGesture: null,
    layoutScrollY: 0,
    pendingImport: null,
    cropDragFrame: null,
    cropDragClientPoint: null,
    cropPreviewTimer: null,
    cropPreviewLastAt: 0,
    cropDragPreviewSource: null
  };

  const documentEl = {
    identityModeBtn: document.querySelector("#identityModeBtn"),
    documentModeBtn: document.querySelector("#documentModeBtn"),
    identityModePanel: document.querySelector("#identityModePanel"),
    documentModePanel: document.querySelector("#documentModePanel"),
    privacyNotice: document.querySelector("#privacyNotice"),
    engineStatus: document.querySelector("#documentEngineStatus"),
    selectBtn: document.querySelector("#documentSelectBtn"),
    cameraBtn: document.querySelector("#documentCameraBtn"),
    imageInput: document.querySelector("#documentImageInput"),
    cameraInput: document.querySelector("#documentCameraInput"),
    dropZone: document.querySelector("#documentDropZone"),
    pageViewport: document.querySelector("#documentPageViewport"),
    pageItems: document.querySelector("#documentPageItems"),
    emptyPageAction: document.querySelector("#documentEmptyPageAction"),
    pageTabs: document.querySelector("#documentPageTabs"),
    previousPageBtn: document.querySelector("#documentPreviousPageBtn"),
    nextPageBtn: document.querySelector("#documentNextPageBtn"),
    addPageBtn: document.querySelector("#documentAddPageBtn"),
    deletePageBtn: document.querySelector("#documentDeletePageBtn"),
    statusLog: document.querySelector("#documentStatusLog"),
    inspector: document.querySelector("#documentInspector"),
    noSelection: document.querySelector("#documentNoSelection"),
    selectionControls: document.querySelector("#documentSelectionControls"),
    selectedName: document.querySelector("#documentSelectedName"),
    selectedStatus: document.querySelector("#documentSelectedStatus"),
    widthCm: document.querySelector("#documentWidthCm"),
    heightCm: document.querySelector("#documentHeightCm"),
    leftCm: document.querySelector("#documentLeftCm"),
    topCm: document.querySelector("#documentTopCm"),
    lockRatio: document.querySelector("#documentLockRatio"),
    pdfBtn: document.querySelector("#documentPdfBtn"),
    sharePdfBtn: document.querySelector("#documentSharePdfBtn"),
    cropDialog: document.querySelector("#documentCropDialog"),
    cropContext: document.querySelector("#documentCropContext"),
    cropStage: document.querySelector("#documentCropStage"),
    cropCanvas: document.querySelector("#documentCropCanvas"),
    cropOverlay: document.querySelector("#documentCropOverlay"),
    cropHint: document.querySelector("#documentCropHint"),
    cropCorrectionPreviewCanvas: document.querySelector("#documentCropCorrectionPreviewCanvas"),
    autoCropBtn: document.querySelector("#documentAutoCropBtn"),
    nextFrameBtn: document.querySelector("#documentNextFrameBtn"),
    rotateLeftBtn: document.querySelector("#documentRotateLeftBtn"),
    rotateRightBtn: document.querySelector("#documentRotateRightBtn"),
    rotate180Btn: document.querySelector("#documentRotate180Btn"),
    resetCropBtn: document.querySelector("#documentResetCropBtn"),
    applyCropBtn: document.querySelector("#documentApplyCropBtn"),
    discardPrompt: document.querySelector("#documentDiscardPrompt"),
    keepEditingBtn: document.querySelector("#documentKeepEditingBtn"),
    discardBtn: document.querySelector("#documentDiscardBtn")
  };

  const HANDLE_LABELS = ["左上角", "右上角", "右下角", "左下角"];
  const DOCUMENT_CROP_PREVIEW_INTERVAL_MS = 100;
  const DOCUMENT_CROP_DRAG_PREVIEW_MAX_EDGE = 900;
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;
  const DEFAULT_DOCUMENT_WIDTH_MM = 175;
  const DEFAULT_DOCUMENT_HEIGHT_MM = 248;

  function documentUid() {
    return `document-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
  }

  function createDocumentPage() {
    return { id: documentUid(), documents: [] };
  }

  function ensureDocumentPage() {
    if (!documentState.pages.length) {
      const page = createDocumentPage();
      documentState.pages.push(page);
      documentState.activePageId = page.id;
    }
    return activeDocumentPage();
  }

  function activeDocumentPage() {
    return documentState.pages.find((page) => page.id === documentState.activePageId) || documentState.pages[0] || null;
  }

  function allDocumentItems() {
    return documentState.pages.flatMap((page) => page.documents);
  }

  function findDocumentItem(itemId) {
    for (const page of documentState.pages) {
      const item = page.documents.find((documentItem) => documentItem.id === itemId);
      if (item) return { page, item };
    }
    if (documentState.pendingImport?.item.id === itemId) {
      return {
        page: documentState.pendingImport.page,
        item: documentState.pendingImport.item
      };
    }
    return { page: null, item: null };
  }

  function selectedDocumentItem() {
    return findDocumentItem(documentState.selectedItemId).item;
  }

  function documentLog(message) {
    const line = document.createElement("div");
    line.textContent = message;
    documentEl.statusLog.prepend(line);
  }

  function documentToast(message) {
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
    clearTimeout(documentToast.timer);
    documentToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function setMode(mode) {
    documentState.mode = mode;
    const isDocument = mode === "document";
    documentEl.identityModeBtn.classList.toggle("active", !isDocument);
    documentEl.documentModeBtn.classList.toggle("active", isDocument);
    documentEl.identityModeBtn.setAttribute("aria-pressed", String(!isDocument));
    documentEl.documentModeBtn.setAttribute("aria-pressed", String(isDocument));
    documentEl.identityModePanel.hidden = isDocument;
    documentEl.documentModePanel.hidden = !isDocument;
    documentEl.privacyNotice.textContent = isDocument
      ? "文件僅於本機瀏覽器處理，不會上傳或儲存。"
      : "證件僅於本機瀏覽器處理，不會上傳或儲存。";
    if (isDocument) renderDocumentEditor();
  }

  documentEl.identityModeBtn.addEventListener("click", () => setMode("identity"));
  documentEl.documentModeBtn.addEventListener("click", () => setMode("document"));

  function waitForDocumentCv() {
    return new Promise((resolve) => {
      const check = () => {
        if (window.cv?.Mat) {
          if (cv.getBuildInformation) resolve();
          else cv.onRuntimeInitialized = resolve;
        } else {
          setTimeout(check, 120);
        }
      };
      check();
    });
  }

  waitForDocumentCv().then(() => {
    documentState.cvReady = true;
    documentEl.engineStatus.textContent = "文件邊緣偵測已就緒";
    if (documentEl.cropDialog.open && documentState.cropPoints.length === 4) updateDocumentCropCorrectionPreview();
  }).catch(() => {
    documentEl.engineStatus.textContent = "影像引擎載入失敗，仍可人工裁切";
  });

  function cloneDocumentPoints(points) {
    return points.map((point) => ({ x: point.x, y: point.y }));
  }

  function normalizeDocumentRotation(rotation) {
    return ((rotation % 360) + 360) % 360;
  }

  function documentOrderPoints(points) {
    const center = points.reduce((sum, point) => ({
      x: sum.x + point.x / points.length,
      y: sum.y + point.y / points.length
    }), { x: 0, y: 0 });
    const sorted = points.slice().sort((a, b) =>
      Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x)
    );
    const start = sorted.reduce((best, point, index) =>
      point.x + point.y < sorted[best].x + sorted[best].y ? index : best, 0
    );
    return [...sorted.slice(start), ...sorted.slice(0, start)];
  }

  function documentDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function documentPolygonArea(points) {
    return Math.abs(points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2);
  }

  function documentQuadRatio(points) {
    const width = (documentDistance(points[0], points[1]) + documentDistance(points[3], points[2])) / 2;
    const height = (documentDistance(points[0], points[3]) + documentDistance(points[1], points[2])) / 2;
    return Math.max(width, height) / Math.max(1, Math.min(width, height));
  }

  function documentIsConvex(points) {
    let sign = 0;
    for (let index = 0; index < points.length; index += 1) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      const c = points[(index + 2) % points.length];
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (Math.abs(cross) < 1) continue;
      const current = Math.sign(cross);
      if (!sign) sign = current;
      if (sign !== current) return false;
    }
    return true;
  }

  function documentSegmentsIntersect(a, b, c, d) {
    const ccw = (p1, p2, p3) =>
      (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
    return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
  }

  function validDocumentQuad(points, canvas) {
    if (points.length !== 4 || points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return false;
    const margin = Math.max(canvas.width, canvas.height) * 0.08;
    if (points.some((point) => point.x < -margin || point.y < -margin || point.x > canvas.width + margin || point.y > canvas.height + margin)) return false;
    if (!documentIsConvex(points)) return false;
    if (documentSegmentsIntersect(points[0], points[1], points[2], points[3])) return false;
    if (documentSegmentsIntersect(points[1], points[2], points[3], points[0])) return false;
    const [tl, tr, br, bl] = points;
    if (!(tl.x < tr.x && bl.x < br.x && tl.y < bl.y && tr.y < br.y)) return false;
    const areaRatio = documentPolygonArea(points) / (canvas.width * canvas.height);
    const ratio = documentQuadRatio(points);
    return areaRatio >= 0.08 && ratio >= 1.03 && ratio <= 2.2;
  }

  function documentBounding(points) {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
  }

  function documentIntersectionRatio(a, b) {
    const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const intersection = width * height;
    const areaA = (a.right - a.left) * (a.bottom - a.top);
    const areaB = (b.right - b.left) * (b.bottom - b.top);
    return intersection / Math.max(1, Math.min(areaA, areaB));
  }

  function documentAngleScore(points) {
    let total = 0;
    points.forEach((point, index) => {
      const previous = points[(index + 3) % 4];
      const next = points[(index + 1) % 4];
      const ax = previous.x - point.x;
      const ay = previous.y - point.y;
      const bx = next.x - point.x;
      const by = next.y - point.y;
      const cosine = Math.abs((ax * bx + ay * by) / Math.max(1, Math.hypot(ax, ay) * Math.hypot(bx, by)));
      total += Math.max(0, 1 - cosine);
    });
    return total / 4;
  }

  function sampleDocumentEdgeCoverage(points, edgeMat, scale) {
    let hits = 0;
    let samples = 0;
    for (let side = 0; side < 4; side += 1) {
      const a = points[side];
      const b = points[(side + 1) % 4];
      const count = Math.max(18, Math.min(100, Math.round(documentDistance(a, b) * scale / 12)));
      for (let index = 0; index <= count; index += 1) {
        const progress = index / count;
        const x = Math.round((a.x + (b.x - a.x) * progress) * scale);
        const y = Math.round((a.y + (b.y - a.y) * progress) * scale);
        let found = false;
        for (let offsetY = -2; offsetY <= 2 && !found; offsetY += 1) {
          for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
            const px = Math.max(0, Math.min(edgeMat.cols - 1, x + offsetX));
            const py = Math.max(0, Math.min(edgeMat.rows - 1, y + offsetY));
            if (edgeMat.ucharPtr(py, px)[0] > 0) {
              found = true;
              break;
            }
          }
        }
        if (found) hits += 1;
        samples += 1;
      }
    }
    return samples ? hits / samples : 0;
  }

  function scoreDocumentCandidate(candidate, canvas) {
    const points = documentOrderPoints(candidate.points);
    if (!validDocumentQuad(points, canvas)) return null;
    const area = documentPolygonArea(points);
    const areaRatio = area / (canvas.width * canvas.height);
    const ratio = documentQuadRatio(points);
    const ratioScore = Math.max(0, 1 - Math.abs(ratio - Math.SQRT2) / 0.75);
    const bounds = documentBounding(points);
    const frameInsetX = canvas.width * 0.012;
    const frameInsetY = canvas.height * 0.012;
    const frameSides = [
      bounds.left <= frameInsetX,
      bounds.right >= canvas.width - frameInsetX,
      bounds.top <= frameInsetY,
      bounds.bottom >= canvas.height - frameInsetY
    ].filter(Boolean).length;
    // Thresholding often emits the source image boundary; it is not a detected sheet edge.
    if (areaRatio > 0.94 && frameSides >= 3) return null;
    const edgeDistance = (
      bounds.left / canvas.width
      + (canvas.width - bounds.right) / canvas.width
      + bounds.top / canvas.height
      + (canvas.height - bounds.bottom) / canvas.height
    ) / 4;
    const outerScore = Math.max(0, 1 - edgeDistance * 2.2);
    const coverage = Math.min(1, candidate.edgeCoverage || 0);
    const sourceBonus = candidate.source === "line" ? 0.28 : 0;
    const score = areaRatio * 6.2 + coverage * 2.4 + documentAngleScore(points) * 0.9 + ratioScore * 0.65 + outerScore * 0.8 + sourceBonus;
    return { ...candidate, points, area, areaRatio, ratio, score };
  }

  function documentLineIntersection(a, b) {
    const denominator = (a.x1 - a.x2) * (b.y1 - b.y2) - (a.y1 - a.y2) * (b.x1 - b.x2);
    if (Math.abs(denominator) < 0.001) return null;
    return {
      x: ((a.x1 * a.y2 - a.y1 * a.x2) * (b.x1 - b.x2) - (a.x1 - a.x2) * (b.x1 * b.y2 - b.y1 * b.x2)) / denominator,
      y: ((a.x1 * a.y2 - a.y1 * a.x2) * (b.y1 - b.y2) - (a.y1 - a.y2) * (b.x1 * b.y2 - b.y1 * b.x2)) / denominator
    };
  }

  function pickDocumentOuterLine(lines, side) {
    if (!lines.length) return null;
    return lines.slice().sort((a, b) => {
      const aMid = side === "top" || side === "bottom" ? (a.y1 + a.y2) / 2 : (a.x1 + a.x2) / 2;
      const bMid = side === "top" || side === "bottom" ? (b.y1 + b.y2) / 2 : (b.x1 + b.x2) / 2;
      const positional = side === "top" || side === "left" ? aMid - bMid : bMid - aMid;
      if (Math.abs(positional) > 18) return positional;
      return b.length - a.length;
    })[0];
  }

  function detectDocumentCandidates(canvas) {
    if (!documentState.cvReady) return [];
    const scale = Math.min(1, 1800 / Math.max(canvas.width, canvas.height));
    const work = document.createElement("canvas");
    work.width = Math.max(1, Math.round(canvas.width * scale));
    work.height = Math.max(1, Math.round(canvas.height * scale));
    work.getContext("2d").drawImage(canvas, 0, 0, work.width, work.height);
    const src = cv.imread(work);
    const gray = new cv.Mat();
    const blur = new cv.Mat();
    const edges = new cv.Mat();
    const threshold = new cv.Mat();
    const candidates = [];
    try {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
      cv.Canny(blur, edges, 24, 105);
      cv.adaptiveThreshold(blur, threshold, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 31, 7);
      const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
      cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
      cv.morphologyEx(threshold, threshold, cv.MORPH_CLOSE, kernel);
      kernel.delete();

      [edges, threshold].forEach((binary, passIndex) => {
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        try {
          cv.findContours(binary, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
          for (let index = 0; index < contours.size(); index += 1) {
            const contour = contours.get(index);
            const contourArea = Math.abs(cv.contourArea(contour));
            if (contourArea < work.width * work.height * 0.075) {
              contour.delete();
              continue;
            }
            const perimeter = cv.arcLength(contour, true);
            for (const epsilon of [0.015, 0.025, 0.04]) {
              const approximation = new cv.Mat();
              cv.approxPolyDP(contour, approximation, epsilon * perimeter, true);
              if (approximation.rows === 4 && cv.isContourConvex(approximation)) {
                const points = [];
                for (let pointIndex = 0; pointIndex < 4; pointIndex += 1) {
                  points.push({
                    x: approximation.intPtr(pointIndex, 0)[0] / scale,
                    y: approximation.intPtr(pointIndex, 0)[1] / scale
                  });
                }
                const ordered = documentOrderPoints(points);
                candidates.push({
                  points: ordered,
                  source: passIndex === 0 ? "edge-contour" : "adaptive-contour",
                  edgeCoverage: sampleDocumentEdgeCoverage(ordered, edges, scale)
                });
              }
              approximation.delete();
            }
            contour.delete();
          }
        } finally {
          contours.delete();
          hierarchy.delete();
        }
      });

      const lines = new cv.Mat();
      try {
        const minimumLength = Math.min(work.width, work.height) * 0.32;
        cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 55, minimumLength, 32);
        const horizontal = [];
        const vertical = [];
        for (let index = 0; index < lines.rows; index += 1) {
          const [x1, y1, x2, y2] = lines.intPtr(index, 0);
          const dx = x2 - x1;
          const dy = y2 - y1;
          const length = Math.hypot(dx, dy);
          const line = { x1: x1 / scale, y1: y1 / scale, x2: x2 / scale, y2: y2 / scale, length: length / scale };
          if (Math.abs(dy) <= Math.abs(dx) * 0.65) horizontal.push(line);
          if (Math.abs(dx) <= Math.abs(dy) * 0.65) vertical.push(line);
        }
        const top = pickDocumentOuterLine(horizontal, "top");
        const bottom = pickDocumentOuterLine(horizontal, "bottom");
        const left = pickDocumentOuterLine(vertical, "left");
        const right = pickDocumentOuterLine(vertical, "right");
        if (top && bottom && left && right) {
          const points = [
            documentLineIntersection(top, left),
            documentLineIntersection(top, right),
            documentLineIntersection(bottom, right),
            documentLineIntersection(bottom, left)
          ];
          if (points.every(Boolean)) {
            const ordered = documentOrderPoints(points);
            candidates.push({
              points: ordered,
              source: "line",
              edgeCoverage: sampleDocumentEdgeCoverage(ordered, edges, scale)
            });
          }
        }
      } finally {
        lines.delete();
      }
    } finally {
      src.delete();
      gray.delete();
      blur.delete();
      edges.delete();
      threshold.delete();
    }

    const ranked = candidates.map((candidate) => scoreDocumentCandidate(candidate, canvas)).filter(Boolean)
      .sort((a, b) => b.score - a.score);
    const unique = [];
    ranked.forEach((candidate) => {
      const duplicate = unique.some((existing) =>
        documentIntersectionRatio(documentBounding(candidate.points), documentBounding(existing.points)) > 0.82
        && Math.min(candidate.area, existing.area) / Math.max(candidate.area, existing.area) > 0.86
      );
      if (!duplicate && unique.length < 3) unique.push(candidate);
    });
    return unique;
  }

  function fullDocumentQuad(canvas) {
    return [
      { x: 0, y: 0 },
      { x: canvas.width, y: 0 },
      { x: canvas.width, y: canvas.height },
      { x: 0, y: canvas.height }
    ];
  }

  function normalizedDocumentPoints(points, width, height) {
    return points.map((point) => ({
      x: Math.max(0, Math.min(1, point.x / Math.max(1, width))),
      y: Math.max(0, Math.min(1, point.y / Math.max(1, height)))
    }));
  }

  function originalDocumentPoints(points, width, height) {
    return points.map((point) => ({ x: point.x * width, y: point.y * height }));
  }

  function originalToRotatedDocumentPoint(point, rotation, width, height) {
    if (rotation === 90) return { x: height - point.y, y: point.x };
    if (rotation === 180) return { x: width - point.x, y: height - point.y };
    if (rotation === 270) return { x: point.y, y: width - point.x };
    return { ...point };
  }

  function rotatedToOriginalDocumentPoint(point, rotation, width, height) {
    if (rotation === 90) return { x: point.y, y: height - point.x };
    if (rotation === 180) return { x: width - point.x, y: height - point.y };
    if (rotation === 270) return { x: width - point.y, y: point.x };
    return { ...point };
  }

  function normalizedToRotatedDocumentPoints(points, rotation, width, height) {
    return documentOrderPoints(originalDocumentPoints(points, width, height)
      .map((point) => originalToRotatedDocumentPoint(point, rotation, width, height)));
  }

  function rotatedToNormalizedDocumentPoints(points, rotation, width, height) {
    return normalizedDocumentPoints(
      points.map((point) => rotatedToOriginalDocumentPoint(point, rotation, width, height)),
      width,
      height
    );
  }

  function documentCanvasFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const image = new Image();
        image.onerror = reject;
        image.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth || image.width;
          canvas.height = image.naturalHeight || image.height;
          canvas.getContext("2d").drawImage(image, 0, 0);
          resolve(canvas);
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function cloneDocumentCanvas(source) {
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    canvas.getContext("2d").drawImage(source, 0, 0);
    return canvas;
  }

  function warpDocumentCanvas(sourceCanvas, inputPoints) {
    const points = documentOrderPoints(inputPoints);
    const measuredWidth = Math.max(documentDistance(points[0], points[1]), documentDistance(points[3], points[2]));
    const measuredHeight = Math.max(documentDistance(points[0], points[3]), documentDistance(points[1], points[2]));
    const scale = Math.min(1, 2400 / Math.max(measuredWidth, measuredHeight));
    const width = Math.max(240, Math.round(measuredWidth * scale));
    const height = Math.max(240, Math.round(measuredHeight * scale));
    if (!documentState.cvReady) return cloneDocumentCanvas(sourceCanvas);
    const source = cv.imread(sourceCanvas);
    const output = new cv.Mat();
    const sourcePoints = cv.matFromArray(4, 1, cv.CV_32FC2, points.flatMap((point) => [point.x, point.y]));
    const targetPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, width, 0, width, height, 0, height]);
    const matrix = cv.getPerspectiveTransform(sourcePoints, targetPoints);
    try {
      cv.warpPerspective(source, output, matrix, new cv.Size(width, height), cv.INTER_LINEAR, cv.BORDER_REPLICATE);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      cv.imshow(canvas, output);
      return canvas;
    } finally {
      source.delete();
      output.delete();
      sourcePoints.delete();
      targetPoints.delete();
      matrix.delete();
    }
  }

  function invalidateDocumentPdf() {
    if (documentState.pdfWarmTimer) {
      window.clearTimeout(documentState.pdfWarmTimer);
      documentState.pdfWarmTimer = null;
    }
    if (documentState.pdfWarmIdle && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(documentState.pdfWarmIdle);
      documentState.pdfWarmIdle = null;
    }
    if (documentState.pdfBundle?.objectUrl) URL.revokeObjectURL(documentState.pdfBundle.objectUrl);
    documentState.pdfBundle = null;
    if (allDocumentItems().length) {
      documentState.pdfWarmTimer = window.setTimeout(() => {
        documentState.pdfWarmTimer = null;
        const prepare = () => {
          documentState.pdfWarmIdle = null;
          try {
            buildDocumentPdfBundle();
          } catch (error) {
            console.error("Document PDF preparation failed.", error);
          }
        };
        if (typeof window.requestIdleCallback === "function") {
          documentState.pdfWarmIdle = window.requestIdleCallback(prepare, { timeout: 4000 });
        } else {
          prepare();
        }
      }, 1400);
    }
  }

  function setInitialDocumentLayout(item, page) {
    const correctedRatio = item.currentCanvas.width / Math.max(1, item.currentCanvas.height);
    let layoutWidthMm = DEFAULT_DOCUMENT_WIDTH_MM;
    let layoutHeightMm = layoutWidthMm / correctedRatio;
    if (layoutHeightMm > DEFAULT_DOCUMENT_HEIGHT_MM) {
      layoutHeightMm = DEFAULT_DOCUMENT_HEIGHT_MM;
      layoutWidthMm = layoutHeightMm * correctedRatio;
    }
    const cascadeOffset = (page.documents.length % 5) * 4.5;
    item.layout = {
      xMm: Math.min(A4_WIDTH_MM - layoutWidthMm, Math.max(0, (A4_WIDTH_MM - layoutWidthMm) / 2 + cascadeOffset)),
      yMm: Math.min(A4_HEIGHT_MM - layoutHeightMm, Math.max(0, (A4_HEIGHT_MM - layoutHeightMm) / 2 + cascadeOffset)),
      widthMm: layoutWidthMm,
      heightMm: layoutHeightMm,
      lockRatio: true
    };
  }

  function confirmInitialDocumentCrop(page, item, opener) {
    return new Promise((resolve) => {
      documentState.pendingImport = { page, item, resolve };
      openDocumentCrop(item.id, opener);
    });
  }

  async function importDocumentFiles(fileList) {
    const files = [...fileList].filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;
    documentLog(`開始處理 ${files.length} 張文件照片`);
    for (const file of files) {
      try {
        const sourceCanvas = await documentCanvasFromFile(file);
        const sourceDataUrl = sourceCanvas.toDataURL("image/jpeg", 0.94);
        const candidates = detectDocumentCandidates(sourceCanvas);
        const best = candidates[0];
        const points = best?.points || fullDocumentQuad(sourceCanvas);
        const currentCanvas = best ? warpDocumentCanvas(sourceCanvas, points) : cloneDocumentCanvas(sourceCanvas);
        const normalized = normalizedDocumentPoints(points, sourceCanvas.width, sourceCanvas.height);
        const page = ensureDocumentPage();
        const item = {
          id: documentUid(),
          name: file.name,
          sourceDataUrl,
          sourceCanvas,
          originalWidth: sourceCanvas.width,
          originalHeight: sourceCanvas.height,
          currentCanvas,
          currentDataUrl: currentCanvas.toDataURL("image/jpeg", 0.94),
          rotation: 0,
          initialCrop: { points: cloneDocumentPoints(normalized), rotation: 0 },
          lastAppliedCrop: { points: cloneDocumentPoints(normalized), rotation: 0 },
          candidates: candidates.map((candidate) => normalizedDocumentPoints(candidate.points, sourceCanvas.width, sourceCanvas.height)),
          candidateIndex: 0,
          autoDetected: Boolean(best),
          manuallyAdjusted: false,
          status: best ? "已自動裁切" : "建議手動調整",
          layout: null
        };
        const applied = await confirmInitialDocumentCrop(page, item, documentEl.selectBtn);
        documentLog(`${file.name}：${applied ? "已確認裁切並加入 A4" : "已取消新增"}`);
      } catch (error) {
        console.error("Document import failed.", error);
        documentLog(`${file.name} 處理失敗，已略過`);
      }
      renderDocumentEditor();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    invalidateDocumentPdf();
  }

  function escapeDocumentHtml(value) {
    const node = document.createElement("span");
    node.textContent = value;
    return node.innerHTML;
  }

  function renderDocumentEditor() {
    const page = ensureDocumentPage();
    documentEl.pageTabs.innerHTML = documentState.pages.map((documentPage, index) => `
      <button type="button" data-document-page-id="${documentPage.id}" class="${documentPage.id === page.id ? "active" : ""}" aria-pressed="${documentPage.id === page.id}">
        第 ${index + 1} 頁
      </button>
    `).join("");
    documentEl.pageItems.innerHTML = page.documents.map((item, index) => {
      const selected = item.id === documentState.selectedItemId;
      const layout = item.layout;
      return `
        <div class="document-layout-item ${selected ? "selected" : ""}" data-document-id="${item.id}"
          role="button" tabindex="0" aria-label="文件 ${index + 1}：${escapeDocumentHtml(item.name)}"
          style="left:${layout.xMm / A4_WIDTH_MM * 100}%;top:${layout.yMm / A4_HEIGHT_MM * 100}%;width:${layout.widthMm / A4_WIDTH_MM * 100}%;height:${layout.heightMm / A4_HEIGHT_MM * 100}%">
          <img src="${item.currentDataUrl}" alt="${escapeDocumentHtml(item.name)}">
          <span class="document-layout-item-label">文件 ${index + 1}</span>
          <span class="document-resize-handle nw" data-layout-resize="nw" aria-hidden="true"></span>
          <span class="document-resize-handle ne" data-layout-resize="ne" aria-hidden="true"></span>
          <span class="document-resize-handle se" data-layout-resize="se" aria-hidden="true"></span>
          <span class="document-resize-handle sw" data-layout-resize="sw" aria-hidden="true"></span>
        </div>
      `;
    }).join("");
    documentEl.emptyPageAction.hidden = page.documents.length > 0;
    documentEl.deletePageBtn.disabled = documentState.pages.length <= 1;
    const activePageIndex = documentState.pages.indexOf(page);
    documentEl.previousPageBtn.disabled = activePageIndex <= 0;
    documentEl.nextPageBtn.disabled = activePageIndex >= documentState.pages.length - 1;
    renderDocumentInspector();
    const hasDocuments = allDocumentItems().length > 0;
    documentEl.pdfBtn.disabled = !hasDocuments;
    documentEl.sharePdfBtn.disabled = !hasDocuments;
    documentEl.pdfBtn.textContent = /SamsungBrowser\//i.test(navigator.userAgent) ? "下載 PDF" : "產生 PDF";
  }

  function renderDocumentInspector() {
    const selected = selectedDocumentItem();
    const onActivePage = activeDocumentPage()?.documents.includes(selected);
    documentEl.noSelection.hidden = Boolean(selected && onActivePage);
    documentEl.selectionControls.hidden = !(selected && onActivePage);
    if (!selected || !onActivePage) return;
    documentEl.selectedName.textContent = selected.name;
    documentEl.selectedStatus.textContent = selected.status;
    documentEl.selectedStatus.classList.toggle("warn", !(selected.autoDetected || selected.manuallyAdjusted));
    documentEl.widthCm.value = (selected.layout.widthMm / 10).toFixed(1);
    documentEl.heightCm.value = (selected.layout.heightMm / 10).toFixed(1);
    documentEl.leftCm.value = (selected.layout.xMm / 10).toFixed(1);
    documentEl.topCm.value = (selected.layout.yMm / 10).toFixed(1);
    documentEl.lockRatio.checked = selected.layout.lockRatio;
  }

  function rotatedSourceCanvas(item, rotation = item.rotation) {
    const source = item.sourceCanvas;
    const rightAngle = rotation === 90 || rotation === 270;
    const canvas = document.createElement("canvas");
    canvas.width = rightAngle ? source.height : source.width;
    canvas.height = rightAngle ? source.width : source.height;
    const context = canvas.getContext("2d");
    if (rotation === 90) {
      context.translate(canvas.width, 0);
      context.rotate(Math.PI / 2);
    } else if (rotation === 180) {
      context.translate(canvas.width, canvas.height);
      context.rotate(Math.PI);
    } else if (rotation === 270) {
      context.translate(0, canvas.height);
      context.rotate(-Math.PI / 2);
    }
    context.drawImage(source, 0, 0);
    return canvas;
  }

  function refreshDocumentOutput(item) {
    const rotated = rotatedSourceCanvas(item, item.rotation);
    const points = normalizedToRotatedDocumentPoints(
      item.lastAppliedCrop.points,
      item.rotation,
      item.originalWidth,
      item.originalHeight
    );
    item.currentCanvas = warpDocumentCanvas(rotated, points);
    item.currentDataUrl = item.currentCanvas.toDataURL("image/jpeg", 0.94);
    if (item.layout?.lockRatio) {
      item.layout.heightMm = item.layout.widthMm / (item.currentCanvas.width / Math.max(1, item.currentCanvas.height));
      clampDocumentLayout(item);
    }
    invalidateDocumentPdf();
  }

  async function redetectDocumentItem(item, opener) {
    const candidates = detectDocumentCandidates(item.sourceCanvas);
    if (!candidates.length) {
      item.autoDetected = false;
      item.status = "建議手動調整";
      renderDocumentEditor();
      documentToast("未找到明確文件外框，請手動調整四角。");
      openDocumentCrop(item.id, opener);
      return;
    }
    const normalizedCandidates = candidates.map((candidate) =>
      normalizedDocumentPoints(candidate.points, item.originalWidth, item.originalHeight)
    );
    item.rotation = 0;
    item.lastAppliedCrop = { points: cloneDocumentPoints(normalizedCandidates[0]), rotation: 0 };
    item.candidates = normalizedCandidates;
    item.candidateIndex = 0;
    item.autoDetected = true;
    item.manuallyAdjusted = false;
    item.status = "已自動裁切";
    refreshDocumentOutput(item);
    renderDocumentEditor();
  }

  function clampDocumentLayout(item, preserveRatio = false) {
    const layout = item.layout;
    if (preserveRatio) {
      const width = Math.max(0.01, layout.widthMm);
      const height = Math.max(0.01, layout.heightMm);
      const shrinkScale = Math.min(1, A4_WIDTH_MM / width, A4_HEIGHT_MM / height);
      layout.widthMm = width * shrinkScale;
      layout.heightMm = height * shrinkScale;
      const growScale = Math.max(1, 10 / layout.widthMm, 10 / layout.heightMm);
      layout.widthMm = Math.min(A4_WIDTH_MM, layout.widthMm * growScale);
      layout.heightMm = Math.min(A4_HEIGHT_MM, layout.heightMm * growScale);
    } else {
      layout.widthMm = Math.min(A4_WIDTH_MM, Math.max(10, layout.widthMm));
      layout.heightMm = Math.min(A4_HEIGHT_MM, Math.max(10, layout.heightMm));
    }
    layout.xMm = Math.min(A4_WIDTH_MM - layout.widthMm, Math.max(0, layout.xMm));
    layout.yMm = Math.min(A4_HEIGHT_MM - layout.heightMm, Math.max(0, layout.yMm));
  }

  function updateDocumentLayoutElement(item) {
    const node = documentEl.pageItems.querySelector(`[data-document-id="${item.id}"]`);
    if (!node) return;
    node.style.left = `${item.layout.xMm / A4_WIDTH_MM * 100}%`;
    node.style.top = `${item.layout.yMm / A4_HEIGHT_MM * 100}%`;
    node.style.width = `${item.layout.widthMm / A4_WIDTH_MM * 100}%`;
    node.style.height = `${item.layout.heightMm / A4_HEIGHT_MM * 100}%`;
    if (item.id === documentState.selectedItemId) renderDocumentInspector();
  }

  function rotatePlacedDocument(item, degrees) {
    const centerX = item.layout.xMm + item.layout.widthMm / 2;
    const centerY = item.layout.yMm + item.layout.heightMm / 2;
    item.rotation = normalizeDocumentRotation(item.rotation + degrees);
    item.lastAppliedCrop.rotation = item.rotation;
    [item.layout.widthMm, item.layout.heightMm] = [item.layout.heightMm, item.layout.widthMm];
    item.layout.xMm = centerX - item.layout.widthMm / 2;
    item.layout.yMm = centerY - item.layout.heightMm / 2;
    item.status = "已旋轉";
    clampDocumentLayout(item);
    refreshDocumentOutput(item);
    renderDocumentEditor();
  }

  function deletePlacedDocument(item) {
    const found = findDocumentItem(item.id);
    if (!found.page) return;
    found.page.documents = found.page.documents.filter((documentItem) => documentItem.id !== item.id);
    if (documentState.selectedItemId === item.id) documentState.selectedItemId = null;
    invalidateDocumentPdf();
    renderDocumentEditor();
  }

  documentEl.pageTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-document-page-id]");
    if (!button) return;
    documentState.activePageId = button.dataset.documentPageId;
    documentState.selectedItemId = null;
    renderDocumentEditor();
  });

  function moveToDocumentPage(offset) {
    const currentIndex = documentState.pages.findIndex((page) => page.id === documentState.activePageId);
    const nextIndex = Math.min(documentState.pages.length - 1, Math.max(0, currentIndex + offset));
    if (nextIndex === currentIndex || nextIndex < 0) return;
    documentState.activePageId = documentState.pages[nextIndex].id;
    documentState.selectedItemId = null;
    renderDocumentEditor();
  }

  documentEl.previousPageBtn.addEventListener("click", () => moveToDocumentPage(-1));
  documentEl.nextPageBtn.addEventListener("click", () => moveToDocumentPage(1));

  documentEl.addPageBtn.addEventListener("click", () => {
    const page = createDocumentPage();
    documentState.pages.push(page);
    documentState.activePageId = page.id;
    documentState.selectedItemId = null;
    invalidateDocumentPdf();
    renderDocumentEditor();
  });

  documentEl.deletePageBtn.addEventListener("click", () => {
    if (documentState.pages.length <= 1) return;
    const page = activeDocumentPage();
    if (!page) return;
    if (page.documents.length && !window.confirm("刪除此頁及頁面內的所有文件？")) return;
    const index = documentState.pages.indexOf(page);
    documentState.pages = documentState.pages.filter((documentPage) => documentPage.id !== page.id);
    documentState.activePageId = documentState.pages[Math.min(index, documentState.pages.length - 1)].id;
    documentState.selectedItemId = null;
    invalidateDocumentPdf();
    renderDocumentEditor();
  });

  documentEl.pageItems.addEventListener("click", (event) => {
    const itemNode = event.target.closest("[data-document-id]");
    if (!itemNode || performance.now() < documentState.suppressClickUntil) return;
    documentState.selectedItemId = itemNode.dataset.documentId;
    renderDocumentEditor();
  });

  documentEl.pageItems.addEventListener("dblclick", (event) => {
    const itemNode = event.target.closest("[data-document-id]");
    if (itemNode) openDocumentCrop(itemNode.dataset.documentId, itemNode);
  });

  function lockDocumentLayoutScroll() {
    documentState.layoutScrollY = window.scrollY;
    document.body.style.top = `-${documentState.layoutScrollY}px`;
    document.body.classList.add("document-layout-dragging");
  }

  function unlockDocumentLayoutScroll() {
    if (!document.body.classList.contains("document-layout-dragging")) return;
    document.body.classList.remove("document-layout-dragging");
    document.body.style.top = "";
    window.scrollTo(0, documentState.layoutScrollY);
  }

  function beginDocumentLayoutGesture(target, clientX, clientY, inputMode, pointerId = null, touchId = null, lockScroll = false) {
    const itemNode = target.closest("[data-document-id]");
    if (!itemNode || documentState.layoutGesture) return;
    const item = findDocumentItem(itemNode.dataset.documentId).item;
    if (!item) return;
    documentState.selectedItemId = item.id;
    documentEl.pageItems.querySelectorAll(".document-layout-item.selected").forEach((node) => node.classList.remove("selected"));
    itemNode.classList.add("selected");
    const resize = target.closest("[data-layout-resize]")?.dataset.layoutResize || "move";
    documentState.layoutGesture = {
      inputMode,
      pointerId,
      touchId,
      target: itemNode,
      item,
      mode: resize,
      startX: clientX,
      startY: clientY,
      startLayout: { ...item.layout },
      ratio: item.layout.widthMm / Math.max(1, item.layout.heightMm),
      moved: false,
      scrollLocked: lockScroll
    };
    if (lockScroll) lockDocumentLayoutScroll();
    renderDocumentInspector();
  }

  function updateDocumentLayoutGestureFromClient(clientX, clientY) {
    const gesture = documentState.layoutGesture;
    if (!gesture) return;
    const pageRect = documentEl.dropZone.getBoundingClientRect();
    const dx = (clientX - gesture.startX) / Math.max(1, pageRect.width) * A4_WIDTH_MM;
    const dy = (clientY - gesture.startY) / Math.max(1, pageRect.height) * A4_HEIGHT_MM;
    if (Math.hypot(clientX - gesture.startX, clientY - gesture.startY) > 3) gesture.moved = true;
    const layout = gesture.item.layout;
    if (gesture.mode === "move") {
      layout.xMm = gesture.startLayout.xMm + dx;
      layout.yMm = gesture.startLayout.yMm + dy;
    } else {
      const fromLeft = gesture.mode === "nw" || gesture.mode === "sw";
      const fromTop = gesture.mode === "nw" || gesture.mode === "ne";
      let width = gesture.startLayout.widthMm + (fromLeft ? -dx : dx);
      let height = gesture.startLayout.heightMm + (fromTop ? -dy : dy);
      const maxWidth = fromLeft
        ? gesture.startLayout.xMm + gesture.startLayout.widthMm
        : A4_WIDTH_MM - gesture.startLayout.xMm;
      const maxHeight = fromTop
        ? gesture.startLayout.yMm + gesture.startLayout.heightMm
        : A4_HEIGHT_MM - gesture.startLayout.yMm;
      if (layout.lockRatio) {
        if (Math.abs(dy) > Math.abs(dx)) width = height * gesture.ratio;
        else height = width / gesture.ratio;
        const scale = Math.min(1, maxWidth / Math.max(0.01, width), maxHeight / Math.max(0.01, height));
        width *= scale;
        height *= scale;
      } else {
        width = Math.min(maxWidth, width);
        height = Math.min(maxHeight, height);
      }
      layout.widthMm = width;
      layout.heightMm = height;
      if (fromLeft) layout.xMm = gesture.startLayout.xMm + gesture.startLayout.widthMm - width;
      else layout.xMm = gesture.startLayout.xMm;
      if (fromTop) layout.yMm = gesture.startLayout.yMm + gesture.startLayout.heightMm - height;
      else layout.yMm = gesture.startLayout.yMm;
    }
    clampDocumentLayout(gesture.item, layout.lockRatio && gesture.mode !== "move");
    updateDocumentLayoutElement(gesture.item);
  }

  function finishDocumentLayoutGesture() {
    const gesture = documentState.layoutGesture;
    if (!gesture) return;
    if (gesture.moved) documentState.suppressClickUntil = performance.now() + 450;
    documentState.layoutGesture = null;
    if (gesture.scrollLocked) unlockDocumentLayoutScroll();
    invalidateDocumentPdf();
    renderDocumentEditor();
  }

  function startDocumentLayoutGesture(event) {
    if (!event.target.closest("[data-document-id]")) return;
    event.preventDefault();
    event.stopPropagation();
    beginDocumentLayoutGesture(
      event.target,
      event.clientX,
      event.clientY,
      "pointer",
      event.pointerId,
      null,
      event.pointerType === "touch"
    );
    const gesture = documentState.layoutGesture;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    try { gesture.target.setPointerCapture(event.pointerId); } catch (_) { /* Synthetic events do not capture. */ }
  }

  function updateDocumentLayoutGesture(event) {
    const gesture = documentState.layoutGesture;
    if (!gesture || gesture.inputMode !== "pointer" || event.pointerId !== gesture.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    updateDocumentLayoutGestureFromClient(event.clientX, event.clientY);
  }

  function endDocumentLayoutGesture(event) {
    const gesture = documentState.layoutGesture;
    if (!gesture || gesture.inputMode !== "pointer" || event.pointerId !== gesture.pointerId) return;
    event.preventDefault();
    try {
      if (gesture.target.hasPointerCapture(event.pointerId)) gesture.target.releasePointerCapture(event.pointerId);
    } catch (_) { /* Capture may already be released. */ }
    finishDocumentLayoutGesture();
  }

  function findLayoutTouch(event, touchId) {
    return [...event.changedTouches, ...event.touches].find((touch) => touch.identifier === touchId) || null;
  }

  documentEl.pageItems.addEventListener("touchstart", (event) => {
    const itemNode = event.target.closest("[data-document-id]");
    if (!itemNode) return;
    event.preventDefault();
    event.stopPropagation();
    if (documentState.layoutGesture) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    beginDocumentLayoutGesture(event.target, touch.clientX, touch.clientY, "touch", null, touch.identifier, true);
  }, { passive: false });

  documentEl.pageItems.addEventListener("touchmove", (event) => {
    const gesture = documentState.layoutGesture;
    if (!gesture || gesture.inputMode !== "touch") return;
    const touch = findLayoutTouch(event, gesture.touchId);
    if (!touch) return;
    event.preventDefault();
    event.stopPropagation();
    updateDocumentLayoutGestureFromClient(touch.clientX, touch.clientY);
  }, { passive: false });

  ["touchend", "touchcancel"].forEach((type) => documentEl.pageItems.addEventListener(type, (event) => {
    const gesture = documentState.layoutGesture;
    if (!gesture || gesture.inputMode !== "touch") return;
    if (!findLayoutTouch(event, gesture.touchId)) return;
    event.preventDefault();
    event.stopPropagation();
    finishDocumentLayoutGesture();
  }, { passive: false }));

  documentEl.pageItems.addEventListener("pointerdown", startDocumentLayoutGesture, { passive: false });
  documentEl.pageItems.addEventListener("pointermove", updateDocumentLayoutGesture, { passive: false });
  documentEl.pageItems.addEventListener("pointerup", endDocumentLayoutGesture, { passive: false });
  documentEl.pageItems.addEventListener("pointercancel", endDocumentLayoutGesture, { passive: false });

  documentEl.pageItems.addEventListener("keydown", (event) => {
    const itemNode = event.target.closest("[data-document-id]");
    if (!itemNode) return;
    const item = findDocumentItem(itemNode.dataset.documentId).item;
    if (!item) return;
    if (event.key === "Enter") {
      event.preventDefault();
      openDocumentCrop(item.id, itemNode);
      return;
    }
    const delta = event.shiftKey ? 5 : 1;
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "ArrowLeft") item.layout.xMm -= delta;
    if (event.key === "ArrowRight") item.layout.xMm += delta;
    if (event.key === "ArrowUp") item.layout.yMm -= delta;
    if (event.key === "ArrowDown") item.layout.yMm += delta;
    clampDocumentLayout(item, item.layout.lockRatio);
    invalidateDocumentPdf();
    updateDocumentLayoutElement(item);
  });

  documentEl.inspector.addEventListener("click", (event) => {
    const quickLayoutButton = event.target.closest("[data-document-quick-layout]");
    const item = selectedDocumentItem();
    if (quickLayoutButton && item) {
      const action = quickLayoutButton.dataset.documentQuickLayout;
      if (action === "horizontal" || action === "center") item.layout.xMm = (A4_WIDTH_MM - item.layout.widthMm) / 2;
      if (action === "vertical" || action === "center") item.layout.yMm = (A4_HEIGHT_MM - item.layout.heightMm) / 2;
      if (action === "fit") {
        const marginMm = 10;
        const availableWidth = A4_WIDTH_MM - marginMm * 2;
        const availableHeight = A4_HEIGHT_MM - marginMm * 2;
        const ratio = item.currentCanvas.width / Math.max(1, item.currentCanvas.height);
        let widthMm = availableWidth;
        let heightMm = widthMm / ratio;
        if (heightMm > availableHeight) {
          heightMm = availableHeight;
          widthMm = heightMm * ratio;
        }
        item.layout.widthMm = widthMm;
        item.layout.heightMm = heightMm;
        item.layout.xMm = (A4_WIDTH_MM - widthMm) / 2;
        item.layout.yMm = (A4_HEIGHT_MM - heightMm) / 2;
      }
      clampDocumentLayout(item);
      invalidateDocumentPdf();
      updateDocumentLayoutElement(item);
      return;
    }
    const button = event.target.closest("[data-selected-document-action]");
    if (!button || !item) return;
    const action = button.dataset.selectedDocumentAction;
    if (action === "crop") openDocumentCrop(item.id, button);
    if (action === "redetect") void redetectDocumentItem(item, button);
    if (action === "rotate-left") rotatePlacedDocument(item, -90);
    if (action === "rotate-right") rotatePlacedDocument(item, 90);
    if (action === "delete") deletePlacedDocument(item);
  });

  function applyDocumentSizeInput(changedAxis) {
    const item = selectedDocumentItem();
    if (!item) return;
    const width = Number(documentEl.widthCm.value);
    const height = Number(documentEl.heightCm.value);
    const ratio = item.layout.widthMm / Math.max(1, item.layout.heightMm);
    if (changedAxis === "width" && Number.isFinite(width)) {
      item.layout.widthMm = width * 10;
      if (item.layout.lockRatio) item.layout.heightMm = item.layout.widthMm / ratio;
    }
    if (changedAxis === "height" && Number.isFinite(height)) {
      item.layout.heightMm = height * 10;
      if (item.layout.lockRatio) item.layout.widthMm = item.layout.heightMm * ratio;
    }
    clampDocumentLayout(item, item.layout.lockRatio);
    invalidateDocumentPdf();
    updateDocumentLayoutElement(item);
  }

  documentEl.widthCm.addEventListener("input", () => applyDocumentSizeInput("width"));
  documentEl.heightCm.addEventListener("input", () => applyDocumentSizeInput("height"));
  function applyDocumentPositionInput(axis) {
    const item = selectedDocumentItem();
    if (!item) return;
    const value = Number(axis === "x" ? documentEl.leftCm.value : documentEl.topCm.value);
    if (!Number.isFinite(value)) return;
    if (axis === "x") item.layout.xMm = value * 10;
    else item.layout.yMm = value * 10;
    clampDocumentLayout(item);
    invalidateDocumentPdf();
    updateDocumentLayoutElement(item);
  }

  documentEl.leftCm.addEventListener("input", () => applyDocumentPositionInput("x"));
  documentEl.topCm.addEventListener("input", () => applyDocumentPositionInput("y"));
  documentEl.lockRatio.addEventListener("change", () => {
    const item = selectedDocumentItem();
    if (!item) return;
    item.layout.lockRatio = documentEl.lockRatio.checked;
    invalidateDocumentPdf();
  });

  function openDocumentPicker(input) {
    input.value = "";
    input.click();
  }

  documentEl.selectBtn.addEventListener("click", () => openDocumentPicker(documentEl.imageInput));
  documentEl.cameraBtn.addEventListener("click", () => openDocumentPicker(documentEl.cameraInput));
  documentEl.emptyPageAction.addEventListener("click", () => openDocumentPicker(documentEl.imageInput));
  documentEl.imageInput.addEventListener("change", () => void importDocumentFiles(documentEl.imageInput.files));
  documentEl.cameraInput.addEventListener("change", () => void importDocumentFiles(documentEl.cameraInput.files));
  ["dragenter", "dragover"].forEach((type) => documentEl.dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    documentEl.dropZone.classList.add("drag-over");
  }));
  ["dragleave", "drop"].forEach((type) => documentEl.dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    documentEl.dropZone.classList.remove("drag-over");
  }));
  documentEl.dropZone.addEventListener("drop", (event) => void importDocumentFiles(event.dataTransfer.files));

  function lockDocumentBackground() {
    if (document.body.classList.contains("document-crop-modal-open")) return;
    documentState.pageScrollY = window.scrollY;
    document.body.style.top = `-${documentState.pageScrollY}px`;
    document.body.classList.add("document-crop-modal-open");
  }

  function unlockDocumentBackground() {
    if (!document.body.classList.contains("document-crop-modal-open")) return;
    const scrollY = documentState.pageScrollY;
    document.body.classList.remove("document-crop-modal-open", "crop-handle-dragging");
    document.body.style.top = "";
    window.scrollTo(0, scrollY);
  }

  function drawDocumentCropSource(item, rotation) {
    const source = rotatedSourceCanvas(item, rotation);
    documentEl.cropCanvas.width = source.width;
    documentEl.cropCanvas.height = source.height;
    documentEl.cropCanvas.getContext("2d").drawImage(source, 0, 0);
    documentState.cropDragPreviewSource = null;
  }

  function openDocumentCrop(itemId, opener = document.activeElement) {
    const { page, item } = findDocumentItem(itemId);
    if (!item) return;
    documentState.activeId = itemId;
    documentState.opener = opener;
    documentState.rotation = normalizeDocumentRotation(item.lastAppliedCrop.rotation || 0);
    documentState.openSnapshot = {
      points: cloneDocumentPoints(item.lastAppliedCrop.points),
      rotation: documentState.rotation
    };
    documentState.initialSnapshot = {
      points: cloneDocumentPoints(item.initialCrop.points),
      rotation: normalizeDocumentRotation(item.initialCrop.rotation || 0)
    };
    documentState.dirty = false;
    documentState.activeHandle = null;
    documentState.cropCandidates = [cloneDocumentPoints(item.lastAppliedCrop.points)];
    item.candidates.forEach((candidate) => {
      if (documentState.cropCandidates.length >= 3) return;
      const duplicate = documentState.cropCandidates.some((saved) => saved.every((point, index) =>
        Math.abs(point.x - candidate[index].x) < 0.00001 && Math.abs(point.y - candidate[index].y) < 0.00001
      ));
      if (!duplicate) documentState.cropCandidates.push(cloneDocumentPoints(candidate));
    });
    documentState.candidateIndex = 0;
    drawDocumentCropSource(item, documentState.rotation);
    documentState.cropPoints = normalizedToRotatedDocumentPoints(
      item.lastAppliedCrop.points,
      documentState.rotation,
      item.originalWidth,
      item.originalHeight
    );
    const pending = documentState.pendingImport?.item.id === item.id;
    const documentNumber = pending ? page.documents.length + 1 : page.documents.indexOf(item) + 1;
    documentEl.cropContext.textContent = `第 ${documentState.pages.indexOf(page) + 1} 頁｜文件 ${documentNumber}｜${item.name}`;
    documentEl.discardPrompt.hidden = true;
    lockDocumentBackground();
    documentEl.cropDialog.showModal();
    requestAnimationFrame(() => {
      fitDocumentOverlay();
      drawDocumentOverlay();
      updateDocumentCropCorrectionPreview();
      updateDocumentCandidateButton();
      updateDocumentCropHint();
      documentEl.applyCropBtn.focus();
    });
  }

  function fitDocumentOverlay() {
    const rect = documentEl.cropCanvas.getBoundingClientRect();
    documentEl.cropOverlay.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
  }

  function documentDisplayPoint(point) {
    const rect = documentEl.cropCanvas.getBoundingClientRect();
    return {
      x: point.x * rect.width / documentEl.cropCanvas.width,
      y: point.y * rect.height / documentEl.cropCanvas.height
    };
  }

  function documentImagePoint(clientX, clientY) {
    const rect = documentEl.cropCanvas.getBoundingClientRect();
    return {
      x: Math.min(documentEl.cropCanvas.width, Math.max(0, (clientX - rect.left) * documentEl.cropCanvas.width / rect.width)),
      y: Math.min(documentEl.cropCanvas.height, Math.max(0, (clientY - rect.top) * documentEl.cropCanvas.height / rect.height))
    };
  }

  function drawDocumentOverlay() {
    const rect = documentEl.cropCanvas.getBoundingClientRect();
    const stageRect = documentEl.cropStage.getBoundingClientRect();
    documentEl.cropOverlay.style.left = `${rect.left - stageRect.left}px`;
    documentEl.cropOverlay.style.top = `${rect.top - stageRect.top}px`;
    documentEl.cropOverlay.style.width = `${rect.width}px`;
    documentEl.cropOverlay.style.height = `${rect.height}px`;
    const points = documentState.cropPoints.map(documentDisplayPoint);
    if (documentEl.cropOverlay.querySelectorAll(".document-handle").length !== 4) {
      documentEl.cropOverlay.innerHTML = `
        <polygon fill="rgba(17,97,93,.18)" stroke="#30c2b3" stroke-width="2"></polygon>
        ${points.map((point, index) => `
          <g class="handle document-handle" data-index="${index}" tabindex="0" role="slider" aria-label="${HANDLE_LABELS[index]}">
            <circle class="handle-hit" r="22"></circle>
            <circle class="handle-dot" r="9" fill="#fff" stroke="#11615d" stroke-width="3"></circle>
          </g>
        `).join("")}`;
    }
    documentEl.cropOverlay.querySelector("polygon").setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
    documentEl.cropOverlay.querySelectorAll(".document-handle").forEach((handle, index) => {
      handle.setAttribute("transform", `translate(${points[index].x} ${points[index].y})`);
      handle.setAttribute("aria-valuetext", `x ${Math.round(documentState.cropPoints[index].x)}，y ${Math.round(documentState.cropPoints[index].y)}`);
      handle.classList.toggle("active", documentState.activeHandle === index);
    });
  }

  function ensureDocumentCropDragPreviewSource() {
    const source = documentEl.cropCanvas;
    const scale = Math.min(1, DOCUMENT_CROP_DRAG_PREVIEW_MAX_EDGE / Math.max(source.width, source.height));
    if (!documentState.cropDragPreviewSource) {
      const previewSource = document.createElement("canvas");
      previewSource.width = Math.max(1, Math.round(source.width * scale));
      previewSource.height = Math.max(1, Math.round(source.height * scale));
      previewSource.getContext("2d").drawImage(source, 0, 0, previewSource.width, previewSource.height);
      documentState.cropDragPreviewSource = previewSource;
    }
    return { source: documentState.cropDragPreviewSource, scale };
  }

  function documentCropDragPreviewInput() {
    const { source, scale } = ensureDocumentCropDragPreviewSource();
    return {
      source,
      points: documentState.cropPoints.map((point) => ({ x: point.x * scale, y: point.y * scale }))
    };
  }

  function updateDocumentCropCorrectionPreview(useDragPreview = false) {
    const input = useDragPreview
      ? documentCropDragPreviewInput()
      : { source: documentEl.cropCanvas, points: documentState.cropPoints };
    const output = warpDocumentCanvas(input.source, input.points);
    const preview = documentEl.cropCorrectionPreviewCanvas;
    preview.width = output.width;
    preview.height = output.height;
    const context = preview.getContext("2d");
    context.clearRect(0, 0, preview.width, preview.height);
    context.drawImage(output, 0, 0);
  }

  function updateDocumentCropHint() {
    const label = HANDLE_LABELS[documentState.activeHandle];
    const prefix = label ? `目前：${label}｜` : "";
    documentEl.cropHint.querySelector(".keyboard-crop-hint").textContent = `${prefix}使用方向鍵微調，Shift＋方向鍵快速移動`;
    documentEl.cropHint.querySelector(".touch-crop-hint").textContent = `${prefix}拖曳四角調整文件範圍`;
  }

  function setActiveDocumentHandle(index, focus = false) {
    documentState.activeHandle = index;
    documentEl.cropOverlay.querySelectorAll(".document-handle").forEach((handle, handleIndex) =>
      handle.classList.toggle("active", handleIndex === index)
    );
    updateDocumentCropHint();
    if (focus) documentEl.cropOverlay.querySelector(`.document-handle[data-index="${index}"]`)?.focus({ preventScroll: true });
  }

  function setDocumentDragging(active) {
    documentEl.cropDialog.classList.toggle("crop-dragging", active);
    documentEl.cropStage.classList.toggle("crop-dragging", active);
    document.body.classList.toggle("crop-handle-dragging", active);
  }

  function cancelDocumentCropDragUpdates() {
    if (documentState.cropDragFrame !== null) cancelAnimationFrame(documentState.cropDragFrame);
    if (documentState.cropPreviewTimer !== null) window.clearTimeout(documentState.cropPreviewTimer);
    documentState.cropDragFrame = null;
    documentState.cropDragClientPoint = null;
    documentState.cropPreviewTimer = null;
  }

  function clearDocumentDrag(pointerId = documentState.dragPointerId) {
    const captureTarget = documentState.dragCaptureTarget;
    cancelDocumentCropDragUpdates();
    documentState.dragHandle = null;
    documentState.dragPointerId = null;
    documentState.dragTouchId = null;
    documentState.dragCaptureTarget = null;
    documentState.inputMode = null;
    documentState.dragStart = null;
    setDocumentDragging(false);
    if (captureTarget && pointerId !== null) {
      try {
        if (captureTarget.hasPointerCapture(pointerId)) captureTarget.releasePointerCapture(pointerId);
      } catch (_) {
        // Capture may already be released by the browser.
      }
    }
  }

  function scheduleDocumentCropDragPreview() {
    if (documentState.cropPreviewTimer !== null) return;
    const elapsed = performance.now() - documentState.cropPreviewLastAt;
    const delay = Math.max(0, DOCUMENT_CROP_PREVIEW_INTERVAL_MS - elapsed);
    documentState.cropPreviewTimer = window.setTimeout(() => {
      documentState.cropPreviewTimer = null;
      if (documentState.dragHandle === null) return;
      documentState.cropPreviewLastAt = performance.now();
      updateDocumentCropCorrectionPreview(true);
    }, delay);
  }

  function renderDocumentDraggedPoint(clientX, clientY, schedulePreview = true) {
    if (documentState.dragHandle === null) return;
    documentState.cropPoints[documentState.dragHandle] = documentImagePoint(clientX, clientY);
    documentState.dirty = true;
    drawDocumentOverlay();
    if (schedulePreview) scheduleDocumentCropDragPreview();
  }

  function updateDocumentDraggedPoint(clientX, clientY) {
    if (documentState.dragHandle === null) return;
    if (documentState.dragStart && Math.hypot(clientX - documentState.dragStart.x, clientY - documentState.dragStart.y) > 4) {
      documentState.dragMoved = true;
    }
    documentState.cropDragClientPoint = { x: clientX, y: clientY };
    if (documentState.cropDragFrame !== null) return;
    documentState.cropDragFrame = requestAnimationFrame(() => {
      documentState.cropDragFrame = null;
      const point = documentState.cropDragClientPoint;
      documentState.cropDragClientPoint = null;
      if (point) renderDocumentDraggedPoint(point.x, point.y);
    });
  }

  function flushDocumentCropDragPreview() {
    if (documentState.cropDragFrame !== null) cancelAnimationFrame(documentState.cropDragFrame);
    documentState.cropDragFrame = null;
    const point = documentState.cropDragClientPoint;
    documentState.cropDragClientPoint = null;
    if (point) renderDocumentDraggedPoint(point.x, point.y, false);
    if (documentState.cropPreviewTimer !== null) window.clearTimeout(documentState.cropPreviewTimer);
    documentState.cropPreviewTimer = null;
    updateDocumentCropCorrectionPreview();
    documentState.cropPreviewLastAt = performance.now();
  }

  function blockDocumentTouch(event) {
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
  }

  [documentEl.cropCanvas, documentEl.cropStage].forEach((surface) => {
    surface.addEventListener("touchstart", blockDocumentTouch, { passive: false });
    surface.addEventListener("touchmove", blockDocumentTouch, { passive: false });
  });

  documentEl.cropOverlay.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest?.(".document-handle");
    if (!handle || documentState.inputMode === "touch" || documentState.dragHandle !== null) return;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    documentState.inputMode = "pointer";
    documentState.dragHandle = Number(handle.dataset.index);
    documentState.dragPointerId = event.pointerId;
    documentState.dragCaptureTarget = handle;
    documentState.dragStart = { x: event.clientX, y: event.clientY };
    documentState.dragMoved = false;
    documentState.cropPreviewLastAt = 0;
    ensureDocumentCropDragPreviewSource();
    setActiveDocumentHandle(documentState.dragHandle, event.pointerType !== "touch");
    setDocumentDragging(true);
    try { handle.setPointerCapture(event.pointerId); } catch (_) { /* Synthetic input has no capture. */ }
  }, { passive: false });

  documentEl.cropOverlay.addEventListener("pointermove", (event) => {
    if (documentState.inputMode !== "pointer" || event.pointerId !== documentState.dragPointerId) return;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    updateDocumentDraggedPoint(event.clientX, event.clientY);
  }, { passive: false });

  function endDocumentPointer(event) {
    if (documentState.inputMode !== "pointer" || event.pointerId !== documentState.dragPointerId) return;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    updateDocumentDraggedPoint(event.clientX, event.clientY);
    flushDocumentCropDragPreview();
    if (documentState.dragMoved) documentState.suppressClickUntil = performance.now() + 500;
    clearDocumentDrag(event.pointerId);
  }

  documentEl.cropOverlay.addEventListener("pointerup", endDocumentPointer);
  documentEl.cropOverlay.addEventListener("pointercancel", endDocumentPointer);
  documentEl.cropOverlay.addEventListener("lostpointercapture", () => {
    if (documentState.inputMode === "pointer") {
      flushDocumentCropDragPreview();
      clearDocumentDrag();
    }
  });

  documentEl.cropOverlay.addEventListener("touchstart", (event) => {
    blockDocumentTouch(event);
    const handle = event.target.closest?.(".document-handle");
    if (!handle || documentState.inputMode === "pointer" || documentState.dragHandle !== null) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    documentState.inputMode = "touch";
    documentState.dragHandle = Number(handle.dataset.index);
    documentState.dragTouchId = touch.identifier;
    documentState.dragStart = { x: touch.clientX, y: touch.clientY };
    documentState.dragMoved = false;
    documentState.cropPreviewLastAt = 0;
    ensureDocumentCropDragPreviewSource();
    setActiveDocumentHandle(documentState.dragHandle);
    setDocumentDragging(true);
  }, { passive: false });

  documentEl.cropOverlay.addEventListener("touchmove", (event) => {
    blockDocumentTouch(event);
    if (documentState.inputMode !== "touch" || documentState.dragHandle === null) return;
    const touch = Array.from(event.touches).find((item) => item.identifier === documentState.dragTouchId);
    if (touch) updateDocumentDraggedPoint(touch.clientX, touch.clientY);
  }, { passive: false });

  function endDocumentTouch(event) {
    blockDocumentTouch(event);
    if (documentState.inputMode !== "touch" || documentState.dragHandle === null) return;
    const ended = event.type === "touchcancel"
      || Array.from(event.changedTouches).some((touch) => touch.identifier === documentState.dragTouchId);
    if (!ended) return;
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === documentState.dragTouchId);
    if (touch) updateDocumentDraggedPoint(touch.clientX, touch.clientY);
    flushDocumentCropDragPreview();
    if (documentState.dragMoved) documentState.suppressClickUntil = performance.now() + 500;
    clearDocumentDrag(null);
  }

  documentEl.cropOverlay.addEventListener("touchend", endDocumentTouch, { passive: false });
  documentEl.cropOverlay.addEventListener("touchcancel", endDocumentTouch, { passive: false });
  documentEl.cropOverlay.addEventListener("click", (event) => {
    if (performance.now() > documentState.suppressClickUntil) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    documentState.suppressClickUntil = 0;
  }, true);
  documentEl.cropOverlay.addEventListener("focusin", (event) => {
    const handle = event.target.closest(".document-handle");
    if (handle) setActiveDocumentHandle(Number(handle.dataset.index));
  });

  function updateDocumentCandidateButton() {
    documentEl.nextFrameBtn.hidden = documentState.cropCandidates.length < 2;
  }

  function setDocumentCandidate(index) {
    const item = findDocumentItem(documentState.activeId).item;
    if (!item || !documentState.cropCandidates.length) return;
    documentState.candidateIndex = ((index % documentState.cropCandidates.length) + documentState.cropCandidates.length) % documentState.cropCandidates.length;
    documentState.cropPoints = normalizedToRotatedDocumentPoints(
      documentState.cropCandidates[documentState.candidateIndex],
      documentState.rotation,
      item.originalWidth,
      item.originalHeight
    );
    documentState.dirty = true;
    drawDocumentOverlay();
    updateDocumentCropCorrectionPreview();
  }

  documentEl.nextFrameBtn.addEventListener("click", () => setDocumentCandidate(documentState.candidateIndex + 1));

  documentEl.autoCropBtn.addEventListener("click", () => {
    const item = findDocumentItem(documentState.activeId).item;
    if (!item) return;
    const candidates = detectDocumentCandidates(item.sourceCanvas);
    if (!candidates.length) {
      documentToast("未找到明確文件外框，可直接拖曳四角調整。");
      return;
    }
    documentState.rotation = 0;
    drawDocumentCropSource(item, 0);
    documentState.cropCandidates = candidates.map((candidate) =>
      normalizedDocumentPoints(candidate.points, item.originalWidth, item.originalHeight)
    );
    documentState.candidateIndex = 0;
    documentState.cropPoints = cloneDocumentPoints(candidates[0].points);
    documentState.dirty = true;
    fitDocumentOverlay();
    drawDocumentOverlay();
    updateDocumentCropCorrectionPreview();
    updateDocumentCandidateButton();
  });

  async function rotateDocumentCrop(degrees) {
    const item = findDocumentItem(documentState.activeId).item;
    if (!item) return;
    const normalizedCrop = rotatedToNormalizedDocumentPoints(
      documentState.cropPoints,
      documentState.rotation,
      item.originalWidth,
      item.originalHeight
    );
    documentState.rotation = normalizeDocumentRotation(documentState.rotation + degrees);
    drawDocumentCropSource(item, documentState.rotation);
    documentState.cropPoints = normalizedToRotatedDocumentPoints(
      normalizedCrop,
      documentState.rotation,
      item.originalWidth,
      item.originalHeight
    );
    documentState.dirty = true;
    fitDocumentOverlay();
    drawDocumentOverlay();
    updateDocumentCropCorrectionPreview();
  }

  documentEl.rotateLeftBtn.addEventListener("click", () => void rotateDocumentCrop(-90));
  documentEl.rotateRightBtn.addEventListener("click", () => void rotateDocumentCrop(90));
  documentEl.rotate180Btn.addEventListener("click", () => void rotateDocumentCrop(180));
  documentEl.resetCropBtn.addEventListener("click", () => {
    const item = findDocumentItem(documentState.activeId).item;
    if (!item) return;
    documentState.rotation = documentState.initialSnapshot.rotation;
    drawDocumentCropSource(item, documentState.rotation);
    documentState.cropPoints = normalizedToRotatedDocumentPoints(
      documentState.initialSnapshot.points,
      documentState.rotation,
      item.originalWidth,
      item.originalHeight
    );
    documentState.dirty = true;
    fitDocumentOverlay();
    drawDocumentOverlay();
    updateDocumentCropCorrectionPreview();
  });

  function applyDocumentCrop() {
    const item = findDocumentItem(documentState.activeId).item;
    if (!item) return;
    const points = documentOrderPoints(documentState.cropPoints);
    const normalized = rotatedToNormalizedDocumentPoints(points, documentState.rotation, item.originalWidth, item.originalHeight);
    item.lastAppliedCrop = { points: cloneDocumentPoints(normalized), rotation: documentState.rotation };
    item.rotation = documentState.rotation;
    item.candidates = documentState.cropCandidates.map((candidate) => cloneDocumentPoints(candidate));
    item.candidateIndex = documentState.candidateIndex;
    item.currentCanvas = warpDocumentCanvas(documentEl.cropCanvas, points);
    item.currentDataUrl = item.currentCanvas.toDataURL("image/jpeg", 0.94);
    item.manuallyAdjusted = true;
    item.status = "已完成裁切";
    item.autoDetected = true;
    documentState.dirty = false;
    invalidateDocumentPdf();
    return item;
  }

  documentEl.applyCropBtn.addEventListener("click", () => {
    const item = applyDocumentCrop();
    const pending = documentState.pendingImport;
    if (item && pending?.item.id === item.id) {
      setInitialDocumentLayout(item, pending.page);
      pending.page.documents.push(item);
      documentState.selectedItemId = item.id;
      documentState.pendingImport = null;
      invalidateDocumentPdf();
      pending.resolve(true);
    }
    documentEl.cropDialog.close();
    renderDocumentEditor();
  });

  function requestDocumentCropClose(force = false) {
    if (documentState.dirty && !force) {
      documentEl.discardPrompt.hidden = false;
      documentEl.keepEditingBtn.focus();
      return;
    }
    documentState.dirty = false;
    documentEl.discardPrompt.hidden = true;
    documentEl.cropDialog.close("cancel");
  }

  documentEl.cropDialog.querySelectorAll("[data-document-crop-cancel]").forEach((button) =>
    button.addEventListener("click", () => requestDocumentCropClose())
  );
  documentEl.keepEditingBtn.addEventListener("click", () => {
    documentEl.discardPrompt.hidden = true;
    documentEl.applyCropBtn.focus();
  });
  documentEl.discardBtn.addEventListener("click", () => requestDocumentCropClose(true));
  documentEl.cropDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    if (!documentEl.discardPrompt.hidden) documentEl.discardPrompt.hidden = true;
    else requestDocumentCropClose();
  });

  function documentCropFocusable() {
    const root = documentEl.discardPrompt.hidden ? documentEl.cropDialog : documentEl.discardPrompt;
    return [...root.querySelectorAll('button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])')]
      .filter((node) => !node.hidden && !node.closest("[hidden]") && node.getClientRects().length > 0);
  }

  function moveDocumentHandle(key, fast) {
    const index = documentState.activeHandle;
    if (index === null) return;
    const step = fast ? 10 : 1;
    const delta = {
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 }
    }[key];
    if (!delta) return;
    const point = documentState.cropPoints[index];
    documentState.cropPoints[index] = {
      x: Math.min(documentEl.cropCanvas.width, Math.max(0, point.x + delta.x)),
      y: Math.min(documentEl.cropCanvas.height, Math.max(0, point.y + delta.y))
    };
    documentState.dirty = true;
    drawDocumentOverlay();
    updateDocumentCropCorrectionPreview();
  }

  documentEl.cropDialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      requestDocumentCropClose();
      return;
    }
    const active = document.activeElement;
    const handle = active?.closest?.(".document-handle");
    if (handle && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      setActiveDocumentHandle(Number(handle.dataset.index));
      moveDocumentHandle(event.key, event.shiftKey);
      return;
    }
    if (event.key === "Enter" && (handle || active === documentEl.cropCanvas)) {
      event.preventDefault();
      documentEl.applyCropBtn.click();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = documentCropFocusable();
    if (!focusable.length) return;
    event.preventDefault();
    const currentIndex = focusable.indexOf(active);
    const nextIndex = event.shiftKey
      ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
      : (currentIndex < 0 || currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
    focusable[nextIndex].focus();
  });

  documentEl.cropDialog.addEventListener("close", () => {
    const opener = documentState.opener;
    const pending = documentState.pendingImport;
    if (pending?.item.id === documentState.activeId) {
      documentState.pendingImport = null;
      pending.resolve(false);
    }
    clearDocumentDrag();
    unlockDocumentBackground();
    documentState.activeId = null;
    documentState.opener = null;
    setTimeout(() => opener?.isConnected && opener.focus(), 0);
  });

  window.addEventListener("resize", () => {
    if (!documentEl.cropDialog.open) return;
    requestAnimationFrame(() => {
      fitDocumentOverlay();
      drawDocumentOverlay();
    });
  });

  function buildDocumentPdfBundle() {
    if (!allDocumentItems().length || !window.jspdf?.jsPDF) return null;
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    documentState.pages.forEach((page, pageIndex) => {
      if (pageIndex > 0) pdf.addPage("a4", "portrait");
      page.documents.forEach((item) => {
        pdf.addImage(
          item.currentDataUrl,
          "JPEG",
          item.layout.xMm,
          item.layout.yMm,
          item.layout.widthMm,
          item.layout.heightMm,
          undefined,
          "FAST"
        );
      });
    });
    const output = pdf.output("blob");
    const blob = output.type === "application/pdf" ? output : new Blob([output], { type: "application/pdf" });
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const filename = `文件排版_${date}.pdf`;
    const file = typeof File === "function" ? new File([blob], filename, { type: "application/pdf" }) : null;
    documentState.pdfBundle = { blob, file, filename, objectUrl: null };
    return documentState.pdfBundle;
  }

  function getDocumentPdfBundle() {
    return documentState.pdfBundle || buildDocumentPdfBundle();
  }

  function documentPdfUrl(bundle) {
    if (!bundle.objectUrl) bundle.objectUrl = URL.createObjectURL(bundle.blob);
    return bundle.objectUrl;
  }

  function downloadDocumentPdf(bundle) {
    const link = document.createElement("a");
    link.href = documentPdfUrl(bundle);
    link.download = bundle.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function openDocumentPdf(bundle) {
    const url = documentPdfUrl(bundle);
    const opened = window.open(url, "_blank");
    if (!opened) {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  }

  function isDocumentMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  }

  documentEl.pdfBtn.addEventListener("click", () => {
    const bundle = getDocumentPdfBundle();
    if (!bundle) {
      documentToast("請先加入文件。");
      return;
    }
    if (/SamsungBrowser\//i.test(navigator.userAgent)) downloadDocumentPdf(bundle);
    else if (isDocumentMobile()) openDocumentPdf(bundle);
    else downloadDocumentPdf(bundle);
    documentLog(`已產生 ${documentState.pages.length} 頁 PDF：${bundle.filename}`);
  });

  documentEl.sharePdfBtn.addEventListener("click", async () => {
    const bundle = getDocumentPdfBundle();
    if (!bundle) {
      documentToast("請先加入文件。");
      return;
    }
    if (/SamsungBrowser\//i.test(navigator.userAgent)) {
      openDocumentPdf(bundle);
      documentToast("PDF 已開啟，請使用閱讀器的分享功能傳送。");
      documentLog(`已開啟 ${documentState.pages.length} 頁 PDF`);
      return;
    }
    if (bundle.file && typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [bundle.file] })) {
      try {
        await navigator.share({ files: [bundle.file], title: "文件排版 PDF" });
        documentLog(`已分享 ${documentState.pages.length} 頁 PDF`);
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
        console.error("Document PDF share failed.", error);
      }
    }
    downloadDocumentPdf(bundle);
    documentToast("此瀏覽器無法直接分享，已改為下載 PDF。");
    documentLog(`已下載 ${documentState.pages.length} 頁 PDF`);
  });

  ensureDocumentPage();
  renderDocumentEditor();
})();
