#!/usr/bin/env python3
"""Check every page's shared script and retain original map provenance."""
from pathlib import Path
import re
import json
import hashlib
root=Path(__file__).resolve().parents[1]
pages=[p for p in root.rglob('*.html') if not p.name.startswith('.')]
for page in pages:
    matches=re.findall(r'<script\b[^>]*src=["\']([^"\']*assets/meeting-ping\.js)["\']',page.read_text())
    assert len(matches)==1,(page,'expected one shared pointer script')
    assert (page.parent/matches[0]).resolve()==root/'assets/meeting-ping.js',page
manifest=root/'experiments/20261026_saved_library/manifest.json'
for entry in json.loads(manifest.read_text())['files']:
    contents=(manifest.parent/entry['path']).read_bytes()
    assert entry['published_bytes']==len(contents),entry['path']
    assert entry['published_sha256']==hashlib.sha256(contents).hexdigest(),entry['path']
print(f'{len(pages)} HTML pages: shared script exists; saved-map manifest matches')
