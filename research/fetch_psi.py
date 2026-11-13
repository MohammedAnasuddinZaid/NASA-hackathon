import json, urllib.parse, urllib.request, hashlib, os, datetime, ssl

BASE = "https://psi.nasa.gov/geode-py/ws"
HDRS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://psi.nasa.gov/physci/repo/",
}
os.makedirs("research/raw", exist_ok=True)

def get(url, out=None):
    req = urllib.request.Request(url, headers=HDRS)
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
        status = r.status
        ctype = r.headers.get("Content-Type")
    if out:
        with open(out, "wb") as f:
            f.write(data)
    return status, ctype, data

for sid in ["PSI-25", "PSI-98"]:
    status, ctype, data = get(f"{BASE}/repo/investigations/{sid}")
    print(sid, "metadata", status, ctype, len(data))
    with open(f"research/raw/{sid}_metadata.json", "wb") as f:
        f.write(data)
    try:
        meta = json.loads(data)
        print(json.dumps(meta, indent=1)[:3000])
    except Exception as e:
        print("parse err", e, data[:300])
