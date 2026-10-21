import json
import math
import re
import time
import urllib.error
import urllib.parse
import urllib.request

ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = "PinTheCity-import/1.0 (https://pinthecity.me; contact@pinthecity.me)"
BATCH = 1500
LABEL_BATCH = 300


def read_cities():
    cities = []
    with open("data/cities5000.txt", encoding="utf-8") as f:
        for line in f:
            columns = line.rstrip("\n").split("\t")
            if columns[7] != "PPLX":
                cities.append(
                    {
                        "id": columns[0],
                        "name": columns[1],
                        "ascii": columns[2],
                        "lat": float(columns[4]),
                        "lon": float(columns[5]),
                    }
                )
    return cities


def query(ids):
    values = " ".join(f'"{i}"' for i in ids)
    sparql = (
        "SELECT ?gn (MAX(?links) AS ?l) WHERE { "
        f"VALUES ?gn {{ {values} }} "
        "?item wdt:P1566 ?gn ; wikibase:sitelinks ?links . "
        "} GROUP BY ?gn"
    )
    return {r["gn"]["value"]: int(r["l"]["value"]) for r in run(sparql)}


def run(sparql):
    body = urllib.parse.urlencode({"query": sparql}).encode()
    request = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/sparql-results+json",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    for attempt in range(6):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.load(response)["results"]["bindings"]
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
            wait = 10 * (attempt + 1)
            print(f"  failed ({e}), retrying in {wait}s")
            time.sleep(wait)
    raise RuntimeError("wikidata query kept failing")


def distance_km(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 12742 * math.asin(math.sqrt(a))


def sparql_literal(text):
    return '"' + text.replace("\\", "\\\\").replace('"', '\\"') + '"'


def query_by_label(cities):
    labels = sorted({label for c in cities for label in (c["name"], c["ascii"])})
    values = " ".join(f"{sparql_literal(label)}@{lang}" for label in labels for lang in ("en", "mul"))
    sparql = (
        "SELECT ?label ?coord (MAX(?links) AS ?l) WHERE { "
        f"VALUES ?label {{ {values} }} "
        "?item rdfs:label ?label ; wdt:P625 ?coord ; wikibase:sitelinks ?links . "
        "} GROUP BY ?label ?coord"
    )
    rows = run(sparql)
    found = []
    for r in rows:
        point = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", r["coord"]["value"])
        if point:
            found.append((r["label"]["value"], float(point[2]), float(point[1]), int(r["l"]["value"])))
    result = {}
    for c in cities:
        best = 0
        for label, lat, lon, links in found:
            if label in (c["name"], c["ascii"]) and distance_km(c["lat"], c["lon"], lat, lon) <= 30:
                best = max(best, links)
        if best:
            result[c["id"]] = best
    return result


def main():
    cities = read_cities()
    ids = [c["id"] for c in cities]
    print(f"cities: {len(ids)}")
    links = {}
    for start in range(0, len(ids), BATCH):
        chunk = ids[start : start + BATCH]
        links.update(query(chunk))
        print(f"{start + len(chunk)}/{len(ids)}: {len(links)} with wikidata")
        time.sleep(1)

    missing = [c for c in cities if c["id"] not in links]
    print(f"looking up {len(missing)} unmatched cities by name")
    for start in range(0, len(missing), LABEL_BATCH):
        chunk = missing[start : start + LABEL_BATCH]
        links.update(query_by_label(chunk))
        print(f"{start + len(chunk)}/{len(missing)}: {len(links)} with wikidata")
        time.sleep(1)

    with open("data/sitelinks.tsv", "w", encoding="utf-8") as f:
        for geoname_id in ids:
            f.write(f"{geoname_id}\t{links.get(geoname_id, 0)}\n")
    print("wrote data/sitelinks.tsv")


if __name__ == "__main__":
    main()
