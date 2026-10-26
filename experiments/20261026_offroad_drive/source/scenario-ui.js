function syncScenarioUI(){
  const spec=SCENARIOS.find(s=>s.id===state.scenario);
  $('scenarioTitle').textContent=spec.title;$('scenarioDescription').textContent=spec.description;$('scenarioCurrent').textContent=spec.id+' / '+SCENARIOS.length;
  $('slopeComplete').textContent=spec.id===4?'정지 위치 지도 보기':'B 도착 지도 보기';
  $('laneChoicePanel').hidden=!isSplitTerrain();
  $('worldTitle').textContent='01 / '+spec.title.slice(3);$('worldPath').textContent=spec.path;
  for(const b of document.querySelectorAll('[data-scenario]'))b.setAttribute('aria-pressed',String(Number(b.dataset.scenario)===state.scenario));
  for(const b of document.querySelectorAll('[data-slope-focus]')){const k=b.dataset.slopeFocus;b.textContent=isSplitTerrain()?(k==='flat'?'왼쪽 평지':k==='edge'?'연결 비탈':'오른쪽 10°'):state.slope>0?(k==='flat'?'경사 전':k==='edge'?'경사 경계':'오르막'):(k==='flat'?'X 5m':k==='edge'?'X 6m':'X 6.5m');}
  $('obstacleLayout').value=state.obstacles;$('slope').value=String(state.slope);$('roughness').value=String(state.rough*100);$('rampStart').value=String(state.start);
  $('roughnessVal').textContent=state.rough?Math.round(state.rough*100)+'cm':'없음';$('slopeVal').textContent=isSplitTerrain()?'0° / 10°':state.slope+'°';$('obstacleVal').textContent=state.obstacles==='none'?'없음':'나무와 돌';$('rampStartVal').textContent=state.slope>0?'X '+state.start+'m':'해당 없음';
  for(const b of document.querySelectorAll('[data-at]')){const x=Number(b.dataset.at);if(x===14)b.textContent=spec.id===4?'정지 위치 보기':'B 도착';if(x===5.5)b.textContent=isSplitTerrain()?'평지 분기 후':state.slope>0?'경사 직전':'중간 구간';if(x===7.2)b.textContent=isSplitTerrain()?'두 노면 옆 주행':state.slope>0?'경사 진입':'후반 구간';}
}
function selectScenario(id){
  const spec=SCENARIOS.find(s=>s.id===Number(id));if(!spec)throw Error('알 수 없는 시나리오: '+id);
  clearTimeout(pending);state.playing=false;state.ready=false;state.gradeStopped=false;state.x=0;state.scenario=spec.id;state.slope=spec.slope;state.rough=spec.rough;state.obstacles=spec.obstacles;state.start=6;
  occupancy.selected=null;$('play').textContent='▶ 주행';syncScenarioUI();
  if(window.history?.replaceState&&/^https?:$/.test(location.protocol)){const url=new URL(location.href);url.searchParams.set('scenario',String(spec.id));window.history.replaceState(null,'',url);}
  $('loading').style.display='grid';$('error').style.display='none';$('error').textContent='';
  pending=setTimeout(()=>{try{rebuild();resize();}catch(e){state.ready=false;$('loading').style.display='none';$('error').style.display='block';$('error').textContent='시나리오 준비 오류: '+e.message;console.error(e);}},50);
}
for(const b of document.querySelectorAll('[data-scenario]'))b.onclick=()=>selectScenario(b.dataset.scenario);

function updateLaneChoiceUI(){
  if(!isSplitTerrain())return;
  const c=route.laneChoice;
  for(const [id,side]of [['laneLeft','left'],['laneRight','right']])$(id).textContent=c?.[side].fit?c[side].fit.angle.toFixed(1)+'°':'미확정';
  $('laneVerdict').textContent=c?.ready?(c.chosen==='left'?'왼쪽 평지 선택':'오른쪽 노면 선택'):'두 노면의 경사 추정 대기 / 출발 보류';
  $('laneEvidence').textContent=c?.ready?'출발점의 같은 카메라 깊이 관측 / 왼쪽 '+c.left.fit.n+'점, 오른쪽 '+c.right.fit.n+'점 / 두 노면 모두 20° 이하지만 더 완만한 쪽을 우선합니다.':'두 영역 모두 평면 추정 조건을 충족해야 경로를 선택합니다. 센서 설치 조건에 따라 관측이 부족할 수 있습니다.';
  $('phase').textContent=c?.ready?'두 노면 동시 인식 / 평지 경로 주행':'두 노면 관측 부족 / 정지';
}
