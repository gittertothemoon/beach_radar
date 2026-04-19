#!/usr/bin/env python3
"""
Reverse-geocode all beach pins via Nominatim and enrich with accurate
address/city/province/rawRegion/country fields.

Usage:
    python3 scripts/seed/reverse-geocode-enrich.py [--dry-run] [--start N]

Rate-limit: 1 req/s (Nominatim ToS). ~23 min for 1402 pins.
Cache: .cache/nominatim_reverse_cache.json — skips already-fetched pins.
"""

import json
import time
import sys
import os
import argparse
import urllib.request
import urllib.parse
from pathlib import Path

DATASET_PATH = Path("src/data/BeachRadar_Rimini_100_geocoded.json")
CACHE_PATH   = Path(".cache/nominatim_reverse_cache.json")
SAVE_EVERY   = 100  # flush dataset every N pins

NOMINATIM_UA = "where2beach-enrichment/1.0 (ivapanto97@gmail.com)"

def nominatim_reverse(lat: float, lng: float) -> dict | None:
    url = (
        f"https://nominatim.openstreetmap.org/reverse"
        f"?lat={lat}&lon={lng}&format=json&addressdetails=1"
    )
    req = urllib.request.Request(url, headers={"User-Agent": NOMINATIM_UA})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f"  ERROR fetching {lat},{lng}: {e}", flush=True)
        return None

def extract_city(addr: dict) -> str:
    for key in ("city", "town", "village", "municipality", "hamlet", "suburb"):
        if key in addr:
            return addr[key]
    return ""

def extract_province_code(addr: dict) -> str:
    # ISO3166-2-lvl6 = "IT-RN" → extract "RN"
    iso = addr.get("ISO3166-2-lvl6", "")
    if iso.startswith("IT-") and len(iso) == 5:
        return iso[3:]
    return ""

def extract_region(addr: dict) -> str:
    return addr.get("state", "")

def extract_country(addr: dict) -> str:
    return addr.get("country", "")

def is_italy(addr: dict) -> bool:
    country = addr.get("country", "")
    country_code = addr.get("country_code", "")
    return country_code == "it" or "Italia" in country or "Italy" in country

def load_cache() -> dict:
    if CACHE_PATH.exists():
        with open(CACHE_PATH) as f:
            return json.load(f)
    return {}

def save_cache(cache: dict):
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CACHE_PATH, "w") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

def load_dataset() -> list:
    with open(DATASET_PATH) as f:
        return json.load(f)

def save_dataset(data: list):
    with open(DATASET_PATH, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  [saved] {DATASET_PATH} ({len(data)} pins)", flush=True)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="No writes, just preview first 5")
    parser.add_argument("--start", type=int, default=0, help="Skip first N pins")
    args = parser.parse_args()

    data    = load_dataset()
    cache   = load_cache()
    total   = len(data)

    print(f"Dataset: {total} pins")
    print(f"Cache:   {len(cache)} entries already fetched")

    removed      = []
    enriched     = 0
    cache_hits   = 0
    errors       = 0
    no_address   = 0
    suspicious   = 0
    saved_count  = 0

    pins_to_remove = set()

    for i, pin in enumerate(data):
        if i < args.start:
            continue

        pin_id = pin["id"]
        lat    = pin["lat"]
        lng    = pin["lng"]
        key    = f"{lat:.6f},{lng:.6f}"

        if i % 50 == 0:
            print(f"[{i}/{total}] processing {pin_id} ...", flush=True)

        # Fetch or use cache
        if key in cache:
            result = cache[key]
            cache_hits += 1
        else:
            if args.dry_run:
                print(f"  DRY-RUN: would fetch {key}")
                continue
            result = nominatim_reverse(lat, lng)
            cache[key] = result
            time.sleep(1)  # Nominatim rate limit

        if result is None:
            errors += 1
            continue

        addr = result.get("address", {})

        # Validate country
        if not is_italy(addr):
            country = addr.get("country", "?")
            print(f"  REMOVE {pin_id}: country={country} (not Italy)", flush=True)
            pins_to_remove.add(pin_id)
            removed.append({"id": pin_id, "name": pin.get("name"), "country": country})
            continue

        # Extract fields
        city          = extract_city(addr)
        province_code = extract_province_code(addr)
        region        = extract_region(addr)
        country       = "Italia"

        display_name = result.get("display_name", "")
        osm_type     = result.get("osm_type", "")
        osm_id       = result.get("osm_id")
        place_id     = result.get("place_id")

        # Build address string from Nominatim components
        road      = addr.get("road", addr.get("pedestrian", addr.get("path", "")))
        house_num = addr.get("house_number", "")
        postcode  = addr.get("postcode", "")
        # Use Nominatim province code if available, fall back to existing
        prov_code = province_code or pin.get("province", "")

        if road and city:
            if house_num:
                new_address = f"{road} {house_num}, {postcode} {city} {prov_code}, Italia".strip(", ")
            else:
                new_address = f"{road}, {postcode} {city} {prov_code}, Italia".strip(", ")
        elif city:
            new_address = f"{postcode} {city} {prov_code}, Italia".strip()
        else:
            new_address = display_name
            no_address += 1

        # Suspicious check: no coastal/road reference
        coastal_keywords = (
            "lungomare", "spiaggia", "mare", "lido", "riviera", "costa",
            "viale", "via", "strada", "corso"
        )
        addr_lower = new_address.lower()
        if not any(kw in addr_lower for kw in coastal_keywords):
            suspicious += 1
            pin["geocodeMeta"]["suspicious"] = True

        # Update pin fields
        pin["address"]     = new_address
        pin["city"]        = city or pin.get("city", "")
        pin["province"]    = prov_code or pin.get("province", "")
        pin["rawRegion"]   = region
        pin["country"]     = country

        # Update geocodeMeta
        pin["geocodeMeta"]["nominatim_place_id"] = place_id
        pin["geocodeMeta"]["nominatim_osm_id"]   = osm_id
        pin["geocodeMeta"]["nominatim_display"]  = display_name
        pin["geocodeMeta"]["nominatim_status"]   = "ok"

        enriched += 1

        # Flush cache + dataset every SAVE_EVERY pins
        if (i + 1) % SAVE_EVERY == 0:
            save_cache(cache)
            # Filter removed so far
            data_to_save = [p for p in data if p["id"] not in pins_to_remove]
            if not args.dry_run:
                save_dataset(data_to_save)
            saved_count += 1
            print(f"  Checkpoint at pin {i+1}: enriched={enriched}, removed={len(removed)}, errors={errors}", flush=True)

    # Final save
    save_cache(cache)
    data_final = [p for p in data if p["id"] not in pins_to_remove]
    if not args.dry_run:
        save_dataset(data_final)

    # Report
    print()
    print("=" * 60)
    print("ENRICHMENT REPORT")
    print("=" * 60)
    print(f"Total pins processed : {total}")
    print(f"Enriched             : {enriched}")
    print(f"Cache hits           : {cache_hits}")
    print(f"Errors (fetch fail)  : {errors}")
    print(f"Removed (non-Italy)  : {len(removed)}")
    print(f"No address found     : {no_address}")
    print(f"Suspicious flags     : {suspicious}")
    print(f"Final dataset size   : {len(data_final)}")
    if removed:
        print()
        print("Removed pins:")
        for r in removed:
            print(f"  - {r['id']} ({r['name']}) → country={r['country']}")

if __name__ == "__main__":
    main()
