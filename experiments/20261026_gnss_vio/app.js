/* NOMAD recorded factory run. Rendering only; never changes recorded estimates. */
(()=>{'use strict';
const SOURCE=window.NOMAD_DATA, MODEL=window.NOMAD_IMU_MODEL;
const D=SOURCE?{...SOURCE,series:{...SOURCE.series,imu:MODEL?.series||SOURCE.series.imu}}:null, $=id=>document.getElementById(id);
if(!D){document.body.insertAdjacentHTML('afterbegin','<p class="runtime-error">기록 데이터를 불러오지 못했습니다. 전체 폴더를 함께 열어 주세요.</p>');return;}
const colors={gt:'#344b4e',ours:'#007fae',imu:'#dd7c2a',red:'#cf5157'};
const state={t:0,playing:false,speed:8,cloud:true,visible:{gt:true,ours:true,imu:true},mode:'follow',roof:false,sampleMode:'tracks',samplePhase:0,imuMode:MODEL?'model':'original',mapView:'xy'};
let scene=null,lastTime=0,renderRequired=true,previousPhase=-1,lastVideoSync=0;
const VIDEO=window.NOMAD_VIDEO,videos=[$('featureVideo'),$('featureVideoLarge')];
for(const v of videos){if(VIDEO)v.src=VIDEO.src;v.muted=true;v.playbackRate=state.speed;v.addEventListener('loadedmetadata',()=>syncVideos(true));}
function syncVideos(force=false){if(!VIDEO)return;const target=Math.max(0,state.t-VIDEO.startT),largeOpen=$('sampleDialog').open;for(let i=0;i<videos.length;i++){const v=videos[i],active=largeOpen?i===1:i===0;if(!active){v.pause();continue;}v.playbackRate=state.speed;if(v.readyState>=1&&(force||Math.abs(v.currentTime-target)>.22))v.currentTime=Math.min(target,Math.max(0,v.duration-.01));if(state.playing){if(v.paused)v.play().catch(()=>{});}else v.pause();}}
const duration=D.meta.durationS;
function upper(rows,t){let l=0,r=rows.length;while(l<r){const m=(l+r)>>1;if(rows[m][0]<=t)l=m+1;else r=m;}return l;}
function sample(rows,t,interpolate=true,preserveJump=false){if(!rows.length||t<rows[0][0]||t>rows[rows.length-1][0]+.3)return null;const i=upper(rows,t)-1,a=rows[Math.max(0,i)],b=rows[i+1];if(!interpolate||!b)return a.slice();if(preserveJump&&Math.hypot(b[1]-a[1],b[2]-a[2],b[3]-a[3])>.75)return a.slice();const f=Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0])));return [t,...a.slice(1).map((v,j)=>j===3?v+Math.atan2(Math.sin(b[4]-v),Math.cos(b[4]-v))*f:v+(b[j+1]-v)*f)];}
function telemetry(t){return D.telemetry[Math.max(0,upper(D.telemetry,t)-1)];}
function phaseAt(t){return D.phases.findIndex((p,i)=>t>=p.start&&(t<p.end||i===D.phases.length-1));}
function timeText(t){const n=Math.max(0,t),m=Math.floor(n/60),s=(n%60).toFixed(1);return String(m).padStart(2,'0')+':'+s.padStart(4,'0');}
function poseObject(p){return p?{x:p[1],y:p[2],z:p[3],yaw:p[4]}:null;}
function canvasSize(canvas){const b=canvas.getBoundingClientRect(),r=Math.min(window.devicePixelRatio||1,2);if(canvas.width!==Math.round(b.width*r)||canvas.height!==Math.round(b.height*r)){canvas.width=Math.round(b.width*r);canvas.height=Math.round(b.height*r);}const c=canvas.getContext('2d');c.setTransform(r,0,0,r,0,0);c.clearRect(0,0,b.width,b.height);return {c,w:b.width,h:b.height};}
function fitBounds(w,h,bounds,pad=30){let [x0,x1,y0,y1]=bounds;const s=Math.min((w-2*pad)/(x1-x0),(h-2*pad)/(y1-y0));const cx=(x0+x1)/2,cy=(y0+y1)/2;return {s,cx,cy,xy:(x,y)=>[w/2+(x-cx)*s,h/2-(y-cy)*s],inv:(x,y)=>[cx+(x-w/2)/s,cy-(y-h/2)/s]};}
function poly(c,points){c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));}
function text(c,str,x,y,style={}){c.font=style.font||'11px Arial,sans-serif';c.fillStyle=style.color||'#6c8185';c.textAlign=style.align||'left';c.textBaseline='middle';c.fillText(str,x,y);}
function grid(c,w,h,P,step=Math.max(10,Math.ceil(32/P.s/10)*10)){c.save();c.strokeStyle='#dde6e580';c.lineWidth=1;const [loX,hiY]=P.inv(0,0),[hiX,loY]=P.inv(w,h);for(let x=Math.ceil(loX/step)*step;x<hiX;x+=step){const a=P.xy(x,loY),b=P.xy(x,hiY);poly(c,[a,b]);c.stroke();}for(let y=Math.ceil(loY/step)*step;y<hiY;y+=step){poly(c,[P.xy(loX,y),P.xy(hiX,y)]);c.stroke();}c.restore();}
function drawWorld(c,w,h,P){const S=window.NOMAD_SCENE_DATA;grid(c,w,h,P);if(S){for(const tree of S.trees||[]){const p=P.xy(tree.pose[0],tree.pose[1]);c.fillStyle='#568c6922';c.beginPath();c.arc(...p,Math.max(2,1.1*P.s),0,Math.PI*2);c.fill();c.strokeStyle='#77977a35';c.lineWidth=.6;c.stroke();}const a=P.xy(-14,11),b=P.xy(26,-11);c.fillStyle='#ebeeec';c.fillRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);for(const box of S.boxes||[]){if(/roof|floor|light/i.test(box.name))continue;const p=P.xy(box.pose[0],box.pose[1]),sx=box.size[0]*P.s,sy=box.size[1]*P.s;c.save();c.translate(...p);c.rotate(-(box.pose[5]||0));c.fillStyle=/wall/i.test(box.name)?'#8d9a9c':'#bdc8c5';c.fillRect(-sx/2,-sy/2,sx,sy);c.restore();}c.save();c.setLineDash([5,5]);c.strokeStyle='#ce646755';c.lineWidth=1;c.strokeRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);c.restore();text(c,'FACTORY',...P.xy(6,1),{font:'600 12px Arial',color:'#8f9c9d',align:'center'});text(c,'무지 통로',...P.xy(-5,-7),{font:'10px sans-serif',color:'#a9b3b2',align:'center'});text(c,'무지 통로',...P.xy(-5,7),{font:'10px sans-serif',color:'#a9b3b2',align:'center'});}
}
const gt=D.series.gt;const mapBounds=[Math.min(-35,...gt.map(r=>r[1]))-3,Math.max(29,...gt.map(r=>r[1]))+2,Math.min(-14,...gt.map(r=>r[2]))-3,Math.max(23,...gt.map(r=>r[2]))+3];
function path(c,rows,t,P,color,dashed=false,width=2.3){c.save();c.strokeStyle=color;c.lineWidth=width;c.lineJoin='round';c.lineCap='round';c.setLineDash(dashed?[5,5]:[]);c.beginPath();let started=false;for(let i=0;i<rows.length&&rows[i][0]<=t;i++){const p=P.xy(rows[i][1],rows[i][2]);if(!started){c.moveTo(...p);started=true;}else c.lineTo(...p);}const a=sample(rows,t,true,true);if(a&&started)c.lineTo(...P.xy(a[1],a[2]));c.stroke();c.restore();}
function point(c,p,color,r=4){c.save();c.beginPath();c.arc(...p,r+2,0,Math.PI*2);c.fillStyle='#fff';c.fill();c.beginPath();c.arc(...p,r,0,Math.PI*2);c.fillStyle=color;c.fill();c.restore();}
function arrow(c,p,yaw,color){c.save();c.translate(...p);c.rotate(-yaw);c.beginPath();c.moveTo(8,0);c.lineTo(-6,-5);c.lineTo(-3,0);c.lineTo(-6,5);c.closePath();c.fillStyle=color;c.fill();c.strokeStyle='#fff';c.lineWidth=1.5;c.stroke();c.restore();}
function edgeMarker(c,w,h,P,p,label,color){
 const q=P.xy(p[1],p[2]),margin=18;if(q[0]>=margin&&q[0]<=w-margin&&q[1]>=margin&&q[1]<=h-margin)return false;
 const dx=q[0]-w/2,dy=q[1]-h/2,k=Math.min((w/2-margin)/Math.max(Math.abs(dx),1e-9),(h/2-margin)/Math.max(Math.abs(dy),1e-9)),x=w/2+dx*k,y=h/2+dy*k;
 arrow(c,[x,y],Math.atan2(-dy,dx),color);
 const anchor=x>w/2?'right':'left',tx=x+(x>w/2?-14:14),ty=Math.min(h-47,Math.max(48,y));
 const lines=String(label).split('\n');
 c.save();c.font='600 11px Arial,sans-serif';const width=Math.max(...lines.map(t=>c.measureText(t).width))+14;
 c.fillStyle='#fffaf2ed';c.fillRect(anchor==='right'?tx-width+7:tx-7,ty-10,width,lines.length*15+5);c.restore();
 lines.forEach((t,i)=>text(c,t,tx,ty+i*15,{color,font:(i?'':'600 ')+'11px Arial,sans-serif',align:anchor}));return true;
}
function eventMarker(c,P,event,now){if(now<event.t)return;const q=sample(gt,event.t),p=P.xy(q[1],q[2]);c.save();c.strokeStyle=colors.red;c.lineWidth=1.8;if(event.type==='loss'){poly(c,[[p[0]-4,p[1]-4],[p[0]+4,p[1]+4]]);c.stroke();poly(c,[[p[0]-4,p[1]+4],[p[0]+4,p[1]-4]]);c.stroke();}else{c.beginPath();c.arc(...p,5,0,Math.PI*2);c.stroke();}text(c,event.type==='loss'?'GNSS 소실':'GNSS 재수신',p[0]-9,p[1]+(event.type==='loss'?16:-15),{color:colors.red,font:'600 10px sans-serif',align:'right'});c.restore();}
function drawMapCloud(c,P){
 if(!state.cloud||!state.visible.ours)return;const o=sample(D.series.ours,state.t,true,true);if(!o)return;
 const radius=window.nomadCloudRadius(state.t,D.phases);
 const q=P.xy(o[1],o[2]),r=radius*P.s;c.save();c.translate(...q);c.rotate(-o[4]-.45);c.scale(1,.7);
 const g=c.createRadialGradient(0,0,0,0,0,r*1.6);g.addColorStop(0,'#007fae60');g.addColorStop(.45,'#007fae2d');g.addColorStop(1,'#007fae00');c.fillStyle=g;c.beginPath();c.arc(0,0,r*1.6,0,Math.PI*2);c.fill();
 [.55,1,1.45].forEach((k,i)=>{c.strokeStyle=['#007fae88','#007fae55','#007fae33'][i];c.lineWidth=1;c.beginPath();c.arc(0,0,r*k,0,Math.PI*2);c.stroke();});c.restore();
}

function drawMap(){if(state.mapView==='xyz'&&window.drawNomadTrajectory3D){window.drawNomadTrajectory3D($('map'),{t:state.t,series:D.series,visible:state.visible,cloud:state.cloud,phases:D.phases,events:D.events,modeled:state.imuMode==='model'});return;}const {c,w,h}=canvasSize($('map')),P=fitBounds(w,h,mapBounds,30);drawWorld(c,w,h,P);drawMapCloud(c,P);for(const name of ['gt','imu','ours'])if(state.visible[name])path(c,D.series[name],state.t,P,colors[name],name==='gt',name==='ours'?2.8:1.8);for(const event of D.events.filter(e=>['loss','regain'].includes(e.type)))eventMarker(c,P,event,state.t);for(const name of ['gt','imu','ours']){const p=sample(D.series[name],state.t,true,name==='ours');if(!p||!state.visible[name])continue;if(!edgeMarker(c,w,h,P,p,name==='imu'?'IMU · 맵 밖\nGT에서 수평 '+Math.hypot(p[1]-sample(gt,state.t)[1],p[2]-sample(gt,state.t)[2]).toFixed(1)+' m':'',colors[name])){if(name==='gt')arrow(c,P.xy(p[1],p[2]),p[4],colors.gt);else {point(c,P.xy(p[1],p[2]),colors[name],name==='ours'?4.5:3);if(name==='imu'){const pos=P.xy(p[1],p[2]),dz=p[3]-sample(gt,state.t)[3];text(c,'IMU · Δz '+dz.toFixed(0)+' m',pos[0]+(pos[0]>w*.7?-9:9),Math.max(44,Math.min(h-38,pos[1]-12)),{color:colors.imu,font:'600 10px Arial',align:pos[0]>w*.7?'right':'left'});}}}}
const unit=[10,20,50,100,200,500,1000].find(v=>v*P.s>=35)||1000,scale=unit*P.s,xx=18,yy=h-20;poly(c,[[xx,yy-3],[xx,yy],[xx+scale,yy],[xx+scale,yy-3]]);c.strokeStyle='#8b9c9f';c.lineWidth=1;c.stroke();text(c,unit+' m',xx+scale/2,yy-10,{font:'10px Arial',align:'center'});text(c,'N ↑',w-23,20,{font:'600 11px Arial',color:'#637b80',align:'right'});}
let errorRows=[],maxError=180;
function refreshErrors(){errorRows=D.telemetry.map(row=>{const g=sample(gt,row[0]),o=sample(D.series.ours,row[0],true,true),m=sample(D.series.imu,row[0]);return [row[0],g&&o?Math.hypot(o[1]-g[1],o[2]-g[2],o[3]-g[3]):null,g&&m?Math.hypot(m[1]-g[1],m[2]-g[2],m[3]-g[3]):null];});
maxError=Math.ceil(Math.max(1,...errorRows.flatMap(r=>[r[1]||0,r[2]||0]))/20)*20;}
refreshErrors();
function drawErrors(){const {c,w,h}=canvasSize($('errors'));if(!w||!h)return;const L=29,R=8,T=8,B=17,y=v=>h-B-(v/maxError)*(h-T-B),x=t=>L+t/duration*(w-L-R),loss=D.events.find(e=>e.type==='loss').t,regain=D.events.find(e=>e.type==='regain').t;
 c.fillStyle='#cf515509';c.fillRect(x(loss),T,x(regain)-x(loss),h-T-B);c.strokeStyle='#dfe7e7';c.lineWidth=.7;for(const v of [0,maxError/2,maxError]){poly(c,[[L,y(v)],[w-R,y(v)]]);c.stroke();text(c,String(v),L-5,y(v),{align:'right',font:'9px Arial',color:'#87979b'});}
 for(const [name,col]of [['ours',1],['imu',2]]){if(!state.visible[name])continue;c.beginPath();c.strokeStyle=colors[name];c.lineWidth=2;let started=false,last=null;for(const r of errorRows){if(r[0]>state.t)break;if(r[col]===null){started=false;continue;}if(!started){c.moveTo(x(r[0]),y(r[col]));started=true;}else c.lineTo(x(r[0]),y(r[col]));last=r;}c.stroke();if(last)point(c,[x(last[0]),y(last[col])],colors[name],2.5);}
 poly(c,[[x(state.t),T],[x(state.t),h-B]]);c.strokeStyle='#607c8155';c.lineWidth=1;c.stroke();for(const t of [0,100,200])if(t<=duration)text(c,String(t),x(t),h-6,{align:t===0?'left':t===200?'right':'center',font:'9px Arial',color:'#87979b'});
}
const messages=['야지에서 GNSS와 VIO의 전역 좌표를 연결합니다.','공장 진입 · GNSS가 끊기고 추적 특징점이 줄어듭니다.','특징점 회복 · 추적은 이어지지만 누적된 전역 오차는 남습니다.','내부 U턴 · GNSS 없이 VIO 상대 이동으로 추정을 이어갑니다.','출구 통과 · 무지 통로에서 특징점이 다시 줄어듭니다.','GNSS 재수신 · 절대 위치 관측이 전역 추정을 보정합니다.'];
function updateUI(){const tel=telemetry(state.t),phase=Math.max(0,phaseAt(state.t)),o=sample(D.series.ours,state.t,true,true),g=sample(gt,state.t),im=sample(D.series.imu,state.t);$('timeline').value=state.t;$('timeLabel').textContent=timeText(state.t);$('oursError').innerHTML=(o&&g?Math.hypot(o[1]-g[1],o[2]-g[2],o[3]-g[3]).toFixed(2):'—')+'<small>m</small>';$('imuError').innerHTML=(im&&g?Math.hypot(im[1]-g[1],im[2]-g[2],im[3]-g[3]).toFixed(2):'—')+'<small>m</small>';
const valid=tel[4],known=valid!==null&&tel[5]!==null&&tel[5]<=D.meta.gnssStaleS;$('gnssStatus').className='status '+(known?(valid?'good':'bad'):'');$('gnssStatus').innerHTML='<i></i>GNSS '+(known?(valid?'수신':'소실'):'대기');const n=tel[1],fresh=n!==null&&tel[3]!==null&&tel[3]<=D.meta.featureStaleS;$('featureStatus').className='status '+(fresh?(n<30?'warn':'good'):'');$('featureStatus').innerHTML='<i></i>추적점 '+(fresh?Math.round(n)+'개':'대기');
let msg=messages[phase];if(state.t<D.meta.firstOursT)msg='초기 정렬 중 · '+D.meta.firstOursT.toFixed(1)+'초부터 Ours 전역 출력이 시작됩니다.';const jump=D.events.find(e=>e.type==='jump');if(state.t>=jump.t&&state.t-jump.t<2)msg='GNSS 복귀 후 실제 위치 보정 · '+jump.distanceM.toFixed(2)+' m 이동';$('phaseMessage').textContent=msg;
if(phase!==previousPhase){document.querySelectorAll('.phase').forEach((b,i)=>{b.classList.toggle('active',i===phase);b.classList.toggle('past',i<phase);b.setAttribute('aria-current',i===phase?'step':'false');});previousPhase=phase;}
 $('sampleStamp').textContent=timeText(state.t)+' · 탑뷰와 동기 재생';$('videoTimeLabel').textContent=timeText(state.t);$('videoTimeline').value=state.t;
 if($('sampleDialog').open)$('sampleTitle').textContent=D.phases[phase].name+' · 실제 특징점';
 if(scene){const p=sample(D.series.gt_base,state.t);if(p)scene.update(poseObject(p),D.phases[phase],state.t);}drawMap();drawErrors();}
function setTime(t){state.t=Math.max(0,Math.min(duration,t));syncVideos(true);renderRequired=true;}
function setPlaying(on){state.playing=on;if(on&&state.t>=duration)setTime(0);$('playIcon').textContent=on?'Ⅱ':'▶';$('playText').textContent=on?'정지':'재생';$('playBtn').setAttribute('aria-label',on?'정지':'재생');$('videoPlayBtn').textContent=on?'정지':'재생';syncVideos(true);}
$('phases').innerHTML=D.phases.map((p,i)=>`<button class="phase" data-index="${i}" title="${p.note}"><span class="number">0${i+1}</span><span><strong>${p.name}</strong><small>${p.subtitle}</small></span></button>`).join('');
document.querySelectorAll('.phase').forEach(b=>b.addEventListener('click',()=>{setTime(D.phases[+b.dataset.index].start+.12);setPlaying(false);}));
$('playBtn').onclick=()=>setPlaying(!state.playing);$('resetBtn').onclick=()=>{setPlaying(false);setTime(0);};$('timeline').max=duration;$('timeline').oninput=e=>setTime(+e.target.value);$('durationLabel').textContent=timeText(duration);$('speed').onchange=e=>{state.speed=+e.target.value;syncVideos(true);};$('videoTimeline').max=duration;$('videoTimeline').oninput=e=>setTime(+e.target.value);$('videoPlayBtn').onclick=()=>setPlaying(!state.playing);
$('timelineEvents').innerHTML=D.events.filter(e=>['loss','regain'].includes(e.type)).map(e=>`<span class="timeline-event" style="left:${e.t/duration*100}%" title="${e.label}"></span>`).join('');
document.querySelectorAll('[data-series]').forEach(b=>b.onclick=()=>{const k=b.dataset.series;state.visible[k]=!state.visible[k];b.setAttribute('aria-pressed',state.visible[k]);renderRequired=true;});
function selectImu(mode){
 state.imuMode=mode==='model'&&MODEL?'model':'original';
 D.series={...SOURCE.series,imu:state.imuMode==='model'?MODEL.series:SOURCE.series.imu};
 $('imuSource').value=state.imuMode;
 $('imuLegend').textContent=state.imuMode==='model'?'IMU · 오차 모델':'IMU · 원본';
 $('recordTag').innerHTML='<i></i>'+ (state.imuMode==='model'?'실제 기록 + IMU 오차 모델':'실제 기록 재생');
 $('methodNote').textContent=state.imuMode==='model'?'GT·Ours: 원본 기록 · IMU만 가정한 센서 오차를 추가해 재적분':'Ours: Ceres 윈도우 최적화 · IMU: 원본 센서 단순 적분';
 refreshErrors();renderRequired=true;
}
$('imuSource').onchange=e=>selectImu(e.target.value);
document.querySelectorAll('[data-map-view]').forEach(b=>b.onclick=()=>{state.mapView=b.dataset.mapView;document.querySelector('.map-panel').dataset.view=state.mapView;document.querySelectorAll('[data-map-view]').forEach(v=>v.setAttribute('aria-pressed',v===b));renderRequired=true;});
selectImu(state.imuMode);
$('cloudBtn').onclick=()=>{state.cloud=!state.cloud;$('cloudBtn').setAttribute('aria-pressed',state.cloud);renderRequired=true;};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;scene?.setMode(state.mode);document.querySelectorAll('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',x===b));renderRequired=true;});
$('roofBtn').onclick=()=>{state.roof=!state.roof;scene?.setRoof(state.roof);$('roofBtn').setAttribute('aria-pressed',state.roof);$('roofBtn').textContent=state.roof?'지붕 숨기기':'지붕 보기';};
$('fullBtn').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.();};
$('dataInfo').innerHTML=`<h3>실제 기록</h3><p>${D.meta.sourceDate} · ${D.meta.mapVersion}<br>GT 경로 ${D.summary.pathLengthM.toFixed(1)} m / GNSS 소실 ${D.summary.outageDurationS.toFixed(1)} s.<br>기존 시뮬레이션의 기록을 재생합니다. 숲·경사를 추가한 v2 재시험 결과는 아닙니다.</p><h3>GT · Ours · IMU</h3><p>같은 월드 좌표와 GNSS 안테나 위치로 비교합니다. Ours는 Basalt의 상대 이동과 GNSS를 결합한 Ceres 최적화 출력입니다. GT를 이용한 사후 정렬은 하지 않았으며, 기록에 있는 보정 점프를 유지합니다.</p><p>원본 IMU는 최초 GT 위치·자세와 정지 속도로 초기화하고, 최초 3초의 gyro 평균을 보정한 단순 적분입니다. 이후 위치 보정은 없습니다. 탑뷰 궤적은 XY 좌표이고, 아래 오차 수치와 그래프는 XYZ 전체 거리입니다. 원본 IMU는 마지막에 수평 약 29 m, 높이 약 173 m 오차를 보여 전체 약 175 m로 발산합니다. 수평 오차만은 단조 증가하지 않으며, 실제 값을 그대로 표시합니다.</p><h3>IMU 센서 오차 모델</h3><p>기본 주황색 궤적은 원본 IMU 관측에 가정한 잔여 바이어스와 백색잡음을 추가한 뒤 다시 적분한 결과입니다. GT·Ours와 원본 IMU 결과는 변경하지 않았습니다. Ours에는 이 추가 오차를 넣어 재실험하지 않았으므로, 이 모드는 동일 센서 조건의 성능 비교가 아닙니다. ‘IMU 입력’에서 원본과 비교할 수 있습니다. 이 설정은 특정 장비의 측정값이나 데이터시트 보증값이 아닙니다.</p><p>가속도 잔여 바이어스 (X,Y,Z): (0.01, −0.01, 0.005) m/s²<br>각속도 잔여 바이어스: (0.001, −0.001, 0.005) °/s<br>표본별 백색잡음 σ: 가속도 0.02 m/s² · 각속도 0.01 °/s (200 Hz)<br>초기 3초 보정 후 적용 · 난수 seed 42. 자세 오차가 중력 제거에 영향을 주고, 가속도 오차를 두 번 적분하면서 위치 오차가 누적됩니다.</p><h3>불확실성 구름</h3><p>시나리오의 GNSS 소실·특징점 부족 구간에서 경과 시간만큼 커지고, 특징점 회복 구간에서는 누적 크기를 유지합니다. 다시 특징점이 부족해지면 이어서 커지고, GNSS 재수신 후에는 연속적으로 줄어듭니다. 구간에 따른 설명용 크기이며, 실제 특징점 수로 추정한 공분산은 아닙니다. 실제 Opti 공분산·신뢰구간·입자 필터 출력이 아니며 면적이나 밀도를 확률로 해석하지 않습니다. 특징점 회복이 이미 누적된 위치 오차의 소거를 뜻하지도 않습니다.</p><h3>3D와 카메라 이미지</h3><p>3D 화면은 시험에 쓰인 맵 형상과 기록된 GT 이동을 브라우저에서 재현합니다. Gazebo 실시간 영상이 아닙니다. 오른쪽 영상은 원본 rosbag 카메라와 같은 촬영 시각의 Basalt 추적점을 겹친 15 fps 연속 영상입니다. 탑뷰·3D와 같은 시간으로 재생하며, 클릭하면 확대됩니다. 초기 카메라 미수신과 특징점 미출력 구간도 표시합니다.</p><h3>화면 조작</h3><p>구간 이름으로 이동 · 범례로 궤적 켜기/끄기 · Space 재생/정지 · 방향키 5초 이동 · 3D 드래그/휠 · 전체 화면.</p><p>상세 원본 연결은 함께 제공한 <code>provenance.json</code>에 보관했습니다.</p>`;
$('infoBtn').onclick=()=>$('infoDialog').showModal();
$('sampleBtn').onclick=()=>{$('sampleDialog').showModal();syncVideos(true);renderRequired=true;};$('sampleDialog').addEventListener('close',()=>syncVideos(true));
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||['INPUT','SELECT','BUTTON'].includes(document.activeElement.tagName))return;if(e.code==='Space'){e.preventDefault();setPlaying(!state.playing);}if(e.code==='ArrowRight'){e.preventDefault();setTime(state.t+5);}if(e.code==='ArrowLeft'){e.preventDefault();setTime(state.t-5);}});
try{if(!window.THREE||!window.createNomadScene)throw new Error('3D 모듈을 찾을 수 없습니다.');scene=window.createNomadScene($('scene'));scene.setRoof(false);window.nomadScene=scene;}catch(e){$('sceneFallback').hidden=false;$('sceneFallback').textContent='3D를 열 수 없습니다. WebGL을 지원하는 브라우저에서 열어 주세요.';console.error(e);}
new ResizeObserver(()=>{renderRequired=true;scene?.resize();}).observe(document.querySelector('main'));
function animate(now){const dt=lastTime?Math.min((now-lastTime)/1000,.1):0;lastTime=now;if(scene?.getMode&&scene.getMode()!==state.mode){state.mode=scene.getMode();document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===state.mode));}if(state.playing){state.t=Math.min(duration,state.t+dt*state.speed);renderRequired=true;if(state.t>=duration)setPlaying(false);}if(renderRequired){updateUI();renderRequired=false;}if(now-lastVideoSync>250){syncVideos();lastVideoSync=now;}requestAnimationFrame(animate);}requestAnimationFrame(animate);
window.NOMAD_DEMO={setTime,play:()=>setPlaying(true),pause:()=>setPlaying(false),getState:()=>({...state}),data:D,render:()=>{updateUI();}};
// Meeting pointers use map coordinates, independently of the receiver's viewport size.
window.NomadPingAdapters=()=>[{id:'trajectory-map',canvas:$('map'),
  pick:(x,y)=>{if(state.mapView==='xyz')return null;const r=$('map').getBoundingClientRect();return fitBounds(r.width,r.height,mapBounds,30).inv(x-r.left,y-r.top);},
  project:point=>{const r=$('map').getBoundingClientRect(),p=fitBounds(r.width,r.height,mapBounds,30).xy(...point);return {x:r.left+p[0],y:r.top+p[1]};}
}];

})();
