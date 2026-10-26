from pathlib import Path
import hashlib
import re
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
    ('SEMANTIC_UI_INLINE', 'semantic-ui.js'), ('ROUTE_MODEL_INLINE', 'route-model.js'), ('GRADE_STOP_INLINE', 'grade-stop.js'),
]:
    page = page.replace('/* ' + marker + ' */', lib if name is None else (root / name).read_text())
worker = (root / 'slope-worker.js').read_text()
eigen = worker[worker.index('function smallestEigen'):worker.index('self.onmessage=')]
page = page.replace('/* SLOPE_EIGEN_INLINE */', eigen)
page = page.replace('<script>' + lib, '<!-- Included library: Three.js r160.1\n' + (root / 'THREE-LICENSE.txt').read_text() + '\n-->\n<script>' + lib, 1)
output.write_text(page)
print('Built', output, len(page.encode()), 'bytes')

# A new content URL prevents the library from reopening an older cached HTML.
catalogue = root.parents[2] / 'scenarios' / 'index.html'
if catalogue.exists():
    version = hashlib.sha256(output.read_bytes()).hexdigest()[:12]
    target = '../experiments/20261026_offroad_drive/'
    pattern = r'href="' + re.escape(target) + r'(?:\?[^\"]*)?"'
    updated, count = re.subn(pattern, 'href="' + target + '?v=' + version + '"', catalogue.read_text())
    if count:
        catalogue.write_text(updated)
        print('Updated scenario library link to version', version)
