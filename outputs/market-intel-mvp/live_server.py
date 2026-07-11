#!/usr/bin/env python3
from __future__ import annotations

import html as html_lib
import json
import math
import os
import re
import statistics
import sys
import threading
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


PORT = int(os.environ.get("PORT", "4318"))
ROOT = Path(__file__).resolve().parent
SNAPSHOT_PATH = ROOT / "data" / "live_snapshots.json"
FRESHNESS_HOURS = 24
MIN_SOCIAL_AUDIENCE = 10_000
CACHE_SECONDS = 300
SYMBOL_CACHE_SECONDS = 900
STATIC_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".pdf": "application/pdf",
    ".txt": "text/plain; charset=utf-8",
}

THEME_PROFILES = [
    {"needles": ("咖啡", "coffee"), "terms": ("coffee stocks", "coffee chains"), "symbols": ("SBUX", "BROS", "KDP", "JVA", "WEST", "REBN")},
    {"needles": ("遊戲", "gaming", "video game", "game stocks"), "terms": ("video game stocks", "gaming industry"), "symbols": ("TTWO", "EA", "RBLX", "U", "CRSR", "SONY")},
    {"needles": ("機器人", "robot", "robotics", "自動化"), "terms": ("robotics stocks", "industrial automation"), "symbols": ("ISRG", "ROK", "TER", "SYM", "CGNX")},
    {"needles": ("太空", "space", "衛星", "satellite"), "terms": ("space stocks", "satellite industry"), "symbols": ("RKLB", "LUNR", "ASTS", "PL", "IRDM")},
    {"needles": ("軍工", "國防", "defense", "防務", "aerospace"), "terms": ("defense stocks", "aerospace defense"), "symbols": ("LMT", "NOC", "RTX", "GD", "LHX", "PLTR")},
    {"needles": ("娛樂", "串流", "streaming", "影音"), "terms": ("streaming media stocks", "entertainment stocks"), "symbols": ("NFLX", "SPOT", "DIS", "WBD", "TTWO", "RBLX")},
    {"needles": ("能源", "電力", "energy", "核能", "uranium", "nuclear", "utility"), "terms": ("energy stocks", "nuclear power stocks"), "symbols": ("CEG", "VST", "GEV", "ETN", "CCJ", "NNE")},
    {"needles": ("半導體", "晶片", "semiconductor", "人工智慧", " ai "), "terms": ("AI semiconductor stocks", "artificial intelligence chips"), "symbols": ("NVDA", "TSM", "AVGO", "AMD", "INTC", "AMAT")},
    {"needles": ("醫療", "healthcare", "醫藥", "medical"), "terms": ("healthcare stocks", "medical technology"), "symbols": ("LLY", "UNH", "ISRG", "SYK", "MDT")},
    {"needles": ("生技", "biotech", "製藥", "pharma"), "terms": ("biotech stocks", "pharmaceutical stocks"), "symbols": ("VRTX", "REGN", "GILD", "AMGN", "MRNA")},
    {"needles": ("金融", "銀行", "fintech", "支付", "payments"), "terms": ("financial stocks", "fintech payments"), "symbols": ("JPM", "BAC", "V", "MA", "PYPL")},
    {"needles": ("電動車", " ev ", "automaker", "汽車"), "terms": ("electric vehicle stocks", "automaker stocks"), "symbols": ("TSLA", "GM", "F", "RIVN", "LCID")},
    {"needles": ("資安", "cybersecurity", "網安"), "terms": ("cybersecurity stocks",), "symbols": ("CRWD", "PANW", "FTNT", "ZS", "OKTA")},
    {"needles": ("雲端", "cloud", "saas", "軟體"), "terms": ("cloud software stocks", "SaaS stocks"), "symbols": ("MSFT", "AMZN", "CRM", "NOW", "SNOW")},
    {"needles": ("加密", "crypto", "bitcoin", "比特幣"), "terms": ("crypto stocks", "bitcoin miners"), "symbols": ("COIN", "MSTR", "MARA", "RIOT", "CLSK")},
    {"needles": ("旅遊", "travel", "航空", "飯店", "郵輪"), "terms": ("travel stocks", "airline hotel stocks"), "symbols": ("BKNG", "ABNB", "DAL", "MAR", "RCL")},
    {"needles": ("零售", "retail", "消費"), "terms": ("retail stocks", "consumer discretionary stocks"), "symbols": ("AMZN", "WMT", "COST", "TGT", "HD")},
    {"needles": ("太陽能", "solar", "再生能源", "renewable"), "terms": ("solar energy stocks", "renewable energy stocks"), "symbols": ("FSLR", "ENPH", "SEDG", "NXT", "ARRY")},
]

AUTHORITY_DOMAINS = {
    "reuters.com", "apnews.com", "bloomberg.com", "cnbc.com", "ft.com", "wsj.com",
    "nytimes.com", "bbc.com", "bbc.co.uk", "nikkei.com", "marketwatch.com",
    "nasdaq.com", "barrons.com", "businesswire.com", "globenewswire.com",
    "prnewswire.com", "investing.com", "morningstar.com",
}
OFFICIAL_NEWS_DOMAINS = {
    "sec.gov", "investor.gov", "federalreserve.gov", "energy.gov", "defense.gov",
    "eia.gov", "ferc.gov", "iea.org", "europa.eu", "gov.tw",
}
SOCIAL_HOSTS = {
    "youtube.com": "YouTube",
    "youtu.be": "YouTube",
    "instagram.com": "Instagram",
    "x.com": "X",
    "twitter.com": "X",
    "threads.net": "Threads",
    "facebook.com": "Facebook",
    "fb.com": "Facebook",
}
IGNORED_SYMBOLS = {
    "AI", "CEO", "ETF", "ETFS", "EPS", "USA", "US", "UK", "USD", "THE", "AND", "OR",
    "IPO", "SEC", "NYSE", "NASDAQ", "YOY", "YTD", "GDP", "LLC",
}
COMPANY_WORDS = {
    "corporation", "corp", "inc", "incorporated", "company", "limited", "ltd", "holdings",
    "holding", "common", "stock", "ordinary", "shares", "plc", "group", "class", "and", "the", "of",
}
GENERIC_INDUSTRY_WORDS = {
    "coffee", "gaming", "energy", "software", "technology", "technologies", "international",
    "systems", "entertainment", "media", "power", "defense", "aerospace", "nuclear", "semiconductor",
}

_cache: dict[str, tuple[float, dict]] = {}
_cache_lock = threading.Lock()
_symbol_cache: dict[str, tuple[float, dict]] = {}
_symbol_cache_lock = threading.Lock()
_snapshot_lock = threading.Lock()
_gdelt_lock = threading.Lock()
_gdelt_last_request = 0.0


def clean(value: str) -> str:
    value = html_lib.unescape(value or "")
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def request_bytes(url: str, timeout: int = 12, headers: dict | None = None) -> bytes:
    merged_headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AnalystIntelMVP/0.7",
        "Accept": "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.8,zh-TW;q=0.6",
    }
    if headers:
        merged_headers.update(headers)
    request = urllib.request.Request(url, headers=merged_headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def request_json(url: str, timeout: int = 12, headers: dict | None = None) -> dict:
    return json.loads(request_bytes(url, timeout=timeout, headers=headers).decode("utf-8", errors="replace"))


def is_direct_source_url(url: str) -> bool:
    if not url:
        return False
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return False
    host = parsed.netloc.lower()
    if host == "bing.com" or host.endswith(".bing.com"):
        return False
    return not any(domain in host for domain in ("google.com", "news.google.com", "yahoo.com/search", "bing.com/search"))


def article_summary(url: str) -> str:
    try:
        html = request_bytes(url, timeout=5).decode("utf-8", errors="replace")[:180000]
    except Exception:
        return ""
    patterns = [
        r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:description["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']description["\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, html, flags=re.IGNORECASE)
        if match:
            summary = clean(match.group(1))
            if len(summary) >= 45:
                return summary[:320]
    for paragraph in re.findall(r"<p[^>]*>(.*?)</p>", html, flags=re.IGNORECASE | re.DOTALL):
        summary = clean(paragraph)
        if len(summary) >= 80:
            return summary[:320]
    return ""


def parse_published(value: str) -> datetime | None:
    value = clean(value)
    if not value:
        return None
    try:
        published_at = parsedate_to_datetime(value)
    except Exception:
        published_at = None
    if published_at is None:
        for fmt in ("%Y%m%dT%H%M%SZ", "%b %d, %Y", "%Y-%m-%dT%H:%M:%S%z"):
            try:
                published_at = datetime.strptime(value, fmt)
                break
            except ValueError:
                continue
    if published_at is None:
        return None
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=timezone.utc)
    return published_at.astimezone(timezone.utc)


def relative_age_hours(value: str) -> float | None:
    text = clean(value).lower()
    if not text:
        return None
    if any(term in text for term in ("minute", "分鐘", "秒", "just now")):
        return 0.1
    match = re.search(r"(\d+(?:\.\d+)?)\s*(hour|hr|小時)", text)
    if match:
        return float(match.group(1))
    match = re.search(r"(\d+(?:\.\d+)?)\s*(day|天)", text)
    if match:
        return float(match.group(1)) * 24
    return None


def evidence_item(title: str, url: str, source: str, summary: str, published_at: datetime, **extra) -> dict:
    now = datetime.now(timezone.utc)
    item = {
        "title": clean(title),
        "url": url,
        "publishedAt": published_at.isoformat(),
        "ageHours": max(0, round((now - published_at).total_seconds() / 3600, 1)),
        "source": clean(source),
        "summary": clean(summary)[:320],
        "contentKind": "news",
    }
    item.update(extra)
    return item


def normalize_host(url: str) -> str:
    return urllib.parse.urlparse(url).netloc.lower().removeprefix("www.")


def domain_matches(host: str, domains: set[str]) -> bool:
    return any(host == domain or host.endswith(f".{domain}") for domain in domains)


def classify_news(url: str) -> tuple[str, float]:
    host = normalize_host(url)
    if host.endswith(".gov") or host.endswith(".mil") or domain_matches(host, OFFICIAL_NEWS_DOMAINS):
        return "官方公告", 1.6
    if domain_matches(host, AUTHORITY_DOMAINS):
        return "權威新聞", 1.35
    return "新聞", 1.0


def profile_for_query(query: str) -> dict:
    lower = clean(query).lower()
    for profile in THEME_PROFILES:
        if any(theme_needle_matches(lower, needle) for needle in profile["needles"]):
            return profile
    return {"needles": (), "terms": (query,), "symbols": ()}


def theme_needle_matches(query: str, needle: str) -> bool:
    needle = clean(needle).lower()
    if not needle:
        return False
    if re.fullmatch(r"[a-z0-9.+ -]+", needle):
        return bool(re.search(rf"(?<![a-z0-9]){re.escape(needle)}(?![a-z0-9])", query))
    return needle in query


def topic_tokens(query: str, profile: dict) -> list[str]:
    text = " ".join((query, *profile.get("terms", ())))
    latin = re.findall(r"[a-z][a-z0-9.+-]{2,}", text.lower())
    cjk = re.findall(r"[\u3400-\u9fff]{2,}", text)
    ignored = {"stocks", "stock", "industry", "shares", "market", "the", "and"}
    return list(dict.fromkeys(token for token in (*latin, *cjk) if token not in ignored))


def is_topic_relevant(text: str, tokens: list[str]) -> bool:
    normalized = clean(text).lower()
    return not tokens or any(token.lower() in normalized for token in tokens)


def has_topic_coverage(text: str, tokens: list[str]) -> bool:
    normalized = clean(text).lower()
    matched = sum(1 for token in dict.fromkeys(tokens) if token.lower() in normalized)
    return matched >= (1 if len(tokens) <= 1 else 2)


def gdelt_news(query: str, profile: dict, limit: int = 12) -> list[dict]:
    global _gdelt_last_request
    search_term = profile.get("terms", (query,))[0] or query
    gdelt_query = f'"{search_term}" (stock OR shares OR earnings OR investor)'
    params = urllib.parse.urlencode({
        "query": gdelt_query,
        "mode": "artlist",
        "maxrecords": min(40, max(20, limit * 2)),
        "format": "json",
        "timespan": "1d",
        "sort": "hybridrel",
    })
    url = f"https://api.gdeltproject.org/api/v2/doc/doc?{params}"
    with _gdelt_lock:
        wait_seconds = max(0.0, 5.1 - (time.monotonic() - _gdelt_last_request))
        if wait_seconds:
            time.sleep(wait_seconds)
        try:
            payload = request_json(url, timeout=20)
        finally:
            _gdelt_last_request = time.monotonic()

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=FRESHNESS_HOURS)
    tokens = topic_tokens(query, profile)
    rows = []
    seen = set()
    for row in payload.get("articles", []):
        article_url = clean(row.get("url", ""))
        title = clean(row.get("title", ""))
        published_at = parse_published(row.get("seendate", ""))
        if not title or not is_direct_source_url(article_url) or published_at is None:
            continue
        if published_at < cutoff or published_at > now + timedelta(minutes=5):
            continue
        if not is_topic_relevant(title, tokens):
            continue
        dedupe_key = (normalize_host(article_url), title.lower())
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        rows.append((row, article_url, title, published_at))
        if len(rows) >= min(20, limit * 2):
            break

    results = []
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(article_summary, row[1]): row for row in rows}
        for future in as_completed(futures):
            row, article_url, title, published_at = futures[future]
            try:
                summary = future.result()
            except Exception:
                summary = ""
            if not summary:
                continue
            source_type, authority_weight = classify_news(article_url)
            results.append(evidence_item(
                title,
                article_url,
                row.get("domain") or normalize_host(article_url),
                summary,
                published_at,
                sourceType=source_type,
                authorityWeight=authority_weight,
            ))
    return sorted(results, key=lambda item: (-float(item.get("authorityWeight", 1)), float(item.get("ageHours", 24))))[:limit]


def bing_original_url(value: str) -> str:
    value = html_lib.unescape(clean(value))
    parsed = urllib.parse.urlparse(value)
    host = parsed.netloc.lower()
    if host == "bing.com" or host.endswith(".bing.com"):
        direct = urllib.parse.parse_qs(parsed.query).get("url", [""])[0]
        value = urllib.parse.unquote(direct)
    return value if is_direct_source_url(value) else ""


def candidate_symbols_from_text(text: str) -> list[str]:
    text = clean(text)
    symbols = []
    explicit_patterns = (
        r"\b(?:NASDAQ|NYSE|AMEX|OTCPK|OTCQX|OTCQB)\s*[:：]\s*([A-Z][A-Z0-9.-]{0,8})\b",
        r"\(([A-Z][A-Z0-9.-]{0,7})\)",
        r"\$([A-Z][A-Z0-9.-]{0,7})\b",
        r"\b(?:ticker|symbol)\s*[:：]?\s*([A-Z][A-Z0-9.-]{0,7})\b",
    )
    for pattern in explicit_patterns:
        symbols.extend(re.findall(pattern, text, flags=re.IGNORECASE))
    for symbol in re.findall(r"\b[A-Z][A-Z0-9.-]{1,5}\b", text):
        if symbol not in IGNORED_SYMBOLS and not re.fullmatch(r"Q[1-4]", symbol):
            symbols.append(symbol)
    return list(dict.fromkeys(symbol.upper() for symbol in symbols if symbol.upper() not in IGNORED_SYMBOLS))


def bing_news_rss(query: str, profile: dict, limit: int = 12) -> dict:
    base_terms = [profile.get("terms", (query,))[0] or query, query]
    searches = []
    for term in base_terms:
        term = clean(term)
        if not term:
            continue
        search = term if "stock" in term.lower() else f"{term} stocks"
        if search.casefold() not in {item.casefold() for item in searches}:
            searches.append(search)

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=FRESHNESS_HOURS)
    tokens = topic_tokens(query, profile)
    candidates = []
    fresh = []
    seen_urls = set()
    feed_errors = []
    for search in searches[:2]:
        params = urllib.parse.urlencode({"format": "rss", "mkt": "en-US", "setlang": "en-US", "q": search})
        url = f"https://www.bing.com/news/search?{params}"
        try:
            root = ET.fromstring(request_bytes(url, timeout=12))
        except Exception as exc:
            feed_errors.append(str(exc))
            continue
        for row in root.findall(".//item"):
            title = clean(row.findtext("title", ""))
            summary = clean(row.findtext("description", ""))
            article_url = bing_original_url(row.findtext("link", ""))
            published_at = parse_published(row.findtext("pubDate", ""))
            candidates.extend(candidate_symbols_from_text(f"{title} {summary}"))
            if not title or not summary or not article_url or published_at is None:
                continue
            if published_at < cutoff or published_at > now + timedelta(minutes=5):
                continue
            if not is_topic_relevant(f"{title} {summary}", tokens):
                continue
            dedupe_key = (normalize_host(article_url), title.casefold())
            if dedupe_key in seen_urls:
                continue
            seen_urls.add(dedupe_key)
            source_type, authority_weight = classify_news(article_url)
            fresh.append(evidence_item(
                title,
                article_url,
                normalize_host(article_url),
                summary,
                published_at,
                sourceType=source_type,
                authorityWeight=authority_weight,
            ))
    if not fresh and not candidates and feed_errors:
        raise RuntimeError(feed_errors[0])
    return {
        "evidence": sorted(
            fresh,
            key=lambda item: (-float(item.get("authorityWeight", 1)), float(item.get("ageHours", 24))),
        )[:limit],
        "symbols": list(dict.fromkeys(candidates))[:12],
    }


def stock_symbols_from_query(query: str) -> list[str]:
    symbols = []
    for token in re.findall(r"\b[A-Z][A-Z0-9.-]{0,8}\b", query):
        if token not in IGNORED_SYMBOLS:
            symbols.append(token)
    return list(dict.fromkeys(symbols))


def symbols_from_evidence(evidence: list[dict]) -> list[str]:
    symbols = []
    patterns = [
        r"\b(?:NASDAQ|NYSE|AMEX|OTCPK|OTCQX|OTCQB)\s*[:：]\s*([A-Z][A-Z0-9.-]{0,8})\b",
        r"\(([A-Z][A-Z0-9.-]{0,7})\)",
    ]
    for item in evidence:
        text = item.get("title", "")
        for pattern in patterns:
            for symbol in re.findall(pattern, text):
                if symbol not in IGNORED_SYMBOLS:
                    symbols.append(symbol)
    return list(dict.fromkeys(symbols))


def yahoo_quote_candidates(query: str, profile: dict, limit: int = 8) -> list[dict]:
    terms = list(profile.get("terms", ())) or [query]
    if query.isascii() and query not in terms:
        terms.append(query)
    candidates = []
    seen = set()
    for term in terms[:3]:
        encoded = urllib.parse.quote(term)
        urls = [
            f"https://query1.finance.yahoo.com/v1/finance/search?q={encoded}&quotesCount=10&newsCount=0",
            f"https://query2.finance.yahoo.com/v1/finance/search?q={encoded}&quotesCount=10&newsCount=0",
        ]
        payload = None
        for url in urls:
            try:
                payload = request_json(url, timeout=9)
                break
            except Exception:
                continue
        if not payload:
            continue
        for row in payload.get("quotes", []):
            symbol = clean(row.get("symbol", "")).upper()
            if row.get("quoteType") != "EQUITY" or not symbol or symbol in seen:
                continue
            if not re.fullmatch(r"[A-Z][A-Z0-9.-]{0,8}", symbol):
                continue
            seen.add(symbol)
            candidates.append({
                "symbol": symbol,
                "name": clean(row.get("shortname") or row.get("longname") or symbol),
                "exchange": clean(row.get("exchDisp") or row.get("exchange") or ""),
            })
            if len(candidates) >= limit:
                return candidates
    return candidates


def parse_price(value: str) -> float | None:
    match = re.search(r"-?\d+(?:\.\d+)?", clean(value).replace(",", ""))
    return float(match.group(0)) if match else None


def nasdaq_quote_profile(symbol: str, fallback: dict | None = None) -> dict | None:
    if not re.fullmatch(r"[A-Z][A-Z0-9-]{0,7}", symbol):
        return None
    base = "https://api.nasdaq.com/api"
    try:
        info_payload = request_json(f"{base}/quote/{urllib.parse.quote(symbol)}/info?assetclass=stocks", timeout=12)
        info = info_payload.get("data") or {}
        primary = info.get("primaryData") or {}
        if not info.get("symbol") or not primary.get("lastSalePrice"):
            return None
    except Exception:
        return None

    profile_data = {}
    try:
        profile_payload = request_json(f"{base}/company/{urllib.parse.quote(symbol)}/company-profile", timeout=10)
        profile_data = profile_payload.get("data") or {}
    except Exception:
        profile_data = {}

    def profile_value(key: str) -> str:
        value = profile_data.get(key) or {}
        return clean(value.get("value", "")) if isinstance(value, dict) else clean(str(value))

    last_price_text = clean(primary.get("lastSalePrice", ""))
    percent_text = clean(primary.get("percentageChange", ""))
    market_url = f"https://www.nasdaq.com/market-activity/stocks/{symbol.lower()}"
    return {
        "symbol": symbol,
        "name": clean(info.get("companyName") or profile_value("CompanyName") or (fallback or {}).get("name") or symbol),
        "exchange": clean(info.get("exchange") or (fallback or {}).get("exchange") or "NASDAQ"),
        "lastSalePrice": last_price_text,
        "lastSaleValue": parse_price(last_price_text),
        "netChange": clean(primary.get("netChange", "")),
        "percentageChange": percent_text,
        "changePercentValue": parse_price(percent_text),
        "direction": clean(primary.get("deltaIndicator", "")),
        "lastTradeTimestamp": clean(primary.get("lastTradeTimestamp", "")),
        "marketStatus": clean(info.get("marketStatus", "")),
        "range52Week": clean(((info.get("keyStats") or {}).get("fiftyTwoWeekHighLow") or {}).get("value", "")),
        "url": market_url,
        "companyUrl": profile_value("CompanyUrl"),
        "companyDescription": profile_value("CompanyDescription")[:360],
        "sector": profile_value("Sector"),
        "industry": profile_value("Industry"),
        "secUrl": f"https://www.sec.gov/edgar/browse/?CIK={urllib.parse.quote(symbol)}&owner=exclude&action=getcompany",
        "verifiedProvider": "Nasdaq",
    }


def parse_financial_value(value: str) -> float | None:
    text = clean(value).replace(",", "")
    if not text or text in {"--", "N/A"}:
        return None
    negative = text.startswith("-") or (text.startswith("(") and text.endswith(")"))
    match = re.search(r"\d+(?:\.\d+)?", text)
    if not match:
        return None
    number = float(match.group(0))
    return -number if negative else number


def table_row(table: dict, label: str) -> dict:
    for row in (table or {}).get("rows") or []:
        if clean(row.get("value1", "")).casefold() == label.casefold():
            return row
    return {}


def row_number(table: dict, label: str, key: str = "value2") -> float | None:
    return parse_financial_value(table_row(table, label).get(key, ""))


def percent_change(current: float | None, previous: float | None) -> float | None:
    if current is None or previous in {None, 0}:
        return None
    return round((current / previous - 1) * 100, 2)


def ratio_percent(numerator: float | None, denominator: float | None) -> float | None:
    if numerator is None or denominator in {None, 0}:
        return None
    return round(numerator / denominator * 100, 2)


def nasdaq_summary_data(symbol: str) -> dict:
    url = f"https://api.nasdaq.com/api/quote/{urllib.parse.quote(symbol)}/summary?assetclass=stocks"
    try:
        payload = request_json(url, timeout=13)
    except Exception:
        return {}
    summary = ((payload.get("data") or {}).get("summaryData") or {})

    def value(key: str) -> str:
        row = summary.get(key) or {}
        return clean(row.get("value", "")) if isinstance(row, dict) else ""

    target = parse_price(value("OneYrTarget"))
    market_cap = parse_financial_value(value("MarketCap"))
    return {
        "oneYearTarget": target,
        "oneYearTargetLabel": value("OneYrTarget"),
        "marketCap": market_cap,
        "dividendYieldPercent": parse_price(value("Yield")),
        "annualizedDividend": parse_price(value("AnnualizedDividend")),
        "previousClose": parse_price(value("PreviousClose")),
        "averageVolume": parse_financial_value(value("AverageVolume")),
        "shareVolume": parse_financial_value(value("ShareVolume")),
        "exDividendDate": value("ExDividendDate"),
        "sourceUrl": f"https://www.nasdaq.com/market-activity/stocks/{symbol.lower()}",
    }


def nasdaq_financial_data(symbol: str) -> dict:
    url = f"https://api.nasdaq.com/api/company/{urllib.parse.quote(symbol)}/financials?frequency=1"
    try:
        payload = request_json(url, timeout=15)
    except Exception:
        return {}
    data = payload.get("data") or {}
    income = data.get("incomeStatementTable") or {}
    balance = data.get("balanceSheetTable") or {}
    cash_flow = data.get("cashFlowTable") or {}
    headers = income.get("headers") or {}
    if not (income.get("rows") or []):
        return {}

    revenue = row_number(income, "Total Revenue")
    prior_revenue = row_number(income, "Total Revenue", "value3")
    gross_profit = row_number(income, "Gross Profit")
    operating_income = row_number(income, "Operating Income")
    prior_operating_income = row_number(income, "Operating Income", "value3")
    net_income = row_number(income, "Net Income")
    operating_cash = row_number(cash_flow, "Net Cash Flow-Operating")
    capital_expenditures = row_number(cash_flow, "Capital Expenditures")
    free_cash_flow = None
    if operating_cash is not None and capital_expenditures is not None:
        free_cash_flow = round(operating_cash + capital_expenditures, 2)
    cash = row_number(balance, "Cash and Cash Equivalents")
    short_debt = row_number(balance, "Short-Term Debt / Current Portion of Long-Term Debt")
    long_debt = row_number(balance, "Long-Term Debt")
    total_debt = None
    if short_debt is not None or long_debt is not None:
        total_debt = round((short_debt or 0) + (long_debt or 0), 2)

    operating_margin = ratio_percent(operating_income, revenue)
    prior_operating_margin = ratio_percent(prior_operating_income, prior_revenue)
    margin_change = None
    if operating_margin is not None and prior_operating_margin is not None:
        margin_change = round(operating_margin - prior_operating_margin, 2)

    annual_series = []
    for key in ("value5", "value4", "value3", "value2"):
        period = clean(headers.get(key, ""))
        period_revenue = row_number(income, "Total Revenue", key)
        period_net_income = row_number(income, "Net Income", key)
        period_operating_cash = row_number(cash_flow, "Net Cash Flow-Operating", key)
        period_capex = row_number(cash_flow, "Capital Expenditures", key)
        period_fcf = None
        if period_operating_cash is not None and period_capex is not None:
            period_fcf = round(period_operating_cash + period_capex, 2)
        if period and period_revenue is not None:
            annual_series.append({
                "period": period,
                "revenueThousands": period_revenue,
                "netIncomeThousands": period_net_income,
                "freeCashFlowThousands": period_fcf,
            })

    return {
        "periodEnd": clean(headers.get("value2", "")),
        "priorPeriodEnd": clean(headers.get("value3", "")),
        "unit": "USD thousands",
        "revenueThousands": revenue,
        "revenueGrowthPercent": percent_change(revenue, prior_revenue),
        "grossMarginPercent": ratio_percent(gross_profit, revenue),
        "operatingMarginPercent": operating_margin,
        "operatingMarginChangePoints": margin_change,
        "netMarginPercent": ratio_percent(net_income, revenue),
        "freeCashFlowThousands": free_cash_flow,
        "freeCashFlowMarginPercent": ratio_percent(free_cash_flow, revenue),
        "cashThousands": cash,
        "totalDebtThousands": total_debt,
        "netDebtThousands": None if total_debt is None else round(total_debt - (cash or 0), 2),
        "annualSeries": annual_series,
        "sourceUrl": f"https://www.nasdaq.com/market-activity/stocks/{symbol.lower()}/financials",
        "provider": "Nasdaq reported financials",
    }


def historical_return(points: list[dict], days: int) -> float | None:
    if len(points) < 2:
        return None
    latest = points[-1]
    target = latest["dateValue"] - timedelta(days=days)
    candidates = [point for point in points if point["dateValue"] <= target]
    base = candidates[-1] if candidates else points[0]
    if base["close"] in {None, 0}:
        return None
    return round((latest["close"] / base["close"] - 1) * 100, 2)


def nasdaq_history_data(symbol: str) -> dict:
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=370)
    params = urllib.parse.urlencode({
        "assetclass": "stocks",
        "fromdate": start.isoformat(),
        "todate": today.isoformat(),
        "limit": 5000,
    })
    url = f"https://api.nasdaq.com/api/quote/{urllib.parse.quote(symbol)}/historical?{params}"
    try:
        payload = request_json(url, timeout=16)
    except Exception:
        return {}
    rows = (((payload.get("data") or {}).get("tradesTable") or {}).get("rows") or [])
    points = []
    for row in rows:
        try:
            date_value = datetime.strptime(clean(row.get("date", "")), "%m/%d/%Y").date()
        except ValueError:
            continue
        close_value = parse_price(row.get("close", ""))
        if close_value is None:
            continue
        points.append({
            "date": date_value.isoformat(),
            "dateValue": date_value,
            "close": close_value,
            "high": parse_price(row.get("high", "")),
            "low": parse_price(row.get("low", "")),
            "volume": parse_financial_value(row.get("volume", "")),
        })
    points.sort(key=lambda item: item["dateValue"])
    if not points:
        return {}

    closes = [point["close"] for point in points]
    daily_returns = [closes[index] / closes[index - 1] - 1 for index in range(1, len(closes)) if closes[index - 1]]
    recent_returns = daily_returns[-20:]
    volatility = None
    if len(recent_returns) >= 2:
        volatility = round(statistics.stdev(recent_returns) * math.sqrt(252) * 100, 2)

    peak = closes[0]
    max_drawdown = 0.0
    for price in closes:
        peak = max(peak, price)
        drawdown = (price / peak - 1) * 100 if peak else 0
        max_drawdown = min(max_drawdown, drawdown)

    recent20 = points[-20:]
    recent_closes = [point["close"] for point in recent20]
    sorted_recent = sorted(recent_closes)
    index25 = max(0, int((len(sorted_recent) - 1) * 0.25))
    index75 = max(0, int((len(sorted_recent) - 1) * 0.75))
    low52 = min(closes)
    high52 = max(closes)
    latest_close = closes[-1]
    percentile = None if high52 == low52 else round((latest_close - low52) / (high52 - low52) * 100, 1)

    return {
        "asOf": points[-1]["date"],
        "latestClose": latest_close,
        "returns": {
            "oneWeek": historical_return(points, 7),
            "oneMonth": historical_return(points, 30),
            "threeMonths": historical_return(points, 90),
            "oneYear": historical_return(points, 365),
        },
        "annualizedVolatility20dPercent": volatility,
        "maxDrawdown1yPercent": round(max_drawdown, 2),
        "low20d": min(recent_closes),
        "high20d": max(recent_closes),
        "average20d": round(sum(recent_closes) / len(recent_closes), 2),
        "lowerQuartile20d": sorted_recent[index25],
        "upperQuartile20d": sorted_recent[index75],
        "low52Week": low52,
        "high52Week": high52,
        "pricePercentile52Week": percentile,
        "series": [{"date": point["date"], "close": point["close"]} for point in points[-60:]],
        "sourceUrl": f"https://www.nasdaq.com/market-activity/stocks/{symbol.lower()}/historical",
    }


def nasdaq_analyst_data(symbol: str) -> dict:
    url = f"https://api.nasdaq.com/api/analyst/{urllib.parse.quote(symbol)}/ratings"
    try:
        payload = request_json(url, timeout=12)
    except Exception:
        return {}
    data = payload.get("data") or {}
    summary = clean(data.get("ratingsSummary", ""))
    coverage_match = re.search(r"(\d+)\s+analysts?", summary, flags=re.IGNORECASE)
    return {
        "meanRating": clean(data.get("meanRatingType", "")),
        "analystCount": int(coverage_match.group(1)) if coverage_match else None,
        "summary": summary,
        "sourceUrl": f"https://www.nasdaq.com/market-activity/stocks/{symbol.lower()}/analyst-research",
    }


def nasdaq_earnings_data(symbol: str) -> dict:
    url = f"https://api.nasdaq.com/api/company/{urllib.parse.quote(symbol)}/earnings-surprise"
    try:
        payload = request_json(url, timeout=12)
    except Exception:
        return {}
    rows = ((((payload.get("data") or {}).get("earningsSurpriseTable") or {}).get("rows")) or [])[:4]
    surprises = []
    normalized_rows = []
    for row in rows:
        surprise = parse_financial_value(str(row.get("percentageSurprise", "")))
        if surprise is not None:
            surprises.append(surprise)
        normalized_rows.append({
            "fiscalQuarter": clean(str(row.get("fiscalQtrEnd", ""))),
            "dateReported": clean(str(row.get("dateReported", ""))),
            "eps": row.get("eps"),
            "consensusForecast": clean(str(row.get("consensusForecast", ""))),
            "surprisePercent": surprise,
        })
    return {
        "latest": normalized_rows[0] if normalized_rows else None,
        "averageSurprisePercent": round(sum(surprises) / len(surprises), 2) if surprises else None,
        "beatCount": sum(1 for value in surprises if value > 0),
        "reportedCount": len(surprises),
        "rows": normalized_rows,
        "sourceUrl": f"https://www.nasdaq.com/market-activity/stocks/{symbol.lower()}/earnings",
    }


def nasdaq_decision_data(symbol: str, current_price: float | None) -> dict:
    cache_key = symbol.upper()
    with _symbol_cache_lock:
        cached = _symbol_cache.get(cache_key)
        if cached and time.monotonic() - cached[0] <= SYMBOL_CACHE_SECONDS:
            base = cached[1]
        else:
            base = None

    if base is None:
        with ThreadPoolExecutor(max_workers=5) as executor:
            tasks = {
                "valuation": executor.submit(nasdaq_summary_data, symbol),
                "fundamentals": executor.submit(nasdaq_financial_data, symbol),
                "history": executor.submit(nasdaq_history_data, symbol),
                "analyst": executor.submit(nasdaq_analyst_data, symbol),
                "earnings": executor.submit(nasdaq_earnings_data, symbol),
            }
            base = {}
            for key, future in tasks.items():
                try:
                    base[key] = future.result()
                except Exception:
                    base[key] = {}
        with _symbol_cache_lock:
            _symbol_cache[cache_key] = (time.monotonic(), base)

    result = {key: dict(value) if isinstance(value, dict) else value for key, value in base.items()}
    valuation = result.setdefault("valuation", {})
    target = valuation.get("oneYearTarget")
    valuation["targetUpsidePercent"] = percent_change(target, current_price)
    result["coverage"] = {
        "valuation": bool(valuation),
        "fundamentals": bool(result.get("fundamentals")),
        "history": bool(result.get("history")),
        "analyst": bool(result.get("analyst")),
        "earnings": bool(result.get("earnings")),
    }
    return result


def nasdaq_news(symbol: str, limit: int = 6) -> list[dict]:
    query = urllib.parse.quote(f"{symbol}|stocks")
    url = f"https://www.nasdaq.com/api/news/topic/articlebysymbol?q={query}&offset=0&limit=20"
    try:
        payload = request_json(url, timeout=14)
    except Exception:
        return []
    now = datetime.now(timezone.utc)
    results = []
    for row in ((payload.get("data") or {}).get("rows") or []):
        age_hours = relative_age_hours(row.get("ago", ""))
        if age_hours is None or age_hours > FRESHNESS_HOURS:
            continue
        published_at = now - timedelta(hours=age_hours)
        article_path = clean(row.get("url", ""))
        article_url = urllib.parse.urljoin("https://www.nasdaq.com", article_path)
        title = clean(row.get("title", ""))
        summary = clean(row.get("description", ""))
        if not title or not summary or not is_direct_source_url(article_url):
            continue
        related = []
        for value in row.get("related_symbols") or []:
            related_symbol = clean(value.split("|", 1)[0]).upper()
            if related_symbol:
                related.append(related_symbol)
        mentions_symbol = bool(re.search(
            rf"(?<![A-Z0-9]){re.escape(symbol)}(?![A-Z0-9])",
            f"{title} {summary}".upper(),
        ))
        if symbol not in related and not mentions_symbol:
            continue
        if symbol not in related:
            related.append(symbol)
        results.append(evidence_item(
            title,
            article_url,
            f"{clean(row.get('publisher', 'Nasdaq'))} via Nasdaq",
            summary,
            published_at,
            sourceType="權威新聞",
            authorityWeight=1.35,
            symbols=list(dict.fromkeys(related)),
        ))
        if len(results) >= limit:
            break
    return results


def text_value(node: dict | None) -> str:
    if not isinstance(node, dict):
        return ""
    if node.get("simpleText"):
        return clean(node["simpleText"])
    return clean("".join(run.get("text", "") for run in node.get("runs", []) if isinstance(run, dict)))


def extract_json_assignment(html: str, markers: tuple[str, ...]) -> dict | None:
    decoder = json.JSONDecoder()
    for marker in markers:
        marker_index = html.find(marker)
        if marker_index < 0:
            continue
        start = html.find("{", marker_index + len(marker))
        if start < 0:
            continue
        try:
            payload, _ = decoder.raw_decode(html[start:])
            if isinstance(payload, dict):
                return payload
        except Exception:
            continue
    return None


def walk_video_renderers(node):
    if isinstance(node, dict):
        renderer = node.get("videoRenderer")
        if isinstance(renderer, dict):
            yield renderer
        for value in node.values():
            yield from walk_video_renderers(value)
    elif isinstance(node, list):
        for value in node:
            yield from walk_video_renderers(value)


def decode_json_string(value: str) -> str:
    try:
        return json.loads(f'"{value}"')
    except Exception:
        return clean(value)


def parse_audience_count(text: str) -> tuple[int | None, str]:
    normalized = clean(text).replace(",", "").replace("，", "").lower()
    patterns = [
        (r"(\d+(?:\.\d+)?)\s*(b|billion|十億)", 1_000_000_000),
        (r"(\d+(?:\.\d+)?)\s*(m|million|百萬)", 1_000_000),
        (r"(\d+(?:\.\d+)?)\s*(萬|万)", 10_000),
        (r"(\d+(?:\.\d+)?)\s*(k|thousand|千)", 1_000),
        (r"(\d{4,})\s*(?:subscribers?|followers?|追蹤|訂閱)", 1),
    ]
    for pattern, multiplier in patterns:
        match = re.search(pattern, normalized, flags=re.IGNORECASE)
        if match:
            return int(float(match.group(1)) * multiplier), clean(text)
    return None, ""


def youtube_subscriber_count(video_id: str) -> tuple[int | None, str]:
    try:
        html = request_bytes(f"https://www.youtube.com/watch?v={urllib.parse.quote(video_id)}", timeout=12).decode("utf-8", errors="replace")
    except Exception:
        return None, ""
    for match in re.finditer(r'"subscriberCountText"', html):
        chunk = html[match.start():match.start() + 1400]
        for raw in re.findall(r'"(?:simpleText|label)":"((?:\\.|[^"\\])*)"', chunk):
            value = decode_json_string(raw)
            count, label = parse_audience_count(value)
            if count is not None:
                return count, label
    return None, ""


def youtube_direct_results(query: str, profile: dict, limit: int = 6) -> list[dict]:
    search_term = profile.get("terms", (query,))[0] or query
    encoded = urllib.parse.quote_plus(f"{search_term} stock analysis")
    url = f"https://www.youtube.com/results?search_query={encoded}&sp=EgIIAg%253D%253D"
    try:
        html = request_bytes(url, timeout=15).decode("utf-8", errors="replace")
    except Exception:
        return []
    data = extract_json_assignment(html, ("var ytInitialData =", 'window["ytInitialData"] =', "ytInitialData ="))
    if not data:
        return []

    candidates = []
    seen = set()
    tokens = topic_tokens(query, profile)
    for renderer in walk_video_renderers(data):
        video_id = clean(renderer.get("videoId", ""))
        title = text_value(renderer.get("title"))
        published_text = text_value(renderer.get("publishedTimeText"))
        age_hours = relative_age_hours(published_text)
        if not video_id or video_id in seen or age_hours is None or age_hours > FRESHNESS_HOURS:
            continue
        if not is_topic_relevant(title, tokens):
            continue
        seen.add(video_id)
        owner_runs = (renderer.get("ownerText") or {}).get("runs") or []
        channel = clean(owner_runs[0].get("text", "")) if owner_runs else "YouTube"
        channel_url = ""
        if owner_runs:
            browse = ((owner_runs[0].get("navigationEndpoint") or {}).get("browseEndpoint") or {})
            canonical = clean(browse.get("canonicalBaseUrl", ""))
            browse_id = clean(browse.get("browseId", ""))
            if canonical:
                channel_url = urllib.parse.urljoin("https://www.youtube.com", canonical)
            elif browse_id:
                channel_url = f"https://www.youtube.com/channel/{browse_id}"
        candidates.append({
            "videoId": video_id,
            "title": title,
            "channel": channel,
            "channelUrl": channel_url,
            "publishedText": published_text,
            "ageHours": age_hours,
        })
        if len(candidates) >= 12:
            break

    verified = []
    now = datetime.now(timezone.utc)
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(youtube_subscriber_count, item["videoId"]): item for item in candidates}
        for future in as_completed(futures):
            candidate = futures[future]
            try:
                audience_count, audience_label = future.result()
            except Exception:
                continue
            if audience_count is None or audience_count < MIN_SOCIAL_AUDIENCE:
                continue
            published_at = now - timedelta(hours=float(candidate["ageHours"]))
            verified.append(evidence_item(
                candidate["title"],
                f"https://www.youtube.com/watch?v={candidate['videoId']}",
                candidate["channel"],
                f"{candidate['channel']}；{audience_label}；{candidate['publishedText']}。",
                published_at,
                sourceType="YouTube",
                contentKind="social",
                authorityWeight=0.9,
                platform="YouTube",
                audienceCount=audience_count,
                audienceLabel=audience_label,
                channelUrl=candidate["channelUrl"],
            ))
    return sorted(verified, key=lambda item: (-int(item.get("audienceCount", 0)), float(item.get("ageHours", 24))))[:limit]


def social_platform_for_url(url: str) -> str:
    host = normalize_host(url)
    for domain, platform in SOCIAL_HOSTS.items():
        if host == domain or host.endswith(f".{domain}"):
            return platform
    return ""


def brave_social_results(query: str, profile: dict, limit: int = 8) -> list[dict]:
    api_key = os.environ.get("BRAVE_SEARCH_API_KEY", "").strip()
    if not api_key:
        return []
    search_term = profile.get("terms", (query,))[0] or query
    site_clause = "(site:instagram.com OR site:x.com OR site:threads.net OR site:facebook.com)"
    params = urllib.parse.urlencode({
        "q": f"{site_clause} {search_term} stock analysis",
        "count": 20,
        "freshness": "pd",
        "search_lang": "en",
        "safesearch": "moderate",
    })
    try:
        payload = request_json(
            f"https://api.search.brave.com/res/v1/web/search?{params}",
            timeout=15,
            headers={"X-Subscription-Token": api_key, "Accept": "application/json"},
        )
    except Exception:
        return []

    now = datetime.now(timezone.utc)
    tokens = topic_tokens(query, profile)
    results = []
    for row in ((payload.get("web") or {}).get("results") or []):
        result_url = clean(row.get("url", ""))
        platform = social_platform_for_url(result_url)
        if not platform or not is_direct_source_url(result_url):
            continue
        title = clean(row.get("title", ""))
        description = clean(row.get("description", ""))
        if not is_topic_relevant(f"{title} {description}", tokens):
            continue
        age_hours = relative_age_hours(row.get("age", ""))
        if age_hours is None or age_hours > FRESHNESS_HOURS:
            continue
        page_summary = article_summary(result_url)
        audience_count, audience_label = parse_audience_count(f"{description} {page_summary}")
        if audience_count is None or audience_count < MIN_SOCIAL_AUDIENCE:
            continue
        summary = page_summary or description
        if not summary:
            continue
        results.append(evidence_item(
            title,
            result_url,
            platform,
            summary,
            now - timedelta(hours=age_hours),
            sourceType=platform,
            contentKind="social",
            authorityWeight=0.8,
            platform=platform,
            audienceCount=audience_count,
            audienceLabel=audience_label,
        ))
        if len(results) >= limit:
            break
    return results


def company_name_tokens(name: str, topic_words: set[str] | None = None) -> list[str]:
    tokens = re.findall(r"[a-z0-9]{3,}", clean(name).lower())
    ignored = GENERIC_INDUSTRY_WORDS | (topic_words or set())
    return [token for token in tokens if token not in COMPANY_WORDS and token not in ignored]


def associate_symbols(items: list[dict], quotes: list[dict], topic_words: set[str] | None = None) -> list[dict]:
    for item in items:
        related = {clean(symbol).upper() for symbol in item.get("symbols", []) if clean(symbol)}
        raw_text = clean(f"{item.get('title', '')} {item.get('summary', '')}")
        text = raw_text.lower()
        for quote in quotes:
            symbol = quote.get("symbol", "").upper()
            symbol_match = bool(len(symbol) >= 2 and re.search(rf"(?<![A-Z0-9]){re.escape(symbol)}(?![A-Z0-9])", raw_text))
            name_match = any(
                re.search(rf"(?<![a-z0-9]){re.escape(token)}(?![a-z0-9])", text)
                for token in company_name_tokens(quote.get("name", ""), topic_words)[:3]
            )
            if symbol_match or name_match:
                related.add(symbol)
        item["symbols"] = sorted(related)
    return items


def dedupe_evidence(items: list[dict], limit: int = 24) -> list[dict]:
    seen = set()
    results = []
    for item in sorted(items, key=lambda row: (-float(row.get("authorityWeight", 1)), float(row.get("ageHours", 24)))):
        key = clean(item.get("url", "")).lower()
        if not key or key in seen:
            continue
        seen.add(key)
        results.append(item)
        if len(results) >= limit:
            break
    return results


def load_snapshots() -> dict:
    if not SNAPSHOT_PATH.exists():
        return {}
    try:
        return json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_snapshots(snapshots: dict) -> None:
    SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_PATH.write_text(json.dumps(snapshots, ensure_ascii=False, indent=2), encoding="utf-8")


def freshness_payload(query: str, evidence: list[dict], quotes: list[dict]) -> dict:
    today = datetime.now(timezone.utc).date().isoformat()
    current_prices = {
        quote["symbol"]: quote.get("lastSaleValue")
        for quote in quotes
        if quote.get("lastSaleValue") is not None
    }
    signature = "|".join([item.get("url", "") for item in evidence[:8]] + sorted(current_prices))
    with _snapshot_lock:
        snapshots = load_snapshots()
        key = clean(query).casefold()
        history = snapshots.get(key, [])
        previous = next((row for row in reversed(history) if row.get("date") != today), None)
        current = {
            "date": today,
            "signature": signature,
            "prices": current_prices,
            "collectedAt": datetime.now(timezone.utc).isoformat(),
        }
        if not history or history[-1].get("date") != today:
            history.append(current)
        else:
            history[-1] = current
        snapshots[key] = history[-14:]
        try:
            save_snapshots(snapshots)
        except Exception:
            pass

    comparisons = []
    if previous:
        previous_prices = previous.get("prices") or {}
        for symbol, current_price in current_prices.items():
            previous_price = previous_prices.get(symbol)
            if not previous_price or current_price is None:
                continue
            return_percent = round((current_price - previous_price) / previous_price * 100, 2)
            comparisons.append({
                "symbol": symbol,
                "fromDate": previous.get("date"),
                "toDate": today,
                "previousPrice": previous_price,
                "currentPrice": current_price,
                "returnPercent": return_percent,
            })
    return {
        "date": today,
        "windowHours": FRESHNESS_HOURS,
        "previousDate": previous.get("date") if previous else None,
        "changedFromPrevious": None if previous is None else previous.get("signature") != signature,
        "comparisons": comparisons,
    }


def cached_payload(query: str) -> dict | None:
    key = clean(query).casefold()
    with _cache_lock:
        entry = _cache.get(key)
        if not entry or time.monotonic() - entry[0] > CACHE_SECONDS:
            return None
        return entry[1]


def store_cached_payload(query: str, payload: dict) -> None:
    with _cache_lock:
        _cache[clean(query).casefold()] = (time.monotonic(), payload)


def build_analysis_payload(query: str) -> dict:
    cached = cached_payload(query)
    if cached:
        return cached

    profile = profile_for_query(query)
    errors = []
    broad_news: list[dict] = []
    bing_news: list[dict] = []
    bing_symbols: list[str] = []
    youtube_results: list[dict] = []
    other_social: list[dict] = []
    yahoo_candidates: list[dict] = []

    with ThreadPoolExecutor(max_workers=5) as executor:
        tasks = {
            "news": executor.submit(gdelt_news, query, profile),
            "bing": executor.submit(bing_news_rss, query, profile),
            "youtube": executor.submit(youtube_direct_results, query, profile),
            "social": executor.submit(brave_social_results, query, profile),
            "quotes": executor.submit(yahoo_quote_candidates, query, profile),
        }
        for name, future in tasks.items():
            try:
                value = future.result()
            except Exception as exc:
                errors.append(f"{name}: {exc}")
                value = []
            if name == "news":
                broad_news = value
            elif name == "bing":
                feed = value if isinstance(value, dict) else {}
                bing_news = feed.get("evidence", [])
                bing_symbols = feed.get("symbols", [])
            elif name == "youtube":
                youtube_results = value
            elif name == "social":
                other_social = value
            else:
                yahoo_candidates = value

    fallback_by_symbol = {row["symbol"]: row for row in yahoo_candidates}
    ordered_symbols = []
    for symbol in (
        *stock_symbols_from_query(query),
        *symbols_from_evidence([*broad_news, *bing_news]),
        *profile.get("symbols", ()),
        *bing_symbols,
        *(row["symbol"] for row in yahoo_candidates),
    ):
        symbol = clean(symbol).upper()
        if symbol and symbol not in ordered_symbols and symbol not in IGNORED_SYMBOLS:
            ordered_symbols.append(symbol)
    ordered_symbols = ordered_symbols[:8]

    quotes = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {
            executor.submit(nasdaq_quote_profile, symbol, fallback_by_symbol.get(symbol)): symbol
            for symbol in ordered_symbols
        }
        quote_by_symbol = {}
        for future in as_completed(futures):
            symbol = futures[future]
            try:
                quote = future.result()
            except Exception:
                quote = None
            if quote:
                quote_by_symbol[symbol] = quote
        quotes = [quote_by_symbol[symbol] for symbol in ordered_symbols if symbol in quote_by_symbol]

    if not profile.get("symbols"):
        query_tokens = topic_tokens(query, profile)
        explicit_symbols = set(stock_symbols_from_query(query))
        quotes = [
            quote for quote in quotes
            if quote["symbol"] in explicit_symbols or has_topic_coverage(
                " ".join((
                    quote.get("symbol", ""),
                    quote.get("name", ""),
                    quote.get("companyDescription", ""),
                    quote.get("sector", ""),
                    quote.get("industry", ""),
                )),
                query_tokens,
            )
        ]

    symbol_news = []
    decision_by_symbol = {}
    with ThreadPoolExecutor(max_workers=12) as executor:
        futures = {}
        for quote in quotes[:8]:
            symbol = quote["symbol"]
            futures[executor.submit(nasdaq_news, symbol)] = ("news", symbol)
            futures[executor.submit(nasdaq_decision_data, symbol, quote.get("lastSaleValue"))] = ("decision", symbol)
        for future in as_completed(futures):
            kind, symbol = futures[future]
            try:
                value = future.result()
            except Exception:
                value = [] if kind == "news" else {}
            if kind == "news":
                symbol_news.extend(value)
            else:
                decision_by_symbol[symbol] = value

    for quote in quotes:
        quote["decisionData"] = decision_by_symbol.get(quote["symbol"], {})

    association_topic_words = set(topic_tokens(query, profile))
    evidence = associate_symbols(
        dedupe_evidence([*broad_news, *bing_news, *symbol_news]),
        quotes,
        association_topic_words,
    )
    social = associate_symbols(
        dedupe_evidence([*youtube_results, *other_social], limit=16),
        quotes,
        association_topic_words,
    )
    freshness = freshness_payload(query, evidence, quotes)
    payload = {
        "query": query,
        "mode": "live",
        "collectedAt": datetime.now(timezone.utc).isoformat(),
        "freshness": freshness,
        "evidence": evidence,
        "social": social,
        "quotes": quotes,
        "dataWindows": {
            "newsHours": FRESHNESS_HOURS,
            "priceHistoryDays": 365,
            "financialPeriods": 4,
        },
        "socialPolicy": {
            "minimumAudience": MIN_SOCIAL_AUDIENCE,
            "platforms": ["YouTube", "Instagram", "X", "Threads", "Facebook"],
            "verifiedResults": len(social),
            "externalSearchEnabled": bool(os.environ.get("BRAVE_SEARCH_API_KEY", "").strip()),
        },
        "errors": errors,
    }
    store_cached_payload(query, payload)
    return payload


def error_payload(query: str, error: str = "") -> dict:
    return {
        "query": query,
        "mode": "error",
        "evidence": [],
        "social": [],
        "quotes": [],
        "freshness": {"windowHours": FRESHNESS_HOURS, "comparisons": []},
        "dataWindows": {"newsHours": FRESHNESS_HOURS, "priceHistoryDays": 365, "financialPeriods": 4},
        "socialPolicy": {"minimumAudience": MIN_SOCIAL_AUDIENCE, "verifiedResults": 0},
        "errors": [error] if error else [],
    }


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, payload: dict, status: int = 200, include_body: bool = True) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        try:
            self.end_headers()
            if include_body:
                self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            return

    def do_OPTIONS(self) -> None:
        self._send_json({"ok": True})

    def _send_static(self, path: str, include_body: bool = True) -> None:
        if path in {"", "/"}:
            path = "/index.html"
        relative = path.lstrip("/")
        file_path = (ROOT / relative).resolve()
        if not str(file_path).startswith(str(ROOT)) or not file_path.exists() or not file_path.is_file():
            self._send_json({"error": "not found"}, 404, include_body=include_body)
            return
        body = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", STATIC_TYPES.get(file_path.suffix, "application/octet-stream"))
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if include_body:
            self.wfile.write(body)

    def do_HEAD(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self._send_json({"ok": True}, include_body=False)
            return
        self._send_static(parsed.path, include_body=False)

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path not in {"/api/custom-sector", "/api/source-preview"}:
            self._send_static(parsed.path)
            return

        params = urllib.parse.parse_qs(parsed.query)
        query = clean((params.get("q") or [""])[0])[:160]
        if not query:
            self._send_json({"error": "missing q"}, 400)
            return

        try:
            if parsed.path == "/api/source-preview":
                payload = build_analysis_payload(query)
                source_type = clean((params.get("type") or ["新聞"])[0])
                if "youtube" in source_type.lower():
                    items = [item for item in payload.get("social", []) if item.get("platform") == "YouTube"]
                else:
                    items = payload.get("evidence", [])
                self._send_json({
                    "query": query,
                    "sourceType": source_type,
                    "windowHours": FRESHNESS_HOURS,
                    "fallbackUsed": False,
                    "items": items[:3],
                })
                return
            self._send_json(build_analysis_payload(query))
        except Exception as exc:
            self._send_json(error_payload(query, str(exc)))

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write(fmt % args + "\n")


def main() -> int:
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Analyst Intel live server running on http://0.0.0.0:{PORT}")
    print("Endpoints: / and /api/custom-sector?q=YOUR_KEYWORD")
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
