// One world, one clock. All views share object positions; masks apply illustrative classification errors.
const linkedStyle=document.createElement('link');linkedStyle.rel='stylesheet';linkedStyle.href='linked.css';document.head.append(linkedStyle);
const chaseSection=document.createElement('section');chaseSection.className='chase-section';
chaseSection.innerHTML='<div class="chase-heading"><h2>3인칭 주행 뷰</h2><span>동일 장면 · 설명용 렌더링</span></div><div class="chase-stage"><canvas id="chase" width="1280" height="600" aria-label="상단과 같은 장면의 3인칭 주행"></canvas><div class="chase-hud"><span id="chase-mode"></span><b id="chase-action"></b></div><div class="chase-clock" id="chase-clock"></div></div><p class="chase-foot">상단은 차량 카메라 시점 / 하단은 같은 차량을 뒤에서 보는 시점</p>';
document.querySelector('main.shell').append(chaseSection);
const chaseCtx=document.getElementById('chase').getContext('2d');
let trackingPanel=null;
if(kind==='dynamic'){
 trackingPanel=document.createElement('section');trackingPanel.className='tracking-panel';trackingPanel.hidden=true;
 trackingPanel.innerHTML='<div class="tracking-title"><b>추적'+'·이력 방어 내부 동작</b><small>설계 설명용 · 특징점 위치와 관측값은 연출</small></div><div class="tracking-grid"><article><span>① 원본 영상의 특징점 추적</span><strong id="track-id"></strong><p id="track-state"></p></article><article class="history-article"><span>② 최근 관측 · 오래된 기록부터</span><div id="track-history" class="track-history"></div><p>분할이 잘려도 ID는 유지 · 오래된 기록은 제거</p></article><article><span>③ 진행 영역의 비용</span><div class="cost-bar"><i id="track-cost"></i></div><strong id="cost-label"></strong><p id="cost-detail"></p></article><article><span>④ 후속 판단</span><strong id="track-decision"></strong><p>색상 마스크를 수정하는 대신 주행 비용에 반영</p></article></div>';
 document.querySelector('.player').insertAdjacentElement('afterend',trackingPanel);
 const record=document.createElement('div');record.id='track-record';record.className='track-record';trackingPanel.append(record);
}
function personWorldX(t){return -3+Math.min(t/4,1)*3+Math.max(0,Math.min((t-5.5)/3.5,1))*5}
function personWalking(t){return t<4||(t>=5.5&&t<9)}
function personObservation(t){if(t<.4)return '대기';if(t>=9)return '통로 비움';if((t>=2.2&&t<4)||(t>=5.5&&t<8.5)){return ['부분 분할','사람','노면 오분류'][Math.floor((t-2.2)/.35)%3]}return '사람'}
function guardedCost(t){if(t<.4)return 0;if(t<2.2)return 75;if(t<9)return 95;if(t<10)return 95*(1-(t-9));return 0}
const thirdBuffer=document.createElement('canvas');thirdBuffer.width=960;thirdBuffer.height=450;
const thirdCtx=thirdBuffer.getContext('2d');
// Deterministic world-anchored surface details: no scrolling texture or camera-relative stripes.
const groundRandom=n=>{const v=Math.sin(n*127.17+37.61)*43758.5453;return v-Math.floor(v)};
const soilDetails=Array.from({length:420},(_,i)=>({x:(groundRandom(i*7)-.5)*6,z:-14+groundRandom(i*7+1)*105,rx:.04+groundRandom(i*7+2)*.48,rz:.06+groundRandom(i*7+3)*.65,tint:i%5,angle:groundRandom(i*7+4)*6.28}));
const gravelDetails=Array.from({length:55},(_,i)=>({x:(groundRandom(i*9+600)-.5)*5.9,z:-8+groundRandom(i*9+601)*83,s:.045+groundRandom(i*9+602)*.15}));
let worldFrameKey='',viewRevision=0,lowerVisible=true,upperVisible=true;
if(typeof IntersectionObserver!=='undefined'){
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.target===chaseSection)lowerVisible=entry.isIntersecting;else upperVisible=entry.isIntersecting}viewRevision++},{rootMargin:'120px'});
 observer.observe(chaseSection);observer.observe(document.querySelector('.screens'));
}
function vehiclePose(t){
 const id=mode[0];let x=0,z=0,action='접근';
 if(kind==='dynamic'){const release=id==='guarded'?10:9;z=Math.min(t,3)*1.35;action=t<3?'감속하며 접근':t<release?'사람 통과 대기':'통로 확보 · 재출발';if(id==='partial'&&t>=2.8){z=Math.min(8.65,3.78+(t-2.8)*4.2);action=z>=8.65?'접촉 · 정지':'신체를 노면으로 오판 · 직진'}else if(t>=release){const s=t-release;z=4.05+2.5*(s<.5?s*s:s-.25)}if(id==='guarded'&&t>=2.2&&t<9)action='ID 1 위치 갱신 · 높은 비용 → 대기';if(id==='guarded'&&t>=9&&t<10)action='통로 비움 확인 · 비용 감소';}
 else if(id==='miss'){z=Math.min(8.35,t*2);action=z>=8.35?'접촉 · 정지':'장애물을 노면으로 판단 · 직진'}
 else if(id==='small'){z=Math.min(8.5,t*2);x=.7*Math.sin(Math.min(z/18,1)*Math.PI);action=z>=8.5?'측면 접촉 · 정지':'점유 영역 과소평가'}
 else if(id==='false'){
  const u=Math.max(0,Math.min(1,t-2));z=t<2?t*2:4+2*u-u*u;
  action=t<2?'접근':t<3?'노면 오분류 → 감속':t<3.3?'정지 · 진동 안정 중':t<4.2?'안정된 영상으로 길·장애물 재확인':'길 확보 → 저속 재출발';
  if(t>=4.2){const s=t-4.2;z=5+(s<.8?.5*s*s/.8:s-.4);const a=Math.min(1,s);x=2.1*Math.exp(-Math.pow((z-10)/3,2))*a*a*(3-2*a);if(z>7)action='저속으로 바위 우회';if(z>13)action='우회 완료'}
 }
 else{z=t*1.8;x=2.1*Math.exp(-Math.pow((z-10)/4,2));action=z>14?'우회 완료':z>4?'장애물 우회':'접근';if(kind==='rough'&&t>2&&t<8)action='시간적 보정 · 장애물 영역 유지'}
 return {x,z,action};
}
function roughMotionSeverity(t){
 if(kind!=='rough')return 0;
 if(mode[0]==='false'&&t>=4.2){const s=Math.min(1,(t-4.2)/.8);return .08*s*s*(3-2*s)}
 const stop=mode[0]==='false'?3:mode[0]==='miss'?8.35/2:mode[0]==='small'?8.5/2:Infinity;
 if(t>=stop){const elapsed=t-stop;if(elapsed>=.3-1e-9)return 0;return roughSeverity(stop)*Math.pow(1-elapsed/.3,3)}
 const a=vehiclePose(Math.max(0,t-.01)),b=vehiclePose(t+.01),speed=Math.hypot(b.x-a.x,b.z-a.z)/.02;
 return roughSeverity(t)*Math.min(1,speed/1.5);
}
function renderWorld(ctx,W,H,view){
 const t=time,car=vehiclePose(t),mask=view==='mask',first=view==='camera'||mask,severity=roughMotionSeverity(t);
 const distortion=mask?severity*(mode[0]==='success'?.10:1):0;
 const palette={sky:'#4c88b6',dense_vegetation:'#11952f',unpaved_surface:'#b7a184',natural_obstacle:'#6e4a2e',person:'#e71d3d'};let category='dense_vegetation';
 ctx.save();ctx.clearRect(0,0,W,H);if(view==='camera'&&severity>0)ctx.translate(Math.sin(t*35)*7*severity,Math.cos(t*28)*4*severity);
 const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#bad5da');sky.addColorStop(1,'#e9e9d5');ctx.fillStyle=mask?palette.sky:sky;ctx.fillRect(-15,-15,W+30,H+30);
 const cam=first?{x:car.x,y:1.35,z:car.z+.8}:{x:car.x*.65,y:5.8,z:car.z-10};const pitch=first?.13:.30,cp=Math.cos(pitch),sp=Math.sin(pitch),f=W*(first?.70:.57),centerY=H*(first?.48:.34);
 function project(p){const dx=p[0]-cam.x,dy=p[1]-cam.y,dz=p[2]-cam.z,d=dz*cp-dy*sp;if(d<.12)return null;return [W/2+dx*f/d,centerY-(dy*cp+dz*sp)*f/d,d]}
 const faces=[];let terrainLayer=2;
 function face(vertices,color){let verts=vertices,cls=category;if(mask){const avg=verts.reduce((a,p)=>[a[0]+p[0]/verts.length,a[1]+p[1]/verts.length,a[2]+p[2]/verts.length],[0,0,0]);if(cls==='person'&&['partial','guarded'].includes(mode[0])&&personWalking(t)&&avg[1]<(personObservation(t)==='노면 오분류'?1.9:personObservation(t)==='부분 분할'?1.55:0))cls='unpaved_surface';if(cls==='natural_obstacle'){if(mode[0]==='miss'&&(kind==='static'||severity>.3))cls='unpaved_surface';if(mode[0]==='small'&&(Math.abs(avg[0])>.3||avg[1]<.4))cls='unpaved_surface';if(kind==='rough'&&severity>.1&&mode[0]!=='success'&&Math.sin(avg[0]*7+avg[1]*9+t*4)>1-severity)cls='unpaved_surface'}if(cls==='unpaved_surface'&&kind==='rough'&&mode[0]==='false'&&severity>.1&&Math.sin(avg[2]*1.5+t*3)+Math.cos(avg[0]*2)>1.6-severity)cls='dense_vegetation';if(distortion>0&&category!=='person')verts=verts.map(p=>[p[0]+distortion*.32*Math.sin(p[2]*4+p[0]*2+t*9),p[1],p[2]+distortion*.12*Math.cos(p[0]*6+t*8)]);color=palette[cls]||palette.dense_vegetation}const ps=verts.map(project);if(ps.some(p=>!p))return;faces.push({ps,color,layer:terrainLayer,d:ps.reduce((a,p)=>a+p[2],0)/ps.length})}
 function cube(x,y,z,w,h,l,colors){const p=[[x-w/2,y,z-l/2],[x+w/2,y,z-l/2],[x+w/2,y,z+l/2],[x-w/2,y,z+l/2],[x-w/2,y+h,z-l/2],[x+w/2,y+h,z-l/2],[x+w/2,y+h,z+l/2],[x-w/2,y+h,z+l/2]];[[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]].forEach((a,i)=>face(a.map(j=>p[j]),colors[i%colors.length]))}
 // Terrain stays fixed in world coordinates while cameras move with the car.
 const step=mask&&distortion>.12?1.5:3,columns=mask&&distortion>.12?4:1;
 for(let z=Math.floor(cam.z/step)*step+step;z<cam.z+54;z+=step){terrainLayer=0;category='dense_vegetation';face([[-55,0,z],[55,0,z],[55,0,z+step],[-55,0,z+step]],'#67825b');terrainLayer=1;category='unpaved_surface';const edge=q=>kind==='rough'?3.05+.13*Math.sin(q*.81)+.07*Math.sin(q*2.17+.8):3.35,a=edge(z),b=edge(z+step);for(let j=0;j<columns;j++){const x0=-a+2*a*j/columns,x1=-a+2*a*(j+1)/columns,v0=-b+2*b*j/columns,v1=-b+2*b*(j+1)/columns;face([[x0,.03,z],[x1,.03,z],[v1,.03,z+step],[v0,.03,z+step]],kind==='rough'?'#a18b6c':'#bbaa87')}}
 terrainLayer=2;
 function stone(x,z,s){category='natural_obstacle';const ring=[],upper=[];for(let i=0;i<11;i++){const a=i*Math.PI*2/11,r=s*(.85+.16*Math.sin(i*4));ring.push([x+Math.cos(a)*r,.04,z+Math.sin(a)*r*.75]);upper.push([x+Math.cos(a)*r*.6,s*(.5+.18*Math.sin(i*1.7)),z+Math.sin(a)*r*.45])}for(let i=0;i<11;i++){const j=(i+1)%11;face([ring[i],ring[j],upper[j],upper[i]],['#71766d','#8d9286','#62695f'][i%3]);face([upper[i],upper[j],[x,.95*s,z]],['#a2a597','#7d8477','#b0b2a2'][i%3])}}
 if(kind==='rough'){
  category='unpaved_surface';
  if(!mask){
   const colors=['#8f7b60','#b09a77','#a48c6a','#786b56','#b49f7d'];
   for(const p of soilDetails){if(p.z<cam.z+.4||p.z>cam.z+30)continue;const verts=[];for(let k=0;k<7;k++){const a=k*6.283/7+p.angle,r=.72+.28*Math.sin(k*2.3+p.angle);verts.push([p.x+Math.cos(a)*p.rx*r,.044,p.z+Math.sin(a)*p.rz*r])}face(verts,colors[p.tint])}
   // Shallow, winding depressions run along the trail rather than across it.
   for(const side of [-1,1])for(let z=-12;z<80;z+=1.7){if(z<cam.z+.5||z>cam.z+28)continue;const a=side*.95+.15*Math.sin(z*.61)+.08*Math.cos(z*1.27),b=side*.95+.15*Math.sin((z+1.7)*.61)+.08*Math.cos((z+1.7)*1.27);face([[a-.08,.038,z],[a+.10,.038,z],[b+.08,.038,z+1.7],[b-.10,.038,z+1.7]],'#927e61')}
  }
  for(const p of gravelDetails){if(p.z<cam.z||p.z>cam.z+28)continue;stone(p.x,p.z,p.s)}
 }
 category='dense_vegetation';for(let i=0;i<28;i++)for(const side of [-1,1]){const z=i*4-6;if(z<cam.z)continue;const x=side*(4.4+(i*7%12)*.4);cube(x,0,z,.16,2,.16,['#5e5944']);const h=2.7+i%3*.4;for(let k=0;k<7;k++){const a=k*Math.PI*2/7,b=(k+1)*Math.PI*2/7;face([[x+Math.cos(a)*1.3,1.5,z+Math.sin(a)*1.3],[x+Math.cos(b)*1.3,1.5,z+Math.sin(b)*1.3],[x,h+1.5,z]],['#426b4d','#527b55','#3a6045'][k%3])}}
 if(kind==='dynamic'){category='person';const px=personWorldX(t);
  function limb(x0,y0,z0,x1,y1,z1,r,color){const rings=[];for(const [x,y,z]of [[x0,y0,z0],[x1,y1,z1]]){const ring=[];for(let i=0;i<9;i++){const a=i*Math.PI*2/9;ring.push([x+r*Math.cos(a),y,z+r*Math.sin(a)])}rings.push(ring)}for(let i=0;i<9;i++)face([rings[0][i],rings[0][(i+1)%9],rings[1][(i+1)%9],rings[1][i]],color)}
  const walking=personWalking(t),phase=t*8.5,swing=walking?Math.sin(phase)*.25:0,bob=walking?.025*(1+Math.cos(phase*2)):0;
  // Shared articulated pose for RGB and semantic rendering: feet alternate, knees bend, arms counter-swing.
  for(const side of [-1,1]){
   const hip=px+side*.10,knee=hip+side*swing*.45,foot=hip+side*swing,z=10+side*.09,lift=walking?Math.max(0,side*Math.cos(phase))*.12:0;
   limb(hip,.83+bob,z,knee,.44+lift*.25,z,.095,'#304553');limb(knee,.44+lift*.25,z,foot,.08+lift,z,.075,'#304553');
   limb(px+side*.23,1.38+bob,10+side*.11,px+side*.23-side*swing*.6,1.06+bob,10+side*.13,.065,'#bc6650');limb(px+side*.23-side*swing*.6,1.06+bob,10+side*.13,px+side*.23-side*swing,.79+bob,10+side*.12,.055,'#c78c69');
  }
  limb(px,.79+bob,10,px,1.43+bob,10,.23,'#bc6650');limb(px,1.43+bob,10,px,1.76+bob,10,.145,'#d1a27d');
 }else stone(0,10,.95);
 if(!first){category='natural_obstacle';const cy=.2+(kind==='rough'?.035*roughMotionSeverity(t)*Math.sin(t*22):0);for(const sx of [-.61,.61])for(const sz of [-.63,.63])cube(car.x+sx,.05,car.z+sz,.24,.48,.48,['#233129','#14201b','#39463d']);cube(car.x,cy,car.z,1.15,.38,1.75,['#245a48','#1d4539','#3f7c60']);cube(car.x,cy+.38,car.z+.15,.86,.25,.95,['#d6b65d','#aa914b','#f0d47b']);cube(car.x,cy+.63,car.z+.42,.08,.48,.08,['#3d4944']);cube(car.x,cy+1.06,car.z+.42,.36,.15,.13,['#172b26','#293e36','#8aaba0'])}
 faces.sort((a,b)=>a.layer-b.layer||b.d-a.d);for(const item of faces){ctx.fillStyle=item.color;ctx.beginPath();item.ps.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill();if(mask){ctx.strokeStyle=item.color;ctx.lineWidth=.6;ctx.stroke()}}ctx.restore();
 if(kind==='dynamic'&&mode[0]==='guarded'){
  const px=personWorldX(t);
  if(view==='camera'&&t>=.4){
   ctx.save();ctx.strokeStyle='#ffdc69';ctx.fillStyle='#ffdc69';ctx.lineWidth=1.3;
   for(let i=0;i<12;i++){const dx=(i%3-1)*.12,y=.23+Math.floor(i/3)*.40,legOffset=i<3&&personWalking(t)?Math.sin(t*8.5)*.1:0,p=project([px+dx+legOffset,y,9.82]),q=project([personWorldX(Math.max(.4,t-.18))+dx,y,9.82]);if(!p||!q)continue;ctx.beginPath();ctx.moveTo(q[0],q[1]);ctx.lineTo(p[0],p[1]);ctx.stroke();ctx.beginPath();ctx.arc(p[0],p[1],2.5,0,Math.PI*2);ctx.fill()}
   const label=project([px+.45,1.85,10]);if(label){ctx.font='bold 16px sans-serif';ctx.strokeStyle='#183c2c';ctx.lineWidth=3;ctx.strokeText('ID 1',label[0],label[1]);ctx.fillText('ID 1',label[0],label[1])}ctx.restore();
  }
  if(!first&&guardedCost(t)>0){
   const cost=guardedCost(t),cx=t>=9?0:px;const ring=[];for(let i=0;i<=36;i++){const a=i*Math.PI/18;const p=project([cx+Math.cos(a)*.95,.05,10+Math.sin(a)*1.1]);if(p)ring.push(p)}
   if(ring.length===37){ctx.save();ctx.fillStyle=`rgba(237,137,44,${cost/100*.24})`;ctx.strokeStyle=`rgba(241,130,40,${.25+cost/100*.65})`;ctx.lineWidth=3;ctx.beginPath();ring.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}
  }
 }
 if(!first&&car.action.includes('접촉')){ctx.strokeStyle='#e45541';ctx.lineWidth=7;ctx.strokeRect(4,4,W-8,H-8);const p=project([car.x,.6,car.z+.9]);if(p){ctx.strokeStyle='#ffd598';ctx.lineWidth=3;for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.beginPath();ctx.moveTo(p[0]+Math.cos(a)*10,p[1]+Math.sin(a)*10);ctx.lineTo(p[0]+Math.cos(a)*26,p[1]+Math.sin(a)*26);ctx.stroke()}}}
}
function updateTrackingPanel(){
 if(!trackingPanel)return;const enabled=mode[0]==='guarded';trackingPanel.hidden=!enabled;if(!enabled)return;
 const cost=guardedCost(time),end=Math.floor(time/.4);const samples=[];for(let i=Math.max(0,end-5);i<=end;i++){const t=i*.4,value=personObservation(t);samples.push(`<div class="history-chip ${value==='사람'?'person':value==='통로 비움'?'clear':'uncertain'}"><small>${t.toFixed(1)}s · ID 1</small><b>${value}</b><small>X ${personWorldX(t).toFixed(1)}</small></div>`)}
 document.getElementById('track-id').textContent=time<.4?'특징점 선택 대기':'ID 1 · 특징점 연결';
 document.getElementById('track-state').textContent=time>=9?'사람은 길 밖으로 이동':personWalking(time)?'걷는 중: 특징점 이동으로 현재 위치 갱신':'정지 중: 분할 안정 · 같은 ID 유지';
 const historyHtml=samples.join(''),history=document.getElementById('track-history');if(history.dataset.key!==historyHtml){history.innerHTML=historyHtml;history.dataset.key=historyHtml}document.getElementById('track-cost').style.width=cost+'%';
 document.getElementById('cost-label').textContent=time<2.2?'확인된 사람 영역':time<9?'인식 진동 → 비용 상향':time<10?'통로 비움 확인 → 점진 해제':'비용 해제';
 document.getElementById('cost-detail').textContent='비용 지수 '+Math.round(cost)+'/100 · 예시값, 충돌 확률 아님';
 document.getElementById('track-decision').textContent=vehiclePose(time).action;
 document.getElementById('track-record').textContent='ID 1  →  현재 관측: '+personObservation(time)+'  →  가상 위치 X: '+personWorldX(time).toFixed(2)+'  →  기록: '+samples.length+'/6  →  '+(time<9?'영역 유지 · 위치 갱신':time<10?'통로 관측 확인 · 비용 감소':'해제 · 재출발');
}
function renderLinkedWorld(){
 const key=mode[0]+'|'+time.toFixed(4)+'|'+viewRevision;if(key===worldFrameKey)return;worldFrameKey=key;
 updateTrackingPanel();
 if(upperVisible){renderWorld(ctxs[0],720,450,'camera');renderWorld(ctxs[1],720,450,'mask')}
 if(upperVisible||lowerVisible){renderWorld(thirdCtx,960,450,'third');if(upperVisible){ctxs[2].clearRect(0,0,720,450);ctxs[2].drawImage(thirdBuffer,120,0,720,450,0,0,720,450)}if(lowerVisible){chaseCtx.clearRect(0,0,1280,600);chaseCtx.drawImage(thirdBuffer,0,0,1280,600)}}
 const severity=roughMotionSeverity(time);
 const cameraFilter=severity>0?'blur('+(severity*3).toFixed(1)+'px)':'none';const maskFilter=severity>.1&&mode[0]!=='success'?'blur('+(severity*1.3).toFixed(1)+'px)':'none';
 if(ctxs[0].canvas.style.filter!==cameraFilter)ctxs[0].canvas.style.filter=cameraFilter;
 if(ctxs[1].canvas.style.filter!==maskFilter)ctxs[1].canvas.style.filter=maskFilter;
 const pose=vehiclePose(time);document.getElementById('chase-mode').textContent=mode[1];document.getElementById('chase-action').textContent=pose.action;document.getElementById('chase-clock').textContent=time.toFixed(1)+' / 12 s';document.getElementById('caption0').textContent='차량 탑재 카메라';document.getElementById('caption2').textContent=pose.action;
 let note='클래스별 마스크';
 if(kind==='rough')note=mode[0]==='success'?(time>2&&time<8?'현재 예측 + 이전 프레임 보정 → 경계·장애물 영역 유지':'시간적 보정 목표 예시'):mode[0]==='false'&&time>=3.3?(time<4.2?'입력 안정 → 잘못 번진 식생 마스크 해소 → 재확인':'노면·바위 재인식 → 바위를 피해 저속 재출발'):roughMotionSeverity(time)>.1?'블러 → 경계 번짐·클래스 혼동':'클래스 경계 안정';
 if(kind==='dynamic')note=['partial','guarded'].includes(mode[0])&&personWalking(time)&&time>=2.2?'동일한 원시 분할 오류: '+personObservation(time):'빨강: person / 베이지: 노면';
 if(kind==='static')note=mode[0]==='miss'?'처음부터 바위를 노면으로 오분류':mode[0]==='small'?'바위 가장자리 마스크 누락':'바위 전체를 자연 장애물로 분류';
 document.getElementById('caption1').textContent=note;
}
