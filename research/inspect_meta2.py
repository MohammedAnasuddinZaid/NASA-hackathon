import json

for sid in ["PSI-25", "PSI-98"]:
    with open(f"research/raw/{sid}_metadata.json", encoding="utf-8") as f:
        m = json.load(f)
    print("=" * 90)
    print(sid, m.get("investigationAcronym"), "|", m.get("title"), "| version", m.get("version"))
    print("DOI", m.get("doi"), "| License", m.get("licenseName"), m.get("licenseIdentifier"))
    print("dates", m.get("investigationStartDate"), "->", m.get("investigationEndDate"))
    print("hardware", m.get("experimentHardware"))
    print("total files", len(m.get("added", [])), "size", m.get("totalFileSize"))
    print("\n-- experimentalTable --")
    for x in m.get("experimentalTable", []):
        print(json.dumps(x, indent=1)[:1200])
    print("\n-- images --")
    for x in m.get("images", []):
        print(x.get("file_name"), x.get("version"), x.get("file_size"))
    print("\n-- publications --")
    for p in m.get("publications", []):
        print("-", p.get("title"), "|", p.get("doi"), "|", p.get("status"))
    print("\n-- files matching readme/table/document --")
    for a in m.get("added", []):
        n = (a.get("file_name") or "").lower()
        if any(k in n for k in ["read me", "readme", "experimental table", "modeling table", "data dictionary"]) or n.endswith(".csv") or n.endswith(".xlsx"):
            print(f"  v{a.get('version')} | {a.get('file_size')} | {a.get('file_name')} | {a.get('subcategory','')}")
