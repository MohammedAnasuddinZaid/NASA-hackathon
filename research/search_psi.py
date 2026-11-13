import json, urllib.request

HDRS = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
for q in ["FLEX", "ACME", "BASS", "Saffire", "SPICE", "SLICE"]:
    url = f"https://psi.nasa.gov/geode-py/ws/repo/search?q={q}"
    req = urllib.request.Request(url, headers=HDRS)
    data = json.loads(urllib.request.urlopen(req, timeout=60).read())
    hits = data["hits"]["hits"]
    print("=" * 70)
    print(q, "total", data["hits"]["total"], "returned", len(hits))
    for h in hits[:20]:
        s = h["_source"]
        print(" ", s.get("Accession"), "|", str(s.get("Title"))[:110], "|", s.get("Investigation Acronym") or s.get("Acronym"))
