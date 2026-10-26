const fs=require('fs'),vm=require('vm'),assert=require('assert'),{performance}=require('perf_hooks');
const raw=fs.readFileSync(__dirname+'/../index.html','utf8'),lib=raw.slice(raw.indexOf('<script>')+8,raw.indexOf('</script>',raw.indexOf('<script>'))),moduleContext={exports:{},console:{warn:()=>{}}};moduleContext.module={exports:moduleContext.exports};vm.runInNewContext(lib,moduleContext);const THREE=moduleContext.exports;
const elements=new Map(),buttons=[];const ctx2=new Proxy({},{get:(_t,k)=>k==='measureText'?()=>({width:20}):()=>{}});
function element(id='',tag='div'){return {id,tagName:tag,style:{},dataset:{},classList:{toggle(){}},textContent:'',value:'',checked:false,clientWidth:id==='slopeOverview'?700:id==='slopeDetail'?320:600,clientHeight:id==='profile'?120:id==='slopeOverview'?340:id==='slopeDetail'?330:302,width:600,height:302,attrs:{},setAttribute(k,v){this.attrs[k]=v;},listeners:{},addEventListener(t,fn){this.listeners[t]=fn;},prepend(){},appendChild(){},getContext(){return ctx2;},checkValidity(){return true;},getBoundingClientRect(){return {left:0,top:0};}};}
for(const match of raw.matchAll(/<([a-z][a-z0-9]*)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const e=element(match[3],match[1]),a=match[2];e.value=a.match(/\bvalue="([^"]*)"/)?.[1]??'';e.checked=/\bchecked\b/.test(a);elements.set(e.id,e);}
for(const [id,val]of Object.entries({cameraView:'rgb',mapMode:'accum',speed:'.6',slopeSource:'fused',slopeGrid:'.05',slopeRadius:'.15',obstacleLayout:'none',occupancyZoom:'all'}))elements.get(id).value=val;
elements.get('slopeWorkerSource').textContent=fs.readFileSync(__dirname+'/slope-worker.js','utf8');
for(const match of raw.matchAll(/<button([^>]*\bdata-([^=]+)="([^"]+)"[^>]*)>/g)){const e=element();e.dataset[match[2].replace(/-([a-z])/g,(_m,c)=>c.toUpperCase())]=match[3];buttons.push(e);}
const document={getElementById:id=>elements.get(id),createElement:tag=>element('',tag),querySelectorAll:s=>buttons.filter(b=>s==='[data-scenario]'?'scenario'in b.dataset:s==='[data-at]'?'at'in b.dataset:'slopeFocus'in b.dataset)};
const renderer=function(){this.domElement=element('','canvas');this.capabilities={getMaxAnisotropy:()=>8};for(const name of ['setPixelRatio','setClearColor','setSize','render'])this[name]=()=>{};};
class WorkerStub{constructor(){const self={postMessage:r=>setImmediate(()=>this.onmessage?.({data:r}))};this.scope={self};new Function('self','performance',elements.get('slopeWorkerSource').textContent)(self,performance);}postMessage(data){setImmediate(()=>this.scope.self.onmessage({data}));}}
const app=vm.createContext({THREE:{...THREE,WebGLRenderer:renderer},document,console,Math,Map,Set,Float32Array,Float64Array,devicePixelRatio:1,location:{hash:'',search:'',protocol:'https:',href:'https://example.test/experiments/20261026_offroad_drive/'},performance,Worker:WorkerStub,Blob,URL,ResizeObserver:class{observe(){}},setTimeout,clearTimeout,requestAnimationFrame:()=>{}});app.window=app;app.history={replaceState(_a,_b,url){app.location.href=String(url);app.location.search=new URL(url).search;}};app.addEventListener=()=>{};
const scripts=[...raw.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];const appScript=scripts.findLast(s=>s[2].includes('window.sim={'))?.[2];assert(appScript,'Inline simulation script missing');new vm.Script(appScript);const parameterNames=['THREE','document','console','devicePixelRatio','location','performance','Worker','Blob','URL','ResizeObserver','setTimeout','clearTimeout','requestAnimationFrame','window'];new Function(...parameterNames,appScript)(...parameterNames.map(k=>app[k]));
async function waitFor(fn,limit=120000){const start=performance.now();while(!fn()){if(performance.now()-start>limit)throw Error('Timed out');await new Promise(r=>setTimeout(r,30));}}

assert.equal(app.sim.scenarios.length,4);assert.equal(buttons.filter(b=>'scenario'in b.dataset).length,4);
const outcomes=[];
async function ready(){await waitFor(()=>app.sim?.state.ready||elements.get('error').textContent);assert(!elements.get('error').textContent,elements.get('error').textContent);}
async function verifyScenario(id){
  await ready();const {sim,semanticDemo:sem}=app,spec=sim.scenarios[id-1];
  assert.equal(sim.state.scenario,id);assert.equal(sim.state.slope,spec.slope);assert.equal(sim.state.rough,spec.rough);assert.equal(sim.state.obstacles,spec.obstacles);
  assert.equal(buttons.filter(b=>b.attrs['aria-pressed']==='true').length,1);
  assert.equal(buttons.find(b=>Number(b.dataset.scenario)===id).attrs['aria-pressed'],'true');
  assert.equal(sim.state.x,0);assert.equal(sim.state.playing,false);
  assert.equal(elements.get('scenarioTitle').textContent,spec.title);
  assert(sim.route.points.length>2);assert(Math.abs(sim.route.points[0].x)<1e-9&&Math.abs(sim.route.points[0].z)<1e-9);assert(Math.abs(sim.route.points.at(-1).x-14)<1e-9&&Math.abs(sim.route.points.at(-1).z)<1e-9);
  const range=[Math.min(...sim.terrain.values),Math.max(...sim.terrain.values)];
  if(id===1||id===3){assert.equal(range[0],0);assert.equal(range[1],0);for(let x=0;x<=14;x+=.2){const p=sim.pose(x);assert.equal(p.y,0);assert.equal(p.pitch,0);assert.equal(p.roll,0);}}
  if(spec.slope===0){assert.equal(sim.baseHeight(18),0);assert(!elements.get('phase').textContent.includes('오르막'));assert.equal(elements.get('rampStartVal').textContent,'해당 없음');}
  else if(id===2){
    assert.equal(sim.baseHeight(10,-1.1),0);assert(Math.abs(sim.baseHeight(10,1.1)-4*Math.tan(Math.PI/18))<1e-9);
    const c=sim.route.laneChoice;assert(c.ready,'Both surfaces must be recognized in the same initial camera frame: '+JSON.stringify(c));assert.equal(c.chosen,'left');assert(c.left.fit.angle<.001);assert(Math.abs(c.right.fit.angle-10)<.001);
    const replay=sim.compareLanePoints(sim.scan()[0][1]);assert(replay.ready);assert.equal(replay.chosen,c.chosen);assert(Math.abs(replay.right.fit.angle-c.right.fit.angle)<1e-8,'Decision must use the actual initial frame');
    assert.equal(sim.compareLanePoints([]).ready,false);assert.equal(sim.compareLanePoints(sim.scan()[0][1].filter(p=>p.z<0)).chosen,null,'One visible side cannot trigger a choice');
    // The comparison selects the measured minimum, not a hardcoded left-side preference.
    const swapped=[];for(const [z0,z1,x0,x1,angle]of [[-1.8,-.5,3,8,10],[.85,2.15,6.3,8,0]])for(let x=x0;x<=x1;x+=.1)for(let z=z0;z<=z1;z+=.1)swapped.push({x,y:(x-6)*Math.tan(angle*Math.PI/180),z,semantic:0});
    assert.equal(sim.compareLanePoints(swapped).chosen,'right');
    for(let x=0;x<=14;x+=.1){const p=sim.pose(x);assert(Math.abs(p.y)<1e-8);assert(Math.abs(p.pitch)<1e-8);assert(Math.abs(p.roll)<1e-8);}
    assert.equal(elements.get('laneChoicePanel').hidden,false);assert(elements.get('laneVerdict').textContent.includes('평지 선택'));
    console.log('SIMULTANEOUS LANE OBSERVATION',JSON.stringify(c));
  }
  const lateral=Math.max(...sim.route.points.map(p=>Math.abs(p.z)));
  if(spec.obstacles==='none'){assert.equal(sem.obstacleMeshes.length,0);assert.equal(sim.route.obstacles.length,0);if(id===2){assert(sim.route.length>14);assert(lateral>1);assert(sim.route.points.every(p=>p.z<=1e-8));}else{assert(Math.abs(sim.route.length-14)<1e-7);assert.equal(lateral,0);}}
  else{assert(sem.obstacleMeshes.length>0);assert(lateral>.7);assert(sim.route.minimumClearance>=.65);}
  let min=Infinity;for(let i=0;i<=1400;i++){
    const p=sim.pose(i/100);min=Math.min(min,sim.routeClearance(p.x,p.z));
    const o=sim.sensor(p,sim.state.ch);assert(Math.abs(o.distanceTo(new THREE.Vector3(p.x,p.y,p.z))-sim.state.ch)<1e-8);
    const forward=sim.sensorDir(p,new THREE.Vector3(1,0,0),0);assert(Math.abs(Math.atan2(forward.z,forward.x)-p.heading)<1e-6);
  }
  assert(min>=.649);
  elements.get('safetyMargin').value='.2';sim.update(true);
  for(let i=1;i<=140;i++){assert(sem.advanceSemanticMotion(Math.min(14,i*.1)),'scenario '+id+' unexpectedly stopped');sim.update();}
  assert.equal(sim.state.x,14);assert(Math.abs(sim.pose(14).x-14)<1e-9&&Math.abs(sim.pose(14).z)<1e-9);
  assert(sem.occupancy.free.size>100);
  if(spec.obstacles==='none')assert.equal(sem.occupancy.blocked.size,0);else assert(sem.occupancy.blocked.size>0);
  sim.update(true);await waitFor(()=>app.slopeMap.view.result&&Math.abs(app.slopeMap.view.result.x-sim.route.length)<1e-6);
  const r=app.slopeMap.view.result;assert(r.valid>100);let maxSlope=0;for(let i=0;i<r.rows.length;i+=10)if(r.rows[i+2]===0)maxSlope=Math.max(maxSlope,r.rows[i+3]);
  if(id===1||id===3)assert(maxSlope<.01,'Flat ground map acquired nonzero slope');else{
    let flatCells=0,rampCells=0;for(let i=0;i<r.rows.length;i+=10){const x=(r.rows[i]+.5)*r.res,z=(r.rows[i+1]+.5)*r.res;if(r.rows[i+2]!==0||x<6.5||x>12)continue;if(z<-.5&&z>-1.8&&r.rows[i+3]<.01)flatCells++;if(z>1&&z<2.1&&Math.abs(r.rows[i+3]-10)<.01)rampCells++;}
    assert(flatCells>100,'Split map lost flat cells');assert(rampCells>10,'Split map lost 10 degree cells');
    console.log('SPLIT MAP CELLS',JSON.stringify({flatCells,rampCells}));
    for(const [key,z]of [['flat',-1.1],['edge',.6],['ramp',1.25]]){buttons.find(b=>b.dataset.slopeFocus===key).onclick();assert(Math.abs(app.slopeMap.view.selectedZ-z)<=r.res);}
    const savedChoice=sim.route.laneChoice;sim.route.laneChoice=sim.compareLanePoints([]);sim.state.x=0;assert(!sem.advanceSemanticMotion(.1));assert.equal(sim.state.x,0);sim.route.laneChoice=savedChoice;sim.state.x=14;sim.update(true);
  }
  const row={scenario:id,slope:sim.state.slope,rough:sim.state.rough,obstacles:sim.state.obstacles,heightRange:range,routeLength:sim.route.length,maxLateral:lateral,minCenterClearance:Number.isFinite(min)?min:null,blocked:sem.occupancy.blocked.size,validSlopeCells:r.valid,maxCellSlopeDeg:maxSlope,...(id===2?{laneChoice:sim.route.laneChoice}: {})};
  outcomes.push(row);console.log('SCENARIO',JSON.stringify(row));
}
(async()=>{
  await verifyScenario(1);
  for(const id of [2,3]){buttons.find(b=>Number(b.dataset.scenario)===id).onclick();assert.equal(app.sim.state.ready,false);await verifyScenario(id);}
  // The fourth environment is obstacle-free, but measured grade must stop it.
  buttons.find(b=>Number(b.dataset.scenario)===4).onclick();await ready();
  const {sim,semanticDemo:sem,gradeDemo:grade}=app;assert.equal(sim.state.slope,25);assert.equal(grade.limit,20);assert.equal(sim.state.obstacles,'none');assert.equal(sem.obstacleMeshes.length,0);
  const firstBlocked=grade.frames().find(r=>r.blocked);assert(firstBlocked,'No measured steep patch found');assert(firstBlocked.angle>20);assert(firstBlocked.n>=12);
  const plane=angle=>{const p=[];for(let x=.35;x<=1.5;x+=.04)for(let z=-.3;z<=.3;z+=.04)p.push({x,y:x*Math.tan(angle*Math.PI/180),z,semantic:0});return p;};
  for(const degrees of [0,10,20,25]){const fit=grade.fit(plane(degrees));assert(fit);assert(Math.abs(fit.angle-degrees)<1e-6);assert.equal(grade.exceeds(fit.angle),degrees>20);}
  const stopOutcomes=[];
  for(const speed of [.3,.6,1.2]){
    elements.get('reset').onclick();elements.get('semanticStop').checked=false;sim.state.playing=true;
    for(let t=0;t<1000;t++){const next=Math.min(14,sim.state.x+sim.route.length/14*speed*.1);if(!sem.advanceSemanticMotion(next)){sim.update(true);break;}sim.update();}
    assert(sim.state.gradeStopped);assert(!sim.state.playing);assert(sim.state.x>3&&sim.state.x+.24<6,'Must stop before front wheel reaches ramp');assert.equal(sem.occupancy.blocked.size,0);assert(elements.get('gradeVerdict').textContent.includes('정지'));assert(elements.get('phase').textContent.includes('20°'));
    const stoppedAt=sim.state.x;assert(!sem.advanceSemanticMotion(stoppedAt+.1));assert.equal(sim.state.x,stoppedAt);
    stopOutcomes.push({speed,stoppedAt,measuredGrade:grade.reading().angle});
  }
  for(const method of ['button','slider','slope-map']){
    elements.get('reset').onclick();
    if(method==='button')buttons.find(b=>b.dataset.at==='14').onclick();
    if(method==='slider')elements.get('travel').listeners.input({target:{value:'14'}});
    if(method==='slope-map')elements.get('slopeComplete').onclick();
    assert(sim.state.gradeStopped);assert(sim.state.x+.24<6,'Position controls bypassed grade limit');
  }
  // View-only filters cannot bypass the independent ground-based guard.
  elements.get('reset').onclick();sim.state.cut=true;sim.state.mode='current';app.slopeMap.view.source='lidar';buttons.find(b=>b.dataset.at==='14').onclick();assert(sim.state.gradeStopped);assert.equal(sem.occupancy.blocked.size,0);sim.state.cut=false;sim.state.mode='accum';app.slopeMap.view.source='fused';
  // Changing the displayed grade value without rebuilding cannot change the measured decision.
  elements.get('reset').onclick();sim.state.slope=0;buttons.find(b=>b.dataset.at==='14').onclick();assert(sim.state.gradeStopped);sim.state.slope=25;
  // Future frame points cannot alter the first frame's estimate.
  const originals=sim.scan();grade.build([[plane(0),[]]]);const baseline=JSON.stringify(grade.frames()[0]);grade.build([[plane(0),[]],[plane(25),[]]]);assert.equal(JSON.stringify(grade.frames()[0]),baseline);grade.build(originals);
  const fourth={scenario:4,slope:25,rough:sim.state.rough,obstacles:'none',limit:grade.limit,firstMeasuredHazard:firstBlocked,stopOutcomes,shortcutsRespectStop:true};outcomes.push(fourth);console.log('STEEP STOP',JSON.stringify(fourth));
  // Sensor installation remains shared while every environment preset stays exact.
  app.sim.selectScenario(1);await ready();elements.get('semanticStop').checked=true;
  elements.get('cameraHeight').value='33';elements.get('cameraHeight').listeners.change();await ready();assert.equal(app.sim.state.ch,.33);
  app.sim.selectScenario(1);await ready();assert.equal(app.sim.state.ch,.33);assert.equal(app.sim.state.slope,0);assert.equal(app.sim.state.rough,0);assert.equal(app.semanticDemo.obstacleMeshes.length,0);assert.equal(app.semanticDemo.occupancy.blocked.size,0);assert.equal(app.sim.state.x,0);
  app.sim.selectScenario(4);app.sim.selectScenario(1);await ready();assert.equal(app.sim.state.scenario,1);assert.equal(app.semanticDemo.obstacleMeshes.length,0);assert.equal(app.semanticDemo.occupancy.blocked.size,0);assert(app.location.search.includes('scenario=1'));
  const priorURL=app.location.href;app.location.protocol='file:';app.sim.selectScenario(2);await ready();assert.equal(app.sim.state.scenario,2);assert.equal(app.location.href,priorURL);
  fs.writeFileSync(__dirname+'/verification.json',JSON.stringify({checks:'Three A-to-B routes including simultaneous same-frame camera recognition and measured flatter-lane selection, no bumps in scenarios 1-3, obstacle avoidance on level terrain; fourth obstacle-free 25 degree grade stop with 20 degree vehicle limit; exact 20 degree boundary; three playback speeds; no slider or shortcut bypass; display filters independent; no future observations; retained sensor settings',outcomes},null,2));
  console.log('ALL FOUR SCENARIO CHECKS PASSED');
})().catch(e=>{console.error(e);process.exitCode=1;});
