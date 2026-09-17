#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""自动更新 27 届岗位雷达。

数据源：公开的 27 届秋招信息汇总表（腾讯文档 Smartsheet）。
抓取思路参考 daily-jobs（MIT）项目，并针对销售、采购、供应链、外贸、管培生方向重新筛选。
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import os
import re
import time
import urllib.parse
import urllib.request
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
PAD = "300000000$NrvcQyadGvDp"
SUB = "toi7BY"
REFERER = "https://docs.qq.com/smartsheet/DTnJ2Y1F5YWRHdkRw"
SOURCE_URL = REFERER
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/150.0.0.0"
NOISE_KW = ["27届", "中大厂", "以下为", "以下阿里", "内推汇总", "提前批", "秋招"]
ALI_KW = ["阿里", "菜鸟", "灵犀", "瓴羊", "蚂蚁", "淘宝", "天猫"]

RULES = {
    "销售": ["销售", "商务", "大客户", "渠道", "客户经理", "BD"],
    "采购": ["采购", "寻源", "供应商管理"],
    "供应链": ["供应链", "计划岗", "物流", "仓储", "履约", "生产管理"],
    "外贸": ["外贸", "国际贸易", "海外销售", "国际业务", "海外营销", "全球拓展", "跨境电商", "进出口"],
    "管培生": ["管培", "培训生"],
}


def fetch(startrow: int, endrow: int) -> dict:
    query = urllib.parse.urlencode({
        "padId": PAD,
        "subId": SUB,
        "startrow": startrow,
        "endrow": endrow,
        "outformat": 1,
        "normal": 1,
        "needSheetState": 2,
        "optimizedVer": 2,
        "nowb": 1,
    })
    request = urllib.request.Request(
        "https://docs.qq.com/dop-api/get/sheet?" + query,
        headers={"User-Agent": UA, "Referer": REFERER},
    )
    with urllib.request.urlopen(request, timeout=40) as response:
        return json.loads(response.read())


def cell_text(cell: object) -> str:
    if not isinstance(cell, dict):
        return ""
    value = cell.get("k1")
    if isinstance(value, list):
        return " ".join(str(item.get("k2", "")) for item in value if isinstance(item, dict))
    return value if isinstance(value, str) else ""


def parse_chunk(encoded: str) -> object:
    raw = base64.b64decode(encoded + "=" * (-len(encoded) % 4))
    return json.loads(zlib.decompress(raw).decode("utf-8"))


def clean_text(value: str) -> str:
    value = re.sub(r"[\u200b\u200e\u200f\ufe0f]", "", value or "")
    value = value.replace("\r", "\n")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n+", "；", value)
    value = re.sub(r"；{2,}", "；", value)
    return value.strip("； \n")


def fetch_all() -> list[dict]:
    first = fetch(0, 60)
    data = first.get("data") or {}
    maxrow = int(data.get("maxrow", 0) or 0)
    rows: dict[str, dict[str, str]] = {}
    start = 0
    while start < maxrow:
        response = fetch(start, min(start + 60, maxrow - 1))
        text = ((response.get("data") or {}).get("initialAttributedText") or {}).get("text") or []
        for chunk in text:
            encoded = chunk.get("smartsheet", "")
            if not encoded:
                continue
            try:
                blob = parse_chunk(encoded)
            except Exception:
                continue
            for item in blob:
                for piece in item if isinstance(item, list) else [item]:
                    if not isinstance(piece, dict) or piece.get("t") != 3028:
                        continue
                    rowmap = (piece.get("c", {}).get("k2", {}) or {}).get("k1", {})
                    for row_id, wrapper in rowmap.items():
                        cells = (wrapper or {}).get("k1", {}) if isinstance(wrapper, dict) else {}
                        row = rows.setdefault(row_id, {})
                        for column, cell in cells.items():
                            row[column] = cell_text(cell)
        start += 60

    result = []
    for row in rows.values():
        name = clean_text(str(row.get("fq2BBI", "")))
        if not name or any(keyword in name for keyword in NOISE_KW):
            continue
        if any(keyword in name for keyword in ALI_KW):
            continue
        result.append({
            "name": name,
            "job": clean_text(str(row.get("f1emzF", ""))),
            "deadline": clean_text(str(row.get("fSqe11", ""))),
        })
    return result


def detect_directions(job: str, name: str) -> list[str]:
    text = f"{name} {job}".lower()
    return [direction for direction, keywords in RULES.items() if any(word.lower() in text for word in keywords)]


def build_payload(rows: list[dict]) -> dict:
    relevant = []
    for index, row in enumerate(rows):
        directions = detect_directions(row["job"], row["name"])
        if not directions:
            continue
        relevant.append({
            **row,
            "directions": directions,
            "index": index,
            "sourceUrl": SOURCE_URL,
        })
    now = dt.datetime.now().astimezone()
    return {
        "updatedAt": now.strftime("%Y-%m-%d %H:%M"),
        "date": now.strftime("%Y-%m-%d"),
        "sourceUrl": SOURCE_URL,
        "sourceTotal": len(rows),
        "relevantCount": len(relevant),
        "jobs": relevant,
    }


def write_payload(payload: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "live-jobs.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (DATA_DIR / "live-jobs.js").write_text(
        "window.LIVE_JOBS = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    (DATA_DIR / "last-sync.json").write_text(
        json.dumps({
            "ok": True,
            "updatedAt": payload["updatedAt"],
            "sourceTotal": payload["sourceTotal"],
            "relevantCount": payload["relevantCount"],
        }, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def update_once() -> dict:
    rows = fetch_all()
    payload = build_payload(rows)
    write_payload(payload)
    print(f"[jobs] {payload['updatedAt']} | source={payload['sourceTotal']} | relevant={payload['relevantCount']}", flush=True)
    return payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--watch", action="store_true", help="持续运行，每 6 小时刷新一次")
    parser.add_argument("--hours", type=float, default=6.0, help="刷新间隔，默认 6 小时")
    args = parser.parse_args()

    while True:
        try:
            update_once()
        except Exception as error:
            error_payload = {
                "ok": False,
                "updatedAt": dt.datetime.now().astimezone().strftime("%Y-%m-%d %H:%M"),
                "error": str(error),
            }
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            (DATA_DIR / "last-sync.json").write_text(
                json.dumps(error_payload, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            print(f"[jobs] update failed: {error}", flush=True)
        if not args.watch:
            break
        time.sleep(max(args.hours, 0.25) * 3600)


if __name__ == "__main__":
    main()
