function syncScenarioUI(){
  const spec=SCENARIOS.find(s=>s.id===state.scenario);
  $('scenarioTitle').textContent=spec.title;$('scenarioDescription').textContent=spec.description;$('scenarioCurrent').textContent=spec.id+' / '+SCENARIOS.length;
  $('slopeComplete').textContent=spec.id===5?'정지 위치 지도 보기':'B 도착 지도 보기';
  $('worldTitle').textContent='01 / '+spec.title.slice(3);$('worldPath').textContent=spec.path;
  for(const b of document.querySelectorAll('[data-scenario]'))b.setAttribute('aria-pressed',String(Number(b.dataset.scenario)===state.scenario));
  for(const b of document.querySelectorAll('[data-slope-focus]')){const k=b.dataset.slopeFocus;b.textContent=state.slope>0?(k==='flat'?'경사 전':k==='edge'?'경사 경계':'오르막'):(k==='flat'?'X 5m':k==='edge'?'X 6m':'X 6.5m');}
  $('obstacleLayout').value=state.obstacles;$('slope').value=String(state.slope);$('roughness').value=String(state.rough*100);$('rampStart').value=String(state.start);
  $('roughnessVal').textContent=state.rough?Math.round(state.rough*100)+'cm':'없음';$('slopeVal').textContent=state.slope+'°';$('obstacleVal').textContent=state.obstacles==='none'?'없음':'나무와 돌';$('rampStartVal').textContent=state.slope>0?'X '+state.start+'m':'해당 없음';
  for(const b of document.querySelectorAll('[data-at]')){const x=Number(b.dataset.at);if(x===14)b.textContent=spec.id===5?'정지 위치 보기':'B 도착';if(x===5.5)b.textContent=state.slope>0?'경사 직전':'중간 구간';if(x===7.2)b.textContent=state.slope>0?'경사 진입':'후반 구간';}
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
