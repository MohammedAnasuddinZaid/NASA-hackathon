import json

for sid in ["PSI-25", "PSI-98"]:
    with open(f"research/raw/{sid}_metadata.json", encoding="utf-8") as f:
        m = json.load(f)
    print("=" * 80)
    print(sid, "top keys:", sorted(m.keys()))
    for k, v in m.items():
        if isinstance(v, list):
            print(f"  {k}: list len {len(v)}")
            if v and isinstance(v[0], dict):
                print("    sample keys:", sorted(v[0].keys()))
        elif isinstance(v, dict):
            print(f"  {k}: dict keys {sorted(v.keys())[:20]}")
        else:
            s = str(v)
            print(f"  {k}: {type(v).__name__} {s[:120]}")
    print("-- added files --")
    for a in m.get("added", []):
        print(f"  v{a.get('version')} | {a.get('file_size')} | {a.get('file_name')} | {a.get('subcategory','')}")
