import zipfile
from xml.sax.saxutils import escape

OUT = "presentation/pitch_deck.pptx"

SLIDES = [
    ("FIRETRACE", [
        "Flame in Freefall evidence intelligence",
        "NASA Space Apps 2026",
        "Know what the evidence says. See what it doesn't.",
    ]),
    ("The problem", [
        "Spacecraft fire safety depends on atmosphere and gravity.",
        "Public microgravity combustion tables do not report total pressure or per-test gravity.",
        "A plausible answer can still be unsupported.",
    ]),
    ("The evidence", [
        "BASS-II: 129 records (PSI-25)",
        "Saffire-I: 2 records (PSI-98)",
        "LUCI: context only (NTRS 20250010653)",
        "Challenge page: context only",
    ]),
    ("Central finding", [
        "Initial O2 reported: 131 / 131",
        "Total pressure reported: 0 / 131",
        "Measured per-test gravity: 0 / 131",
        "Standardized outcome: 0 / 131",
        "Missing means unknown, not zero.",
    ]),
    ("What FIRETRACE does", [
        "Overview: corpus ledger and evidence gap",
        "Atmosphere Explorer: Dalton law and reference atmospheres",
        "Evidence Atlas: 131 records with provenance drawer",
        "Compare: comparability audit with blockers",
        "Gap Planner: target audit and Markdown plan",
        "Evidence Assistant: deterministic retrieval with abstention",
        "Methodology & Sources: rules, validation, licenses",
        "Exports: CSV and JSON with raw locators",
    ]),
    ("Atmosphere Explorer", [
        "ppO2 = total pressure x oxygen fraction",
        "Lunar cabin planning point: 10.2 psi x 30% = 3.06 psi",
        "Spacesuit: 4.3 psi x 100% = 4.3 psi",
        "Every corpus record sits on the unknown-pressure axis",
        "Oxygen fraction alone is not an atmosphere",
    ]),
    ("Evidence Atlas", [
        "Search and filter 131 records",
        "Quality: 71 validated, 56 partial, 4 suspect",
        "Suspect flags retained, not corrected",
        "Drawer shows measurements, raw fields, provenance and citations",
        "Export filtered CSV",
    ]),
    ("Compare", [
        "Side-by-side values with measurement basis",
        "Comparability audit reports blockers",
        "Mixed investigations and hardware",
        "Pressure and per-test gravity unknown",
        "Different flow measurement bases",
        "No similarity score is computed",
    ]),
    ("Gap Planner", [
        "Set a target atmosphere and gravity regime",
        "See which dimensions are evidenced",
        "Required measurements for a comparable test",
        "Comparability controls",
        "Downloadable Markdown plan",
        "Planning aid only: no prediction or certification",
    ]),
    ("Evidence Assistant", [
        "Deterministic retrieval, no external model",
        "Every answer cites source locators",
        "Abstains when the corpus cannot support an answer",
        "30 / 30 benchmark questions passed",
        "Safety and certification questions are refused",
    ]),
    ("Why this matters", [
        "No fabricated measurements or citations",
        "No zero-filling or imputation",
        "No arbitrary risk or relevance score",
        "BASS-II, Saffire-I, LUCI and the challenge stay distinct",
        "Missing data is shown as unknown",
    ]),
    ("Demo path", [
        "0:00 Overview",
        "0:25 Atmosphere Explorer",
        "0:55 Evidence Atlas",
        "1:25 Compare",
        "1:55 Gap Planner",
        "2:25 Evidence Assistant",
        "2:50 Exports and close",
        "Backup questions available in docs/judge_qa.md",
    ]),
]

CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
""" + "".join(
    f'  <Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>\n'
    for i in range(1, len(SLIDES) + 1)
) + "</Types>"

RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>"""

PRES_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
""" + "".join(
    f'  <Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{i}.xml"/>\n'
    for i in range(1, len(SLIDES) + 1)
) + "</Relationships>"

PRES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>
""" + "".join(
    f'    <p:sldId id="{255 + i}" r:id="rId{i}"/>\n'
    for i in range(1, len(SLIDES) + 1)
) + """  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>"""


def slide_xml(title, bullets):
    bullet_xml = ""
    for bullet in bullets:
        bullet_xml += (
            '<a:p><a:pPr lvl="0" marL="457200" indent="-228600"><a:buChar char="•"/></a:pPr>'
            f'<a:r><a:rPr sz="2200"/><a:t>{escape(bullet)}</a:t></a:r></a:p>'
        )
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="457200" y="274320"/><a:ext cx="8229600" cy="1143000"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="4000" b="1"/><a:t>{escape(title)}</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="457200" y="1600200"/><a:ext cx="8229600" cy="4800000"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/>{bullet_xml}</p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>"""


with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as archive:
    archive.writestr("[Content_Types].xml", CONTENT_TYPES)
    archive.writestr("_rels/.rels", RELS)
    archive.writestr("ppt/presentation.xml", PRES)
    archive.writestr("ppt/_rels/presentation.xml.rels", PRES_RELS)
    for index, (title, bullets) in enumerate(SLIDES, start=1):
        archive.writestr(f"ppt/slides/slide{index}.xml", slide_xml(title, bullets))

print(f"Wrote {OUT} with {len(SLIDES)} slides")
