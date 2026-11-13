import openpyxl
wb = openpyxl.load_workbook("raw/PSI-25_Fan_Calibration.xlsx", data_only=True)
for ws in wb.worksheets:
    print("SHEET", ws.title, ws.dimensions)
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if any(v is not None for v in row):
            print(i, [v for v in row if v is not None][:18])
        if i > 40:
            break
