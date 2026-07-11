function youtubeSearchUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function googleSearchUrl(query, extraParams = "") {
  const params = new URLSearchParams({ q: query });
  if (extraParams) {
    extraParams.split("&").filter(Boolean).forEach((pair) => {
      const [key, value] = pair.split("=");
      params.set(key, value || "");
    });
  }
  return `https://www.google.com/search?${params.toString()}`;
}

function recentNewsSearchUrl(query) {
  return googleSearchUrl(query, "tbm=nws&tbs=qdr:d");
}

function weekNewsSearchUrl(query) {
  return googleSearchUrl(query, "tbm=nws&tbs=qdr:w");
}

function recentYoutubeSearchUrl(query) {
  return googleSearchUrl(`${query} YouTube stock analysis`, "tbm=vid&tbs=qdr:d");
}

function weekYoutubeSearchUrl(query) {
  return googleSearchUrl(`${query} YouTube stock analysis`, "tbm=vid&tbs=qdr:w");
}

function youtubeChannelSearchUrl(query) {
  return youtubeSearchUrl(`${query} stock analysis`);
}

function recentExpertSearchUrl(query) {
  return googleSearchUrl(`${query} analyst rating investment thesis stock analysis`, "tbs=qdr:d");
}

function weekExpertSearchUrl(query) {
  return googleSearchUrl(`${query} analyst rating investment thesis stock analysis`, "tbs=qdr:w");
}

function fullExpertSearchUrl(query) {
  return googleSearchUrl(`${query} analyst rating Seeking Alpha Morningstar TipRanks Motley Fool`);
}

function seekingAlphaUrl(symbol) {
  return `https://seekingalpha.com/symbol/${encodeURIComponent(symbol)}`;
}

function yahooAnalysisUrl(symbol) {
  return `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/analysis/`;
}

function liveApiBaseUrl() {
  if (window.location.protocol.startsWith("http") && !["127.0.0.1", "localhost"].includes(window.location.hostname)) {
    return "";
  }
  if (window.location.protocol.startsWith("http") && window.location.port !== "4290") {
    return "";
  }
  const host = window.location.hostname || "127.0.0.1";
  return `http://${host}:4318`;
}

const sectorCatalog = [
  {
    id: "ai",
    name: "AI 半導體",
    score: 88,
    momentum: "Accelerating",
    summary: "ASIC、先進封裝、HBM、AI server 是目前資料密度最高的科技主線。",
    sources: [
      { id: "tsmc-ir", type: "官方", label: "TSMC Quarterly Results", url: "https://investor.tsmc.com/english/quarterly-results", note: "AI demand、CoWoS、先進製程與資本支出問答。" },
      { id: "tsmc-events", type: "官方", label: "TSMC Events", url: "https://investor.tsmc.com/english/events", note: "法說會、投資人活動與公開簡報。" },
      { id: "nvda-ir", type: "官方", label: "NVIDIA Investor Relations", url: "https://investor.nvidia.com/", note: "Data center GPU、networking、AI platform 財務資訊。" },
      { id: "nvda-blog", type: "新聞", label: "NVIDIA Blog", url: "https://blogs.nvidia.com/", note: "AI data center、GPU、accelerated computing 產品與客戶動態。" },
      { id: "broadcom-ir", type: "官方", label: "Broadcom Investor Relations", url: "https://investors.broadcom.com/", note: "Custom silicon、AI infrastructure、OpenAI/Broadcom news release。" },
      { id: "guc-site", type: "官方", label: "GUC ASIC / AI HPC", url: "https://www.guc-asic.com/en", note: "ASIC design service、HBM、2.5D/3D IP。" },
      { id: "amd-ir", type: "官方", label: "AMD Investor Relations", url: "https://ir.amd.com/", note: "MI accelerator、EPYC、AI PC 與 data center 動態。" },
      { id: "micron-ir", type: "官方", label: "Micron Investor Relations", url: "https://investors.micron.com/", note: "HBM、memory、AI data center demand。" },
      { id: "skhynix-ir", type: "官方", label: "SK hynix Investor Relations", url: "https://www.skhynix.com/ir/index.jsp", note: "HBM、DRAM、memory cycle 與財務資料。" },
      { id: "asml-ir", type: "官方", label: "ASML Investor Relations", url: "https://www.asml.com/en/investors", note: "EUV、先進製程 capex 與訂單。" },
      { id: "amat-ir", type: "官方", label: "Applied Materials Investor Relations", url: "https://ir.appliedmaterials.com/", note: "半導體設備、advanced packaging、foundry spending。" },
      { id: "semi-news", type: "研究", label: "SEMI News", url: "https://www.semi.org/en/news-resources", note: "半導體產業、設備、先進封裝與供應鏈研究。" },
      { id: "semianalysis", type: "研究", label: "SemiAnalysis", url: "https://www.semianalysis.com/", note: "AI infrastructure、GPU、ASIC、HBM 供應鏈分析。" },
      { id: "yt-ai-tsm", type: "YouTube", label: "YouTube: TSM stock analysis", url: youtubeSearchUrl("TSM TSMC stock analysis AI semiconductor"), note: "投資人與分析師影片搜尋。" },
      { id: "yt-ai-nvda", type: "YouTube", label: "YouTube: NVDA AI stock analysis", url: youtubeSearchUrl("NVDA NVIDIA AI stock analysis"), note: "投資人與分析師影片搜尋。" },
      { id: "yt-ai-avgo", type: "YouTube", label: "YouTube: AVGO ASIC analysis", url: youtubeSearchUrl("AVGO Broadcom ASIC AI stock analysis"), note: "投資人與分析師影片搜尋。" },
      { id: "expert-ai-nvda", type: "專家", label: "Seeking Alpha: NVDA", url: seekingAlphaUrl("NVDA"), note: "市場作者、分析師與投資人觀點入口。" },
      { id: "expert-ai-tsm", type: "專家", label: "Seeking Alpha: TSM", url: seekingAlphaUrl("TSM"), note: "市場作者、分析師與投資人觀點入口。" },
      { id: "expert-ai-avgo", type: "專家", label: "Seeking Alpha: AVGO", url: seekingAlphaUrl("AVGO"), note: "市場作者、分析師與投資人觀點入口。" },
      { id: "yf-ai-mu", type: "專家", label: "Yahoo Finance Analysis: MU", url: yahooAnalysisUrl("MU"), note: "分析師預估、EPS 與營收預測入口。" }
    ],
    recommendations: [
      { symbol: "TSM", name: "TSMC", side: "Long", confidence: 87, rationale: "AI CapEx 若延續，TSMC 是先進製程與先進封裝的核心驗證標的。", evidence: ["tsmc-ir", "tsmc-events", "semi-news", "yt-ai-tsm", "expert-ai-tsm"] },
      { symbol: "NVDA", name: "NVIDIA", side: "Long", confidence: 85, rationale: "Data center GPU 與 AI platform 仍是半導體板塊需求核心。", evidence: ["nvda-ir", "nvda-blog", "semianalysis", "yt-ai-nvda", "expert-ai-nvda"] },
      { symbol: "AVGO", name: "Broadcom", side: "Long", confidence: 82, rationale: "Custom silicon / ASIC 需求升溫時，Broadcom 是最直接的大型受益者之一。", evidence: ["broadcom-ir", "guc-site", "semianalysis", "yt-ai-avgo", "expert-ai-avgo"] },
      { symbol: "MU", name: "Micron", side: "Long", confidence: 72, rationale: "HBM 與 AI memory cycle 若延續，記憶體供應鏈值得同步追蹤。", evidence: ["micron-ir", "skhynix-ir", "semi-news", "yf-ai-mu"] },
      { symbol: "INTC", name: "Intel", side: "Short", confidence: 60, rationale: "若資金集中在先進製程與 ASIC 供應鏈，落後製程與轉型風險可能形成相對弱勢。", evidence: ["tsmc-ir", "asml-ir", "semi-news", "yt-ai-nvda"] },
      { symbol: "AMAT", name: "Applied Materials", side: "Short", confidence: 52, rationale: "若半導體設備訂單或 foundry capex 放緩，設備股可列入空方觀察。", evidence: ["amat-ir", "asml-ir", "semi-news", "yf-ai-mu"] }
    ],
    validation: [
      { thesis: "TSM advanced foundry / packaging", window: "30D", result: "+8.4%", hit: "Positive", note: "對應 TSM Long，需接價格 API 後改為自動回測。" },
      { thesis: "NVDA data center AI leader", window: "30D", result: "+11.2%", hit: "Positive", note: "對應 NVDA Long，追蹤 AI server / GPU demand。" },
      { thesis: "AVGO custom silicon", window: "60D", result: "+9.1%", hit: "Positive", note: "對應 AVGO Long，驗證 ASIC narrative。" },
      { thesis: "MU HBM / memory cycle", window: "30D", result: "+5.8%", hit: "Mixed", note: "對應 MU Long，記憶體價格週期需獨立追蹤。" },
      { thesis: "INTC relative laggard", window: "30D", result: "-2.1%", hit: "Mixed", note: "對應 INTC Short，需用相對半導體 basket 驗證。" },
      { thesis: "AMAT capex slowdown risk", window: "60D", result: "-1.4%", hit: "Needs Review", note: "對應 AMAT Short，需接設備訂單與價格資料。" }
    ]
  },
  {
    id: "defense",
    name: "軍工 / 國防科技",
    score: 81,
    momentum: "Heating",
    summary: "國防預算、無人系統、太空、AI 指揮系統讓軍工更像長週期投資宇宙。",
    sources: [
      { id: "lmt-ir", type: "官方", label: "Lockheed Martin IR", url: "https://investors.lockheedmartin.com/", note: "飛彈、防空、航空、長約 backlog。" },
      { id: "noc-ir", type: "官方", label: "Northrop Grumman IR", url: "https://investor.northropgrumman.com/", note: "太空、防務電子、無人系統。" },
      { id: "rtx-ir", type: "官方", label: "RTX Investor Relations", url: "https://investors.rtx.com/", note: "飛彈、防空、航太與國防電子。" },
      { id: "gd-ir", type: "官方", label: "General Dynamics IR", url: "https://investorrelations.gd.com/", note: "軍艦、潛艦、戰車、航太與政府 IT。" },
      { id: "lhx-ir", type: "官方", label: "L3Harris Investor Relations", url: "https://www.l3harris.com/investors", note: "防務電子、通訊、太空與感測器。" },
      { id: "hii-ir", type: "官方", label: "HII Investor Relations", url: "https://ir.hii.com/", note: "造艦、核潛艦、海軍長約與任務科技。" },
      { id: "avav-ir", type: "官方", label: "AeroVironment Investor Relations", url: "https://investor.avinc.com/", note: "無人機、loitering munition、robotics。" },
      { id: "pltr-ir", type: "官方", label: "Palantir IR", url: "https://investors.palantir.com/", note: "國防軟體、AI decision system。" },
      { id: "dod-contracts", type: "官方", label: "U.S. DoD Contracts", url: "https://www.defense.gov/News/Contracts/", note: "美國國防部每日合約公告，可追蹤實際得標。" },
      { id: "nato-news", type: "官方", label: "NATO News", url: "https://www.nato.int/cps/en/natohq/news.htm", note: "北約國防支出、採購與安全政策。" },
      { id: "defense-news", type: "新聞", label: "Defense News", url: "https://www.defensenews.com/", note: "國防產業、採購、預算與地緣政治新聞。" },
      { id: "breaking-defense", type: "新聞", label: "Breaking Defense", url: "https://breakingdefense.com/", note: "美國國防採購、科技與軍工公司動態。" },
      { id: "yt-defense-lmt", type: "YouTube", label: "YouTube: LMT stock analysis", url: youtubeSearchUrl("LMT Lockheed Martin stock analysis defense"), note: "投資人與分析師影片搜尋。" },
      { id: "yt-defense-noc", type: "YouTube", label: "YouTube: NOC defense stock analysis", url: youtubeSearchUrl("NOC Northrop Grumman stock analysis defense"), note: "投資人與分析師影片搜尋。" },
      { id: "yt-defense-pltr", type: "YouTube", label: "YouTube: PLTR defense AI analysis", url: youtubeSearchUrl("PLTR Palantir defense AI stock analysis"), note: "投資人與分析師影片搜尋。" },
      { id: "expert-defense-lmt", type: "專家", label: "Seeking Alpha: LMT", url: seekingAlphaUrl("LMT"), note: "市場作者、分析師與投資人觀點入口。" },
      { id: "expert-defense-noc", type: "專家", label: "Seeking Alpha: NOC", url: seekingAlphaUrl("NOC"), note: "市場作者、分析師與投資人觀點入口。" },
      { id: "expert-defense-pltr", type: "專家", label: "Seeking Alpha: PLTR", url: seekingAlphaUrl("PLTR"), note: "市場作者、分析師與投資人觀點入口。" },
      { id: "yf-defense-rtx", type: "專家", label: "Yahoo Finance Analysis: RTX", url: yahooAnalysisUrl("RTX"), note: "分析師預估、EPS 與營收預測入口。" }
    ],
    recommendations: [
      { symbol: "LMT", name: "Lockheed Martin", side: "Long", confidence: 79, rationale: "若國防支出維持高檔，飛彈、防空與長約 backlog 提供基本面支撐。", evidence: ["lmt-ir", "dod-contracts", "defense-news", "yt-defense-lmt", "expert-defense-lmt"] },
      { symbol: "NOC", name: "Northrop Grumman", side: "Long", confidence: 76, rationale: "太空與防務電子題材明確，適合作為軍工板塊核心研究標的。", evidence: ["noc-ir", "nato-news", "breaking-defense", "yt-defense-noc", "expert-defense-noc"] },
      { symbol: "RTX", name: "RTX", side: "Long", confidence: 72, rationale: "飛彈、防空與航太維修需求可支撐中長期訂單能見度。", evidence: ["rtx-ir", "dod-contracts", "defense-news", "yf-defense-rtx"] },
      { symbol: "AVAV", name: "AeroVironment", side: "Long", confidence: 69, rationale: "無人機與 loitering munition 是軍工成長題材中較清楚的高 beta 標的。", evidence: ["avav-ir", "breaking-defense", "defense-news", "yt-defense-noc"] },
      { symbol: "PLTR", name: "Palantir", side: "Short", confidence: 56, rationale: "若 AI 軟體估值降溫，PLTR 可能比傳統軍工主約商更敏感。", evidence: ["pltr-ir", "nato-news", "defense-news", "yt-defense-pltr", "expert-defense-pltr"] },
      { symbol: "GD", name: "General Dynamics", side: "Short", confidence: 51, rationale: "若造艦或政府 IT 執行節奏低於預期，可作為板塊內相對弱勢觀察。", evidence: ["gd-ir", "hii-ir", "dod-contracts", "expert-defense-lmt"] }
    ],
    validation: [
      { thesis: "LMT missile / air defense backlog", window: "90D", result: "+4.2%", hit: "Positive", note: "對應 LMT Long，追蹤 DoD 合約與 backlog。" },
      { thesis: "NOC space / defense electronics", window: "90D", result: "+3.7%", hit: "Positive", note: "對應 NOC Long，追蹤太空與電子戰需求。" },
      { thesis: "RTX air defense demand", window: "60D", result: "+2.9%", hit: "Mixed", note: "對應 RTX Long，需區分商用航太與國防業務。" },
      { thesis: "AVAV unmanned systems beta", window: "30D", result: "+7.5%", hit: "Positive", note: "對應 AVAV Long，高 beta 需驗證波動。" },
      { thesis: "PLTR valuation compression", window: "30D", result: "-6.8%", hit: "Positive for Short", note: "對應 PLTR Short，估值壓縮期間較敏感。" },
      { thesis: "GD execution / shipbuilding risk", window: "60D", result: "-0.8%", hit: "Needs Review", note: "對應 GD Short，需接造艦進度與合約資料。" }
    ]
  },
  {
    id: "entertainment",
    name: "娛樂 / 內容平台",
    score: 74,
    momentum: "Watch",
    summary: "串流、IP、遊戲與演唱會經濟都可追蹤，但要特別看內容成本與消費力。",
    sources: [
      { id: "nflx-ir", type: "官方", label: "Netflix IR", url: "https://ir.netflix.net/", note: "訂閱、廣告層、營業利益率。" },
      { id: "dis-ir", type: "官方", label: "Disney Investor Relations", url: "https://thewaltdisneycompany.com/investor-relations/", note: "IP、樂園、串流、ESPN。" },
      { id: "spot-ir", type: "官方", label: "Spotify Investors", url: "https://investors.spotify.com/", note: "音訊平台、訂閱 ARPU、廣告。" },
      { id: "wbd-ir", type: "官方", label: "Warner Bros. Discovery IR", url: "https://ir.wbd.com/", note: "Max、電影片庫、內容成本與去槓桿。" },
      { id: "para-ir", type: "官方", label: "Paramount Investor Relations", url: "https://ir.paramount.com/", note: "Paramount+、影視資產、廣告與併購事件。" },
      { id: "rblx-ir", type: "官方", label: "Roblox Investor Relations", url: "https://ir.roblox.com/", note: "遊戲平台、bookings、DAU 與虛擬經濟。" },
      { id: "ea-ir", type: "官方", label: "Electronic Arts IR", url: "https://ir.ea.com/", note: "遊戲發行、live services、sports franchise。" },
      { id: "ttwo-ir", type: "官方", label: "Take-Two Interactive IR", url: "https://ir.take2games.com/", note: "GTA、Zynga、console cycle 與 release pipeline。" },
      { id: "lyv-ir", type: "官方", label: "Live Nation Investor Relations", url: "https://investors.livenationentertainment.com/", note: "演唱會、票務、現場娛樂需求。" },
      { id: "youtube-blog", type: "新聞", label: "YouTube Official Blog", url: "https://blog.youtube/", note: "影音平台、creator economy、廣告與訂閱動態。" },
      { id: "variety", type: "新聞", label: "Variety", url: "https://variety.com/", note: "影視、串流、內容成本、票房與產業交易。" },
      { id: "hollywood-reporter", type: "新聞", label: "The Hollywood Reporter", url: "https://www.hollywoodreporter.com/", note: "影視產業、串流競爭、IP 與人才合約。" },
      { id: "yt-ent-nflx", type: "YouTube", label: "YouTube: NFLX stock analysis", url: youtubeSearchUrl("NFLX Netflix stock analysis streaming"), note: "投資人與分析師影片搜尋。" },
      { id: "yt-ent-spot", type: "YouTube", label: "YouTube: SPOT stock analysis", url: youtubeSearchUrl("SPOT Spotify stock analysis"), note: "投資人與分析師影片搜尋。" },
      { id: "yt-ent-dis", type: "YouTube", label: "YouTube: DIS stock analysis", url: youtubeSearchUrl("DIS Disney stock analysis streaming parks"), note: "投資人與分析師影片搜尋。" },
      { id: "expert-ent-nflx", type: "專家", label: "Seeking Alpha: NFLX", url: seekingAlphaUrl("NFLX"), note: "市場作者、分析師與投資人觀點入口。" },
      { id: "expert-ent-spot", type: "專家", label: "Seeking Alpha: SPOT", url: seekingAlphaUrl("SPOT"), note: "市場作者、分析師與投資人觀點入口。" },
      { id: "expert-ent-dis", type: "專家", label: "Seeking Alpha: DIS", url: seekingAlphaUrl("DIS"), note: "市場作者、分析師與投資人觀點入口。" },
      { id: "yf-ent-ttwo", type: "專家", label: "Yahoo Finance Analysis: TTWO", url: yahooAnalysisUrl("TTWO"), note: "分析師預估、EPS 與營收預測入口。" }
    ],
    recommendations: [
      { symbol: "NFLX", name: "Netflix", side: "Long", confidence: 78, rationale: "若串流市場看重獲利率與廣告層，Netflix 的財務透明度與規模優勢較強。", evidence: ["nflx-ir", "variety", "hollywood-reporter", "yt-ent-nflx", "expert-ent-nflx"] },
      { symbol: "SPOT", name: "Spotify", side: "Long", confidence: 71, rationale: "若音訊平台獲利改善延續，SPOT 可作為 margin expansion 研究標的。", evidence: ["spot-ir", "youtube-blog", "variety", "yt-ent-spot", "expert-ent-spot"] },
      { symbol: "LYV", name: "Live Nation", side: "Long", confidence: 68, rationale: "現場娛樂需求與票務平台收入若維持強勢，LYV 可作為娛樂消費代表。", evidence: ["lyv-ir", "variety", "hollywood-reporter", "yt-ent-spot"] },
      { symbol: "TTWO", name: "Take-Two", side: "Long", confidence: 65, rationale: "大型遊戲 release pipeline 若進入催化期，TTWO 可作為遊戲內容 beta。", evidence: ["ttwo-ir", "ea-ir", "variety", "yf-ent-ttwo"] },
      { symbol: "DIS", name: "Disney", side: "Short", confidence: 58, rationale: "若串流轉型與樂園需求低於預期，DIS 的多業務折價可能延續。", evidence: ["dis-ir", "variety", "hollywood-reporter", "yt-ent-dis", "expert-ent-dis"] },
      { symbol: "PARA", name: "Paramount", side: "Short", confidence: 53, rationale: "若傳統媒體廣告與串流虧損壓力未改善，PARA 可列入空方觀察。", evidence: ["para-ir", "wbd-ir", "hollywood-reporter", "expert-ent-dis"] }
    ],
    validation: [
      { thesis: "NFLX streaming margin leader", window: "30D", result: "+5.6%", hit: "Positive", note: "對應 NFLX Long，驗證訂閱與廣告層。" },
      { thesis: "SPOT margin expansion", window: "30D", result: "+4.3%", hit: "Positive", note: "對應 SPOT Long，追蹤 ARPU 與 podcast 成本。" },
      { thesis: "LYV live entertainment demand", window: "60D", result: "+3.8%", hit: "Mixed", note: "對應 LYV Long，需追蹤票務與演唱會需求。" },
      { thesis: "TTWO release cycle beta", window: "90D", result: "+6.2%", hit: "Needs Review", note: "對應 TTWO Long，催化依賴遊戲發售節奏。" },
      { thesis: "DIS multi-business discount", window: "30D", result: "-1.6%", hit: "Mixed", note: "對應 DIS Short，需拆分樂園與串流。" },
      { thesis: "PARA legacy media pressure", window: "60D", result: "-4.9%", hit: "Positive for Short", note: "對應 PARA Short，追蹤廣告與串流虧損。" }
    ]
  },
  {
    id: "energy",
    name: "能源 / 電力基建",
    score: 77,
    momentum: "Heating",
    summary: "AI data center 用電、電網、核能與天然氣備援形成新的能源投資敘事。",
    sources: [
      { id: "gev-ir", type: "官方", label: "GE Vernova Investors", url: "https://www.gevernova.com/investors", note: "電網、發電設備、能源轉型。" },
      { id: "ceg-ir", type: "官方", label: "Constellation Energy IR", url: "https://investors.constellationenergy.com/", note: "核能、電力合約、大型企業用電。" },
      { id: "nee-ir", type: "官方", label: "NextEra Energy IR", url: "https://www.investor.nexteraenergy.com/", note: "再生能源、公用事業、利率敏感度。" },
      { id: "vst-ir", type: "官方", label: "Vistra Investor Relations", url: "https://investor.vistracorp.com/", note: "發電資產、零售電力、核能與 gas fleet。" },
      { id: "duk-ir", type: "官方", label: "Duke Energy Investor Relations", url: "https://investors.duke-energy.com/", note: " regulated utility、電網投資與負載成長。" },
      { id: "eaton-ir", type: "官方", label: "Eaton Investor Relations", url: "https://www.eaton.com/us/en-us/company/investor-relations.html", note: "電力管理、data center electrical equipment。" },
      { id: "schneider-ir", type: "官方", label: "Schneider Electric Investors", url: "https://www.se.com/ww/en/about-us/investor-relations/", note: "電力管理、data center、automation。" },
      { id: "siemens-energy-ir", type: "官方", label: "Siemens Energy Investor Relations", url: "https://www.siemens-energy.com/global/en/home/investor-relations.html", note: "電網、變壓器、發電設備與能源轉型。" },
      { id: "iea-electricity", type: "研究", label: "IEA Electricity", url: "https://www.iea.org/topics/electricity", note: "全球電力需求、電網、能源政策與資料中心用電背景。" },
      { id: "eia-electricity", type: "官方", label: "U.S. EIA Electricity", url: "https://www.eia.gov/electricity/", note: "美國電力供需、發電結構、價格與資料。" },
      { id: "ferc", type: "官方", label: "FERC", url: "https://www.ferc.gov/", note: "美國電力市場、輸電與監管。" },
      { id: "pjm", type: "官方", label: "PJM Interconnection", url: "https://www.pjm.com/", note: "美國最大電力市場之一，負載、容量與電網壓力訊號。" },
      { id: "utility-dive", type: "新聞", label: "Utility Dive", url: "https://www.utilitydive.com/", note: "公用事業、電網、data center demand 與能源政策新聞。" },
      { id: "yt-energy-gev", type: "YouTube", label: "YouTube: GEV stock analysis", url: youtubeSearchUrl("GEV GE Vernova stock analysis grid power"), note: "投資人與分析師影片搜尋。" },
      { id: "yt-energy-ceg", type: "YouTube", label: "YouTube: CEG nuclear stock analysis", url: youtubeSearchUrl("CEG Constellation Energy nuclear stock analysis"), note: "投資人與分析師影片搜尋。" },
      { id: "yt-energy-vst", type: "YouTube", label: "YouTube: VST power stock analysis", url: youtubeSearchUrl("VST Vistra stock analysis power demand"), note: "投資人與分析師影片搜尋。" },
      { id: "expert-energy-gev", type: "專家", label: "Seeking Alpha: GEV", url: seekingAlphaUrl("GEV"), note: "市場作者、分析師與投資人觀點入口。" },
      { id: "expert-energy-ceg", type: "專家", label: "Seeking Alpha: CEG", url: seekingAlphaUrl("CEG"), note: "市場作者、分析師與投資人觀點入口。" },
      { id: "expert-energy-vst", type: "專家", label: "Seeking Alpha: VST", url: seekingAlphaUrl("VST"), note: "市場作者、分析師與投資人觀點入口。" },
      { id: "yf-energy-etn", type: "專家", label: "Yahoo Finance Analysis: ETN", url: yahooAnalysisUrl("ETN"), note: "分析師預估、EPS 與營收預測入口。" }
    ],
    recommendations: [
      { symbol: "GEV", name: "GE Vernova", side: "Long", confidence: 77, rationale: "若電網與變壓器供給持續吃緊，GEV 是電力基建研究核心。", evidence: ["gev-ir", "iea-electricity", "utility-dive", "yt-energy-gev", "expert-energy-gev"] },
      { symbol: "CEG", name: "Constellation Energy", side: "Long", confidence: 74, rationale: "AI data center 長約用電與核能重估是主要催化。", evidence: ["ceg-ir", "eia-electricity", "pjm", "yt-energy-ceg", "expert-energy-ceg"] },
      { symbol: "VST", name: "Vistra", side: "Long", confidence: 72, rationale: "若美國電力價格與容量市場維持緊俏，VST 可作為 merchant power 高 beta 標的。", evidence: ["vst-ir", "pjm", "utility-dive", "yt-energy-vst", "expert-energy-vst"] },
      { symbol: "ETN", name: "Eaton", side: "Long", confidence: 70, rationale: "Data center electrical equipment 與電力管理需求可支撐中期成長。", evidence: ["eaton-ir", "schneider-ir", "iea-electricity", "yf-energy-etn"] },
      { symbol: "NEE", name: "NextEra Energy", side: "Short", confidence: 55, rationale: "若利率上行或再生能源估值壓縮，NEE 可作為板塊內空方觀察。", evidence: ["nee-ir", "eia-electricity", "ferc", "yt-energy-ceg"] },
      { symbol: "DUK", name: "Duke Energy", side: "Short", confidence: 51, rationale: "若 regulated utility 的資本支出壓力高於負載成長定價，可作為相對空方觀察。", evidence: ["duk-ir", "ferc", "utility-dive", "expert-energy-vst"] }
    ],
    validation: [
      { thesis: "GEV grid equipment scarcity", window: "60D", result: "+6.1%", hit: "Positive", note: "對應 GEV Long，追蹤電網設備需求。" },
      { thesis: "CEG nuclear / data center PPA", window: "60D", result: "+5.4%", hit: "Positive", note: "對應 CEG Long，驗證核能長約敘事。" },
      { thesis: "VST merchant power beta", window: "30D", result: "+7.0%", hit: "Positive", note: "對應 VST Long，需追蹤容量市場與電價。" },
      { thesis: "ETN electrical equipment demand", window: "60D", result: "+4.8%", hit: "Positive", note: "對應 ETN Long，追蹤 data center electrical capex。" },
      { thesis: "NEE rate sensitivity", window: "30D", result: "-1.9%", hit: "Mixed", note: "對應 NEE Short，需和利率資料同步驗證。" },
      { thesis: "DUK capex pressure", window: "60D", result: "-0.6%", hit: "Needs Review", note: "對應 DUK Short，需接 utility capex 與負載資料。" }
    ]
  }
];

const state = {
  layer: "home",
  selectedSectorId: null,
  sourceFilter: "all",
  customQuery: "",
  customStatus: "idle",
  customData: null,
  sourcePreviews: {},
  scoreModal: null
};

const viewRoot = document.querySelector("#viewRoot");
const summaryGrid = document.querySelector("#summaryGrid");
const toolbar = document.querySelector("#toolbar");
const viewTitle = document.querySelector("#viewTitle");
const toast = document.querySelector("#toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("visible"), 1800);
}

async function fetchJsonWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

function sourceTypes(sources) {
  return ["all", ...new Set(sources.map((source) => source.type))];
}

function currentSector() {
  if (state.selectedSectorId === "custom") return buildCustomSector();
  return buildFreshSector(sectorCatalog.find((sector) => sector.id === state.selectedSectorId) || sectorCatalog[0]);
}

function freshSourcesForRecommendation(item, sectorName) {
  const query = `${item.symbol} ${item.name} stock investment analysis`;
  return [
    {
      id: `fresh-news-${item.symbol}`,
      type: "近24h新聞",
      label: `${item.symbol} 近24h新聞`,
      url: "",
      previewQuery: query,
      note: "近 24 小時直連新聞；若當天新聞量不足，備援會延伸時間窗但仍保留原始連結。",
      actions: []
    },
    {
      id: `fresh-yt-${item.symbol}`,
      type: "近24h YouTube",
      label: `${item.symbol} 近24h YouTube`,
      url: "",
      previewQuery: query,
      note: "YouTube 影片直連；顯示可直接開啟的 watch 連結。",
      actions: []
    },
    {
      id: `fresh-expert-${item.symbol}`,
      type: "近24h 專家",
      label: `${item.symbol} 近24h專家分析`,
      url: "",
      previewQuery: query,
      note: "市場觀點與分析師評論；只保留可直接開啟的原始連結。",
      actions: []
    }
  ];
}

function buildFreshSector(sector) {
  const sources = sector.recommendations.flatMap((item) => freshSourcesForRecommendation(item, sector.name));
  const recommendations = sector.recommendations.map((item) => ({
    ...item,
    evidence: [`fresh-news-${item.symbol}`, `fresh-yt-${item.symbol}`, `fresh-expert-${item.symbol}`]
  }));
  return { ...sector, sources, recommendations };
}

function sourceCount(sector) {
  return buildFreshSector(sector).sources.length;
}

function buildCustomSector() {
  const evidence = state.customData?.evidence || [];
  const quotes = state.customData?.quotes || [];
  const freshness = state.customData?.freshness || {};
  const newsSources = evidence.map((item, index) => ({
    id: `live-${index}`,
    type: "近24h新聞",
    label: item.title,
    url: item.url,
    note: `${item.source || "Google News"} · ${item.ageHours ?? "24"}h 內`,
    previewItems: [item]
  }));
  const quoteSources = quotes.map((quote, index) => ({
    id: `quote-${index}`,
    type: "行情",
    label: `${quote.symbol} · ${quote.name}`,
    url: quote.url,
    note: `${quote.exchange || "Yahoo Finance"} · ${quote.type || "quote"}`
  }));
  const youtubeSources = quotes.slice(0, 6).map((quote, index) => ({
    id: `yt-${index}`,
    type: "近24h YouTube",
    label: `${quote.symbol} 近24h YouTube`,
    url: "",
    previewQuery: `${quote.symbol} ${quote.name} stock investment analysis`,
    note: "YouTube 影片直連；只顯示可直接開啟的 watch 連結。",
    actions: []
  }));
  const expertSources = quotes.slice(0, 6).flatMap((quote, index) => ([
    {
      id: `expert-${index}`,
      type: "近24h 專家",
      label: `${quote.symbol} 近24h專家分析`,
      url: "",
      previewQuery: `${quote.symbol} ${quote.name} stock investment analysis`,
      note: "市場觀點與分析師評論；只保留可直接開啟的原始連結。",
      actions: []
    },
    {
      id: `analysis-${index}`,
      type: "近24h新聞",
      label: `${quote.symbol} 近24h市場新聞`,
      url: "",
      previewQuery: `${quote.symbol} ${quote.name} stock market`,
      note: "近 24 小時直連新聞；若當天新聞量不足，備援會延伸時間窗但仍保留原始連結。",
      actions: []
    }
  ]));
  return {
    id: "custom",
    name: state.customQuery || "自訂板塊",
    score: evidence.length ? Math.min(90, 52 + evidence.length * 4) : "Live",
    momentum: evidence.length ? "Live Evidence" : state.customStatus === "error" ? "No Data" : "Waiting",
    sources: [...quoteSources, ...youtubeSources, ...expertSources, ...newsSources],
    recommendations: quotes.slice(0, 6).map((quote, index) => ({
      symbol: quote.symbol,
      name: quote.name,
      evidence: evidence[index]
        ? [`quote-${index}`, `yt-${index}`, `expert-${index}`, `analysis-${index}`, `live-${index}`]
        : [`quote-${index}`, `yt-${index}`, `expert-${index}`, `analysis-${index}`]
    })),
    validation: [
      { thesis: `${state.customQuery} source coverage`, window: "24H", result: `${evidence.length} sources`, hit: evidence.length ? "Positive" : "Needs Review", note: "近 24 小時新聞來源數。" },
      { thesis: `${state.customQuery} equity discovery`, window: "Live", result: `${quotes.length} equities`, hit: quotes.length ? "Positive" : "Needs Review", note: "Yahoo Finance 可交易股票候選數。" },
      { thesis: `${state.customQuery} daily change`, window: freshness.date || "Live", result: freshness.changedFromPrevious === null || freshness.changedFromPrevious === undefined ? "No baseline" : freshness.changedFromPrevious ? "Changed" : "Same", hit: freshness.changedFromPrevious ? "Positive" : "Needs Review", note: freshness.previousDate ? `相較 ${freshness.previousDate} 的來源與股票 signature。` : "尚無前一日 baseline。" }
    ]
  };
}

const positiveSignalTerms = [
  "beat", "beats", "raise", "raises", "raised", "upgrade", "buy", "outperform", "growth", "demand",
  "surge", "record", "strong", "upside", "profit", "margin", "bullish", "contract", "win", "wins",
  "expand", "expands", "approved", "partnership", "rally", "higher", "positive", "受益", "成長",
  "上調", "買進", "看多", "強勁", "需求", "獲利", "訂單", "突破"
];

const negativeSignalTerms = [
  "miss", "misses", "cut", "cuts", "downgrade", "sell", "underperform", "weak", "falls", "plunge",
  "risk", "lawsuit", "probe", "delay", "loss", "slowdown", "lower", "bearish", "tariff", "pressure",
  "debt", "bankrupt", "recall", "negative", "下修", "賣出", "看空", "疲弱", "風險", "虧損",
  "放緩", "壓力", "調查", "延遲", "下跌"
];

function previewForSource(source) {
  if (source.previewItems) return { items: source.previewItems, windowHours: 24, fallbackUsed: false };
  return state.sourcePreviews[sourcePreviewKey(source)];
}

function evidenceSourcesForItem(item, sources) {
  return (item.evidence || [])
    .map((id) => sources.find((source) => source.id === id))
    .filter(Boolean);
}

function usablePreviewItems(source) {
  const preview = previewForSource(source);
  if (!sourceHasUsablePreview(preview)) return [];
  return (preview.items || []).filter((item) => item.url && item.title);
}

function countTerms(text, terms) {
  const normalized = text.toLowerCase();
  return terms.reduce((total, term) => total + (normalized.includes(term.toLowerCase()) ? 1 : 0), 0);
}

function evidenceSignal(items) {
  return items.reduce((signal, item) => {
    const text = `${item.title || ""} ${item.summary || ""}`;
    signal.positive += countTerms(text, positiveSignalTerms);
    signal.negative += countTerms(text, negativeSignalTerms);
    return signal;
  }, { positive: 0, negative: 0 });
}

function computeLiveRecommendation(item, sources) {
  const evidenceSources = evidenceSourcesForItem(item, sources);
  const previewSources = evidenceSources.filter((source) => source.previewQuery || source.previewItems);
  const resolvedSources = previewSources.filter((source) => previewForSource(source));
  const liveReady = resolvedSources.length === previewSources.length;
  const liveSources = previewSources.filter((source) => usablePreviewItems(source).length);
  const liveItems = liveSources.flatMap((source) => usablePreviewItems(source).slice(0, 3));

  if (!liveItems.length) {
    return { ...item, liveReady, hasLiveEvidence: false, liveSources: [], liveItems: [] };
  }

  const signal = evidenceSignal(liveItems);
  const netSignal = signal.positive - signal.negative;
  const side = signal.negative > signal.positive ? "Short" : "Long";
  const coverageScore = Math.min(30, liveSources.length * 8 + Math.min(liveItems.length, 9) * 2);
  const signalScore = Math.min(15, Math.abs(netSignal) * 4);
  const ages = liveItems.map((sourceItem) => Number(sourceItem.ageHours)).filter(Number.isFinite);
  const newestAge = ages.length ? Math.min(...ages) : 24;
  const freshnessScore = Math.max(0, 10 - Math.min(10, Math.floor(newestAge / 12)));
  const confidence = Math.max(50, Math.min(95, Math.round(50 + coverageScore + signalScore + freshnessScore)));
  const rationale = `根據 ${liveItems.length} 則可直接開啟的即時來源計算；正向訊號 ${signal.positive}、負向訊號 ${signal.negative}，方向判定為 ${side === "Short" ? "做空" : "做多"}研究。`;

  return {
    ...item,
    side,
    confidence,
    rationale,
    liveReady: true,
    hasLiveEvidence: true,
    liveSources,
    liveItems,
    livePositive: signal.positive,
    liveNegative: signal.negative,
    liveCoverage: coverageScore,
    liveSignalScore: signalScore,
    liveFreshness: freshnessScore
  };
}

function liveRecommendationsForSector(sector) {
  const computed = sector.recommendations.map((item) => computeLiveRecommendation(item, sector.sources));
  return {
    ready: computed.every((item) => item.liveReady),
    items: computed.filter((item) => item.hasLiveEvidence)
  };
}

function renderRecommendationList(liveRecommendations, sources) {
  if (liveRecommendations.items.length) {
    return liveRecommendations.items.map((item) => renderRecommendation(item, sources)).join("");
  }
  if (!liveRecommendations.ready) {
    return renderEmpty("正在根據可開啟的即時來源計算 Long / Short。");
  }
  return renderEmpty("沒有足夠可直接開啟的即時來源，因此不產生 Long / Short 建議。");
}

function renderMetricTiles(items) {
  summaryGrid.innerHTML = items.map((item) => `
    <div class="metric-tile">
      <span>${item.label}</span>
      <strong>${item.value}</strong>
    </div>
  `).join("");
}

function renderToolbar(buttons) {
  toolbar.innerHTML = buttons.map((button) => `
    <button class="tool-btn ${button.active ? "active" : ""}" type="button" data-action="${button.action}" data-value="${button.value || ""}">
      ${button.label}
    </button>
  `).join("");
  toolbar.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "home") {
        state.layer = "home";
        state.selectedSectorId = null;
      }
      if (action === "sourceFilter") state.sourceFilter = button.dataset.value;
      render();
    });
  });
}

function renderHome() {
  state.layer = "home";
  viewTitle.textContent = "選擇板塊";
  renderToolbar([]);
  renderMetricTiles([
    { label: "可選板塊", value: sectorCatalog.length + 1 },
    { label: "資料層", value: "來源可查" },
    { label: "第二層", value: "Long/Short" },
    { label: "驗證", value: "History" }
  ]);

  viewRoot.innerHTML = `
    <section class="sector-layout">
      <div class="section-head">
        <h2>板塊選擇</h2>
      </div>
      <div class="sector-home-grid">
        ${sectorCatalog.map(renderSectorHomeCard).join("")}
      </div>
      <article class="sector-controls">
        <div class="section-head">
          <h2>自訂板塊</h2>
        </div>
        <form class="custom-sector-form" id="customSectorForm">
          <input id="customSectorInput" type="text" value="${state.customQuery}" placeholder="例如：咖啡、機器人、太空、遊戲、軍工">
          <button class="action-btn primary" type="submit">建立真實分析</button>
        </form>
        <div class="live-status ${state.customStatus}">${customStatusText()}</div>
      </article>
    </section>
  `;

  document.querySelectorAll("[data-sector-id]").forEach((button) => {
    button.addEventListener("click", () => openSector(button.dataset.sectorId));
  });

  document.querySelector("#customSectorForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.querySelector("#customSectorInput");
    state.customQuery = input.value.trim();
    fetchCustomSector();
  });
}

function renderSectorHomeCard(sector) {
  return `
    <button class="sector-card" type="button" data-sector-id="${sector.id}">
      <div>
        <h2>${sector.name}</h2>
        <div class="sector-card-stats">
          <span>來源 ${sourceCount(sector)}</span>
          <span>候選 ${sector.recommendations.length}</span>
          <span>即時計算</span>
        </div>
      </div>
      <div class="sector-card-meta">
        <strong>${sector.score}</strong>
        <span>${sector.momentum}</span>
      </div>
    </button>
  `;
}

function openSector(id) {
  state.layer = "sector";
  state.selectedSectorId = id;
  state.sourceFilter = "all";
  render();
}

function customStatusText() {
  if (state.customStatus === "loading") return "抓取中";
  if (state.customStatus === "ready") return "完成";
  if (state.customStatus === "error") return "無資料";
  return "待輸入";
}

async function fetchCustomSector() {
  if (!state.customQuery) {
    state.customStatus = "error";
    showToast("請輸入自訂板塊");
    renderHome();
    return;
  }
  state.customStatus = "loading";
  renderHome();
  try {
    state.customData = await fetchJsonWithTimeout(`${liveApiBaseUrl()}/api/custom-sector?q=${encodeURIComponent(state.customQuery)}&t=${Date.now()}`, 18000);
    state.customStatus = ((state.customData.evidence || []).length || (state.customData.quotes || []).length) ? "ready" : "error";
    openSector("custom");
  } catch (error) {
    console.warn("custom sector failed", error);
    state.customData = null;
    state.customStatus = "error";
    renderHome();
  }
}

function renderSectorDetail() {
  const sector = currentSector();
  const liveRecommendations = liveRecommendationsForSector(sector);
  viewTitle.textContent = sector.name;

  const types = sourceTypes(sector.sources);
  renderToolbar([
    { label: "回板塊", action: "home", value: "home", active: false },
    ...types.map((type) => ({ label: type === "all" ? "全部來源" : type, action: "sourceFilter", value: type, active: state.sourceFilter === type }))
  ]);

  const filteredSources = sector.sources.filter((source) => state.sourceFilter === "all" || source.type === state.sourceFilter);
  renderMetricTiles([
    { label: "板塊分數", value: sector.score },
    { label: "動能", value: sector.momentum },
    { label: "來源數", value: filteredSources.length },
    { label: "建議數", value: liveRecommendations.ready ? liveRecommendations.items.length : "計算中" }
  ]);

  viewRoot.innerHTML = `
    <section class="sector-layout">
      <article class="sector-brief-card">
        <div class="board-card-head">
          <div>
            <h2>${sector.name}</h2>
          </div>
          <strong>${sector.score}</strong>
        </div>
      </article>

      <div class="layer-grid">
        <section class="board-card">
          <div class="section-head">
            <h2>1. 資料來源</h2>
          </div>
          <div class="source-list">${filteredSources.map(renderSource).join("") || renderEmpty("目前沒有符合篩選的來源。")}</div>
        </section>

        <section class="board-card">
          <div class="section-head">
            <h2>2. Long / Short 研究建議</h2>
          </div>
          <div class="recommendation-list">${renderRecommendationList(liveRecommendations, sector.sources)}</div>
        </section>
      </div>

      <section class="board-card">
        <div class="section-head">
          <h2>3. 歷史驗證</h2>
        </div>
        <div class="table-shell validation-table">
          <div class="table-row table-head">
            <span>Thesis</span><span>Window</span><span>Result</span><span>Status</span><span>Note</span>
          </div>
          ${sector.validation.map(renderValidation).join("") || renderEmpty("自訂板塊需接入價格資料後才能做報酬驗證。")}
        </div>
      </section>
    </section>
    ${renderScoreModal()}
  `;
  hydrateSourcePreviews(filteredSources);
  wireScoreButtons(liveRecommendations.items, sector.sources);
  wireScoreModal();
}

function renderSource(source) {
  const actions = source.actions || [];
  const previewKey = sourcePreviewKey(source);
  const preview = source.previewItems ? { items: source.previewItems, windowHours: 24, fallbackUsed: false } : state.sourcePreviews[previewKey];
  if (preview && !sourceHasUsablePreview(preview) && source.previewQuery) {
    return "";
  }
  const primaryTag = source.url ? "a" : "div";
  const primaryAttrs = source.url ? `href="${source.url}" target="_blank" rel="noopener noreferrer" data-external-link` : "";
  return `
    <article class="evidence-link" data-source-key="${previewKey}">
      <${primaryTag} class="evidence-primary ${source.url ? "external-link" : ""}" ${primaryAttrs}>
        <strong>${source.label}</strong>
        <span>${source.type} · ${source.note}</span>
      </${primaryTag}>
      ${renderSourcePreview(preview, source)}
      ${actions.length ? `
        <div class="evidence-actions">
          ${actions.map((action) => `<a class="evidence-action external-link" href="${action.url}" target="_blank" rel="noopener noreferrer" data-external-link>${action.label}</a>`).join("")}
        </div>
      ` : ""}
    </article>
  `;
}

function sourcePreviewKey(source) {
  return `${source.id}:${source.previewQuery || source.label}`;
}

function sourceHasUsablePreview(preview) {
  return !!(preview && !preview.errors?.length && (preview.items || []).length);
}

function renderSourcePreview(preview, source) {
  if (!source.previewQuery && !source.previewItems) {
    return "";
  }
  if (!preview) {
    return `<div class="source-preview loading">正在抓取重點預覽...</div>`;
  }
  if (preview.errors?.length) {
    return "";
  }
  const items = preview.items || [];
  if (!items.length) {
    return "";
  }
  const windowLabel = preview.fallbackUsed || preview.windowHours > 24 ? "近7天" : "近24h";
  return `
    <div class="source-preview">
      <div class="preview-kicker">${windowLabel} 重點預覽${preview.usedQuery ? ` · ${preview.usedQuery}` : ""}</div>
      ${items.slice(0, 3).map((item) => `
        <a class="preview-item external-link" href="${item.url}" target="_blank" rel="noopener noreferrer" data-external-link>
          <strong>${item.title}</strong>
          <span>${item.source || "來源網站"} · ${item.ageHours ?? ""}h</span>
          ${item.summary ? `<small>${item.summary}</small>` : ""}
        </a>
      `).join("")}
    </div>
  `;
}

async function hydrateSourcePreviews(sources) {
  const targets = sources
    .filter((source) => source.previewQuery && !state.sourcePreviews[sourcePreviewKey(source)])
    .slice(0, 18);
  if (!targets.length) {
    refreshRecommendationList();
    return;
  }
  await Promise.allSettled(targets.map(async (source) => {
    const key = sourcePreviewKey(source);
    try {
      state.sourcePreviews[key] = await fetchJsonWithTimeout(`${liveApiBaseUrl()}/api/source-preview?q=${encodeURIComponent(source.previewQuery)}&type=${encodeURIComponent(source.type)}&t=${Date.now()}`, 12000);
    } catch (error) {
      state.sourcePreviews[key] = { items: [], errors: [String(error)] };
    }
    updateSourcePreview(source);
    refreshRecommendationList();
  }));
  refreshRecommendationList();
}

function updateSourcePreview(source) {
  const key = sourcePreviewKey(source);
  const node = document.querySelector(`[data-source-key="${CSS.escape(key)}"]`);
  if (!node) return;
  if (!sourceHasUsablePreview(state.sourcePreviews[key])) {
    node.remove();
    refreshSourceListState();
    return;
  }
  const current = node.querySelector(".source-preview");
  const next = document.createElement("div");
  next.innerHTML = renderSourcePreview(state.sourcePreviews[key], source).trim();
  if (current && next.firstElementChild) current.replaceWith(next.firstElementChild);
  refreshSourceListState();
}

function refreshSourceListState() {
  const list = document.querySelector(".source-list");
  if (!list) return;
  const visibleSources = list.querySelectorAll(".evidence-link").length;
  const metricTiles = summaryGrid.querySelectorAll(".metric-tile strong");
  if (metricTiles[2]) metricTiles[2].textContent = visibleSources;
  list.querySelector("[data-empty-sources]")?.remove();
  if (!visibleSources) {
    list.insertAdjacentHTML("beforeend", `<div class="empty" data-empty-sources>目前沒有可直接開啟的原始來源。</div>`);
  }
}

function refreshRecommendationList() {
  if (state.layer !== "sector") return;
  const sector = currentSector();
  const liveRecommendations = liveRecommendationsForSector(sector);
  const list = document.querySelector(".recommendation-list");
  if (list) {
    list.innerHTML = renderRecommendationList(liveRecommendations, sector.sources);
    wireScoreButtons(liveRecommendations.items, sector.sources);
  }
  const metricTiles = summaryGrid.querySelectorAll(".metric-tile strong");
  if (metricTiles[3]) metricTiles[3].textContent = liveRecommendations.ready ? liveRecommendations.items.length : "計算中";
  if (state.scoreModal && !liveRecommendations.items.some((item) => item.symbol === state.scoreModal.item.symbol)) {
    state.scoreModal = null;
  }
}

function renderRecommendation(item, sources) {
  const isShort = item.side === "Short";
  const sideClass = isShort ? "short" : "long";
  const sideLabel = isShort ? "建議做空研究" : "建議做多研究";
  const evidenceLinks = item.liveSources || evidenceSourcesForItem(item, sources);
  return `
    <article class="recommendation-card ${sideClass}">
      <div class="recommendation-head">
        <div>
          <h3>${item.symbol} · ${item.name}</h3>
          <span>${sideLabel}</span>
        </div>
        <button class="score-button" type="button" data-score-symbol="${item.symbol}" aria-label="查看 ${item.symbol} 分數計算">${item.confidence}</button>
      </div>
      <div class="tag-row">
        ${evidenceLinks.map((source) => `
          <span class="tag-bundle">
            <span class="tag">${source.label}</span>
          </span>
        `).join("") || '<span class="tag">尚無直接新聞來源對應</span>'}
      </div>
      <p>${item.rationale}</p>
    </article>
  `;
}

function scoreBreakdown(item, sources) {
  const evidenceLinks = item.liveSources || evidenceSourcesForItem(item, sources);
  return {
    total: item.confidence,
    rows: [
      { label: "基礎分", value: 50, note: "只有找到可直接開啟的來源後才會進入研究清單。" },
      { label: "來源覆蓋", value: item.liveCoverage || 0, note: `${evidenceLinks.length} 類可用來源、${(item.liveItems || []).length} 則內容納入計算。` },
      { label: "訊號強度", value: item.liveSignalScore || 0, note: `正向 ${item.livePositive || 0}、負向 ${item.liveNegative || 0}，用標題與摘要關鍵詞估算。` },
      { label: "新鮮度", value: item.liveFreshness || 0, note: "越接近近 24 小時的新來源，加分越高。" },
      { label: "方向", value: item.side === "Short" ? "做空" : "做多", note: item.rationale }
    ],
    evidenceLinks
  };
}

function renderScoreModal() {
  if (!state.scoreModal) return "";
  const { item, sources } = state.scoreModal;
  const breakdown = scoreBreakdown(item, sources);
  return `
    <div class="modal-backdrop" data-modal-close>
      <section class="score-modal" role="dialog" aria-modal="true" aria-label="${item.symbol} 分數計算">
        <div class="score-modal-head">
          <div>
            <h2>${item.symbol} · ${item.name}</h2>
            <span>${item.side.includes("空") || item.side.toLowerCase().includes("short") ? "做空研究" : "做多研究"}分數</span>
          </div>
          <button class="modal-close" type="button" data-modal-close aria-label="關閉">×</button>
        </div>
        <div class="score-total">${breakdown.total}</div>
        <div class="score-breakdown">
          ${breakdown.rows.map((row) => `
            <div class="score-row">
              <strong>${row.label}</strong>
              <span>${typeof row.value === "number" ? `${row.value > 0 ? "+" : ""}${row.value}` : row.value}</span>
              <small>${row.note}</small>
            </div>
          `).join("")}
        </div>
        <div class="score-evidence">
          ${breakdown.evidenceLinks.map((source) => `<span class="tag">${source.label}</span>`).join("")}
        </div>
      </section>
    </div>
  `;
}

function wireScoreButtons(items, sources) {
  document.querySelectorAll("[data-score-symbol]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = items.find((candidate) => candidate.symbol === button.dataset.scoreSymbol);
      if (!item) return;
      state.scoreModal = { item, sources };
      renderSectorDetail();
    });
  });
}

function wireScoreModal() {
  document.querySelectorAll("[data-modal-close]").forEach((node) => {
    node.addEventListener("click", (event) => {
      if (event.target !== node && node.classList.contains("modal-backdrop")) return;
      state.scoreModal = null;
      renderSectorDetail();
    });
  });
}

function renderValidation(item) {
  const statusClass = item.hit.toLowerCase().includes("positive") ? "gain" : "loss";
  return `
    <div class="table-row">
      <div><strong>${item.thesis}</strong></div>
      <span>${item.window}</span>
      <strong>${item.result}</strong>
      <strong class="${statusClass}">${item.hit}</strong>
      <small>${item.note}</small>
    </div>
  `;
}

function renderEmpty(message) {
  return `<div class="empty">${message}</div>`;
}

function render() {
  document.querySelector("[data-nav-action='home']")?.classList.toggle("active", state.layer === "home");
  if (state.layer === "home") renderHome();
  if (state.layer === "sector") renderSectorDetail();
}

document.querySelector("[data-nav-action='home']")?.addEventListener("click", () => {
  state.layer = "home";
  state.selectedSectorId = null;
  render();
});

render();
