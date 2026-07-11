(function () {
  "use strict";

  const STORAGE_KEY = "analyst-intel-sector-slots-v2";
  const DEFAULT_SLOTS = [
    { id: "slot-1", label: "推薦板塊 1", query: "AI semiconductor" },
    { id: "slot-2", label: "推薦板塊 2", query: "defense aerospace" },
    { id: "slot-3", label: "推薦板塊 3", query: "entertainment streaming gaming" },
    { id: "slot-4", label: "推薦板塊 4", query: "energy power infrastructure" },
    { id: "slot-5", label: "自訂板塊", query: "uranium nuclear energy" }
  ];

  const positiveSignalTerms = [
    "beat", "beats", "raise", "raises", "raised", "upgrade", "buy", "outperform", "growth", "demand",
    "surge", "record", "strong", "upside", "profit", "margin", "bullish", "contract", "win", "wins",
    "expand", "expands", "approved", "partnership", "rally", "higher", "positive", "受益", "成長",
    "上調", "買進", "看多", "強勁", "需求", "獲利", "訂單", "突破", "新高", "增加"
  ];

  const negativeSignalTerms = [
    "miss", "misses", "cut", "cuts", "downgrade", "sell", "underperform", "weak", "falls", "plunge",
    "risk", "lawsuit", "probe", "delay", "loss", "slowdown", "lower", "bearish", "tariff", "pressure",
    "debt", "bankrupt", "recall", "negative", "下修", "賣出", "看空", "疲弱", "風險", "虧損",
    "放緩", "壓力", "調查", "延遲", "下跌", "衰退", "減少"
  ];

  const state = {
    layer: "home",
    slots: loadSlots(),
    selectedSlotId: null,
    editingSlotId: null,
    sourceFilter: "all",
    analyses: {},
    scoreModal: null,
    requestSerial: 0
  };

  const viewRoot = document.querySelector("#viewRoot");
  const summaryGrid = document.querySelector("#summaryGrid");
  const toolbar = document.querySelector("#toolbar");
  const viewTitle = document.querySelector("#viewTitle");
  const toast = document.querySelector("#toast");

  function liveApiBaseUrl() {
    if (window.location.protocol.startsWith("http") && !["127.0.0.1", "localhost"].includes(window.location.hostname)) {
      return "";
    }
    if (window.location.protocol.startsWith("http") && window.location.port !== "4290") {
      return "";
    }
    const host = window.location.hostname || "127.0.0.1";
    return "http://" + host + ":4318";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeExternalUrl(value) {
    try {
      const url = new URL(String(value || ""));
      if (!["http:", "https:"].includes(url.protocol)) return "";
      return escapeHtml(url.href);
    } catch (error) {
      return "";
    }
  }

  function loadSlots() {
    let saved = [];
    try {
      saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (error) {
      saved = [];
    }
    return DEFAULT_SLOTS.map(function (fallback, index) {
      const candidate = Array.isArray(saved) ? saved.find(function (item) {
        return item && item.id === fallback.id;
      }) || saved[index] : null;
      return {
        id: fallback.id,
        label: fallback.label,
        query: candidate && typeof candidate.query === "string" ? candidate.query.trim().slice(0, 120) : fallback.query
      };
    });
  }

  function saveSlots() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.slots.map(function (slot) {
      return { id: slot.id, label: slot.label, query: slot.query };
    })));
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(function () {
      toast.classList.remove("visible");
    }, 1800);
  }

  async function fetchJsonWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = window.setTimeout(function () {
      controller.abort();
    }, timeoutMs || 55000);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return await response.json();
    } finally {
      window.clearTimeout(timer);
    }
  }

  function currentSlot() {
    return state.slots.find(function (slot) {
      return slot.id === state.selectedSlotId;
    }) || state.slots[0];
  }

  function currentAnalysis() {
    return state.analyses[state.selectedSlotId] || { status: "idle", data: null, error: "" };
  }

  function renderMetricTiles(items) {
    summaryGrid.innerHTML = items.map(function (item) {
      return "<div class=\"metric-tile\"><span>" + escapeHtml(item.label) + "</span><strong>" + escapeHtml(item.value) + "</strong></div>";
    }).join("");
  }

  function renderToolbar(buttons) {
    toolbar.innerHTML = buttons.map(function (button) {
      return "<button class=\"tool-btn " + (button.active ? "active" : "") + "\" type=\"button\" data-action=\"" +
        escapeHtml(button.action) + "\" data-value=\"" + escapeHtml(button.value || "") + "\">" +
        escapeHtml(button.label) + "</button>";
    }).join("");
    toolbar.querySelectorAll("[data-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (button.dataset.action === "home") {
          state.layer = "home";
          state.selectedSlotId = null;
          state.scoreModal = null;
          render();
          return;
        }
        if (button.dataset.action === "sourceFilter") {
          state.sourceFilter = button.dataset.value;
          renderSectorDetail();
        }
      });
    });
  }

  function renderHome() {
    state.layer = "home";
    viewTitle.textContent = "選擇板塊";
    renderToolbar([]);
    renderMetricTiles([
      { label: "可編輯板塊", value: "5" },
      { label: "新聞範圍", value: "24h" },
      { label: "社群門檻", value: "1萬+" },
      { label: "市場資料", value: "即時抓取" }
    ]);

    viewRoot.innerHTML =
      "<section class=\"sector-layout\">" +
        "<div class=\"section-head\"><h2>板塊選擇</h2></div>" +
        "<div class=\"sector-home-grid\">" +
          state.slots.map(renderSectorHomeCard).join("") +
        "</div>" +
      "</section>" +
      renderEditModal();

    document.querySelectorAll("[data-open-slot]").forEach(function (button) {
      button.addEventListener("click", function () {
        openSectorSlot(button.dataset.openSlot);
      });
    });
    document.querySelectorAll("[data-edit-slot]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.editingSlotId = button.dataset.editSlot;
        renderHome();
      });
    });
    wireEditModal();
  }

  function renderSectorHomeCard(slot) {
    const configured = Boolean(slot.query);
    return "<article class=\"sector-card editable-sector-card\">" +
      "<button class=\"sector-card-open\" type=\"button\" data-open-slot=\"" + escapeHtml(slot.id) + "\"" +
        (configured ? "" : " aria-label=\"設定這個板塊\"") + ">" +
        "<span class=\"slot-label\">" + escapeHtml(slot.label) + "</span>" +
        "<h2>" + escapeHtml(slot.query || "尚未設定") + "</h2>" +
        "<div class=\"sector-card-stats\">" +
          "<span>即時搜尋</span><span>行情</span><span>來源可查</span>" +
        "</div>" +
      "</button>" +
      "<button class=\"sector-edit-btn\" type=\"button\" data-edit-slot=\"" + escapeHtml(slot.id) + "\">編輯</button>" +
    "</article>";
  }

  function renderEditModal() {
    if (!state.editingSlotId) return "";
    const slot = state.slots.find(function (item) {
      return item.id === state.editingSlotId;
    });
    if (!slot) return "";
    return "<div class=\"modal-backdrop\" data-edit-close>" +
      "<form class=\"sector-edit-modal\" id=\"sectorEditForm\">" +
        "<div class=\"score-modal-head\">" +
          "<div><h2>" + escapeHtml(slot.label) + "</h2></div>" +
          "<button class=\"modal-close\" type=\"button\" data-edit-close aria-label=\"關閉\">×</button>" +
        "</div>" +
        "<label class=\"sector-edit-field\">" +
          "<span>板塊主題或搜尋關鍵字</span>" +
          "<input id=\"sectorEditInput\" type=\"text\" maxlength=\"120\" value=\"" + escapeHtml(slot.query) +
            "\" placeholder=\"例如：咖啡、遊戲、機器人、太空\">" +
        "</label>" +
        "<div class=\"sector-edit-actions\">" +
          "<button class=\"action-btn\" type=\"button\" data-edit-close>取消</button>" +
          "<button class=\"action-btn primary\" type=\"submit\">儲存</button>" +
        "</div>" +
      "</form>" +
    "</div>";
  }

  function wireEditModal() {
    document.querySelectorAll("[data-edit-close]").forEach(function (node) {
      node.addEventListener("click", function (event) {
        if (node.classList.contains("modal-backdrop") && event.target !== node) return;
        state.editingSlotId = null;
        renderHome();
      });
    });
    const form = document.querySelector("#sectorEditForm");
    if (!form) return;
    window.setTimeout(function () {
      document.querySelector("#sectorEditInput")?.focus();
    }, 0);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const slot = state.slots.find(function (item) {
        return item.id === state.editingSlotId;
      });
      const input = document.querySelector("#sectorEditInput");
      if (!slot || !input) return;
      slot.query = input.value.trim().slice(0, 120);
      delete state.analyses[slot.id];
      saveSlots();
      state.editingSlotId = null;
      renderHome();
      showToast("板塊已儲存");
    });
  }

  async function openSectorSlot(slotId) {
    const slot = state.slots.find(function (item) {
      return item.id === slotId;
    });
    if (!slot) return;
    if (!slot.query) {
      state.editingSlotId = slot.id;
      renderHome();
      return;
    }
    const serial = ++state.requestSerial;
    state.layer = "sector";
    state.selectedSlotId = slot.id;
    state.sourceFilter = "all";
    state.scoreModal = null;
    state.analyses[slot.id] = { status: "loading", data: null, error: "" };
    render();
    try {
      const payload = await fetchJsonWithTimeout(
        liveApiBaseUrl() + "/api/custom-sector?q=" + encodeURIComponent(slot.query) + "&t=" + Date.now(),
        55000
      );
      if (serial !== state.requestSerial) return;
      state.analyses[slot.id] = { status: "ready", data: payload, error: "" };
    } catch (error) {
      if (serial !== state.requestSerial) return;
      state.analyses[slot.id] = { status: "error", data: null, error: String(error) };
    }
    if (state.layer === "sector" && state.selectedSlotId === slot.id) renderSectorDetail();
  }

  function sourceTypes(sources) {
    return ["all"].concat(Array.from(new Set(sources.map(function (source) {
      return source.type;
    }))));
  }

  function marketPreviewItem(quote) {
    const change = Number(quote.changePercentValue);
    const changeText = Number.isFinite(change) ? (change > 0 ? "+" : "") + change.toFixed(2) + "%" : quote.percentageChange || "";
    return {
      title: quote.symbol + " " + (quote.lastSalePrice || "無價格") + " " + changeText,
      url: quote.url,
      source: "Nasdaq · " + (quote.exchange || "Market"),
      summary: "最近交易日 " + (quote.lastTradeTimestamp || "未提供") + "；52 週區間 " + (quote.range52Week || "未提供") + "。",
      contentKind: "market",
      marketChangePercent: Number.isFinite(change) ? change : null,
      authorityWeight: 1.4,
      symbols: [quote.symbol]
    };
  }

  function buildLiveSector(slot, data) {
    const quotes = Array.isArray(data && data.quotes) ? data.quotes : [];
    const evidence = Array.isArray(data && data.evidence) ? data.evidence : [];
    const social = Array.isArray(data && data.social) ? data.social : [];
    const marketSources = quotes.map(function (quote) {
      return {
        id: "market-" + quote.symbol,
        type: "行情",
        label: quote.symbol + " · " + quote.name,
        url: quote.url,
        note: (quote.lastSalePrice || "無價格") + " · " + (quote.percentageChange || "無漲跌") + " · " + (quote.exchange || "市場"),
        previewItems: [marketPreviewItem(quote)]
      };
    });
    const officialSources = [];
    quotes.forEach(function (quote) {
      if (quote.companyUrl) {
        officialSources.push({
          id: "official-" + quote.symbol,
          type: "公司官網",
          label: quote.name + " 官網",
          url: quote.companyUrl,
          note: [quote.sector, quote.industry].filter(Boolean).join(" · ") || "Nasdaq 公司資料驗證",
          previewItems: quote.companyDescription ? [{
            title: quote.name,
            url: quote.companyUrl,
            source: "公司官網",
            summary: quote.companyDescription,
            contentKind: "official",
            authorityWeight: 1.5,
            symbols: [quote.symbol]
          }] : []
        });
      }
      if (quote.secUrl) {
        officialSources.push({
          id: "sec-" + quote.symbol,
          type: "官方申報",
          label: quote.symbol + " · SEC EDGAR",
          url: quote.secUrl,
          note: "美國證券交易委員會公司申報入口"
        });
      }
    });
    const newsSources = evidence.map(function (item, index) {
      return {
        id: "news-" + index,
        type: item.sourceType || "新聞",
        label: item.title,
        url: item.url,
        note: (item.source || "來源網站") + " · " + formatAge(item.ageHours),
        previewItems: [item]
      };
    });
    const socialSources = social.map(function (item, index) {
      return {
        id: "social-" + index,
        type: item.platform || item.sourceType || "社群",
        label: item.title,
        url: item.url,
        note: (item.source || item.platform || "社群") + " · 已驗證 " + formatAudience(item.audienceCount),
        previewItems: [item]
      };
    });
    const sources = marketSources.concat(officialSources, newsSources, socialSources);
    const recommendations = quotes.map(function (quote) {
      const relatedNews = evidence.map(function (item, index) {
        return Array.isArray(item.symbols) && item.symbols.includes(quote.symbol) ? "news-" + index : "";
      }).filter(Boolean);
      const relatedSocial = social.map(function (item, index) {
        return Array.isArray(item.symbols) && item.symbols.includes(quote.symbol) ? "social-" + index : "";
      }).filter(Boolean);
      return {
        symbol: quote.symbol,
        name: quote.name,
        quote: quote,
        evidence: ["market-" + quote.symbol].concat(relatedNews, relatedSocial)
      };
    });
    return {
      id: slot.id,
      name: slot.query,
      sources: sources,
      quotes: quotes,
      social: social,
      recommendations: recommendations,
      validation: ((data && data.freshness && data.freshness.comparisons) || [])
    };
  }

  function evidenceSourcesForItem(item, sources) {
    return (item.evidence || []).map(function (id) {
      return sources.find(function (source) {
        return source.id === id;
      });
    }).filter(Boolean);
  }

  function usablePreviewItems(source) {
    return (source.previewItems || []).filter(function (item) {
      return item && item.url && item.title;
    });
  }

  function countTerms(text, terms) {
    const normalized = String(text || "").toLowerCase();
    return terms.reduce(function (total, term) {
      return total + (normalized.includes(term.toLowerCase()) ? 1 : 0);
    }, 0);
  }

  function roundSignal(value) {
    return Math.round(value * 10) / 10;
  }

  function evidenceSignal(items) {
    return items.reduce(function (signal, item) {
      if (item.contentKind === "market") {
        const change = Number(item.marketChangePercent);
        if (Number.isFinite(change) && Math.abs(change) >= 0.05) {
          const weight = Math.min(3, 0.5 + Math.abs(change) / 1.5);
          if (change > 0) signal.positive += weight;
          if (change < 0) signal.negative += weight;
          signal.marketChange = change;
        }
        return signal;
      }
      const weight = Number(item.authorityWeight) || (item.contentKind === "social" ? 0.8 : 1);
      const text = String(item.title || "") + " " + String(item.summary || "");
      signal.positive += countTerms(text, positiveSignalTerms) * weight;
      signal.negative += countTerms(text, negativeSignalTerms) * weight;
      return signal;
    }, { positive: 0, negative: 0, marketChange: null });
  }

  function computeLiveRecommendation(item, sources) {
    const liveSources = evidenceSourcesForItem(item, sources).filter(function (source) {
      return usablePreviewItems(source).length > 0;
    });
    const liveItems = liveSources.flatMap(function (source) {
      return usablePreviewItems(source);
    });
    const researchItems = liveItems.filter(function (sourceItem) {
      return ["news", "social"].includes(sourceItem.contentKind);
    });
    const marketItems = liveItems.filter(function (sourceItem) {
      return sourceItem.contentKind === "market";
    });
    if (!researchItems.length || !marketItems.length) {
      return Object.assign({}, item, { liveReady: true, hasLiveEvidence: false, liveSources: liveSources, liveItems: liveItems });
    }

    const signal = evidenceSignal(liveItems);
    const netSignal = signal.positive - signal.negative;
    if (Math.abs(netSignal) < 0.35) {
      return Object.assign({}, item, { liveReady: true, hasLiveEvidence: false, liveSources: liveSources, liveItems: liveItems });
    }
    const side = netSignal < 0 ? "Short" : "Long";
    const baseScore = 25;
    const qualityScore = Math.min(25, Math.round(researchItems.reduce(function (total, sourceItem) {
      return total + (Number(sourceItem.authorityWeight) || 1) * 5;
    }, 0)));
    const contentKinds = new Set(researchItems.map(function (sourceItem) {
      return sourceItem.contentKind + ":" + (sourceItem.platform || sourceItem.source || "");
    }));
    const coverageScore = Math.min(20, researchItems.length * 3 + contentKinds.size * 3);
    const signalTotal = signal.positive + signal.negative;
    const consensusScore = signalTotal ? Math.min(15, Math.round(Math.abs(netSignal) / signalTotal * 15)) : 0;
    const ages = researchItems.map(function (sourceItem) {
      return Number(sourceItem.ageHours);
    }).filter(Number.isFinite);
    const newestAge = ages.length ? Math.min.apply(Math, ages) : 24;
    const freshnessScore = newestAge <= 3 ? 15 : newestAge <= 8 ? 12 : newestAge <= 16 ? 8 : 4;
    const confidence = baseScore + qualityScore + coverageScore + consensusScore + freshnessScore;
    const marketText = Number.isFinite(signal.marketChange)
      ? "；最近交易日漲跌 " + (signal.marketChange > 0 ? "+" : "") + signal.marketChange.toFixed(2) + "%"
      : "";
    const rationale = "使用 " + researchItems.length + " 則近 24 小時內容與 Nasdaq 行情計算" + marketText +
      "；正向加權 " + roundSignal(signal.positive) + "、負向加權 " + roundSignal(signal.negative) +
      "，方向為" + (side === "Short" ? "做空" : "做多") + "研究。";

    return Object.assign({}, item, {
      side: side,
      confidence: confidence,
      rationale: rationale,
      liveReady: true,
      hasLiveEvidence: true,
      liveSources: liveSources,
      liveItems: liveItems,
      liveResearchItems: researchItems,
      livePositive: roundSignal(signal.positive),
      liveNegative: roundSignal(signal.negative),
      liveBase: baseScore,
      liveQuality: qualityScore,
      liveCoverage: coverageScore,
      liveConsensus: consensusScore,
      liveFreshness: freshnessScore
    });
  }

  function liveRecommendationsForSector(sector) {
    const computed = sector.recommendations.map(function (item) {
      return computeLiveRecommendation(item, sector.sources);
    });
    return { ready: true, items: computed.filter(function (item) {
      return item.hasLiveEvidence;
    }) };
  }

  function renderSectorDetail() {
    const slot = currentSlot();
    const analysis = currentAnalysis();
    viewTitle.textContent = slot.query;
    renderToolbar([{ label: "回板塊", action: "home", value: "home", active: false }]);

    if (analysis.status === "loading") {
      renderMetricTiles([
        { label: "狀態", value: "搜尋中" },
        { label: "行情", value: "抓取中" },
        { label: "新聞", value: "24h" },
        { label: "社群門檻", value: "1萬+" }
      ]);
      viewRoot.innerHTML = "<section class=\"sector-layout\"><section class=\"board-card loading-panel\"><div class=\"loading-indicator\"></div><h2>正在建立即時分析</h2></section></section>";
      return;
    }

    if (analysis.status === "error") {
      renderMetricTiles([
        { label: "狀態", value: "連線失敗" },
        { label: "行情標的", value: "0" },
        { label: "可查來源", value: "0" },
        { label: "研究建議", value: "0" }
      ]);
      viewRoot.innerHTML = "<section class=\"sector-layout\"><section class=\"board-card\">" +
        renderEmpty("這次即時資料連線失敗，請回到首頁重新開啟板塊。") + "</section></section>";
      return;
    }

    const sector = buildLiveSector(slot, analysis.data || {});
    const liveRecommendations = liveRecommendationsForSector(sector);
    const types = sourceTypes(sector.sources);
    renderToolbar([
      { label: "回板塊", action: "home", value: "home", active: false }
    ].concat(types.map(function (type) {
      return {
        label: type === "all" ? "全部來源" : type,
        action: "sourceFilter",
        value: type,
        active: state.sourceFilter === type
      };
    })));
    const filteredSources = sector.sources.filter(function (source) {
      return state.sourceFilter === "all" || source.type === state.sourceFilter;
    });
    renderMetricTiles([
      { label: "行情標的", value: sector.quotes.length },
      { label: "可查來源", value: filteredSources.length },
      { label: "研究建議", value: liveRecommendations.items.length },
      { label: "1萬+ 社群", value: sector.social.length }
    ]);

    viewRoot.innerHTML =
      "<section class=\"sector-layout\">" +
        "<section class=\"board-card market-board\">" +
          "<div class=\"section-head\"><h2>行情</h2></div>" +
          renderMarketBoard(sector.quotes) +
        "</section>" +
        "<div class=\"layer-grid\">" +
          "<section class=\"board-card\">" +
            "<div class=\"section-head\"><h2>1. 資料來源</h2></div>" +
            "<div class=\"source-list\">" +
              (filteredSources.map(renderSource).join("") || renderEmpty("目前沒有通過驗證的來源。")) +
            "</div>" +
          "</section>" +
          "<section class=\"board-card\">" +
            "<div class=\"section-head\"><h2>2. Long / Short 研究建議</h2></div>" +
            "<div class=\"recommendation-list\">" + renderRecommendationList(liveRecommendations, sector.sources) + "</div>" +
          "</section>" +
        "</div>" +
        "<section class=\"board-card\">" +
          "<div class=\"section-head\"><h2>3. 歷史驗證</h2></div>" +
          renderValidationTable(sector.validation) +
        "</section>" +
      "</section>" +
      renderScoreModal();
    wireScoreButtons(liveRecommendations.items, sector.sources);
    wireScoreModal();
  }

  function renderMarketBoard(quotes) {
    if (!quotes.length) return renderEmpty("沒有取得可驗證的上市股票行情。");
    return "<div class=\"market-grid\">" + quotes.map(function (quote) {
      const change = Number(quote.changePercentValue);
      const directionClass = Number.isFinite(change) ? (change >= 0 ? "gain" : "loss") : "";
      const changeText = Number.isFinite(change) ? (change > 0 ? "+" : "") + change.toFixed(2) + "%" : quote.percentageChange || "無漲跌";
      const url = safeExternalUrl(quote.url);
      return "<a class=\"market-quote external-link\" href=\"" + url + "\" target=\"_blank\" rel=\"noopener noreferrer\">" +
        "<div class=\"market-quote-head\"><strong>" + escapeHtml(quote.symbol) + "</strong><span>" + escapeHtml(quote.exchange || "Market") + "</span></div>" +
        "<h3>" + escapeHtml(quote.name) + "</h3>" +
        "<div class=\"market-price\">" + escapeHtml(quote.lastSalePrice || "N/A") + "</div>" +
        "<div class=\"market-change " + directionClass + "\">" + escapeHtml(changeText) + "</div>" +
        "<small>" + escapeHtml(quote.lastTradeTimestamp || "最近交易日") + "</small>" +
      "</a>";
    }).join("") + "</div>";
  }

  function renderSource(source) {
    const url = safeExternalUrl(source.url);
    const primary = url
      ? "<a class=\"evidence-primary external-link\" href=\"" + url + "\" target=\"_blank\" rel=\"noopener noreferrer\">" +
          "<strong>" + escapeHtml(source.label) + "</strong><span>" + escapeHtml(source.type + " · " + source.note) + "</span></a>"
      : "<div class=\"evidence-primary\"><strong>" + escapeHtml(source.label) + "</strong><span>" +
          escapeHtml(source.type + " · " + source.note) + "</span></div>";
    return "<article class=\"evidence-link\">" + primary + renderSourcePreview(source) + "</article>";
  }

  function renderSourcePreview(source) {
    const items = usablePreviewItems(source);
    if (!items.length) return "";
    return "<div class=\"source-preview\">" + items.slice(0, 2).map(function (item) {
      const url = safeExternalUrl(item.url);
      const kind = item.contentKind === "market" ? "最近交易日"
        : item.contentKind === "official" ? "官方資料"
        : item.contentKind === "social" ? "近24h · 已驗證 " + formatAudience(item.audienceCount)
        : "近24h";
      return "<div class=\"preview-kicker\">" + escapeHtml(kind) + "</div>" +
        "<a class=\"preview-item external-link\" href=\"" + url + "\" target=\"_blank\" rel=\"noopener noreferrer\">" +
          "<strong>" + escapeHtml(item.title) + "</strong>" +
          "<span>" + escapeHtml((item.source || "來源網站") + (item.ageHours == null ? "" : " · " + formatAge(item.ageHours))) + "</span>" +
          (item.summary ? "<small>" + escapeHtml(item.summary) + "</small>" : "") +
        "</a>";
    }).join("") + "</div>";
  }

  function renderRecommendationList(liveRecommendations, sources) {
    if (liveRecommendations.items.length) {
      return liveRecommendations.items.map(function (item) {
        return renderRecommendation(item, sources);
      }).join("");
    }
    return renderEmpty("沒有同時具備近 24 小時內容、可驗證行情與明確方向的標的。");
  }

  function renderRecommendation(item, sources) {
    const isShort = item.side === "Short";
    const evidenceLinks = item.liveSources || evidenceSourcesForItem(item, sources);
    return "<article class=\"recommendation-card " + (isShort ? "short" : "long") + "\">" +
      "<div class=\"recommendation-head\">" +
        "<div><h3>" + escapeHtml(item.symbol + " · " + item.name) + "</h3><span>" +
          (isShort ? "建議做空研究" : "建議做多研究") + "</span></div>" +
        "<button class=\"score-button\" type=\"button\" data-score-symbol=\"" + escapeHtml(item.symbol) +
          "\" aria-label=\"查看 " + escapeHtml(item.symbol) + " 分數計算\">" + escapeHtml(item.confidence) + "</button>" +
      "</div>" +
      "<div class=\"tag-row\">" + evidenceLinks.slice(0, 6).map(function (source) {
        const url = safeExternalUrl(source.url);
        return url ? "<a class=\"tag tag-link external-link\" href=\"" + url + "\" target=\"_blank\" rel=\"noopener noreferrer\">" +
          escapeHtml(source.type) + "</a>" : "";
      }).join("") + "</div>" +
      "<p>" + escapeHtml(item.rationale) + "</p>" +
    "</article>";
  }

  function scoreBreakdown(item) {
    return {
      total: item.confidence,
      rows: [
        { label: "可計算基礎", value: item.liveBase, note: "同時具備可開啟的近 24 小時內容與 Nasdaq 行情。" },
        { label: "來源品質", value: item.liveQuality, note: "依官方、權威新聞、一般新聞與通過門檻社群加權。" },
        { label: "來源覆蓋", value: item.liveCoverage, note: item.liveResearchItems.length + " 則近 24 小時內容納入計算。" },
        { label: "方向共識", value: item.liveConsensus, note: "正向 " + item.livePositive + "、負向 " + item.liveNegative + "。" },
        { label: "新鮮度", value: item.liveFreshness, note: "只納入 24 小時內內容，越新分數越高。" },
        { label: "方向", value: item.side === "Short" ? "做空" : "做多", note: item.rationale }
      ],
      evidenceLinks: item.liveSources || []
    };
  }

  function renderScoreModal() {
    if (!state.scoreModal) return "";
    const item = state.scoreModal.item;
    const breakdown = scoreBreakdown(item);
    return "<div class=\"modal-backdrop\" data-modal-close>" +
      "<section class=\"score-modal\" role=\"dialog\" aria-modal=\"true\" aria-label=\"" + escapeHtml(item.symbol) + " 分數計算\">" +
        "<div class=\"score-modal-head\">" +
          "<div><h2>" + escapeHtml(item.symbol + " · " + item.name) + "</h2><span>即時計算分數</span></div>" +
          "<button class=\"modal-close\" type=\"button\" data-modal-close aria-label=\"關閉\">×</button>" +
        "</div>" +
        "<div class=\"score-total\">" + escapeHtml(breakdown.total) + "</div>" +
        "<div class=\"score-breakdown\">" + breakdown.rows.map(function (row) {
          const value = typeof row.value === "number" ? (row.value > 0 ? "+" : "") + row.value : row.value;
          return "<div class=\"score-row\"><strong>" + escapeHtml(row.label) + "</strong><span>" +
            escapeHtml(value) + "</span><small>" + escapeHtml(row.note) + "</small></div>";
        }).join("") + "</div>" +
        "<div class=\"score-evidence\">" + breakdown.evidenceLinks.map(function (source) {
          const url = safeExternalUrl(source.url);
          return url ? "<a class=\"tag tag-link external-link\" href=\"" + url + "\" target=\"_blank\" rel=\"noopener noreferrer\">" +
            escapeHtml(source.type + " · " + source.label) + "</a>" : "";
        }).join("") + "</div>" +
      "</section>" +
    "</div>";
  }

  function wireScoreButtons(items, sources) {
    document.querySelectorAll("[data-score-symbol]").forEach(function (button) {
      button.addEventListener("click", function () {
        const item = items.find(function (candidate) {
          return candidate.symbol === button.dataset.scoreSymbol;
        });
        if (!item) return;
        state.scoreModal = { item: item, sources: sources };
        renderSectorDetail();
      });
    });
  }

  function wireScoreModal() {
    document.querySelectorAll("[data-modal-close]").forEach(function (node) {
      node.addEventListener("click", function (event) {
        if (node.classList.contains("modal-backdrop") && event.target !== node) return;
        state.scoreModal = null;
        renderSectorDetail();
      });
    });
  }

  function renderValidationTable(items) {
    if (!items.length) return renderEmpty("尚無前一交易日快照。");
    return "<div class=\"table-shell validation-table\">" +
      "<div class=\"table-row table-head\"><span>Symbol</span><span>Window</span><span>Result</span><span>Status</span><span>Price</span></div>" +
      items.map(function (item) {
        const result = Number(item.returnPercent);
        const direction = result >= 0 ? "Up" : "Down";
        return "<div class=\"table-row\">" +
          "<div><strong>" + escapeHtml(item.symbol) + "</strong></div>" +
          "<span>" + escapeHtml(item.fromDate + " → " + item.toDate) + "</span>" +
          "<strong>" + escapeHtml((result > 0 ? "+" : "") + result.toFixed(2) + "%") + "</strong>" +
          "<strong class=\"" + (result >= 0 ? "gain" : "loss") + "\">" + direction + "</strong>" +
          "<small>" + escapeHtml(item.previousPrice + " → " + item.currentPrice) + "</small>" +
        "</div>";
      }).join("") +
    "</div>";
  }

  function formatAge(value) {
    const age = Number(value);
    if (!Number.isFinite(age)) return "24h 內";
    if (age < 1) return "1h 內";
    return Math.ceil(age) + "h 內";
  }

  function formatAudience(value) {
    const count = Number(value);
    if (!Number.isFinite(count)) return "1萬+";
    if (count >= 1000000) return (count / 1000000).toFixed(count >= 10000000 ? 0 : 1) + "M";
    if (count >= 10000) return (count / 10000).toFixed(count >= 100000 ? 0 : 1) + "萬";
    return count.toLocaleString("zh-TW");
  }

  function renderEmpty(message) {
    return "<div class=\"empty\">" + escapeHtml(message) + "</div>";
  }

  function render() {
    document.querySelector("[data-nav-action='home']")?.classList.toggle("active", state.layer === "home");
    if (state.layer === "home") renderHome();
    if (state.layer === "sector") renderSectorDetail();
  }

  document.querySelector("[data-nav-action='home']")?.addEventListener("click", function () {
    state.requestSerial += 1;
    state.layer = "home";
    state.selectedSlotId = null;
    state.scoreModal = null;
    render();
  });

  render();
}());
