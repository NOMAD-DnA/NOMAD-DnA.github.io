from pathlib import Path
root = Path(__file__).resolve().parent
output = root.parent / 'index.html'
library_source = output if output.exists() else root.parent / 'with_obstacles.html'
current = library_source.read_text()
start = current.index('<script>') + len('<script>')
lib = current[start:current.index('</script>', start)]
assert 'THREE' in lib and len(lib) > 600000
page = (root / 'index.template.html').read_text()
for marker, name in [
    ('THREE_INLINE', None), ('SCENARIO_MODEL_INLINE', 'scenario-model.js'), ('SCENARIO_UI_INLINE', 'scenario-ui.js'), ('SLOPE_WORKER_INLINE', 'slope-worker.js'),
    ('SLOPE_UI_INLINE', 'slope-ui.js'), ('TERRAIN_MODEL_INLINE', 'terrain-model.js'),
    ('TERRAIN_SCENE_INLINE', 'terrain-scene.js'), ('SEMANTIC_MODEL_INLINE', 'semantic-model.js'),
    ('SEMANTIC_UI_INLINE', 'semantic-ui.js'), ('ROUTE_MODEL_INLINE', 'route-model.js'),
]:
    page = page.replace('/* ' + marker + ' */', lib if name is None else (root / name).read_text())
page = page.replace('<script>' + lib, '<!-- Included library: Three.js r160.1\n' + (root / 'THREE-LICENSE.txt').read_text() + '\n-->\n<script>' + lib, 1)
output.write_text(page)
print('Built', output, len(page.encode()), 'bytes')
