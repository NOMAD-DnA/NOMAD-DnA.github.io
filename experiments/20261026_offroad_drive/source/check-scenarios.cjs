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
const scripts=[...raw.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];new vm.Script(scripts.at(-1)[2]);const parameterNames=['THREE','document','console','devicePixelRatio','location','performance','Worker','Blob','URL','ResizeObserver','setTimeout','clearTimeout','requestAnimationFrame','window'];new Function(...parameterNames,scripts.at(-1)[2])(...parameterNames.map(k=>app[k]));
async function waitFor(fn,limit=120000){const start=performance.now();while(!fn()){if(performance.now()-start>limit)throw Error('Timed out');await new Promise(r=>setTimeout(r,30));}}

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
  if(id===1){assert.equal(range[0],0);assert.equal(range[1],0);for(let x=0;x<=14;x+=.2){const p=sim.pose(x);assert.equal(p.y,0);assert.equal(p.pitch,0);assert.equal(p.roll,0);}}
  if(spec.slope===0){assert.equal(sim.baseHeight(18),0);assert(!elements.get('phase').textContent.includes('오르막'));assert.equal(elements.get('rampStartVal').textContent,'해당 없음');}
  else assert(Math.abs(sim.baseHeight(10)-4*Math.tan(Math.PI/18))<1e-9);
  const lateral=Math.max(...sim.route.points.map(p=>Math.abs(p.z)));
  if(spec.obstacles==='none'){assert.equal(sem.obstacleMeshes.length,0);assert.equal(sim.route.obstacles.length,0);assert(Math.abs(sim.route.length-14)<1e-7);assert.equal(lateral,0);}
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
  if(id===1)assert(maxSlope<.01,'Flat map acquired nonzero slope');else assert(maxSlope>1,'Rough map lost local slopes');
  const row={scenario:id,slope:sim.state.slope,rough:sim.state.rough,obstacles:sim.state.obstacles,heightRange:range,routeLength:sim.route.length,maxLateral:lateral,minCenterClearance:Number.isFinite(min)?min:null,blocked:sem.occupancy.blocked.size,validSlopeCells:r.valid,maxCellSlopeDeg:maxSlope};
  outcomes.push(row);console.log('SCENARIO',JSON.stringify(row));
}
(async()=>{
  await verifyScenario(1);
  for(const id of [2,3,4]){buttons.find(b=>Number(b.dataset.scenario)===id).onclick();assert.equal(app.sim.state.ready,false);await verifyScenario(id);}
  // Sensor installation remains shared while every environment preset stays exact.
  elements.get('cameraHeight').value='33';elements.get('cameraHeight').listeners.change();await ready();assert.equal(app.sim.state.ch,.33);
  app.sim.selectScenario(1);await ready();assert.equal(app.sim.state.ch,.33);assert.equal(app.sim.state.slope,0);assert.equal(app.sim.state.rough,0);assert.equal(app.semanticDemo.obstacleMeshes.length,0);assert.equal(app.semanticDemo.occupancy.blocked.size,0);assert.equal(app.sim.state.x,0);
  app.sim.selectScenario(4);app.sim.selectScenario(1);await ready();assert.equal(app.sim.state.scenario,1);assert.equal(app.semanticDemo.obstacleMeshes.length,0);assert.equal(app.semanticDemo.occupancy.blocked.size,0);assert(app.location.search.includes('scenario=1'));
  const priorURL=app.location.href;app.location.protocol='file:';app.sim.selectScenario(2);await ready();assert.equal(app.sim.state.scenario,2);assert.equal(app.location.href,priorURL);
  fs.writeFileSync(__dirname+'/verification.json',JSON.stringify({checks:'Four full A-to-B routes; 1401 clearance samples each; flat height/pitch/roll and fitted slopes; no-obstacle semantic maps; preset switch resets; retained sensor settings; latest switch wins',outcomes},null,2));
  console.log('ALL FOUR SCENARIO CHECKS PASSED');
})().catch(e=>{console.error(e);process.exitCode=1;});
