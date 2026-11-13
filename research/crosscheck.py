import csv, openpyxl, collections

csv_rows = list(csv.DictReader(open("raw/PSI-25_experimental.csv", encoding="utf-8-sig").read().splitlines()))
by_test = {r["Test #"].strip(): r for r in csv_rows}

wb = openpyxl.load_workbook("raw/PSI-25_Test_Matrices.xlsx", data_only=True)
matrix = {}
for ws in wb.worksheets:
    rows = list(ws.iter_rows(values_only=True))
    header = rows[0]
    for row in rows[1:]:
        if not row or row[2] is None:
            continue
        d = dict(zip(header, row))
        t = str(d.get("Test no.")).strip()
        matrix[t] = d

print("matrix tests", len(matrix), "csv tests", len(csv_rows))
print("only in matrix", sorted(set(matrix) - set(by_test))[:20])
print("only in csv", sorted(set(by_test) - set(matrix))[:20])

diffs = collections.Counter()
examples = []
for t in sorted(set(matrix) & set(by_test)):
    m, c = matrix[t], by_test[t]
    pairs = [
        ("material", str(m.get("Material") or "").strip(), c["Fuel Sample Material"].strip()),
        ("o2i", str(m.get("calibrated  initial O2 % by vol ") or "").strip(), c["Calibrated  initial O2 % by vol "].strip()),
        ("o2f", str(m.get("calibrated final O2 % by vol") or "").strip(), c["Calibrated final O2 % by vol"].strip()),
        ("air", str(m.get("Air display") or "").strip(), c["Air display"].strip()),
    ]
    for k, a, b in pairs:
        if a.lower() != b.lower():
            diffs[k] += 1
            if len(examples) < 25:
                examples.append((t, k, a, b))
print("diffs", diffs)
for e in examples:
    print(e)
