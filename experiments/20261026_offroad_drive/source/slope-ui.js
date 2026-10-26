// Local point-cloud slope map. All estimation runs in an offline Web Worker.
let slopeGeneration=0,slopeTimer=null,slopeBusy=false,slopeLastDispatch=0,slopeRequested=null,slopeSerial=0;
const slopeView={res:.05,radius:.15,source:'fused',focusX:6.35,focusZ:.025,selectedX:6.35,selectedZ:.025,result:null,cells:new Map(),overviewBox:null,detailBox:null};
const slopeWorker=new Worker(URL.createObjectURL(new Blob([$('slopeWorkerSource').textContent],{type:'text/javascript'})));
const slopeReason=['계산됨','주변 점 12개 미만','서로 다른 XY 구역 6개 미만','점들이 선에 가깝게 몰림','평면 오차 10mm 초과'];
function slopeSignature(){return [slopeGeneration,state.cut,state.mode,slopeView.res,slopeView.radius,slopeView.source,$('slopeGroundOnly').checked].join('|');}
function slopeSnapshot(){const k=Math.round(state.x/STEP),inputs=[],groundOnly=$('slopeGroundOnly').checked;for(let s=0;s<2;s++){
  if(slopeView.source==='lidar'&&s!==0||slopeView.source==='camera'&&s!==1)continue;
  if(state.mode==='accum'){const src=state.cut?window.simData.cutClouds[s]:clouds[s],count=(state.cut?window.simData.cutLimits:window.simData.limits)[s][k],out=new Float32Array(count*3);let kept=0;const tags=(state.cut?window.simData.cutLabels:window.simData.labels)[s];for(let i=0;i<count*3;i+=3){if(groundOnly&&tags[i/3]!==0)continue;out[kept++]=src[i];out[kept++]=src[i+1]-.009;out[kept++]=src[i+2];}inputs.push(out.subarray(0,kept));}
  else{const list=[];for(const p of scanFrames[k][s])if((!groundOnly||p.semantic===0)&&(!state.cut||p.y<=cutElevation()+1e-7))list.push(p.x,p.y,p.z);inputs.push(new Float32Array(list));}
}return {inputs,x:routeDistance(k*STEP)};}
function requestSlope(immediate=false){if(!scanFrames.length)return;if(slopeView.result&&slopeView.result.signature!==slopeSignature()){slopeView.result=null;slopeView.cells.clear();prepCanvas('slopeOverview');prepCanvas('slopeDetail');$('slopeAngle').textContent='계산 중';$('slopeSummary').textContent='변경된 조건으로 경사 지도 계산 중';}slopeRequested={signature:slopeSignature(),k:Math.round(state.x/STEP)};if(slopeBusy)return;clearTimeout(slopeTimer);slopeTimer=setTimeout(dispatchSlope,immediate?0:Math.max(0,500-(performance.now()-slopeLastDispatch)));}
function dispatchSlope(){if(slopeBusy||!slopeRequested)return;const req=slopeRequested;slopeRequested=null;const snapshot=slopeSnapshot();slopeBusy=true;slopeLastDispatch=performance.now();$('slopeStatus').textContent='점군에서 경사 계산 중';slopeWorker.postMessage({id:++slopeSerial,signature:req.signature,...snapshot,res:slopeView.res,radius:slopeView.radius});}
slopeWorker.onmessage=({data:r})=>{slopeBusy=false;if(r.signature===slopeSignature()){
  slopeView.result=r;slopeView.cells.clear();for(let i=0;i<r.rows.length;i+=10)slopeView.cells.set(r.rows[i]+','+r.rows[i+1],Array.from(r.rows.subarray(i,i+10)));
  $('slopeStatus').textContent='입력 이동거리 '+r.x.toFixed(1)+'m / 계산 '+Math.round(r.ms)+'ms';$('slopeSummary').textContent='입력 '+r.points.toLocaleString()+'점 → 관측 '+r.observed.toLocaleString()+'셀 → 경사 계산 '+r.valid.toLocaleString()+'셀 / 미확정 '+(r.observed-r.valid).toLocaleString()+'셀';
  $('slopeRejects').textContent='미확정 사유: 점 부족 '+r.reasons[1].toLocaleString()+', XY 구역 부족 '+r.reasons[2].toLocaleString()+', 선형 분포 '+r.reasons[3].toLocaleString()+', 평면 오차 초과 '+r.reasons[4].toLocaleString();
  drawSlopeMaps();
}if(slopeRequested)requestSlope();};
slopeWorker.onerror=e=>{slopeBusy=false;$('slopeStatus').textContent='경사 계산 오류: '+e.message;};
function slopeColor(a){const t=clamp(a/30,0,1),c=t<.5?[[74,208,180],[235,191,104],t*2]:[[235,191,104],[238,114,85],(t-.5)*2];return 'rgb('+c[0].map((v,i)=>Math.round(v+(c[1][i]-v)*c[2])).join(',')+')';}
function prepCanvas(id){const c=$(id),w=c.clientWidth,h=c.clientHeight,dpr=Math.min(devicePixelRatio,2);c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#0d1823';ctx.fillRect(0,0,w,h);return {ctx,w,h};}
function drawSlopeMaps(){if(!slopeView.result)return;drawSlopeOverview();drawSlopeDetail();}
function drawSlopeOverview(){const {ctx,w,h}=prepCanvas('slopeOverview'),r=slopeView.result,scale=Math.min((w-60)/24,(h-57)/10),left=42,bottom=h-34,top=bottom-10*scale,X=x=>left+(x+2)*scale,Z=z=>bottom-(z+5)*scale;slopeView.overviewBox={left,bottom,scale};
  ctx.save();ctx.beginPath();ctx.rect(left,top,24*scale,10*scale);ctx.clip();
  for(const a of slopeView.cells.values()){ctx.fillStyle=a[2]===0?slopeColor(a[3]):'#64717e';ctx.fillRect(X(a[0]*r.res),Z((a[1]+1)*r.res),Math.max(.7,r.res*scale),Math.max(.7,r.res*scale));}
  ctx.strokeStyle='#bac9d04a';ctx.lineWidth=1;for(const z of [-1.8,1.8]){ctx.beginPath();ctx.moveTo(X(-2),Z(z));ctx.lineTo(X(22),Z(z));ctx.stroke();}
  if(state.slope>0){
  ctx.strokeStyle='#f2d0aa';ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(X(state.start),top);ctx.lineTo(X(state.start),bottom);ctx.stroke();ctx.setLineDash([]);
  }
  ctx.strokeStyle='#edf5fd';ctx.strokeRect(X(slopeView.focusX-4.5*r.res),Z(slopeView.focusZ+4.5*r.res),9*r.res*scale,9*r.res*scale);
  ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(X(pose(state.x).x),Z(pose(state.x).z),3.5,0,2*Math.PI);ctx.fill();ctx.restore();
  ctx.fillStyle='#afc0ce';ctx.font='11px system-ui';ctx.textAlign='center';for(let x=0;x<=20;x+=5)ctx.fillText(x+'m',X(x),h-15);ctx.textAlign='right';for(const z of [-4,0,4])ctx.fillText(z+'m',left-7,Z(z)+4);ctx.textAlign='left';ctx.fillText('진행 방향 X →',left,h-2);ctx.fillText('좌우',5,18);ctx.fillStyle='#f2d0aa';if(state.slope>0)ctx.fillText('경사 시작',Math.min(w-65,X(state.start)+4),Math.max(18,top+14));
}
function drawSlopeDetail(){const {ctx,w,h}=prepCanvas('slopeDetail'),r=slopeView.result,n=9,sz=Math.min((w-40)/n,(h-41)/n),left=(w-n*sz)/2,bottom=h-24,ix=Math.floor(slopeView.focusX/r.res),iz=Math.floor(slopeView.focusZ/r.res),firstX=ix-4,firstZ=iz-4;slopeView.detailBox={left,bottom,sz,firstX,firstZ};
  ctx.font='11px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=slopeView.cells.get((firstX+i)+','+(firstZ+j)),x=left+i*sz,y=bottom-(j+1)*sz;ctx.fillStyle=!a?'#142332':a[2]===0?slopeColor(a[3]):'#64717e';ctx.fillRect(x+.5,y+.5,sz-1,sz-1);ctx.fillStyle=a&&a[2]===0?'#0e2427':'#e3eaf2';let text=!a?'—':a[2]===0?(a[3]<.05?'0.0':a[3].toFixed(1)):'?';ctx.fillText(text,x+sz/2,y+sz/2);}
  const selectedX=Math.floor(slopeView.selectedX/r.res),selectedZ=Math.floor(slopeView.selectedZ/r.res);ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.strokeRect(left+(selectedX-firstX)*sz+1,bottom-(selectedZ-firstZ+1)*sz+1,sz-2,sz-2);
  ctx.textBaseline='alphabetic';ctx.fillStyle='#afc0ce';ctx.textAlign='left';ctx.fillText(((firstX)*r.res).toFixed(2)+'m',left,h-6);ctx.textAlign='right';ctx.fillText(((firstX+n)*r.res).toFixed(2)+'m',left+n*sz,h-6);ctx.textAlign='left';ctx.fillText('셀별 경사각 / 도',left,12);
  const a=slopeView.cells.get(selectedX+','+selectedZ),x=(selectedX+.5)*r.res,z=(selectedZ+.5)*r.res;
  $('slopeSelection').textContent='선택 셀 중심 X '+x.toFixed(3)+'m / 좌우 '+z.toFixed(3)+'m';
  $('slopeAngle').textContent=!a?'미관측':a[2]===0?(a[3]<.05?'0.00':a[3].toFixed(2))+'°':'미확정';
  $('slopeEvidence').textContent=!a?'이 셀 안에 관측점이 없어 각도를 만들지 않았습니다.':'셀 내부 '+a[8]+'점 / 반경 안 '+a[4]+'점 / XY 구역 '+a[9]+'개 / '+(a[2]===0?'평면 RMS '+(a[5]*1000).toFixed(2)+'mm':slopeReason[a[2]]);
}
function selectSlopePoint(x,z,recenter=true){const r=slopeView.res;slopeView.selectedX=(Math.floor(clamp(x,-2,22-r)/r)+.5)*r;slopeView.selectedZ=(Math.floor(clamp(z,-5,5-r)/r)+.5)*r;if(recenter){slopeView.focusX=slopeView.selectedX;slopeView.focusZ=slopeView.selectedZ;}drawSlopeMaps();}
$('slopeOverview').addEventListener('click',e=>{const b=slopeView.overviewBox;if(!b)return;const rect=e.target.getBoundingClientRect();selectSlopePoint((e.clientX-rect.left-b.left)/b.scale-2,(b.bottom-(e.clientY-rect.top))/b.scale-5);});
$('slopeDetail').addEventListener('click',e=>{const b=slopeView.detailBox;if(!b)return;const rect=e.target.getBoundingClientRect(),i=Math.floor((e.clientX-rect.left-b.left)/b.sz),j=Math.floor((b.bottom-(e.clientY-rect.top))/b.sz);if(i<0||i>=9||j<0||j>=9)return;selectSlopePoint((b.firstX+i+.5)*slopeView.res,(b.firstZ+j+.5)*slopeView.res,false);});
for(const id of ['slopeOverview','slopeDetail'])$(id).addEventListener('keydown',e=>{const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]};if(!dirs[e.key])return;e.preventDefault();const d=dirs[e.key];selectSlopePoint(slopeView.selectedX+d[0]*slopeView.res,slopeView.selectedZ+d[1]*slopeView.res);});
for(const [id,key] of [['slopeSource','source'],['slopeGrid','res'],['slopeRadius','radius']])$(id).onchange=e=>{slopeView[key]=key==='source'?e.target.value:Number(e.target.value);requestSlope(true);};
$('slopeComplete').onclick=()=>{seekProgress(END);requestSlope(true);};
for(const b of document.querySelectorAll('[data-slope-focus]'))b.onclick=()=>{const kind=b.dataset.slopeFocus;selectSlopePoint(state.start+(kind==='flat'?-1:kind==='edge'?-.025:.5),.025);};
const slopeRO=new ResizeObserver(drawSlopeMaps);slopeRO.observe($('slopeOverview'));slopeRO.observe($('slopeDetail'));
window.slopeMap={view:slopeView,request:requestSlope,select:selectSlopePoint,worker:slopeWorker};

$('slopeGroundOnly').onchange=()=>requestSlope(true);
