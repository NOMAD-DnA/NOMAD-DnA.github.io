#!/usr/bin/env python3
"""Export one day's saved records directly from the local experiment library."""
import argparse
from datetime import datetime
import hashlib
import html
import io
import json
from pathlib import Path
import re
from zoneinfo import ZoneInfo

import numpy as np
import requests

parser=argparse.ArgumentParser()
parser.add_argument('--source',default='http://127.0.0.1:8892')
parser.add_argument('--date',default='20261028')
args=parser.parse_args()
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'experiments/slope/20261028-umyeonsa-daeseongsa'
DEST.mkdir(parents=True,exist_ok=True)
http=requests.Session()

def get(path):
    r=http.get(args.source+path,timeout=60)
    r.raise_for_status()
    return r

def write_changed(path,text):
    if not path.exists() or path.read_text()!=text:path.write_text(text)

source=get('/api/records').json()
# Explicit allowlist excludes management tokens, deleted records and local paths.
fields=['id','title','memo','date','time','phase','state_label','has_data','points','scans','depth_frames','error','synthetic']
records=[];manifest=[]
plotly_sha=None
for row in sorted(source['records'],key=lambda r:r['id']):
    if not row['id'].startswith(args.date) or row.get('synthetic'):continue
    item={k:row.get(k) for k in fields}
    item['viewers']={'cloud':None,'terrain':None}
    if row['has_data']:
        sid=row['id'];target=DEST/'records'/sid;target.mkdir(parents=True,exist_ok=True)
        prefix='/records/'+sid+'/'
        metadata=get(prefix+'terrain/fused/metadata.json').json()
        status=get(prefix+'terrain/status.json').json()
        raw_grid=get(prefix+'terrain/fused/map.npz').content
        with np.load(io.BytesIO(raw_grid),allow_pickle=False) as grid:
            item['valid_cells']=int(grid['slope_valid'].sum())
            item['observed_cells']=int(grid['observed'].sum())
        item['valid_pct']=100*item['valid_cells']/item['observed_cells'] if item['observed_cells'] else 0
        item['mean_ms']=metadata['timing']['mean_ms']
        item['timing_samples']=metadata['timing']['samples']
        item['last_queue_wait_s']=status['timing']['queue_wait_ms']/1000
        for kind in ['cloud','terrain']:
            filename=row['viewers'][kind]
            if not filename:continue
            original=get(prefix+filename).content.decode('utf-8')
            digest=hashlib.sha256(original.encode()).hexdigest()
            published=original
            if kind=='cloud':
                blocks=re.finditer(r'<script\b[^>]*>(.*?)</script>',original,re.S)
                library=next(b for b in blocks if len(b.group(1))>1_000_000 and 'plotly.js' in b.group(1)[:500])
                current_sha=hashlib.sha256(library.group(1).encode()).hexdigest()
                if plotly_sha is None:
                    plotly_sha=current_sha
                    write_changed(ROOT/'assets/vendor/plotly-field.min.js',library.group(1))
                assert current_sha==plotly_sha
                published=original[:library.start()]+'<script src="../../../../../assets/vendor/plotly-field.min.js"></script>'+original[library.end():]
                published=published.replace('경사각과 비용 6개 지도 열기','경사 지도 열기')
                published=published.replace('<h1>라이다 + OAK 깊이 저장 지도</h1>',f'<h1>{html.escape(row["title"])} | {row["time"]} | 점군 지도</h1>')
                published=published.replace('<header>','<header><p><a style="color:#83ded3" href="../../#run-'+sid+'">← 오늘 주행 목록</a></p>',1)
                output='map_viewer.html'
            else:
                published=published.replace('<title>7cm 경사각 + VIO 실시간</title>','<title>저장 경사 지도 | '+html.escape(row['title'])+'</title>')
                published=published.replace('7cm 융합 경사각 지도 + VIO 실시간 | 시작 Z 제한 없음',html.escape(row['title'])+' | '+row['time']+' | 저장 경사 지도')
                published=published.replace('<header>','<header><p><a href="../../#run-'+sid+'">← 오늘 주행 목록</a> <a href="map_viewer.html">3D 점군 지도 ↗</a></p>',1)
                published=published.replace('href="/saved.html"','href="map_viewer.html"')
                published=published.replace('</style>','#downloads,#vio3d,#vio-tools,#vio-values,#vio-error,aside>strong:first-child{display:none!important}</style>',1)
                published=re.sub(r'<span id="downloads">.*?</span>','<span id="downloads" hidden></span>',published,flags=re.S)
                published=published.replace('경사 계산: ','경사 계산 (마지막): ')
                output='terrain_viewer.html'
            published+='\n<script type="module" src="../../../../../assets/meeting-ping.js"></script>\n'
            write_changed(target/output,published)
            item['viewers'][kind]=f'records/{sid}/{output}'
            manifest.append({'session_id':sid,'kind':kind,'source_path':prefix+filename,
                             'source_sha256':digest,'published_path':f'records/{sid}/{output}',
                             'published_sha256':hashlib.sha256(published.encode()).hexdigest()})
        evidence={k:metadata[k] for k in ['schema','representative_mode','cross_sensor_representative_conflict_check','candidate_settings','plane_quality','core_counters','timing','ground_segmentation','accuracy_verified','height_selection','camera_preprocessing','input_points','selected_points']}
        evidence.update(session_id=sid,observed_cells=item['observed_cells'],valid_cells=item['valid_cells'],last_queue_wait_s=item['last_queue_wait_s'])
        write_changed(target/'metadata.json',json.dumps(evidence,ensure_ascii=False,indent=2))
        manifest.append({'session_id':sid,'kind':'slope_array','source_path':prefix+'terrain/fused/map.npz','source_sha256':hashlib.sha256(raw_grid).hexdigest()})
    records.append(item)
    print(row['id'],row['title'],'exported',flush=True)

stamp=datetime.now(ZoneInfo('Asia/Seoul')).isoformat(timespec='seconds')
data={'source':'8892 실험 기록 자료함','source_date':'2026-10-28','exported_at':stamp,'records':records}
(DEST/'records.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
(DEST/'provenance.json').write_text(json.dumps({'exported_at':stamp,'files':manifest},ensure_ascii=False,indent=2))
valid=[r for r in records if r['has_data']]
empty=[r for r in records if not r['has_data']]
escape=html.escape

def entry(item):
    sid=item['id'];has=item['has_data']
    badge='partial' if item['phase']!='completed' else 'complete'
    links=''
    for key,label in [('cloud','3D 점군 지도 ↗'),('terrain','경사 지도 ↗')]:
        if item['viewers'][key]:links+=f'<a href="{item["viewers"][key]}" target="_blank" rel="noopener">{label}</a>'
    if not links:links='<span class="unavailable">저장된 지도 없음</span>'
    metrics=f'<span>점군 <b>{item["points"]:,}</b>점</span><span>LiDAR <b>{item["scans"]:,}</b>스캔</span><span>OAK <b>{item["depth_frames"]:,}</b>프레임</span>'
    if has:
        metrics+=f'<span>경사 계산 평균 <b>{item["mean_ms"]:.1f} ms</b></span><span>경사 확정 <b>{item["valid_cells"]:,} / {item["observed_cells"]:,}셀 ({item["valid_pct"]:.1f}%)</b></span>'
    memo=f'<p class="memo">{escape(item["memo"])}</p>' if item['memo'] else ''
    error=f'<p class="record-error">{escape(item["error"])}</p>' if item['error'] else ''
    details=(f'<details class="record-details"><summary>기록 정보</summary><p>기록 번호: <code>{sid}</code></p><p>경사 계산 평균 표본: {item["timing_samples"]}회 / 마지막 입력 큐 대기: {item["last_queue_wait_s"]:.2f}초</p><a href="records/{sid}/metadata.json">원본 측정 항목 확인</a></details>' if has else f'<p class="session-id">{sid}</p>')
    search=escape(' '.join([item['title'],item['memo'],sid,item['time']]),quote=True)
    return f'''<article class="record" id="run-{sid}" data-search="{search}" data-phase="{item['phase']}">
<div class="record-heading"><h2>{escape(item['title'])}</h2><span class="badge {badge}">{escape(item['state_label'])}</span><time datetime="2026-10-28T{item['time']}+09:00">{item['time']}</time></div>
<div class="record-metrics">{metrics}</div>{memo}{error}<nav class="record-links" aria-label="{escape(item['title'])} {item['time']} 결과">{links}</nav>{details}</article>'''

content='''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NOMAD | 10.28 우면사, 대성사 실측</title><meta name="description" content="8892 실험 기록 자료함의 오늘 주행 기록과 실제 저장 지도를 엽니다.">
<link rel="stylesheet" href="../../../assets/library.css"><link rel="stylesheet" href="../../../assets/field-library.css"></head><body><main>
<header><a class="back" href="../">← 경사 지도</a><div class="label">NOMAD / FIELD RECORDS</div><h1>10.28 우면사, 대성사 실측</h1><p>8892 실험 기록 자료함에 저장된 오늘 주행 결과입니다. 각 기록에서 실제 저장된 지도를 바로 엽니다.</p></header>
'''+f'''<div class="stats" aria-label="오늘 저장 결과"><div><strong>{len(valid)}</strong><span>지도 기록</span></div><div><strong>{sum(bool(r['viewers']['cloud']) for r in valid)}</strong><span>3D 점군 지도</span></div><div><strong>{sum(bool(r['viewers']['terrain']) for r in valid)}</strong><span>경사 지도</span></div><div><strong>{sum(r['phase']!='completed' for r in valid)}</strong><span>일부 저장</span></div></div>
'''+'''<div class="tools"><label><span>주행 검색</span><input type="search" id="search" placeholder="이름, 시간 또는 기록 번호"></label><label><span>저장 상태</span><select id="filter"><option value="all">전체 지도 기록</option><option value="completed">저장 완료</option><option value="partial">일부 저장</option></select></label><p id="visible-count" aria-live="polite">'''+f'{len(valid)}개 기록</p></div>'+'''
<section class="records" aria-label="오늘 주행 지도 목록">'''+''.join(entry(r) for r in valid)+'''</section><p id="no-results" hidden>검색에 맞는 기록이 없습니다.</p>
'''+f'<details class="empty-records"><summary>지도 없는 기록 {len(empty)}개</summary>'+''.join(entry(r) for r in empty)+'''</details>
<p class="note">경사 계산 평균은 저장 메타데이터의 계산 표본 기준입니다. 센서 입력 처리, 카메라 전처리, 직렬화, 저장과 화면 표시를 제외합니다. 경사 확정률은 관측 셀 중 경사각이 확정된 비율이며 정확도 검증값은 아닙니다.</p>
<footer>8892 자료함의 2026.10.28 기록을 직접 내보낸 정적 사본입니다. 기록 이름, 상태와 지도 데이터는 자료함 기준입니다. <a href="records.json">기록 목록</a> / <a href="provenance.json">원본 대조 정보</a></footer></main>
<script>
const records=[...document.querySelectorAll('.records>.record')];
function filterRecords(){const q=document.getElementById('search').value.trim().toLocaleLowerCase(),filter=document.getElementById('filter').value;let n=0;for(const r of records){const match=r.dataset.search.toLocaleLowerCase().includes(q)&&(filter==='all'||filter==='completed'&&r.dataset.phase==='completed'||filter==='partial'&&r.dataset.phase!=='completed');r.hidden=!match;if(match)n++}document.getElementById('visible-count').textContent=n+'개 기록';document.getElementById('no-results').hidden=n!==0;}
document.getElementById('search').addEventListener('input',filterRecords);document.getElementById('filter').addEventListener('change',filterRecords);
</script><script type="module" src="../../../assets/meeting-ping.js"></script></body></html>
'''
write_changed(DEST/'index.html',content)
css='''main{max-width:1120px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}.stats>div{padding:16px 20px;background:white;border:1px solid var(--line);border-radius:9px}.stats strong{display:block;font-size:29px;line-height:1.3;color:#284f6a}.stats span{font-size:13px;color:var(--muted)}.tools{display:flex;align-items:flex-end;gap:12px;margin-bottom:20px}.tools label{display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--muted)}.tools label:first-child{flex:1}.tools input,.tools select{font:inherit;font-size:14px;padding:10px 12px;border:1px solid #cbd6de;border-radius:6px;background:white;color:var(--ink);min-width:0}.tools p{font-size:13px;white-space:nowrap;padding-bottom:10px}.record{scroll-margin-top:15px;background:white;border:1px solid var(--line);border-radius:9px;padding:22px;margin-top:14px}.record-heading{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.record h2{margin:0;font-size:20px}.record time{color:var(--muted);font-size:14px;margin-left:auto;font-variant-numeric:tabular-nums}.badge{font-size:12px;padding:3px 8px;border-radius:4px;white-space:nowrap}.complete{background:#e7f4ed;color:#387357}.partial{background:#fff1d9;color:#906226}.record-metrics{display:flex;flex-wrap:wrap;gap:7px 20px;margin-top:12px;font-size:13px;color:#697a87;font-variant-numeric:tabular-nums}.record-metrics b{font-weight:600;color:#344e60}.record-links{display:flex;gap:9px;flex-wrap:wrap;margin-top:17px}.record-links a{display:inline-block;border:1px solid #bdcedb;border-radius:6px;color:#315e7e;background:#f3f7fa;padding:9px 14px;text-decoration:none;font-size:14px}.record-links a:hover{background:#e8f0f6}.record-error{color:#94642c;background:#fff8ea;font-size:13px;padding:10px 13px;margin-top:12px;border-radius:5px}.record-details{margin-top:13px;font-size:12px;color:var(--muted)}.record-details summary{cursor:pointer}.record-details p{margin-top:7px}.record-details a{display:inline-block;color:var(--accent);margin-top:7px}.memo{font-size:13px;margin-top:10px}.session-id,.unavailable{font-size:12px;color:var(--muted)}.empty-records{margin:25px 0;color:var(--muted);font-size:13px}.empty-records>summary{cursor:pointer;padding:8px 0}.empty-records .record{background:#f9fafb}.empty-records h2{font-size:17px}footer a{color:var(--accent)}input:focus-visible,select:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #5186ab;outline-offset:3px}[hidden]{display:none!important}@media(max-width:600px){.stats{grid-template-columns:repeat(2,1fr);gap:9px}.stats>div{padding:13px 16px}.tools{flex-wrap:wrap}.tools label:first-child{flex-basis:100%}.tools p{margin-left:auto}.record{padding:17px}.record h2{font-size:18px}.record-heading{gap:8px}.record time{font-size:12px}.record-metrics{gap:6px 13px;font-size:12px}}
'''
write_changed(ROOT/'assets/field-library.css',css)
print(f'Direct source export complete: {len(valid)} map records, {len(empty)} empty records')
