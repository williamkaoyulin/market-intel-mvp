#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


PORT = int(os.environ.get("PORT", "4318"))
ROOT = Path(__file__).resolve().parent
SNAPSHOT_PATH = Path(__file__).resolve().parent / "data" / "live_snapshots.json"
FRESHNESS_HOURS = 24
STATIC_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
}


THEME_TERMS = [
    (("咖啡", "coffee"), ["coffee"]),
    (("機器人", "robot", "robotics", "自動化"), ["robotics", "automation"]),
    (("太空", "space", "衛星"), ["space", "satellite"]),
    (("遊戲", "gaming", "game"), ["gaming", "video games"]),
    (("軍工", "國防", "defense", "防務"), ["defense stocks", "aerospace defense"]),
    (("娛樂", "串流", "streaming", "影音"), ["streaming media", "entertainment"]),
    (("能源", "電力", "energy", "核能", "公用事業"), ["energy stocks", "utilities", "nuclear energy"]),
    (("半導體", "晶片", "semiconductor", "ai"), ["semiconductor", "artificial intelligence"]),
    (("寵物", "pet", "動物", "獸醫"), ["pet care", "animal health"]),
    (("醫療", "healthcare", "醫藥", "醫院"), ["healthcare", "medical devices"]),
    (("生技", "biotech", "製藥", "藥"), ["biotech", "pharmaceutical"]),
    (("銀行", "金融", "fintech", "支付"), ["bank stocks", "fintech", "payments"]),
    (("保險", "insurance"), ["insurance"]),
    (("電動車", "ev", "汽車", "車"), ["electric vehicles", "automakers"]),
    (("電池", "battery", "鋰"), ["battery technology", "lithium"]),
    (("太陽能", "solar", "再生能源"), ["solar energy", "renewable energy"]),
    (("資安", "cybersecurity", "網安"), ["cybersecurity"]),
    (("雲端", "cloud", "軟體", "saas"), ["cloud software", "saas"]),
    (("加密", "crypto", "bitcoin", "比特幣"), ["crypto stocks", "bitcoin miners"]),
    (("旅遊", "travel", "航空", "飯店", "郵輪"), ["travel stocks", "airlines", "hotels"]),
    (("零售", "retail", "消費"), ["retail stocks", "consumer discretionary"]),
    (("精品", "luxury", "奢侈"), ["luxury goods"]),
    (("運動", "sports", "球鞋"), ["sportswear", "athletic apparel"]),
    (("教育", "education", "線上學習"), ["education stocks", "online learning"]),
    (("房地產", "reits", "reit", "住宅"), ["reit", "homebuilders"]),
    (("航運", "shipping", "海運"), ["shipping stocks", "container shipping"]),
    (("農業", "agriculture", "糧食", "肥料"), ["agriculture stocks", "fertilizer"]),
    (("水", "water", "水資源"), ["water utilities"]),
]


def clean(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value or "")
    return re.sub(r"\s+", " ", value).strip()


def is_search_or_redirect_url(url: str) -> bool:
    host = urllib.parse.urlparse(url).netloc.lower()
    return any(domain in host for domain in ("google.com", "news.google.com", "yahoo.com/search"))


def is_direct_source_url(url: str) -> bool:
    if not url:
        return False
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return False
    return not is_search_or_redirect_url(url)


def resolve_article_url(url: str) -> str:
    if not url:
        return url
    request = urllib.request.Request(url, headers={"User-Agent": "AnalystIntelMVP/0.3"})
    try:
        with urllib.request.urlopen(request, timeout=3) as response:
            return response.geturl() or url
    except Exception:
        return url


def article_summary(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "AnalystIntelMVP/0.3"})
    try:
        with urllib.request.urlopen(request, timeout=6) as response:
            html = response.read(120000).decode("utf-8", errors="replace")
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
            return clean(urllib.parse.unquote(match.group(1)))[:260]
    paragraphs = re.findall(r"<p[^>]*>(.*?)</p>", html, flags=re.IGNORECASE | re.DOTALL)
    for paragraph in paragraphs:
        text = clean(paragraph)
        if len(text) > 80:
            return text[:260]
    return ""


def parse_published(value: str) -> datetime | None:
    try:
        published_at = parsedate_to_datetime(clean(value))
        if published_at.tzinfo is None:
            published_at = published_at.replace(tzinfo=timezone.utc)
        return published_at.astimezone(timezone.utc)
    except Exception:
        return None


def evidence_item(title: str, url: str, source: str, summary: str, published_at: datetime | None = None, published: str = "") -> dict:
    now = datetime.now(timezone.utc)
    if published_at is None:
        published_at = now
    return {
        "title": clean(title),
        "url": url,
        "published": clean(published),
        "publishedAt": published_at.isoformat(),
        "ageHours": max(0, round((now - published_at).total_seconds() / 3600, 1)),
        "source": clean(source),
        "summary": clean(summary)[:260],
    }


def google_news_rss(query: str, hours: int = FRESHNESS_HOURS, limit: int = 10) -> list[dict]:
    when_term = "when:1d" if hours <= 24 else "when:7d"
    encoded = urllib.parse.quote(f"{query} stock OR earnings OR investor OR market {when_term}")
    url = f"https://news.google.com/rss/search?q={encoded}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant"
    request = urllib.request.Request(url, headers={"User-Agent": "AnalystIntelMVP/0.2"})
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            xml_text = response.read().decode("utf-8", errors="replace")
    except Exception:
        return []

    root = ET.fromstring(xml_text)
    evidence = []
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=hours)
    for item in root.findall(".//item"):
        title = clean(item.findtext("title") or "")
        link = clean(item.findtext("link") or "")
        description = clean(item.findtext("description") or "")
        published = clean(item.findtext("pubDate") or "")
        published_at = parse_published(published)
        if published_at is None:
            continue
        if published_at < cutoff or published_at > now + timedelta(minutes=5):
            continue
        source_node = item.find("source")
        source = clean(source_node.text if source_node is not None else "Google News")
        if title and link:
            final_url = resolve_article_url(link)
            if not is_direct_source_url(final_url):
                continue
            item_payload = evidence_item(title, final_url, source, description, published_at, published)
            item_payload["googleNewsUrl"] = link
            item_payload["resolvedUrl"] = final_url
            evidence.append(item_payload)
        if len(evidence) >= limit:
            break
    return evidence


def stock_symbols_from_query(query: str) -> list[str]:
    ignored = {"AI", "CEO", "ETF", "EPS", "USA", "USD", "THE", "AND", "OR"}
    symbols = []
    for token in re.findall(r"\b[A-Z][A-Z0-9.]{1,5}\b", query):
        if token not in ignored:
            symbols.append(token)
    return list(dict.fromkeys(symbols))


def yahoo_finance_rss(query: str, hours: int = FRESHNESS_HOURS, limit: int = 10) -> list[dict]:
    symbols = stock_symbols_from_query(query)
    if not symbols:
        return []
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=hours)
    evidence = []
    for symbol in symbols[:4]:
        rss_url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={urllib.parse.quote(symbol)}&region=US&lang=en-US"
        request = urllib.request.Request(rss_url, headers={"User-Agent": "AnalystIntelMVP/0.4"})
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                xml_text = response.read().decode("utf-8", errors="replace")
        except Exception:
            continue
        try:
            root = ET.fromstring(xml_text)
        except Exception:
            continue
        for item in root.findall(".//item"):
            title = clean(item.findtext("title") or "")
            link = clean(item.findtext("link") or "")
            description = clean(item.findtext("description") or "")
            published = clean(item.findtext("pubDate") or "")
            published_at = parse_published(published)
            if published_at is None or published_at < cutoff or published_at > now + timedelta(minutes=5):
                continue
            final_url = resolve_article_url(link)
            if not title or not is_direct_source_url(final_url):
                continue
            evidence.append(evidence_item(title, final_url, "Yahoo Finance News", description, published_at, published))
            if len(evidence) >= limit:
                return evidence
    return evidence


def youtube_direct_results(query: str, limit: int = 10) -> list[dict]:
    encoded = urllib.parse.quote_plus(f"{query} stock analysis")
    url = f"https://www.youtube.com/results?search_query={encoded}&sp=EgIIAg%253D%253D"
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 AnalystIntelMVP/0.4"})
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            html = response.read(900000).decode("utf-8", errors="replace")
    except Exception:
        return []

    evidence = []
    seen = set()
    for match in re.finditer(r'"videoRenderer":\{"videoId":"([^"]+)".{0,5000}?"title":\{"runs":\[\{"text":"([^"]+)"\}', html):
        video_id, raw_title = match.groups()
        if video_id in seen:
            continue
        seen.add(video_id)
        title = clean(raw_title.encode("utf-8").decode("unicode_escape", errors="ignore"))
        if not title:
            continue
        channel_match = re.search(r'"ownerText":\{"runs":\[\{"text":"([^"]+)"', match.group(0))
        channel = clean(channel_match.group(1)) if channel_match else "YouTube"
        evidence.append(evidence_item(
            title,
            f"https://www.youtube.com/watch?v={video_id}",
            channel,
            "YouTube 影片搜尋結果，可直接開啟原始影片頁。",
        ))
        if len(evidence) >= limit:
            break
    return evidence


def preview_query_variants(query: str) -> list[str]:
    variants = [query]
    simplified = re.sub(r"\b(stock|investment|analysis|analyst|rating|thesis|market)\b", " ", query, flags=re.IGNORECASE)
    simplified = re.sub(r"\s+", " ", simplified).strip()
    if simplified:
        variants.append(simplified)
    parts = query.split()
    if parts:
        variants.append(parts[0])
    if len(parts) >= 2:
        variants.append(" ".join(parts[:2]))
    return list(dict.fromkeys(variants))


def source_preview_payload(query: str, source_type: str) -> dict:
    preview_query = query
    if "youtube" in source_type.lower():
        preview_query = f"{query} YouTube stock analysis"
    elif "專家" in source_type or "expert" in source_type.lower():
        preview_query = f"{query} analyst rating investment thesis stock analysis"

    used_query = preview_query
    evidence = []
    if "youtube" in source_type.lower():
        for candidate in preview_query_variants(preview_query):
            evidence = youtube_direct_results(candidate, limit=3)
            if evidence:
                used_query = candidate
                break
    else:
        for candidate in preview_query_variants(preview_query):
            evidence = google_news_rss(candidate, hours=24, limit=3)
            if not evidence:
                evidence = yahoo_finance_rss(candidate, hours=24, limit=3)
            if evidence:
                used_query = candidate
                break
    window_hours = 24
    fallback_used = False
    if not evidence:
        for candidate in preview_query_variants(preview_query):
            evidence = google_news_rss(candidate, hours=168, limit=3)
            if not evidence:
                evidence = yahoo_finance_rss(candidate, hours=168, limit=3)
            if evidence:
                used_query = candidate
                window_hours = 168
                fallback_used = True
                break

    return {
        "query": query,
        "previewQuery": preview_query,
        "usedQuery": used_query,
        "sourceType": source_type,
        "windowHours": window_hours,
        "fallbackUsed": fallback_used,
        "items": evidence,
        "message": "近 24 小時沒有足夠預覽，已顯示近 7 天。" if fallback_used else "近 24 小時預覽。",
    }


def query_terms(query: str, evidence: list[dict]) -> list[str]:
    queries = []
    lower = query.lower()
    for needles, terms in THEME_TERMS:
        if any(needle in lower or needle in query for needle in needles):
            queries.extend(terms)
    if query.isascii():
        queries.append(query)

    for item in evidence[:8]:
        title = item.get("title", "")
        ascii_chunks = re.findall(r"\b[A-Za-z][A-Za-z&.\-]{2,}(?:\s+[A-Za-z][A-Za-z&.\-]{2,}){0,2}\b", title)
        for chunk in ascii_chunks[:2]:
            if chunk.lower() not in {"the", "and", "market", "stock", "stocks", "news"}:
                queries.append(chunk)
    queries = list(dict.fromkeys(queries))
    return queries


def yahoo_quote_candidates(query: str, evidence: list[dict]) -> list[dict]:
    queries = query_terms(query, evidence)

    seen = set()
    candidates = []
    for term in queries:
        encoded = urllib.parse.quote(term)
        url = f"https://query1.finance.yahoo.com/v1/finance/search?q={encoded}&quotesCount=8&newsCount=0"
        request = urllib.request.Request(url, headers={"User-Agent": "AnalystIntelMVP/0.2"})
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                payload = json.loads(response.read().decode("utf-8", errors="replace"))
        except Exception:
            continue
        for row in payload.get("quotes", []):
            symbol = clean(row.get("symbol", ""))
            quote_type = clean(row.get("quoteType") or "")
            if quote_type != "EQUITY":
                continue
            if not symbol or symbol in seen:
                continue
            seen.add(symbol)
            candidates.append({
                "symbol": symbol,
                "name": clean(row.get("shortname") or row.get("longname") or symbol),
                "exchange": clean(row.get("exchDisp") or row.get("exchange") or ""),
                "type": quote_type,
                "url": f"https://finance.yahoo.com/quote/{urllib.parse.quote(symbol)}",
            })
            if len(candidates) >= 8:
                return candidates
    return candidates


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
    signature_parts = [item.get("url", "") for item in evidence[:5]] + [quote.get("symbol", "") for quote in quotes[:6]]
    signature = "|".join(signature_parts)
    snapshots = load_snapshots()
    history = snapshots.get(query, [])
    previous = next((row for row in reversed(history) if row.get("date") != today), None)
    current = {"date": today, "signature": signature, "collectedAt": datetime.now(timezone.utc).isoformat()}
    if not history or history[-1].get("date") != today:
        history.append(current)
    else:
        history[-1] = current
    snapshots[query] = history[-10:]
    save_snapshots(snapshots)
    return {
        "date": today,
        "windowHours": FRESHNESS_HOURS,
        "signature": signature,
        "previousDate": previous.get("date") if previous else None,
        "changedFromPrevious": None if previous is None else previous.get("signature") != signature,
    }


def error_payload(query: str, error: str = "") -> dict:
    return {
        "query": query,
        "mode": "error",
        "evidence": [],
        "quotes": [],
        "freshness": {"windowHours": FRESHNESS_HOURS},
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
        if parsed.path == "/api/source-preview":
            params = urllib.parse.parse_qs(parsed.query)
            query = clean((params.get("q") or [""])[0])
            source_type = clean((params.get("type") or ["新聞"])[0])
            if not query:
                self._send_json({"error": "missing q"}, 400)
                return
            try:
                self._send_json(source_preview_payload(query, source_type))
            except Exception as exc:
                self._send_json({"query": query, "sourceType": source_type, "items": [], "errors": [str(exc)]})
            return

        if parsed.path != "/api/custom-sector":
            self._send_static(parsed.path)
            return

        params = urllib.parse.parse_qs(parsed.query)
        query = clean((params.get("q") or [""])[0])
        if not query:
            self._send_json({"error": "missing q"}, 400)
            return

        try:
            evidence = google_news_rss(query)
            quote_errors = []
            try:
                quotes = yahoo_quote_candidates(query, evidence)
            except Exception as exc:
                quotes = []
                quote_errors = [f"quotes: {exc}"]
            freshness = freshness_payload(query, evidence, quotes)
            self._send_json({
                "query": query,
                "mode": "live",
                "collectedAt": datetime.now(timezone.utc).isoformat(),
                "freshness": freshness,
                "evidence": evidence,
                "quotes": quotes,
                "errors": quote_errors,
            })
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
