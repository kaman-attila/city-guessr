import collections
import json
import struct

SOURCE = "data/borders/ne_50m_admin_0_countries.geojson"
TARGET = "../api/data/borders.bin"
SCALE = 10_000
FALLBACK_CODES = {"Somaliland": "SO", "N. Cyprus": "CY", "Siachen Glacier": "IN"}


def inside_ring(lon, lat, ring):
    hit = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            hit = not hit
        j = i
    return hit


def inside_polygon(lon, lat, rings):
    return sum(inside_ring(lon, lat, ring) for ring in rings) % 2 == 1


def varint(value):
    out = bytearray()
    while value >= 0x80:
        out.append((value & 0x7F) | 0x80)
        value >>= 7
    out.append(value)
    return out


def signed(value):
    return varint((value << 1) ^ (value >> 63))


def read_cities():
    cities = []
    with open("data/cities5000.txt", encoding="utf-8") as f:
        for line in f:
            c = line.rstrip("\n").split("\t")
            if c[7] != "PPLX":
                cities.append((float(c[5]), float(c[4]), c[8]))
    return cities


def main():
    features = json.load(open(SOURCE, encoding="utf-8"))["features"]
    cities = read_cities()

    polygons = []
    for feature in features:
        props = feature["properties"]
        code = FALLBACK_CODES.get(props["NAME"], props["ISO_A2_EH"])
        geometry = feature["geometry"]
        parts = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
        for rings in parts:
            lons = [p[0] for p in rings[0]]
            lats = [p[1] for p in rings[0]]
            polygons.append(
                {"name": props["NAME"], "code": code, "rings": rings, "bbox": (min(lons), min(lats), max(lons), max(lats))}
            )

    votes = [collections.Counter() for _ in polygons]
    matched = located = 0
    for lon, lat, country in cities:
        for i, p in enumerate(polygons):
            x0, y0, x1, y1 = p["bbox"]
            if x0 <= lon <= x1 and y0 <= lat <= y1 and inside_polygon(lon, lat, p["rings"]):
                votes[i][country] += 1
                located += 1
                break

    relabelled = []
    for p, vote in zip(polygons, votes):
        if vote:
            winner = vote.most_common(1)[0][0]
            if winner != p["code"]:
                relabelled.append(f"{p['name']} {p['code']}->{winner} ({sum(vote.values())} cities)")
            p["code"] = winner
        matched += vote[p["code"]]

    polygons = [p for p in polygons if len(p["code"]) == 2 and p["code"].isalpha()]
    out = bytearray(b"BRD2")
    out += struct.pack("<H", len(polygons))
    for p in polygons:
        out += p["code"].encode("ascii")
        out += varint(len(p["rings"]))
        for ring in p["rings"]:
            out += varint(len(ring))
            x = y = 0
            for lon, lat in ring:
                nx, ny = round(lon * SCALE), round(lat * SCALE)
                out += signed(nx - x) + signed(ny - y)
                x, y = nx, ny
    with open(TARGET, "wb") as f:
        f.write(out)

    print(f"{len(polygons)} polygons, {len(out) // 1024} KB written to {TARGET}")
    print(f"cities inside a border: {located}/{len(cities)}, inside their own country: {matched}")
    print("relabelled by city vote:", "; ".join(relabelled) or "none")


if __name__ == "__main__":
    main()
