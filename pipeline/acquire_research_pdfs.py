"""Reacquire the exact reviewed NASA PDFs into ignored tmp (no corpus mutation).

Uses only registered NASA URLs; fails on changed content, so a revised upstream PDF
requires a new review rather than silently updating scientific provenance.
"""
import hashlib
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

if __name__ == '__main__':
    data = json.loads((ROOT / 'data/research/curation.json').read_text(encoding='utf-8'))
    directory = ROOT / 'tmp'
    directory.mkdir(exist_ok=True)
    for source in data['sources']:
        if source['kind'] != 'research_report':
            continue
        path = directory / source['cache_filename']
        if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == source['sha256']:
            print(source['id'], 'existing original hash verified')
            continue
        url = source['download_url']
        if not url.startswith('https://ntrs.nasa.gov/api/citations/'):
            raise ValueError('Unregistered download host')
        with urllib.request.urlopen(url, timeout=180) as response:
            content = response.read()
        if not content.startswith(b'%PDF') or hashlib.sha256(content).hexdigest() != source['sha256']:
            raise ValueError(f"Changed upstream PDF for {source['id']}; review required. Nothing published.")
        path.write_bytes(content)
        print(source['id'], 'downloaded original hash verified', len(content))
