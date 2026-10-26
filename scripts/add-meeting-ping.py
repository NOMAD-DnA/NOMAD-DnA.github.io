#!/usr/bin/env python3
"""Attach the shared meeting pointer to every HTML page; safe to run again."""
from pathlib import Path
import os
import re

root = Path(__file__).resolve().parents[1]
count = 0
for page in sorted(root.rglob('*.html')):
    if page.name.startswith('.'):
        continue
    text = page.read_text()
    if re.search(r'<script\b[^>]*src=["\'][^"\']*assets/meeting-ping\.js', text):
        continue
    src = os.path.relpath(root / 'assets/meeting-ping.js', page.parent).replace(os.sep, '/')
    script = f'\n<script type="module" src="{src}"></script>\n'
    match = list(re.finditer(r'</body\s*>', text, re.I)) or list(re.finditer(r'</html\s*>', text, re.I))
    offset = match[-1].start() if match else len(text)
    page.write_text(text[:offset] + script + text[offset:])
    count += 1
print(f'{count} HTML pages updated')
