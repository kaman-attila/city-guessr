import time

from fetch_fame import read_cities, run

BATCH = 400


def query(ids):
    values = " ".join(f'"{i}"' for i in ids)
    sparql = (
        "SELECT ?gn ?label WHERE { "
        f"VALUES ?gn {{ {values} }} "
        "?item wdt:P1566 ?gn ; wdt:P31 ?class . "
        '?class rdfs:label ?label . FILTER(LANG(?label) = "en") '
        "}"
    )
    types = {}
    for r in run(sparql):
        types.setdefault(r["gn"]["value"], set()).add(r["label"]["value"])
    return types


def main():
    ids = [c["id"] for c in read_cities()]
    types = {}
    for start in range(0, len(ids), BATCH):
        types.update(query(ids[start : start + BATCH]))
        print(f"{min(start + BATCH, len(ids))}/{len(ids)}: {len(types)} with a type")
        time.sleep(1)
    with open("data/types.tsv", "w", encoding="utf-8") as f:
        for geoname_id in ids:
            if geoname_id in types:
                f.write(f"{geoname_id}\t{'|'.join(sorted(types[geoname_id]))}\n")
    print("wrote data/types.tsv")


if __name__ == "__main__":
    main()
