import csv, os, json

for f in ["PSI-25_experimental.csv", "PSI-98_experimental.csv"]:
    p = os.path.join("raw", f)
    print("=" * 100)
    print(f)
    raw = open(p, "rb").read()
    text = raw.decode("utf-8-sig")
    rows = list(csv.reader(text.splitlines()))
    print("rows:", len(rows), "cols:", max(len(r) for r in rows))
    for i, r in enumerate(rows[:6]):
        print(i, r)
    print("... last row:", rows[-1])
    print("header:", rows[0])
