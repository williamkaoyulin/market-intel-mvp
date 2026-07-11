#!/usr/bin/env python3
"""
First-pass data collector for Analyst Intel.

This script intentionally keeps the first version boring and inspectable:
- `--sample` writes deterministic sample intelligence without network access.
- without `--sample`, it reads RSS feeds from sources.json, extracts keyword hits,
  and writes a raw evidence file that can later feed the scoring pipeline.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DEFAULT_SOURCES = ROOT / "sources.json"
DEFAULT_OUTPUT = ROOT / "data" / "generated-intelligence.json"


KEYWORDS = {
    "ASIC 接棒 GPU": ["ASIC", "custom chip", "客製化晶片", "世芯", "創意", "Broadcom", "Marvell"],
    "AI CapEx 延續": ["AI capex", "AI capital expenditure", "台積電", "advanced packaging", "CoWoS"],
    "Memory Recovery": ["DRAM", "memory", "南亞科", "Micron", "SK Hynix", "庫存"],
    "AI Server 出貨": ["AI server", "server shipment", "鴻海", "GB200", "NVL"]
}


@dataclass
class Source:
    name: str
    url: str
    source_type: str
    credibility: int


def default_sources() -> list[Source]:
    return [
        Source("Sample Tech RSS", "https://example.com/rss", "News", 60),
    ]


def load_sources(path: Path) -> list[Source]:
    if not path.exists():
      return default_sources()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return [Source(row["name"], row["url"], row.get("type", "News"), int(row.get("credibility", 60))) for row in rows]


def fetch_text(url: str, timeout: int = 15) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "AnalystIntelMVP/0.1"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def parse_rss(xml_text: str) -> list[dict]:
    root = ET.fromstring(xml_text)
    items = []
    for item in root.findall(".//item")[:50]:
        title = item.findtext("title") or ""
        link = item.findtext("link") or ""
        description = item.findtext("description") or ""
        published = item.findtext("pubDate") or ""
        items.append({"title": clean(title), "link": clean(link), "description": clean(description), "published": published})
    return items


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def classify(item: dict, source: Source) -> list[dict]:
    text = f"{item['title']} {item['description']}".lower()
    hits = []
    for theme, keywords in KEYWORDS.items():
        matched = [keyword for keyword in keywords if keyword.lower() in text]
        if matched:
            hits.append({
                "theme": theme,
                "source": source.name,
                "type": source.source_type,
                "credibility": source.credibility,
                "title": item["title"],
                "url": item["link"],
                "matchedKeywords": matched,
                "published": item["published"],
            })
    return hits


def collect(sources: list[Source]) -> dict:
    evidence = []
    errors = []
    for source in sources:
        try:
            xml_text = fetch_text(source.url)
            for item in parse_rss(xml_text):
                evidence.extend(classify(item, source))
        except Exception as exc:
            errors.append({"source": source.name, "url": source.url, "error": str(exc)})
    return {"generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "evidence": evidence, "errors": errors}


def sample_payload() -> dict:
    return {
        "generatedAt": "2026-07-09T07:30:00Z",
        "mode": "sample",
        "evidence": [
            {
                "theme": "ASIC 接棒 GPU",
                "source": "Morgan Stanley",
                "type": "Broker Report",
                "credibility": 88,
                "title": "ASIC supply chain demand expands beyond GPU cycle",
                "url": "https://www.alchip.com/en",
                "matchedKeywords": ["ASIC", "custom chip", "世芯"],
                "published": "2026-07-09"
            },
            {
                "theme": "AI CapEx 延續",
                "source": "Earnings Transcript",
                "type": "Transcript",
                "credibility": 90,
                "title": "Cloud capex remains focused on AI infrastructure",
                "url": "https://investor.tsmc.com/english/quarterly-results/2026/q2",
                "matchedKeywords": ["AI capex", "advanced packaging"],
                "published": "2026-07-09"
            }
        ],
        "errors": []
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect analyst intelligence evidence.")
    parser.add_argument("--sources", type=Path, default=DEFAULT_SOURCES)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--sample", action="store_true", help="write deterministic sample output without network access")
    args = parser.parse_args()

    payload = sample_payload() if args.sample else collect(load_sources(args.sources))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {args.output}")
    print(f"evidence={len(payload['evidence'])} errors={len(payload['errors'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
