import json
import math
import time
import urllib.error
import urllib.parse
import urllib.request

ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = "PinTheCity-import/1.0 (https://pinthecity.me; contact@pinthecity.me)"
BATCH = 500
LABEL_BATCH = 500
CHECK_POPULATION = 100_000
CHECK_CODES = ("PPLC", "PPLA", "PPLG")
CHECK_BELOW = 60


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
                        "code": columns[7],
                        "population": int(columns[14]),
                    }
                )
    return cities


def query(ids):
    values = " ".join(f'"{i}"' for i in ids)
    sparql = (
        "SELECT ?gn (MAX(?n) AS ?l) WHERE { "
        "{ SELECT ?gn ?item (COUNT(?article) AS ?n) WHERE { "
        f"VALUES ?gn {{ {values} }} "
        "?item wdt:P1566 ?gn . "
        "OPTIONAL { ?article schema:about ?item ; schema:isPartOf ?site . "
        '?site wikibase:wikiGroup "wikipedia" . } '
        "} GROUP BY ?gn ?item } "
        "} GROUP BY ?gn"
    )
    return {r["gn"]["value"]: int(r["l"]["value"]) for r in run(sparql)}


def needs_label_check(city, links):
    if city["id"] not in links:
        return True
    big = city["population"] >= CHECK_POPULATION or city["code"] in CHECK_CODES
    return big and links[city["id"]] < CHECK_BELOW


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


WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
API_BATCH = 50
NOT_WIKIPEDIAS = {
    "commonswiki", "specieswiki", "metawiki", "wikidatawiki", "mediawikiwiki",
    "sourceswiki", "outreachwiki", "foundationwiki", "wikimaniawiki", "wikifunctionswiki",
}


def api_get(url, params):
    request = urllib.request.Request(
        url + "?" + urllib.parse.urlencode({**params, "format": "json", "maxlag": "5"}),
        headers={"User-Agent": USER_AGENT},
    )
    for attempt in range(6):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                data = json.load(response)
            if "error" not in data:
                return data
            print(f"  api error {data['error'].get('code')}, retrying")
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
            print(f"  failed ({e}), retrying")
        time.sleep(5 * (attempt + 1))
    raise RuntimeError("wikipedia api kept failing")


def lookup_titles(titles):
    data = api_get(WIKIPEDIA_API, {
        "action": "query", "redirects": "1", "prop": "pageprops|coordinates",
        "ppprop": "wikibase_item", "colimit": "max", "titles": "|".join(titles),
    })["query"]
    target = {t: t for t in titles}
    for step in ("normalized", "redirects"):
        moves = {m["from"]: m["to"] for m in data.get(step, [])}
        target = {t: moves.get(to, to) for t, to in target.items()}
    pages = {}
    for page in data.get("pages", {}).values():
        item = page.get("pageprops", {}).get("wikibase_item")
        coords = page.get("coordinates")
        if item and coords:
            pages[page["title"]] = (item, coords[0]["lat"], coords[0]["lon"])
    return {t: pages[to] for t, to in target.items() if to in pages}


def wikipedia_counts(items):
    data = api_get(WIKIDATA_API, {"action": "wbgetentities", "ids": "|".join(items), "props": "sitelinks"})
    return {
        item: sum(1 for site in entity.get("sitelinks", {}) if site.endswith("wiki") and site not in NOT_WIKIPEDIAS)
        for item, entity in data.get("entities", {}).items()
    }


def query_by_title(cities):
    titles = sorted({t for c in cities for t in (c["name"], c["ascii"]) if t and "|" not in t})
    found = {}
    for start in range(0, len(titles), API_BATCH):
        found.update(lookup_titles(titles[start : start + API_BATCH]))
    near = {}
    for c in cities:
        for title in (c["name"], c["ascii"]):
            if title in found:
                item, lat, lon = found[title]
                if distance_km(c["lat"], c["lon"], lat, lon) <= 30:
                    near.setdefault(c["id"], set()).add(item)
    items = sorted({i for s in near.values() for i in s})
    counts = {}
    for start in range(0, len(items), API_BATCH):
        counts.update(wikipedia_counts(items[start : start + API_BATCH]))
    result = {}
    for city_id, its in near.items():
        best = max(counts.get(i, 0) for i in its)
        if best:
            result[city_id] = best
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

    missing = [c for c in cities if needs_label_check(c, links)]
    print(f"looking up {len(missing)} unmatched or doubtful cities by name")
    for start in range(0, len(missing), LABEL_BATCH):
        chunk = missing[start : start + LABEL_BATCH]
        for geoname_id, found in query_by_title(chunk).items():
            links[geoname_id] = max(links.get(geoname_id, 0), found)
        print(f"{start + len(chunk)}/{len(missing)}: {len(links)} with wikidata")
        time.sleep(1)

    with open("data/sitelinks.tsv", "w", encoding="utf-8") as f:
        for geoname_id in ids:
            f.write(f"{geoname_id}\t{links.get(geoname_id, 0)}\n")
    print("wrote data/sitelinks.tsv")


if __name__ == "__main__":
    main()
