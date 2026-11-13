import docx
import openpyxl

for f in ["PSI-25_ReadMe.docx", "PSI-98_ReadMe.docx"]:
    print("=" * 100)
    print(f)
    d = docx.Document(f"raw/{f}")
    for p in d.paragraphs:
        t = p.text.strip()
        if t:
            print(t)
    for ti, table in enumerate(d.tables):
        print(f"-- table {ti} --")
        for row in table.rows:
            print(" | ".join(c.text.strip() for c in row.cells))

for f in ["PSI-25_Test_Matrices.xlsx", "PSI-25_Fan_Calibration.xlsx"]:
    print("=" * 100)
    print(f)
    wb = openpyxl.load_workbook(f"raw/{f}", data_only=True)
    for ws in wb.worksheets:
        print(f"-- sheet: {ws.title} dims={ws.dimensions} --")
        for row in ws.iter_rows(values_only=True):
            if any(v is not None for v in row):
                print(row)
