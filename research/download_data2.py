import os, urllib.parse, urllib.request, hashlib, json, datetime

BASE = "https://psi.nasa.gov/geode-py/ws"
HDRS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
    "Accept": "*/*",
    "Referer": "https://psi.nasa.gov/physci/repo/",
}
ROOT = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.join(ROOT, "raw")
os.makedirs(OUTDIR, exist_ok=True)

files = [
    ("PSI-25", "PSI-25_Experimental table_BASS-II.csv", 1, "PSI-25_experimental.csv"),
    ("PSI-25", "PSI-25_Science Documents_BASS-II_ReadMe.docx", 2, "PSI-25_ReadMe.docx"),
    ("PSI-25", "PSI-25_Science Documents_BASS-II_Test.Matrices.xlsx", 2, "PSI-25_Test_Matrices.xlsx"),
    ("PSI-25", "PSI-25_Reference Data_Fan calibration data.xlsx", 2, "PSI-25_Fan_Calibration.xlsx"),
    ("PSI-98", "PSI-98_Experimental table_SAFFIRE-1.csv", 1, "PSI-98_experimental.csv"),
    ("PSI-98", "PSI-98_Science Documents_SAFFIRE-I and SAFFIRE-III Readme.docx", 1, "PSI-98_ReadMe.docx"),
]

def fetch(url):
    req = urllib.request.Request(url, headers=HDRS)
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.status, r.headers.get("Content-Type"), r.read()

manifest_path = os.path.join(OUTDIR, "download_manifest.json")
manifest = json.load(open(manifest_path, encoding="utf-8")) if os.path.exists(manifest_path) else []

for sid, name, version, out in files:
    q = urllib.parse.urlencode({"file": name, "version": version, "redirect": "false"})
    api = f"{BASE}/studies/{sid}/download?{q}"
    status, ctype, data = fetch(api)
    # PSI returns a signed S3 URL as body text; follow it.
    probe = data[:400].decode("utf-8", "ignore").strip()
    followed = None
    if probe.startswith("http"):
        followed = probe
        status, ctype, data = fetch(probe)
    path = os.path.join(OUTDIR, out)
    with open(path, "wb") as f:
        f.write(data)
    sha = hashlib.sha256(data).hexdigest()
    entry = {
        "investigation": sid, "file": name, "out": out, "version": version,
        "source_page": f"https://psi.nasa.gov/physci/repo/data/investigations/{sid}",
        "api_url": api, "resolved_url": followed, "content_type": ctype,
        "bytes": len(data), "sha256": sha, "http_status": status,
        "downloaded_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    manifest = [m for m in manifest if m.get("out") != out] + [entry]
    print(f"OK {status} {len(data):>9} {out} type={ctype} sha={sha[:16]}")
    if out.endswith(".csv"):
        print(data[:300].decode("utf-8", "ignore"))

with open(manifest_path, "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2)
