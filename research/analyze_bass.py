import csv, re, collections

raw = open("raw/PSI-25_experimental.csv", "rb").read().decode("utf-8-sig")
rows = list(csv.DictReader(raw.splitlines()))
print("rows:", len(rows))
print("PIs:", collections.Counter(r["PI"] for r in rows))
print("blank rows:", sum(1 for r in rows if not r["Test #"].strip()))
# columns
for k in rows[0].keys():
    vals = [r[k].strip() for r in rows]
    nonblank = [v for v in vals if v not in ("", "none", "None")]
    print(f"{k!r}: nonblank {len(nonblank)}/{len(vals)}; distinct {len(set(nonblank))}")

print("\n-- sample numbers duplicated --")
c = collections.Counter(r["Sample #"].strip() for r in rows)
print([x for x in c.items() if x[1] > 1])

print("\n-- O2 anomalies --")
for i, r in enumerate(rows):
    try:
        oi = float(r["Calibrated  initial O2 % by vol "])
    except: 
        oi = None
    try:
        of = float(r["Calibrated final O2 % by vol"])
    except:
        of = None
    if oi is not None and of is not None and (of > oi + 2 or of < 0 or oi < 10 or oi > 25):
        print(i+2, r["Test #"], oi, of, r["Fuel Sample Material"])
print("\n-- odd values --")
for i, r in enumerate(rows):
    for k, v in r.items():
        if v.strip().lower() in ("none", "or", "over", "video", ">500", "300+   +102"):
            print(i+2, r["Test #"], k, repr(v))
