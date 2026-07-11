(function () {
  "use strict";

  const SLOT_KEY = "analyst-intel-sector-slots-v3";
  const LEGACY_SLOT_KEY = "analyst-intel-sector-slots-v2";
  const PROFILE_KEY = "analyst-intel-profile-v3";
  const WATCH_KEY = "analyst-intel-watchlist-v3";
  const PAPER_KEY = "analyst-intel-paper-positions-v3";
  const DEFAULT_SLOTS = [
    { id: "slot-1", label: "推薦板塊 1", query: "AI semiconductor" },
    { id: "slot-2", label: "推薦板塊 2", query: "defense aerospace" },
    { id: "slot-3", label: "推薦板塊 3", query: "entertainment streaming gaming" },
    { id: "slot-4", label: "推薦板塊 4", query: "energy power infrastructure" },
    { id: "slot-5", label: "自訂板塊", query: "uranium nuclear energy" }
  ];
  const DEFAULT_PROFILE = {
    capitalUsd: 10000,
    maxLossPercent: 1,
    horizon: "swing",
    allowShort: false
  };
  const HORIZON_LABELS = {
    short: "1-4 週",
    swing: "1-3 個月",
    long: "1 年以上"
  };
  const POSITIVE_TERMS = [
    "beat", "beats", "raise", "raised", "upgrade", "buy", "outperform", "growth", "demand",
    "surge", "record", "strong", "upside", "profit", "margin", "bullish", "contract", "win",
    "expand", "approved", "partnership", "rally", "higher", "positive", "受益", "成長", "上調",
    "買進", "看多", "強勁", "需求", "獲利", "訂單", "突破", "新高", "增加"
  ];
  const NEGATIVE_TERMS = [
    "miss", "misses", "cut", "downgrade", "sell", "underperform", "weak", "falls", "plunge",
    "risk", "lawsuit", "probe", "delay", "loss", "slowdown", "lower", "bearish", "tariff",
    "pressure", "debt", "bankrupt", "recall", "negative", "下修", "賣出", "看空", "疲弱",
    "風險", "虧損", "放緩", "壓力", "調查", "延遲", "下跌", "衰退", "減少"
  ];

  const state = {
    layer: "home",
    sectorTab: "opportunities",
    slots: loadSlots(),
    selectedSlotId: null,
    editingSlotId: null,
    analyses: {},
    profile: loadObject(PROFILE_KEY, DEFAULT_PROFILE),
    watchlist: loadArray(WATCH_KEY),
    positions: loadArray(PAPER_KEY),
    profileOpen: false,
    detailSymbol: null,
    paperSymbol: null,
    scoreAxis: null,
    sourceFilter: "all",
    sourcesExpanded: false,
    compareSymbols: new Set(),
    requestSerial: 0
  };

  const viewRoot = document.querySelector("#viewRoot");
  const overlayRoot = document.querySelector("#overlayRoot");
  const summaryGrid = document.querySelector("#summaryGrid");
  const toolbar = document.querySelector("#toolbar");
  const viewTitle = document.querySelector("#viewTitle");
  const toast = document.querySelector("#toast");

  function liveApiBaseUrl() {
    if (window.location.protocol.startsWith("http") && !["127.0.0.1", "localhost"].includes(window.location.hostname)) return "";
    if (window.location.protocol.startsWith("http") && window.location.port !== "4290") return "";
    return "http://" + (window.location.hostname || "127.0.0.1") + ":4318";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return ["http:", "https:"].includes(url.protocol) ? escapeHtml(url.href) : "";
    } catch (error) {
      return "";
    }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function loadObject(key, fallback) {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) || "null");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? Object.assign({}, fallback, parsed)
        : Object.assign({}, fallback);
    } catch (error) {
      return Object.assign({}, fallback);
    }
  }

  function loadArray(key) {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function loadSlots() {
    const stored = loadArray(SLOT_KEY);
    const legacy = stored.length ? [] : loadArray(LEGACY_SLOT_KEY);
    const source = stored.length ? stored : legacy;
    return DEFAULT_SLOTS.map(function (fallback) {
      const saved = source.find(function (item) { return item && item.id === fallback.id; });
      return saved ? { id: fallback.id, label: fallback.label, query: String(saved.query || "").slice(0, 120) } : Object.assign({}, fallback);
    });
  }

  function persist(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(function () { toast.classList.remove("show"); }, 1800);
  }

  async function fetchJson(url, timeoutMs) {
    const controller = new AbortController();
    const timer = window.setTimeout(function () { controller.abort(); }, timeoutMs);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return await response.json();
    } finally {
      window.clearTimeout(timer);
    }
  }

  function formatMoney(value) {
    const number = finite(value);
    if (number == null) return "資料不足";
    return "$" + number.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatLargeUsd(thousands) {
    const value = finite(thousands);
    if (value == null) return "資料不足";
    const dollars = value * 1000;
    if (Math.abs(dollars) >= 1e9) return "$" + (dollars / 1e9).toFixed(1) + "B";
    if (Math.abs(dollars) >= 1e6) return "$" + (dollars / 1e6).toFixed(1) + "M";
    return "$" + dollars.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  function formatPercent(value, empty) {
    const number = finite(value);
    if (number == null) return empty || "資料不足";
    return (number > 0 ? "+" : "") + number.toFixed(2) + "%";
  }

  function formatAge(value) {
    const age = finite(value);
    if (age == null) return "24h 內";
    if (age < 1) return "1h 內";
    return Math.ceil(age) + "h 內";
  }

  function formatAudience(value) {
    const count = finite(value);
    if (count == null) return "1萬+";
    if (count >= 1000000) return (count / 1000000).toFixed(count >= 10000000 ? 0 : 1) + "M";
    if (count >= 10000) return (count / 10000).toFixed(count >= 100000 ? 0 : 1) + "萬";
    return count.toLocaleString("zh-TW");
  }

  function renderMetrics(items) {
    summaryGrid.innerHTML = items.map(function (item) {
      return `<div class="metric-tile"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`;
    }).join("");
  }

  function renderToolbar(buttons) {
    toolbar.innerHTML = buttons.map(function (item) {
      return `<button class="tool-btn ${item.active ? "active" : ""}" type="button" data-toolbar-action="${escapeHtml(item.action)}">${escapeHtml(item.label)}</button>`;
    }).join("");
  }

  function setNav() {
    document.querySelectorAll("[data-nav-action]").forEach(function (button) {
      const action = button.dataset.navAction;
      button.classList.toggle("active", (action === "home" && state.layer === "home") || (action === "tracking" && state.layer === "tracking"));
    });
  }

  function currentSlot() {
    return state.slots.find(function (slot) { return slot.id === state.selectedSlotId; }) || null;
  }

  function currentAnalysis() {
    return state.analyses[state.selectedSlotId] || { status: "idle", data: null, error: "" };
  }

  function renderHome() {
    state.layer = "home";
    viewTitle.textContent = "選擇板塊";
    renderToolbar([
      { label: "追蹤清單", action: "tracking" },
      { label: "投資設定", action: "profile" }
    ]);
    renderMetrics([
      { label: "可編輯板塊", value: "5" },
      { label: "觀察標的", value: String(state.watchlist.length) },
      { label: "模擬持倉", value: String(state.positions.length) },
      { label: "投資期間", value: HORIZON_LABELS[state.profile.horizon] || HORIZON_LABELS.swing }
    ]);
    viewRoot.innerHTML = `<section class="sector-home-grid">${state.slots.map(renderSectorCard).join("")}</section>`;
    renderOverlays();
  }

  function renderSectorCard(slot) {
    const configured = Boolean(slot.query);
    return `<article class="sector-card editable-sector-card">
      <button class="sector-card-open" type="button" data-open-slot="${escapeHtml(slot.id)}">
        <span class="slot-label">${escapeHtml(slot.label)}</span>
        <h2>${escapeHtml(slot.query || "尚未設定")}</h2>
        <div class="sector-card-stats"><span>投資機會</span><span>財務估值</span><span>來源可查</span></div>
      </button>
      <button class="sector-edit-btn" type="button" data-edit-slot="${escapeHtml(slot.id)}">編輯</button>
    </article>`;
  }

  async function openSector(slotId) {
    const slot = state.slots.find(function (item) { return item.id === slotId; });
    if (!slot) return;
    if (!slot.query) {
      state.editingSlotId = slot.id;
      render();
      return;
    }
    state.layer = "sector";
    state.selectedSlotId = slot.id;
    state.sectorTab = "opportunities";
    state.sourceFilter = "all";
    state.sourcesExpanded = false;
    state.compareSymbols = new Set();
    state.detailSymbol = null;
    const serial = ++state.requestSerial;
    state.analyses[slot.id] = { status: "loading", data: null, error: "" };
    render();
    try {
      const url = liveApiBaseUrl() + "/api/custom-sector?q=" + encodeURIComponent(slot.query) + "&t=" + Date.now();
      const payload = await fetchJson(url, 65000);
      if (serial !== state.requestSerial) return;
      state.analyses[slot.id] = { status: "ready", data: buildSector(slot, payload), error: "" };
    } catch (error) {
      if (serial !== state.requestSerial) return;
      state.analyses[slot.id] = { status: "error", data: null, error: String(error) };
    }
    if (state.layer === "sector" && state.selectedSlotId === slot.id) render();
  }

  function countTerms(text, terms) {
    const normalized = String(text || "").toLowerCase();
    return terms.reduce(function (total, term) { return total + (normalized.includes(term.toLowerCase()) ? 1 : 0); }, 0);
  }

  function evidenceSignal(items) {
    return items.reduce(function (signal, item) {
      const weight = finite(item.authorityWeight) || (item.contentKind === "social" ? 0.8 : 1);
      const text = String(item.title || "") + " " + String(item.summary || "");
      signal.positive += countTerms(text, POSITIVE_TERMS) * weight;
      signal.negative += countTerms(text, NEGATIVE_TERMS) * weight;
      return signal;
    }, { positive: 0, negative: 0 });
  }

  function ratingAdjustment(value) {
    const rating = String(value || "").toLowerCase();
    if (rating.includes("strong buy")) return 18;
    if (rating.includes("buy")) return 12;
    if (rating.includes("outperform")) return 10;
    if (rating.includes("sell")) return -18;
    if (rating.includes("underperform")) return -12;
    return 0;
  }

  function buildDecision(quote, evidence, social, query) {
    const decisionData = quote.decisionData || {};
    const fundamentals = decisionData.fundamentals || {};
    const valuation = decisionData.valuation || {};
    const history = decisionData.history || {};
    const analyst = decisionData.analyst || {};
    const earnings = decisionData.earnings || {};
    const related = evidence.concat(social).filter(function (item) {
      return Array.isArray(item.symbols) && item.symbols.includes(quote.symbol);
    });
    const signal = evidenceSignal(related);
    const netSignal = signal.positive - signal.negative;
    const signalTotal = signal.positive + signal.negative;

    const evidenceParts = [{ label: "中性基礎", points: 50, raw: "50" }];
    const evidenceSignalPoints = netSignal * 5;
    evidenceParts.push({ label: "正負訊號差 × 5", points: evidenceSignalPoints, raw: netSignal.toFixed(1) });
    let evidenceScore = 50 + evidenceSignalPoints;
    let fundamentalScore = 50;
    const fundamentalParts = [{ label: "中性基礎", points: 50, raw: "50" }];
    const revenueGrowth = finite(fundamentals.revenueGrowthPercent);
    const operatingMargin = finite(fundamentals.operatingMarginPercent);
    const marginChange = finite(fundamentals.operatingMarginChangePoints);
    const freeCashFlow = finite(fundamentals.freeCashFlowThousands);
    const earningsSurprise = finite(earnings.averageSurprisePercent);
    if (revenueGrowth != null) {
      const points = clamp(revenueGrowth * 1.1, -20, 20);
      fundamentalScore += points;
      fundamentalParts.push({ label: "營收成長", points: points, raw: formatPercent(revenueGrowth) });
    }
    if (operatingMargin != null) {
      const points = clamp((operatingMargin - 8) * 0.8, -12, 14);
      fundamentalScore += points;
      fundamentalParts.push({ label: "營業利益率", points: points, raw: formatPercent(operatingMargin) });
    }
    if (marginChange != null) {
      const points = clamp(marginChange * 1.6, -12, 12);
      fundamentalScore += points;
      fundamentalParts.push({ label: "利益率年變化", points: points, raw: marginChange.toFixed(2) + " 個百分點" });
    }
    if (freeCashFlow != null) {
      const points = freeCashFlow > 0 ? 10 : -14;
      fundamentalScore += points;
      fundamentalParts.push({ label: "自由現金流方向", points: points, raw: formatLargeUsd(freeCashFlow) });
    }
    if (earningsSurprise != null) {
      const points = clamp(earningsSurprise * 0.35, -10, 10);
      fundamentalScore += points;
      fundamentalParts.push({ label: "近四季財報驚喜", points: points, raw: formatPercent(earningsSurprise) });
    }

    let valuationScore = 50;
    const valuationParts = [{ label: "中性基礎", points: 50, raw: "50" }];
    const targetUpside = finite(valuation.targetUpsidePercent);
    const pricePercentile = finite(history.pricePercentile52Week);
    if (targetUpside != null) {
      const points = clamp(targetUpside * 1.1, -35, 35);
      valuationScore += points;
      valuationParts.push({ label: "市場目標價空間", points: points, raw: formatPercent(targetUpside) });
    }
    if (pricePercentile != null) {
      const points = clamp((50 - pricePercentile) * 0.28, -14, 14);
      valuationScore += points;
      valuationParts.push({ label: "52週價格位置", points: points, raw: pricePercentile.toFixed(1) + "%" });
    }
    const ratingPoints = ratingAdjustment(analyst.meanRating);
    valuationScore += ratingPoints;
    if (analyst.meanRating) valuationParts.push({ label: "分析師平均評級", points: ratingPoints, raw: analyst.meanRating });

    const returns = history.returns || {};
    let trendScore = 50;
    const trendParts = [{ label: "中性基礎", points: 50, raw: "50" }];
    const oneMonth = finite(returns.oneMonth);
    const threeMonths = finite(returns.threeMonths);
    const dayChange = finite(quote.changePercentValue);
    if (oneMonth != null) {
      const points = clamp(oneMonth * 0.7, -18, 18);
      trendScore += points;
      trendParts.push({ label: "30日報酬", points: points, raw: formatPercent(oneMonth) });
    }
    if (threeMonths != null) {
      const points = clamp(threeMonths * 0.35, -16, 16);
      trendScore += points;
      trendParts.push({ label: "90日報酬", points: points, raw: formatPercent(threeMonths) });
    }
    if (dayChange != null) {
      const points = clamp(dayChange * 1.2, -6, 6);
      trendScore += points;
      trendParts.push({ label: "最近交易日", points: points, raw: formatPercent(dayChange) });
    }

    let riskScore = 25;
    const riskParts = [{ label: "基礎風險", points: 25, raw: "25" }];
    const volatility = finite(history.annualizedVolatility20dPercent);
    const drawdown = finite(history.maxDrawdown1yPercent);
    const netDebt = finite(fundamentals.netDebtThousands);
    const revenue = finite(fundamentals.revenueThousands);
    if (volatility != null) {
      const points = volatility >= 55 ? 25 : volatility >= 35 ? 15 : volatility >= 25 ? 8 : 0;
      riskScore += points;
      riskParts.push({ label: "20日年化波動", points: points, raw: formatPercent(volatility) });
    }
    if (drawdown != null) {
      const points = drawdown <= -45 ? 20 : drawdown <= -30 ? 12 : drawdown <= -20 ? 6 : 0;
      riskScore += points;
      riskParts.push({ label: "一年最大回撤", points: points, raw: formatPercent(drawdown) });
    }
    if (freeCashFlow != null && freeCashFlow < 0) {
      riskScore += 18;
      riskParts.push({ label: "負自由現金流", points: 18, raw: formatLargeUsd(freeCashFlow) });
    }
    if (netDebt != null && revenue && netDebt / revenue > 1) {
      riskScore += 18;
      riskParts.push({ label: "淨負債／營收 > 1", points: 18, raw: (netDebt / revenue).toFixed(2) });
    } else if (netDebt != null && revenue && netDebt / revenue > 0.5) {
      riskScore += 10;
      riskParts.push({ label: "淨負債／營收 > 0.5", points: 10, raw: (netDebt / revenue).toFixed(2) });
    }
    if (marginChange != null && marginChange < -3) {
      riskScore += 10;
      riskParts.push({ label: "利益率明顯惡化", points: 10, raw: marginChange.toFixed(2) + " 個百分點" });
    }
    if (signal.positive > 0 && signal.negative > 0 && Math.min(signal.positive, signal.negative) / Math.max(signal.positive, signal.negative) > 0.55) {
      riskScore += 8;
      riskParts.push({ label: "正反證據衝突", points: 8, raw: signal.positive.toFixed(1) + " / " + signal.negative.toFixed(1) });
    }

    evidenceScore = clamp(Math.round(evidenceScore), 0, 100);
    fundamentalScore = clamp(Math.round(fundamentalScore), 0, 100);
    valuationScore = clamp(Math.round(valuationScore), 0, 100);
    trendScore = clamp(Math.round(trendScore), 0, 100);
    riskScore = clamp(Math.round(riskScore), 0, 100);

    const coverage = decisionData.coverage || {};
    const coverageCount = [coverage.valuation, coverage.fundamentals, coverage.history, coverage.analyst, coverage.earnings].filter(Boolean).length;
    const sourceQuality = related.reduce(function (total, item) { return total + (finite(item.authorityWeight) || 1); }, 0);
    const confidenceParts = [
      { label: "基礎", points: 20, raw: "20" },
      { label: "資料種類", points: coverageCount * 10, raw: coverageCount + "/5" },
      { label: "公司專屬來源", points: Math.min(18, related.length * 5), raw: related.length + " 則" },
      { label: "來源品質", points: Math.min(12, sourceQuality * 2), raw: sourceQuality.toFixed(1) }
    ];
    const confidence = clamp(Math.round(confidenceParts.reduce(function (total, part) { return total + part.points; }, 0)), 0, 100);
    const decisionScore = clamp(Math.round(evidenceScore * 0.2 + fundamentalScore * 0.28 + valuationScore * 0.27 + trendScore * 0.25), 0, 100);
    const decisionParts = [
      { label: "證據方向 × 20%", points: evidenceScore * 0.2, raw: String(evidenceScore) },
      { label: "基本面 × 28%", points: fundamentalScore * 0.28, raw: String(fundamentalScore) },
      { label: "估值 × 27%", points: valuationScore * 0.27, raw: String(valuationScore) },
      { label: "價格趨勢 × 25%", points: trendScore * 0.25, raw: String(trendScore) }
    ];

    let status = "等待";
    if (confidence >= 50 && decisionScore >= 65 && fundamentalScore >= 50 && valuationScore >= 48 && riskScore < 78) status = "做多";
    if (confidence >= 50 && decisionScore <= 35 && trendScore <= 48) status = state.profile.allowShort ? "做空" : "避開";
    if (riskScore >= 78 && decisionScore < 58) status = "避開";

    const currentPrice = finite(quote.lastSaleValue);
    const low20 = finite(history.low20d);
    const high20 = finite(history.high20d);
    const average20 = finite(history.average20d);
    const lowerQuartile = finite(history.lowerQuartile20d);
    const upperQuartile = finite(history.upperQuartile20d);
    let entryLow = null;
    let entryHigh = null;
    let invalidation = null;
    if (status === "做多") {
      entryLow = low20;
      entryHigh = average20;
      invalidation = low20;
    } else if (status === "做空") {
      entryLow = average20;
      entryHigh = high20;
      invalidation = high20;
    } else if (status === "等待") {
      entryLow = lowerQuartile || low20;
      entryHigh = upperQuartile || high20;
    }
    if (entryLow != null && entryHigh != null && entryLow > entryHigh) {
      const swap = entryLow;
      entryLow = entryHigh;
      entryHigh = swap;
    }

    const targetPrice = finite(valuation.oneYearTarget);
    let riskReward = null;
    if (currentPrice != null && invalidation != null && targetPrice != null) {
      const risk = Math.abs(currentPrice - invalidation);
      const reward = status === "做空" ? currentPrice - targetPrice : targetPrice - currentPrice;
      if (risk > 0 && reward > 0) riskReward = Math.round(reward / risk * 100) / 100;
    }

    let suggestedShares = 0;
    let suggestedValue = 0;
    if (["做多", "做空"].includes(status) && currentPrice && invalidation != null) {
      const riskBudget = finite(state.profile.capitalUsd) * finite(state.profile.maxLossPercent) / 100;
      const perShareRisk = Math.abs(currentPrice - invalidation);
      const riskShares = perShareRisk > 0 ? Math.floor(riskBudget / perShareRisk) : 0;
      const allocationShares = Math.floor((finite(state.profile.capitalUsd) * 0.25) / currentPrice);
      suggestedShares = Math.max(0, Math.min(riskShares, allocationShares));
      suggestedValue = Math.round(suggestedShares * currentPrice * 100) / 100;
    }

    const risks = [];
    if (freeCashFlow != null && freeCashFlow < 0) risks.push("自由現金流為負");
    if (marginChange != null && marginChange < 0) risks.push("營業利益率年減 " + Math.abs(marginChange).toFixed(2) + " 個百分點");
    if (volatility != null && volatility >= 35) risks.push("20 日年化波動 " + volatility.toFixed(1) + "%");
    if (drawdown != null && drawdown <= -30) risks.push("一年最大回撤 " + drawdown.toFixed(1) + "%");
    if (targetUpside != null && targetUpside < 0) risks.push("市場目標價低於現價");
    if (!related.length) risks.push("近 24 小時沒有公司專屬證據");
    const negativeEvidence = related.filter(function (item) {
      const text = String(item.title || "") + " " + String(item.summary || "");
      return countTerms(text, NEGATIVE_TERMS) > countTerms(text, POSITIVE_TERMS);
    }).slice(0, 2).map(function (item) { return item.title; });
    negativeEvidence.forEach(function (title) { risks.push(title); });

    const catalyst = related[0] || null;
    const confidenceLabel = confidence >= 75 ? "高" : confidence >= 55 ? "中" : "低";
    return {
      symbol: quote.symbol,
      name: quote.name,
      query: query,
      quote: quote,
      status: status,
      decisionScore: decisionScore,
      confidence: confidence,
      confidenceLabel: confidenceLabel,
      riskScore: riskScore,
      riskLabel: riskScore >= 70 ? "高" : riskScore >= 45 ? "中" : "低",
      axes: {
        evidence: evidenceScore,
        fundamentals: fundamentalScore,
        valuation: valuationScore,
        trend: trendScore
      },
      scoreDetails: {
        decision: decisionParts,
        confidence: confidenceParts,
        risk: riskParts,
        evidence: evidenceParts,
        fundamentals: fundamentalParts,
        valuation: valuationParts,
        trend: trendParts
      },
      signal: { positive: Math.round(signal.positive * 10) / 10, negative: Math.round(signal.negative * 10) / 10, net: Math.round(netSignal * 10) / 10 },
      related: related,
      fundamentals: fundamentals,
      valuation: valuation,
      history: history,
      analyst: analyst,
      earnings: earnings,
      entryLow: entryLow,
      entryHigh: entryHigh,
      targetPrice: targetPrice,
      targetUpside: targetUpside,
      invalidation: invalidation,
      riskReward: riskReward,
      suggestedShares: suggestedShares,
      suggestedValue: suggestedValue,
      catalyst: catalyst,
      risks: risks.slice(0, 5),
      dataCoverage: coverageCount,
      horizon: HORIZON_LABELS[state.profile.horizon] || HORIZON_LABELS.swing
    };
  }

  function buildSector(slot, payload) {
    const evidence = Array.isArray(payload && payload.evidence) ? payload.evidence : [];
    const social = Array.isArray(payload && payload.social) ? payload.social : [];
    const quotes = Array.isArray(payload && payload.quotes) ? payload.quotes : [];
    const sources = evidence.map(function (item, index) {
      return { id: "news-" + index, type: item.sourceType || "新聞", item: item };
    }).concat(social.map(function (item, index) {
      return { id: "social-" + index, type: item.platform || item.sourceType || "社群", item: item };
    }));
    const decisions = quotes.map(function (quote) { return buildDecision(quote, evidence, social, slot.query); });
    return {
      id: slot.id,
      name: slot.query,
      quotes: quotes,
      evidence: evidence,
      social: social,
      sources: sources,
      decisions: decisions,
      freshness: payload.freshness || { comparisons: [] },
      dataWindows: payload.dataWindows || {},
      errors: payload.errors || []
    };
  }

  function pulseForSector(sector) {
    const scored = sector.decisions.filter(function (item) { return item.confidence >= 45; });
    const average = scored.length ? Math.round(scored.reduce(function (total, item) { return total + item.decisionScore; }, 0) / scored.length) : null;
    const oneMonthValues = sector.decisions.map(function (item) { return finite((item.history.returns || {}).oneMonth); }).filter(function (value) { return value != null; });
    const oneMonth = oneMonthValues.length ? oneMonthValues.reduce(function (total, value) { return total + value; }, 0) / oneMonthValues.length : null;
    const label = average == null ? "資料不足" : average >= 60 ? "偏多" : average <= 40 ? "偏空" : "中性";
    return { score: average, label: label, oneMonth: oneMonth };
  }

  function renderSector() {
    const slot = currentSlot();
    const analysis = currentAnalysis();
    if (!slot) return renderHome();
    viewTitle.textContent = slot.query;
    renderToolbar([
      { label: "回板塊", action: "home" },
      { label: "追蹤", action: "tracking" },
      { label: "投資設定", action: "profile" }
    ]);
    if (analysis.status === "loading") {
      renderMetrics([
        { label: "狀態", value: "分析中" },
        { label: "新聞", value: "24h" },
        { label: "價格", value: "1年" },
        { label: "財務", value: "4期" }
      ]);
      viewRoot.innerHTML = `<section class="loading-state"><div class="loading-line"></div><strong>正在建立即時投資決策</strong></section>`;
      return renderOverlays();
    }
    if (analysis.status === "error" || !analysis.data) {
      renderMetrics([{ label: "狀態", value: "無結果" }]);
      viewRoot.innerHTML = `<div class="empty">目前沒有取得可驗證資料。</div>`;
      return renderOverlays();
    }
    const sector = analysis.data;
    const longCount = sector.decisions.filter(function (item) { return item.status === "做多"; }).length;
    const waitCount = sector.decisions.filter(function (item) { return item.status === "等待"; }).length;
    renderMetrics([
      { label: "上市標的", value: String(sector.decisions.length) },
      { label: "做多研究", value: String(longCount) },
      { label: "等待", value: String(waitCount) },
      { label: "官方財務", value: String(sector.decisions.filter(function (item) { return item.dataCoverage >= 3; }).length) }
    ]);
    viewRoot.innerHTML = renderSectorTabs() + renderSectorTab(sector);
    renderOverlays();
  }

  function renderSectorTabs() {
    const tabs = [
      ["opportunities", "投資機會"],
      ["overview", "板塊總覽"],
      ["sources", "資料來源"],
      ["validation", "歷史驗證"]
    ];
    return `<div class="sector-tabs" role="tablist">${tabs.map(function (tab) {
      return `<button type="button" role="tab" class="sector-tab ${state.sectorTab === tab[0] ? "active" : ""}" data-sector-tab="${tab[0]}">${tab[1]}</button>`;
    }).join("")}</div>`;
  }

  function renderSectorTab(sector) {
    if (state.sectorTab === "overview") return renderOverview(sector);
    if (state.sectorTab === "sources") return renderSources(sector);
    if (state.sectorTab === "validation") return renderValidation(sector);
    return renderOpportunities(sector);
  }

  function statusClass(status) {
    return status === "做多" ? "long" : status === "做空" ? "short" : status === "避開" ? "avoid" : "wait";
  }

  function renderOpportunities(sector) {
    const pulse = pulseForSector(sector);
    const sorted = sector.decisions.slice().sort(function (a, b) { return b.decisionScore - a.decisionScore; });
    return `<section class="decision-workspace">
      <div class="pulse-band">
        <div><span>板塊狀態</span><strong>${escapeHtml(pulse.label)}</strong></div>
        <div><span>30 日平均</span><strong>${formatPercent(pulse.oneMonth)}</strong></div>
        <div><span>可查來源</span><strong>${sector.sources.length}</strong></div>
        <div><span>追蹤中</span><strong>${state.watchlist.filter(function (item) { return item.query === sector.name; }).length}</strong></div>
      </div>
      ${renderOpportunityTable(sorted)}
      ${renderComparePanel(sorted)}
    </section>`;
  }

  function renderOpportunityTable(items) {
    if (!items.length) return `<div class="empty">沒有取得可驗證的上市標的。</div>`;
    return `<section class="opportunity-section">
      <div class="section-head"><h2>投資機會</h2></div>
      <div class="opportunity-table">
        <div class="opportunity-row opportunity-head">
          <span>股票</span><span>狀態</span><span>現價</span><span>市場目標</span><span>20日觀察區間</span><span>信心</span><span>風險</span><span>操作</span>
        </div>
        ${items.map(renderOpportunityRow).join("")}
      </div>
    </section>`;
  }

  function renderOpportunityRow(item) {
    const compared = state.compareSymbols.has(item.symbol);
    const watched = state.watchlist.some(function (watch) { return watch.symbol === item.symbol; });
    const zone = item.entryLow != null && item.entryHigh != null ? formatMoney(item.entryLow) + " - " + formatMoney(item.entryHigh) : "資料不足";
    return `<article class="opportunity-row">
      <button class="symbol-cell" type="button" data-detail-symbol="${escapeHtml(item.symbol)}"><strong>${escapeHtml(item.symbol)}</strong><small>${escapeHtml(item.name)}</small></button>
      <span data-label="狀態"><b class="status-badge ${statusClass(item.status)}">${escapeHtml(item.status)}</b></span>
      <span data-label="現價"><strong>${formatMoney(item.quote.lastSaleValue)}</strong></span>
      <span data-label="市場目標">${formatMoney(item.targetPrice)}<small>${formatPercent(item.targetUpside)}</small></span>
      <span data-label="20日觀察區間">${escapeHtml(zone)}</span>
      <span data-label="信心"><strong>${item.confidenceLabel}</strong><small>${item.confidence}/100</small></span>
      <span data-label="風險"><strong class="risk-${item.riskLabel === "高" ? "high" : item.riskLabel === "中" ? "mid" : "low"}">${escapeHtml(item.riskLabel)}</strong><small>${item.riskScore}/100</small></span>
      <div class="row-actions" data-label="操作">
        <button type="button" class="mini-btn ${compared ? "active" : ""}" data-compare-symbol="${escapeHtml(item.symbol)}">比較</button>
        <button type="button" class="mini-btn ${watched ? "active" : ""}" data-watch-symbol="${escapeHtml(item.symbol)}">${watched ? "已追蹤" : "追蹤"}</button>
        <button type="button" class="mini-btn primary" data-detail-symbol="${escapeHtml(item.symbol)}">詳情</button>
      </div>
    </article>`;
  }

  function renderComparePanel(items) {
    const selected = items.filter(function (item) { return state.compareSymbols.has(item.symbol); });
    if (selected.length < 2) return "";
    const rows = [
      ["狀態", function (item) { return item.status; }],
      ["決策分數", function (item) { return item.decisionScore + "/100"; }],
      ["市場目標", function (item) { return formatMoney(item.targetPrice); }],
      ["目標空間", function (item) { return formatPercent(item.targetUpside); }],
      ["營收成長", function (item) { return formatPercent(item.fundamentals.revenueGrowthPercent); }],
      ["營業利益率", function (item) { return formatPercent(item.fundamentals.operatingMarginPercent); }],
      ["自由現金流", function (item) { return formatLargeUsd(item.fundamentals.freeCashFlowThousands); }],
      ["30日報酬", function (item) { return formatPercent((item.history.returns || {}).oneMonth); }],
      ["最大回撤", function (item) { return formatPercent(item.history.maxDrawdown1yPercent); }]
    ];
    return `<section class="compare-section"><div class="section-head"><h2>標的比較</h2></div>
      <div class="compare-grid" style="--compare-count:${selected.length}">
        <div class="compare-label">指標</div>${selected.map(function (item) { return `<strong>${escapeHtml(item.symbol)}</strong>`; }).join("")}
        ${rows.map(function (row) { return `<div class="compare-label">${row[0]}</div>${selected.map(function (item) { return `<span>${escapeHtml(row[1](item))}</span>`; }).join("")}`; }).join("")}
      </div></section>`;
  }

  function renderOverview(sector) {
    return `<section class="overview-layout">
      <section class="market-band"><div class="section-head"><h2>行情</h2></div><div class="market-grid">${sector.decisions.map(renderMarketQuote).join("")}</div></section>
      <section class="fundamental-band"><div class="section-head"><h2>財務與趨勢</h2></div><div class="fundamental-list">${sector.decisions.map(renderFundamentalRow).join("")}</div></section>
    </section>`;
  }

  function renderMarketQuote(item) {
    const change = finite(item.quote.changePercentValue);
    const url = safeUrl(item.quote.url);
    return `<a class="market-quote external-link" href="${url}" target="_blank" rel="noopener noreferrer">
      <div class="market-quote-head"><strong>${escapeHtml(item.symbol)}</strong><span>${escapeHtml(item.quote.exchange || "Market")}</span></div>
      <h3>${escapeHtml(item.name)}</h3><div class="market-price">${escapeHtml(item.quote.lastSalePrice || "N/A")}</div>
      <div class="market-change ${change != null && change >= 0 ? "gain" : "loss"}">${formatPercent(change, "無漲跌")}</div>
      <small>${escapeHtml(item.quote.lastTradeTimestamp || "最近交易日")}</small>
    </a>`;
  }

  function renderFundamentalRow(item) {
    const returns = item.history.returns || {};
    return `<article class="fundamental-row">
      <button type="button" class="fundamental-symbol" data-detail-symbol="${escapeHtml(item.symbol)}"><strong>${escapeHtml(item.symbol)}</strong><span>${escapeHtml(item.analyst.meanRating || "無評級")}</span></button>
      <div><span>營收成長</span><strong>${formatPercent(item.fundamentals.revenueGrowthPercent)}</strong></div>
      <div><span>營業利益率</span><strong>${formatPercent(item.fundamentals.operatingMarginPercent)}</strong></div>
      <div><span>自由現金流</span><strong>${formatLargeUsd(item.fundamentals.freeCashFlowThousands)}</strong></div>
      <div><span>30日</span><strong>${formatPercent(returns.oneMonth)}</strong></div>
      <div><span>90日</span><strong>${formatPercent(returns.threeMonths)}</strong></div>
      <button type="button" class="mini-btn primary" data-detail-symbol="${escapeHtml(item.symbol)}">詳情</button>
    </article>`;
  }

  function sourceTypes(sources) {
    return ["all"].concat(Array.from(new Set(sources.map(function (source) { return source.type; }))));
  }

  function renderSources(sector) {
    const types = sourceTypes(sector.sources);
    const filtered = sector.sources.filter(function (source) { return state.sourceFilter === "all" || source.type === state.sourceFilter; });
    const visible = state.sourcesExpanded ? filtered : filtered.slice(0, 5);
    return `<section class="source-workspace">
      <div class="source-filter-row">${types.map(function (type) {
        return `<button type="button" class="filter-btn ${state.sourceFilter === type ? "active" : ""}" data-source-filter="${escapeHtml(type)}">${escapeHtml(type === "all" ? "全部來源" : type)}</button>`;
      }).join("")}</div>
      <div class="source-list">${visible.map(renderSource).join("") || `<div class="empty">目前沒有通過驗證的來源。</div>`}</div>
      ${filtered.length > 5 ? `<button type="button" class="source-toggle" data-source-toggle>${state.sourcesExpanded ? "收合來源" : "顯示全部 " + filtered.length + " 則"}</button>` : ""}
    </section>`;
  }

  function renderSource(source) {
    const item = source.item || {};
    const url = safeUrl(item.url);
    const socialNote = item.contentKind === "social" ? " · 已驗證 " + formatAudience(item.audienceCount) : "";
    return `<article class="evidence-link v3-evidence">
      <a class="evidence-primary external-link" href="${url}" target="_blank" rel="noopener noreferrer">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml((item.source || source.type) + " · " + formatAge(item.ageHours) + socialNote)}</span>
        <small>${escapeHtml(item.summary || "")}</small>
      </a>
    </article>`;
  }

  function renderValidation(sector) {
    return `<section class="validation-workspace">
      <section><div class="section-head"><h2>市場歷史</h2></div>${renderReturnTable(sector.decisions)}</section>
      <section><div class="section-head"><h2>站內追蹤</h2></div>${renderSnapshotTable(sector.freshness.comparisons || [])}</section>
    </section>`;
  }

  function renderReturnTable(items) {
    if (!items.some(function (item) { return item.history && item.history.asOf; })) return `<div class="empty">沒有取得可驗證的歷史價格。</div>`;
    return `<div class="return-table"><div class="return-row return-head"><span>股票</span><span>1週</span><span>1月</span><span>3月</span><span>1年</span><span>最大回撤</span><span>波動</span></div>${items.map(function (item) {
      const returns = item.history.returns || {};
      return `<div class="return-row"><strong>${escapeHtml(item.symbol)}</strong><span>${formatPercent(returns.oneWeek)}</span><span>${formatPercent(returns.oneMonth)}</span><span>${formatPercent(returns.threeMonths)}</span><span>${formatPercent(returns.oneYear)}</span><span>${formatPercent(item.history.maxDrawdown1yPercent)}</span><span>${formatPercent(item.history.annualizedVolatility20dPercent)}</span></div>`;
    }).join("")}</div>`;
  }

  function renderSnapshotTable(items) {
    if (!items.length) return `<div class="empty">尚未累積前一個交易日快照。</div>`;
    return `<div class="return-table"><div class="return-row snapshot return-head"><span>股票</span><span>起始日</span><span>比較日</span><span>起始價</span><span>目前價</span><span>報酬</span></div>${items.map(function (item) {
      return `<div class="return-row snapshot"><strong>${escapeHtml(item.symbol)}</strong><span>${escapeHtml(item.fromDate)}</span><span>${escapeHtml(item.toDate)}</span><span>${formatMoney(item.previousPrice)}</span><span>${formatMoney(item.currentPrice)}</span><strong>${formatPercent(item.returnPercent)}</strong></div>`;
    }).join("")}</div>`;
  }

  function findDecision(symbol) {
    for (const analysis of Object.values(state.analyses)) {
      if (!analysis || !analysis.data) continue;
      const match = analysis.data.decisions.find(function (item) { return item.symbol === symbol; });
      if (match) return match;
    }
    return null;
  }

  function renderTracking() {
    state.layer = "tracking";
    viewTitle.textContent = "追蹤中心";
    renderToolbar([
      { label: "回板塊", action: "home" },
      { label: "投資設定", action: "profile" }
    ]);
    renderMetrics([
      { label: "觀察標的", value: String(state.watchlist.length) },
      { label: "模擬持倉", value: String(state.positions.length) },
      { label: "風險上限", value: finite(state.profile.maxLossPercent).toFixed(1) + "%" },
      { label: "投資期間", value: HORIZON_LABELS[state.profile.horizon] || HORIZON_LABELS.swing }
    ]);
    viewRoot.innerHTML = `<section class="tracking-layout">
      <section><div class="section-head"><h2>觀察清單</h2></div>${renderWatchlist()}</section>
      <section><div class="section-head"><h2>模擬持倉</h2></div>${renderPositions()}</section>
    </section>`;
    renderOverlays();
  }

  function renderWatchlist() {
    if (!state.watchlist.length) return `<div class="empty">尚未追蹤標的。</div>`;
    return `<div class="tracking-list">${state.watchlist.map(function (saved) {
      const live = findDecision(saved.symbol);
      const current = live || saved;
      let alert = "持續觀察";
      if (live && live.status !== saved.status) alert = "狀態改變：" + saved.status + " → " + live.status;
      if (live && live.invalidation != null && live.quote.lastSaleValue != null) {
        if (live.status === "做多" && live.quote.lastSaleValue < live.invalidation) alert = "低於失效價格";
        if (live.status === "做空" && live.quote.lastSaleValue > live.invalidation) alert = "高於失效價格";
      }
      return `<article class="tracking-row"><div><strong>${escapeHtml(saved.symbol)}</strong><span>${escapeHtml(saved.name || "")}</span></div><b class="status-badge ${statusClass(current.status)}">${escapeHtml(current.status)}</b><span>${formatMoney(live ? live.quote.lastSaleValue : saved.price)}</span><span>${escapeHtml(alert)}</span><button type="button" class="mini-btn" data-remove-watch="${escapeHtml(saved.symbol)}">移除</button></article>`;
    }).join("")}</div>`;
  }

  function renderPositions() {
    if (!state.positions.length) return `<div class="empty">尚未建立模擬持倉。</div>`;
    return `<div class="tracking-list">${state.positions.map(function (position) {
      const live = findDecision(position.symbol);
      const current = live ? finite(live.quote.lastSaleValue) : finite(position.entryPrice);
      const entry = finite(position.entryPrice);
      const shares = finite(position.shares) || 0;
      const pnl = current != null && entry != null ? (position.side === "做空" ? entry - current : current - entry) * shares : null;
      return `<article class="tracking-row position"><div><strong>${escapeHtml(position.symbol)}</strong><span>${escapeHtml(position.side)} · ${shares} 股</span></div><span>成本 ${formatMoney(entry)}</span><span>現價 ${formatMoney(current)}</span><strong class="${pnl != null && pnl >= 0 ? "gain" : "loss"}">${pnl == null ? "資料不足" : (pnl >= 0 ? "+" : "") + "$" + pnl.toFixed(2)}</strong><button type="button" class="mini-btn" data-remove-position="${escapeHtml(position.id)}">移除</button></article>`;
    }).join("")}</div>`;
  }

  function renderOverlays() {
    overlayRoot.innerHTML = renderEditModal() + renderProfileModal() + renderDetailModal() + renderPaperModal();
  }

  function renderEditModal() {
    if (!state.editingSlotId) return "";
    const slot = state.slots.find(function (item) { return item.id === state.editingSlotId; });
    if (!slot) return "";
    return `<div class="modal-backdrop"><form class="sector-edit-modal" id="sectorEditForm"><div class="modal-head"><h2>${escapeHtml(slot.label)}</h2><button type="button" class="modal-close" data-close-overlay>×</button></div><label class="sector-edit-field"><span>板塊主題或搜尋關鍵字</span><input id="sectorEditInput" name="query" type="text" maxlength="120" value="${escapeHtml(slot.query)}" required></label><div class="sector-edit-actions"><button type="button" class="action-btn" data-close-overlay>取消</button><button class="action-btn primary" type="submit">儲存</button></div></form></div>`;
  }

  function renderProfileModal() {
    if (!state.profileOpen) return "";
    return `<div class="modal-backdrop"><form class="profile-modal" id="profileForm"><div class="modal-head"><h2>投資設定</h2><button type="button" class="modal-close" data-close-overlay>×</button></div><div class="profile-fields"><label><span>可投入資金（USD）</span><input name="capitalUsd" type="number" min="100" step="100" value="${escapeHtml(state.profile.capitalUsd)}" required></label><label><span>單一判斷最大損失</span><div class="input-suffix"><input name="maxLossPercent" type="number" min="0.1" max="10" step="0.1" value="${escapeHtml(state.profile.maxLossPercent)}" required><span>%</span></div></label><label><span>投資期間</span><select name="horizon"><option value="short" ${state.profile.horizon === "short" ? "selected" : ""}>1-4 週</option><option value="swing" ${state.profile.horizon === "swing" ? "selected" : ""}>1-3 個月</option><option value="long" ${state.profile.horizon === "long" ? "selected" : ""}>1 年以上</option></select></label><label class="check-field"><input name="allowShort" type="checkbox" ${state.profile.allowShort ? "checked" : ""}><span>允許做空研究</span></label></div><div class="sector-edit-actions"><button type="button" class="action-btn" data-close-overlay>取消</button><button class="action-btn primary" type="submit">儲存設定</button></div></form></div>`;
  }

  function renderDetailModal() {
    if (!state.detailSymbol) return "";
    const item = findDecision(state.detailSymbol);
    if (!item) return "";
    const watched = state.watchlist.some(function (watch) { return watch.symbol === item.symbol; });
    const links = [
      ["Nasdaq 行情", item.quote.url],
      ["公司官網", item.quote.companyUrl],
      ["SEC EDGAR", item.quote.secUrl],
      ["財務資料", item.fundamentals.sourceUrl],
      ["歷史價格", item.history.sourceUrl],
      ["分析師研究", item.analyst.sourceUrl]
    ].filter(function (link) { return safeUrl(link[1]); });
    const zone = item.entryLow != null && item.entryHigh != null ? formatMoney(item.entryLow) + " - " + formatMoney(item.entryHigh) : "資料不足";
    return `<div class="modal-backdrop detail-backdrop"><section class="stock-detail-modal"><div class="modal-head stock-detail-head"><div><span>${escapeHtml(item.query)}</span><h2>${escapeHtml(item.symbol + " · " + item.name)}</h2></div><button type="button" class="modal-close" data-close-overlay>×</button></div>
      <div class="stock-decision-strip"><b class="status-badge ${statusClass(item.status)}">${escapeHtml(item.status)}</b><button type="button" class="score-link" data-score-axis="decision"><span>決策分數</span><strong>${item.decisionScore}</strong></button><button type="button" class="score-link" data-score-axis="confidence"><span>信心</span><strong>${item.confidenceLabel} · ${item.confidence}</strong></button><button type="button" class="score-link" data-score-axis="risk"><span>風險</span><strong>${item.riskLabel} · ${item.riskScore}</strong></button></div>
      <div class="axis-grid">${renderAxis("證據方向", item.axes.evidence, "evidence")}${renderAxis("基本面", item.axes.fundamentals, "fundamentals")}${renderAxis("估值", item.axes.valuation, "valuation")}${renderAxis("價格趨勢", item.axes.trend, "trend")}</div>
      ${renderScoreFormula(item)}
      <section class="decision-plan"><div><span>現價</span><strong>${formatMoney(item.quote.lastSaleValue)}</strong></div><div><span>20日觀察區間</span><strong>${escapeHtml(zone)}</strong></div><div><span>市場目標價</span><strong>${formatMoney(item.targetPrice)}</strong></div><div><span>判斷失效價格</span><strong>${formatMoney(item.invalidation)}</strong></div><div><span>風險報酬比</span><strong>${item.riskReward == null ? "資料不足" : item.riskReward.toFixed(2)}</strong></div><div><span>研究倉位上限</span><strong>${item.suggestedShares ? item.suggestedShares + " 股 · " + formatMoney(item.suggestedValue) : "不建立"}</strong></div></section>
      <section class="detail-data-grid"><div><h3>財務</h3><dl>${detailMetric("營收成長", formatPercent(item.fundamentals.revenueGrowthPercent))}${detailMetric("營業利益率", formatPercent(item.fundamentals.operatingMarginPercent))}${detailMetric("自由現金流", formatLargeUsd(item.fundamentals.freeCashFlowThousands))}${detailMetric("淨負債", formatLargeUsd(item.fundamentals.netDebtThousands))}</dl></div><div><h3>估值與共識</h3><dl>${detailMetric("市場目標空間", formatPercent(item.targetUpside))}${detailMetric("分析師評級", item.analyst.meanRating || "資料不足")}${detailMetric("分析師覆蓋", item.analyst.analystCount == null ? "資料不足" : item.analyst.analystCount + " 位")}${detailMetric("近四季財報超預期", item.earnings.reportedCount ? item.earnings.beatCount + "/" + item.earnings.reportedCount : "資料不足")}</dl></div></section>
      <section class="catalyst-risk-grid"><div><h3>近期催化</h3>${item.catalyst ? `<a href="${safeUrl(item.catalyst.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.catalyst.title)}</a>` : `<p>尚無公司專屬近 24 小時催化。</p>`}</div><div><h3>反方與風險</h3>${item.risks.length ? `<ul>${item.risks.map(function (risk) { return `<li>${escapeHtml(risk)}</li>`; }).join("")}</ul>` : `<p>目前沒有辨識到重大反方訊號。</p>`}</div></section>
      <section class="official-links"><h3>官方與原始資料</h3><div>${links.map(function (link) { return `<a href="${safeUrl(link[1])}" target="_blank" rel="noopener noreferrer">${escapeHtml(link[0])}</a>`; }).join("")}</div></section>
      <div class="detail-actions"><button type="button" class="action-btn ${watched ? "active" : ""}" data-watch-symbol="${escapeHtml(item.symbol)}">${watched ? "取消追蹤" : "加入追蹤"}</button>${["做多", "做空"].includes(item.status) ? `<button type="button" class="action-btn primary" data-paper-symbol="${escapeHtml(item.symbol)}">建立模擬持倉</button>` : ""}</div>
    </section></div>`;
  }

  function renderAxis(label, value, key) {
    return `<button type="button" class="axis-item" data-score-axis="${escapeHtml(key)}"><div><span>${escapeHtml(label)}</span><strong>${value}</strong></div><div class="axis-track"><i style="width:${clamp(value, 0, 100)}%"></i></div></button>`;
  }

  function renderScoreFormula(item) {
    if (!state.scoreAxis) return "";
    const labels = {
      decision: "決策分數",
      confidence: "信心",
      risk: "風險",
      evidence: "證據方向",
      fundamentals: "基本面",
      valuation: "估值",
      trend: "價格趨勢"
    };
    const totals = {
      decision: item.decisionScore,
      confidence: item.confidence,
      risk: item.riskScore,
      evidence: item.axes.evidence,
      fundamentals: item.axes.fundamentals,
      valuation: item.axes.valuation,
      trend: item.axes.trend
    };
    const parts = (item.scoreDetails || {})[state.scoreAxis] || [];
    return `<section class="score-formula-panel"><div class="score-formula-head"><div><span>${escapeHtml(labels[state.scoreAxis] || "分數")}</span><strong>${escapeHtml(totals[state.scoreAxis])}</strong></div><button type="button" class="mini-btn" data-close-score>收合</button></div><div class="score-formula-rows">${parts.map(function (part) {
      const points = finite(part.points) || 0;
      return `<div><span>${escapeHtml(part.label)}</span><small>${escapeHtml(part.raw)}</small><strong>${points >= 0 ? "+" : ""}${points.toFixed(1)}</strong></div>`;
    }).join("")}</div><small class="score-cap-note">各項先加總並四捨五入，最終分數限制於 0–100。</small></section>`;
  }

  function detailMetric(label, value) {
    return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
  }

  function renderPaperModal() {
    if (!state.paperSymbol) return "";
    const item = findDecision(state.paperSymbol);
    if (!item) return "";
    return `<div class="modal-backdrop"><form class="paper-modal" id="paperForm"><div class="modal-head"><h2>${escapeHtml(item.symbol)} 模擬持倉</h2><button type="button" class="modal-close" data-close-overlay>×</button></div><div class="profile-fields"><label><span>方向</span><select name="side"><option value="做多" ${item.status !== "做空" ? "selected" : ""}>做多</option><option value="做空" ${item.status === "做空" ? "selected" : ""}>做空</option></select></label><label><span>模擬進場價</span><input name="entryPrice" type="number" min="0.01" step="0.01" value="${escapeHtml(item.quote.lastSaleValue || "")}" required></label><label><span>股數</span><input name="shares" type="number" min="1" step="1" value="${escapeHtml(item.suggestedShares || 1)}" required></label></div><div class="sector-edit-actions"><button type="button" class="action-btn" data-close-overlay>取消</button><button class="action-btn primary" type="submit">建立持倉</button></div></form></div>`;
  }

  function toggleWatch(symbol) {
    const index = state.watchlist.findIndex(function (item) { return item.symbol === symbol; });
    if (index >= 0) {
      state.watchlist.splice(index, 1);
      showToast(symbol + " 已取消追蹤");
    } else {
      const decision = findDecision(symbol);
      if (!decision) return;
      state.watchlist.push({
        symbol: decision.symbol,
        name: decision.name,
        query: decision.query,
        status: decision.status,
        price: decision.quote.lastSaleValue,
        targetPrice: decision.targetPrice,
        invalidation: decision.invalidation,
        savedAt: new Date().toISOString()
      });
      showToast(symbol + " 已加入追蹤");
    }
    persist(WATCH_KEY, state.watchlist);
    render();
  }

  function closeOverlays() {
    state.editingSlotId = null;
    state.profileOpen = false;
    state.detailSymbol = null;
    state.paperSymbol = null;
    state.scoreAxis = null;
    renderOverlays();
  }

  document.addEventListener("click", function (event) {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.dataset.navAction === "home" || target.dataset.toolbarAction === "home") {
      state.requestSerial += 1;
      state.layer = "home";
      state.selectedSlotId = null;
      render();
      return;
    }
    if (target.dataset.navAction === "tracking" || target.dataset.toolbarAction === "tracking") {
      state.layer = "tracking";
      render();
      return;
    }
    if (target.dataset.navAction === "profile" || target.dataset.toolbarAction === "profile") {
      state.profileOpen = true;
      renderOverlays();
      return;
    }
    if (target.dataset.openSlot) return void openSector(target.dataset.openSlot);
    if (target.dataset.editSlot) {
      state.editingSlotId = target.dataset.editSlot;
      renderOverlays();
      return;
    }
    if (target.hasAttribute("data-close-overlay")) return closeOverlays();
    if (target.dataset.sectorTab) {
      state.sectorTab = target.dataset.sectorTab;
      render();
      return;
    }
    if (target.dataset.sourceFilter) {
      state.sourceFilter = target.dataset.sourceFilter;
      state.sourcesExpanded = false;
      render();
      return;
    }
    if (target.hasAttribute("data-source-toggle")) {
      state.sourcesExpanded = !state.sourcesExpanded;
      render();
      return;
    }
    if (target.dataset.detailSymbol) {
      state.detailSymbol = target.dataset.detailSymbol;
      state.scoreAxis = null;
      renderOverlays();
      return;
    }
    if (target.dataset.scoreAxis) {
      state.scoreAxis = target.dataset.scoreAxis;
      renderOverlays();
      return;
    }
    if (target.hasAttribute("data-close-score")) {
      state.scoreAxis = null;
      renderOverlays();
      return;
    }
    if (target.dataset.compareSymbol) {
      const symbol = target.dataset.compareSymbol;
      if (state.compareSymbols.has(symbol)) state.compareSymbols.delete(symbol);
      else if (state.compareSymbols.size < 4) state.compareSymbols.add(symbol);
      else showToast("最多同時比較 4 支股票");
      render();
      return;
    }
    if (target.dataset.watchSymbol) return toggleWatch(target.dataset.watchSymbol);
    if (target.dataset.paperSymbol) {
      state.paperSymbol = target.dataset.paperSymbol;
      renderOverlays();
      return;
    }
    if (target.dataset.removeWatch) return toggleWatch(target.dataset.removeWatch);
    if (target.dataset.removePosition) {
      state.positions = state.positions.filter(function (item) { return item.id !== target.dataset.removePosition; });
      persist(PAPER_KEY, state.positions);
      render();
    }
  });

  document.addEventListener("submit", function (event) {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    if (form.id === "sectorEditForm") {
      const slot = state.slots.find(function (item) { return item.id === state.editingSlotId; });
      if (!slot) return;
      slot.query = String(data.get("query") || "").trim().slice(0, 120);
      delete state.analyses[slot.id];
      persist(SLOT_KEY, state.slots);
      state.editingSlotId = null;
      showToast("板塊已儲存");
      render();
      return;
    }
    if (form.id === "profileForm") {
      state.profile = {
        capitalUsd: clamp(finite(data.get("capitalUsd")) || DEFAULT_PROFILE.capitalUsd, 100, 100000000),
        maxLossPercent: clamp(finite(data.get("maxLossPercent")) || DEFAULT_PROFILE.maxLossPercent, 0.1, 10),
        horizon: ["short", "swing", "long"].includes(data.get("horizon")) ? data.get("horizon") : "swing",
        allowShort: data.get("allowShort") === "on"
      };
      persist(PROFILE_KEY, state.profile);
      state.profileOpen = false;
      Object.keys(state.analyses).forEach(function (key) {
        const analysis = state.analyses[key];
        if (analysis && analysis.status === "ready") {
          const slot = state.slots.find(function (item) { return item.id === key; });
          const raw = analysis.data;
          analysis.data.decisions = raw.quotes.map(function (quote) { return buildDecision(quote, raw.evidence, raw.social, slot.query); });
        }
      });
      showToast("投資設定已更新");
      render();
      return;
    }
    if (form.id === "paperForm") {
      const decision = findDecision(state.paperSymbol);
      if (!decision) return;
      const position = {
        id: decision.symbol + "-" + Date.now(),
        symbol: decision.symbol,
        name: decision.name,
        query: decision.query,
        side: data.get("side") === "做空" ? "做空" : "做多",
        entryPrice: finite(data.get("entryPrice")),
        shares: Math.floor(finite(data.get("shares")) || 0),
        invalidation: decision.invalidation,
        targetPrice: decision.targetPrice,
        createdAt: new Date().toISOString()
      };
      if (position.entryPrice && position.shares > 0) state.positions.push(position);
      persist(PAPER_KEY, state.positions);
      state.paperSymbol = null;
      state.detailSymbol = null;
      showToast(decision.symbol + " 模擬持倉已建立");
      render();
    }
  });

  function render() {
    setNav();
    if (state.layer === "sector") return renderSector();
    if (state.layer === "tracking") return renderTracking();
    return renderHome();
  }

  render();
}());
