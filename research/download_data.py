import os, urllib.parse, urllib.request, hashlib, json, datetime

BASE = "https://psi.nasa.gov/geode-py/ws"
HDRS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://psi.nasa.gov/physci/repo/",
}
os.makedirs("research/raw", exist_ok=True)

files = [
    ("PSI-25", "PSI-25_Experimental table_BASS-II.csv", 1, "PSI-25_experimental.csv"),
    ("PSI-25", "PSI-25_Science Documents_BASS-II_ReadMe.docx", 2, "PSI-25_ReadMe.docx"),
    ("PSI-25", "PSI-25_Science Documents_BASS-II_Test.Matrices.xlsx", 2, "PSI-25_Test_Matrices.xlsx"),
    ("PSI-25", "PSI-25_Reference Data_Fan calibration data.xlsx", 2, "PSI-25_Fan_Calibration.xlsx"),
    ("PSI-98", "PSI-98_Experimental table_SAFFIRE-1.csv", 1, "PSI-98_experimental.csv"),
    ("PSI-98", "PSI-98_Science Documents_SAFFIRE-I and SAFFIRE-III Readme.docx", 1, "PSI-98_ReadMe.docx"),
]

manifest = []
for sid, name, version, out in files:
    q = urllib.parse.urlencode({"file": name, "version": version, "redirect": "false"})
    url = f"{BASE}/studies/{sid}/download?{q}"
    req = urllib.request.Request(url, headers=HDRS)
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            data = r.read()
            status = r.status
        path = os.path.join("research/raw", out)
        with open(path, "wb") as f:
            f.write(data)
        sha = hashlib.sha256(data).hexdigest()
        manifest.append({
            "investigation": sid, "file": name, "out": out, "version": version,
            "url": url, "bytes": len(data), "sha256": sha, "status": status,
            "downloaded_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        })
        print(f"OK {status} {len(data):>9} {out} sha={sha[:16]}")
    except Exception as e:
        print("FAIL", sid, name, repr(e))

with open("research/raw/download_manifest.json", "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2)
