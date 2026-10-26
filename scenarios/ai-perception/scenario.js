const kind=document.body.dataset.scenario;
const configs={
 static:{num:'01',title:'길 위 바위가, 길로 보인다면?',intro:'바위의 존재뿐 아니라 점유 영역을 얼마나 정확히 전달하는지가 중요합니다.',object:'바위',modes:[
 ['success','정상 인식','바위와 점유 영역을 인식','장애물 영역을 전달','후속 모듈이 여유를 두고 우회','장애물 정보가 유지되는 동안 우회 경로를 선택하는 예시입니다.'],
 ['miss','바위를 길로 오분류','바위 영역을 통행 가능 후보로 분류','장애물 영역이 전달되지 않음','전진하여 접촉할 위험','다른 모듈이 정상이어도, 전달되지 않은 장애물을 반드시 피할 수 있다고 볼 수 없습니다.'],
 ['small','장애물 영역 축소','바위를 실제보다 작게 분류','축소된 점유 영역을 전달','우회 여유가 부족해 접촉할 위험','영상 내 점유 영역 오류가 후속 경로 판단에 전달되는 상황입니다.']
 ],limits:'위치·크기·점유 영역은 영상 좌표 기준입니다. 실제 거리와 물리적 크기에는 깊이 정보 및 좌표 변환이 추가로 필요합니다.'},
 dynamic:{num:'02',title:'사람은 멈췄는데, 인식이 사라진다면?',intro:'사람이 길에 진입해 멈췄다가, 길 밖으로 이동하면 로봇이 다시 출발합니다.',object:'사람',modes:[
 ['success','연속 인식','사람의 진입·정지·이탈을 연속 인식','사람 점유 영역과 통로 확보를 후속 모듈이 확인','감속 → 정지·대기 → 통로 확보 후 재출발','0~4초 횡단, 4~7초 정지, 7~9초 길 밖으로 이동, 9~12초 로봇 재출발을 보여주는 가정 기반 예시입니다.'],
 ['partial','신체 일부를 길로 오분류','걷는 동안 신체 일부가 person과 노면 사이에서 변동','실제 신체가 있는 진행 공간을 길로 전달','길이 비어 보임 → 직진 → 사람과 접촉','추적·이력 방어 조건과 같은 원시 오류를 사용합니다. 현재 프레임만 보고 작은 사람 영역 밖을 길로 판단하는 설명용 예시입니다.'],
 ['guarded','같은 오류 + 추적·이력 방어','특징점으로 같은 사람을 연결하고 부분 분할 오류를 감지','인식 이력에 따라 불확실성 비용을 유지','대기 유지 → 통로 확보 확인 → 재출발','희소 Optical Flow 추적과 이력 기반 비용 갱신을 설명하는 예시입니다. 실제 LK 알고리즘이나 모델 추론 결과가 아닙니다.'],
 ],limits:'동일 물체 추적·이동 방향·속도 추정은 후속 모듈의 역할입니다. 누락 허용 시간과 재출발 조건은 가정이며 실제 설계값이 아닙니다.'},
 rough:{num:'03',title:'영상이 흐려져도, 길을 구분할 수 있을까?',intro:'거친 노면에서 입력 영상이 흔들리고 경계·질감이 번지는 상황입니다.',object:'장애물',modes:[
 ['success','시간적 보정 · 인식 유지','현재 예측과 움직임 보정한 이전 프레임을 결합','장애물 영역과 주요 노면 경계를 유지','순간적인 분류 오류를 줄이며 우회','시간적 보정의 목표 동작 예시입니다. 실제 알고리즘 구현·시험 결과는 아닙니다.'],
 ['miss','장애물을 길로 오분류','블러 구간에서 장애물 누락','통행 가능 후보로 전달','장애물 방향으로 전진할 위험','흐린 입력에서 잘못된 출력이 확신 있게 나오는 경우를 보여줍니다.'],
 ['false','길을 장애물로 오분류','흔들림으로 노면 경계를 잘못 분류','정지 후 안정된 영상에서 재인식','정지 → 재확인 → 저속 재출발·우회','재인식으로 길이 확보되면 저속으로 재출발하는 목표 동작 예시입니다. 실제 장애물은 계속 우회합니다.'],
 ],limits:'화면 블러와 분류 오류는 문제 설명용 연출입니다. 실제 촬영 블러 사진은 아래에 별도로 표시합니다.'}
};
const c=configs[kind];let mode=c.modes[kind==='dynamic'?2:0],time=0,playing=true,last=0;
const nav=[['static','정적 장애물'],['dynamic','동적 장애물'],['rough','거친 노면']];
document.getElementById('app').innerHTML=`<header><a href="../">← NOMAD 시나리오</a><nav>${nav.map(([id,label])=>`<a class="${id===kind?'active':''}" href="${id}.html">${label}</a>`).join('')}</nav><span class="badge">가정 기반 동작 예시</span></header><main class="shell"><div class="heading"><div><p class="eyebrow">SCENARIO ${c.num} / AI PERCEPTION</p><h1>${c.title}</h1><p>${c.intro}</p></div><p class="assumption">다른 파트는 전달된 정보를 정상 처리합니다.<br>인지 결과와 후속 정책에 따른 예상 영향을 비교합니다.</p></div><div class="modes" role="group" aria-label="인지 조건 선택">${c.modes.map((m,i)=>`<button data-mode="${i}" aria-pressed="${m===mode}">${m[1]}</button>`).join('')}</div><div class="screens">${['카메라가 보는 상황','AI가 전달하는 분할 정보','후속 모듈의 예상 동작'].map((title,i)=>`<article class="screen"><div class="screen-title"><b>0${i+1} / ${title}</b><small>설명용 애니메이션</small></div><canvas width="720" height="450" id="view${i}" aria-label="${title}"></canvas><p id="caption${i}"></p></article>`).join('')}</div><div class="legend"><span><i style="background:#65aa7c"></i>통행 가능 후보</span><span><i style="background:#e2a35a"></i>장애물·사람 영역</span><span><i style="background:#8ea79c"></i>주변 식생</span><span>의미 분류만으로 실제 통행 안전성을 보장하지 않습니다.</span></div><div class="player"><button id="play">일시정지</button><button id="restart">처음부터</button><input id="timeline" aria-label="재생 위치" type="range" min="0" max="12" step="0.01" value="0"><output id="clock">0.0 / 12초</output></div><div class="explanation"><div><span>인지 상태</span><h3 id="state"></h3></div><div><span>전달 정보</span><h3 id="transfer"></h3></div><div><span>주행 영향 · 가정</span><h3 id="impact"></h3><p id="policy"></p></div></div><p class="limits">${c.limits}</p>${kind==='rough'?`<div class="real-photo"><img src="assets/real-motion-blur.jpg" alt="2026년 10월 19일 실제 촬영된 심한 모션 블러 프레임"><div><span class="badge">실제 촬영 자료</span><h3>실제 심한 흔들림에서 관측한 입력</h3><p>낙엽·흙·돌의 경계와 질감이 번진 프레임입니다.<br>이 사진 자체는 AI 인식 성능이나 주행 성공의 증거가 아닙니다.</p></div></div>`:''}<details class="evidence"><summary>추후 실제 시험 결과 넣기 · 내 컴퓨터에서만 열기</summary><p class="limits">각 조건을 선택한 뒤 원본·분할·주행 자료를 불러올 수 있습니다. 서버 업로드는 없으며 파일은 현재 브라우저에서만 표시됩니다. 재열면 파일을 다시 선택해야 합니다.</p><div class="upload-grid">${['원본 카메라','AI 분할 결과','실제 주행 결과'].map((name,i)=>`<div class="upload"><label>${name}<input type="file" accept="image/*,video/*" data-upload="${i}"></label><div id="media${i}"></div><small id="filename${i}">자료 미등록</small></div>`).join('')}</div><div class="record"><label>시험 상태 <select id="resultStatus"><option>미시험 / 예시</option><option>시험 수행 / 분석 중</option><option>시험 결과 확인</option></select></label><input id="memo" placeholder="관측 사실 입력: 예) 3.2~4.1초 사람 영역 누락"><button id="save" type="button">기록 내려받기</button></div></details><p class="footer">담당 범위: 카메라 입력의 픽셀 분류 및 후속 모듈 출력 연동. 경로 계획·추적·속도 추정·로봇 제어는 후속 파트입니다. 이 페이지의 애니메이션은 실제 시뮬레이션 및 실차 안전성 검증 결과가 아닙니다.</p></main>`;
const ctxs=[0,1,2].map(i=>document.getElementById(`view${i}`).getContext('2d'));
const mediaState={};
function updateCopy(){document.getElementById('state').textContent=mode[2];document.getElementById('transfer').textContent=mode[3];document.getElementById('impact').textContent=mode[4];document.getElementById('policy').textContent=mode[5];document.getElementById('caption0').textContent=kind==='dynamic'?'0~4초 걷기 · 4~5.5초 정지 · 5.5~9초 이탈 · 10초 재출발':kind==='rough'?'2~7초에 입력 흔들림·블러가 발생하는 설명용 상황입니다.':'바위는 길 안에 계속 존재합니다.';document.getElementById('caption1').textContent='픽셀별 분류를 요약한 개념도입니다. 모델의 실제 예측 영상이 아닙니다.';document.getElementById('caption2').textContent=mode[4];syncDynamicTitles();}
function text(ctx,str,x,y,color='#fff',size=19){ctx.fillStyle=color;ctx.font=`bold ${size}px "Malgun Gothic", sans-serif`;ctx.fillText(str,x,y)}
function rock(ctx,x,y,color='#786c58',scale=1){
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
 const mask=color==='#e2a35a';
 const outline=()=>{ctx.beginPath();ctx.moveTo(-54,19);ctx.bezierCurveTo(-61,7,-49,-8,-45,-14);ctx.bezierCurveTo(-39,-26,-29,-22,-23,-33);ctx.bezierCurveTo(-14,-44,3,-38,10,-35);ctx.bezierCurveTo(20,-39,28,-30,34,-23);ctx.bezierCurveTo(47,-24,45,-9,53,-3);ctx.bezierCurveTo(64,9,57,22,46,27);ctx.bezierCurveTo(27,31,16,27,1,32);ctx.bezierCurveTo(-19,34,-39,30,-54,19);ctx.closePath()};
 if(!mask){ctx.fillStyle='#302e2944';ctx.beginPath();ctx.ellipse(4,29,67,15,-.06,0,Math.PI*2);ctx.fill()}
 outline();if(mask){ctx.fillStyle='#6e4a2e';ctx.fill();ctx.restore();return}
 const grad=ctx.createLinearGradient(-30,-39,40,35);grad.addColorStop(0,'#b7b3a6');grad.addColorStop(.42,'#85857d');grad.addColorStop(1,'#454b46');ctx.fillStyle=grad;ctx.fill();ctx.clip();
 ctx.fillStyle='#d2cbb780';ctx.beginPath();ctx.moveTo(-48,-6);ctx.bezierCurveTo(-24,-35,-10,-31,11,-34);ctx.lineTo(-2,-11);ctx.lineTo(-30,3);ctx.closePath();ctx.fill();
 ctx.fillStyle='#343b3755';ctx.beginPath();ctx.moveTo(10,-34);ctx.lineTo(20,-8);ctx.lineTo(5,7);ctx.lineTo(31,30);ctx.lineTo(64,22);ctx.lineTo(48,-28);ctx.closePath();ctx.fill();
 for(let i=0;i<430;i++){const px=((i*73.37)%121)-61,py=((i*39.71)%83)-43;ctx.fillStyle=i%3===0?'#ece9d44d':'#26312d40';ctx.beginPath();ctx.ellipse(px,py,.45+i%3,.35+i%2,.4,0,Math.PI*2);ctx.fill()}
 ctx.strokeStyle='#343b3777';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(-22,-30);ctx.lineTo(-13,-12);ctx.lineTo(-22,1);ctx.moveTo(-13,-12);ctx.lineTo(5,-4);ctx.moveTo(25,-18);ctx.lineTo(18,-6);ctx.lineTo(30,6);ctx.lineTo(21,19);ctx.stroke();ctx.restore()
}
function person(ctx,x,y,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y-30,12,0,Math.PI*2);ctx.fill();ctx.fillRect(x-11,y-15,22,38);ctx.strokeStyle=color;ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(x-6,y+20);ctx.lineTo(x-13,y+46);ctx.moveTo(x+6,y+20);ctx.lineTo(x+14,y+46);ctx.stroke()}
function robot(ctx,x,y){ctx.fillStyle='#153f35';ctx.fillRect(x-22,y-26,44,40);ctx.fillStyle='#f0d187';ctx.fillRect(x-13,y-39,26,18);ctx.fillStyle='#172722';ctx.fillRect(x-29,y-18,9,39);ctx.fillRect(x+20,y-18,9,39)}
function roadShape(ctx,rough){ctx.beginPath();ctx.moveTo(290,170);ctx.lineTo(430,170);if(rough){ctx.bezierCurveTo(450,205,385,224,478,254);ctx.lineTo(450,285);ctx.bezierCurveTo(527,309,492,351,572,378);ctx.lineTo(616,450);ctx.lineTo(92,450);ctx.lineTo(154,398);ctx.lineTo(135,366);ctx.bezierCurveTo(239,329,181,295,265,267);ctx.lineTo(242,232);ctx.lineTo(296,206)}else{ctx.lineTo(650,450);ctx.lineTo(65,450)}ctx.closePath()}
function base(ctx,semantic){
 const rough=kind==='rough';
 ctx.fillStyle=semantic?(true?'#4c88b6':'#becac6'):'#c9dedc';ctx.fillRect(0,0,720,450);
 ctx.fillStyle=semantic?(true?'#11952f':'#8ea79c'):'#567759';ctx.beginPath();ctx.moveTo(0,150);ctx.quadraticCurveTo(150,80,340,160);ctx.quadraticCurveTo(580,70,720,140);ctx.lineTo(720,450);ctx.lineTo(0,450);ctx.fill();
 ctx.save();roadShape(ctx,rough);ctx.fillStyle=semantic?(true?'#b7a184':'#65aa7c'):rough?'#968469':'#b4a17d';ctx.fill();ctx.clip();
 if(!semantic){for(let i=0;i<70;i++){ctx.fillStyle=i%2?'#6e7656':'#ccb99a';ctx.fillRect((i*137)%720,230+(i*47)%220,5+(i%7),3)}
 if(rough){
  for(let i=0;i<15;i++){const y=216+(i*43)%240,x=205+(i*67)%330;ctx.fillStyle='#443d3270';ctx.beginPath();ctx.ellipse(x,y,20+(i%3)*9,6+i%4,-.2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#d7c29b';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,y-3,20+(i%3)*9,6+i%4,-.2,.15,2.8);ctx.stroke()}
  ctx.strokeStyle='#66543f';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(290,205);ctx.bezierCurveTo(365,263,210,328,224,450);ctx.moveTo(396,215);ctx.bezierCurveTo(331,288,484,351,470,450);ctx.stroke();
  for(let i=0;i<11;i++)rock(ctx,190+(i*83)%330,250+(i*47)%200,'#786c58',.13+(i%3)*.08);
 }}ctx.restore();
 if(kind==='rough'&&!semantic){ctx.fillStyle='#654a2e';ctx.fillRect(405,398,295,35);text(ctx,'거친 노면 · 돌 · 패임 · 요철',418,421,'#fff',15)}
}
function draw(ctx,index){const t=time,id=mode[0],blur=kind==='rough'&&t>2&&t<7;ctx.clearRect(0,0,720,450);ctx.save();if(index<=1&&blur){ctx.filter='blur(4px)';ctx.translate(Math.sin(t*35)*12,Math.cos(t*28)*7)}base(ctx,index===1);const x=kind==='dynamic'?150+Math.min(t/4,1)*210+(mode[0]==='partial'?0:Math.max(0,Math.min((t-7)/2,1))*240):360,y=kind==='dynamic'?265:300;const failActive=(kind==='rough'?blur:kind==='dynamic'?t>=4.5&&t<6.5:true);const missing=id==='miss'&&failActive;const small=id==='small';if(index!==1||!missing){if(kind==='dynamic')person(ctx,x,y,index===1?'#e2a35a':'#c36a4f');else rock(ctx,x,y,index===1?'#e2a35a':'#786c58',index===1&&small?.42:1)}if(index===1){if(id==='false'&&failActive){ctx.fillStyle='#e2a35a';ctx.fillRect(160,320,160,100)}if(!missing){ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.setLineDash([7,5]);ctx.strokeRect(x-(small?18:48),y-(kind==='dynamic'?48:40),small?36:96,kind==='dynamic'?103:80);ctx.setLineDash([])}}
if(index===2){let ry=420-Math.min(t,8)*23,rx=360;let label='접근 중';let warn=false;if(kind==='dynamic'){if(id==='miss'&&t>=4.5&&t<6.5){ry=345-(t-4.5)*23;label='인식 누락 → 잘못된 재출발 위험';warn=true}else if(id==='miss'&&t>=6.5&&t<9){ry=299;label=t<7?'사람 재검출 → 다시 정지':'사람 이탈 중 → 대기'}else{ry=t>9? (id==='miss'?299:345)-(t-9)*46:Math.max(345,ry);label=t>=9?(id==='false'?'사람 이탈 · 가짜 장애물로 계속 정지':'통로 확보 → 재출발'):t>=7?'사람 이탈 중 → 대기':t>4?'사람 정지 → 대기':'사람 이동 → 감속'}}else if(id==='miss'&&failActive){ry=Math.max(320,ry);label=t>4?'장애물 누락 → 전진 위험':'접근 중';warn=t>4}else if(id==='false'&&failActive){ry=370;label='가짜 장애물 → 불필요 정지'}else if(small){rx=360+Math.sin(Math.min(t/10,1)*Math.PI)*55;label=t>4?'작은 점유 영역 → 여유 부족':'우회 판단';warn=t>4}else{rx=360+Math.sin(Math.min(t/10,1)*Math.PI)*145;label=t>3?'장애물 영역을 피해 우회':'접근 중'}ctx.strokeStyle=warn?'#bd5a4e':'#f4d786';ctx.lineWidth=5;ctx.setLineDash([10,10]);ctx.beginPath();ctx.moveTo(360,445);ctx.quadraticCurveTo(rx,365,rx,ry);ctx.stroke();ctx.setLineDash([]);robot(ctx,rx,ry);ctx.fillStyle=warn?'#983e36':'#193e32';ctx.fillRect(18,18,684,46);text(ctx,label,32,49,'#fff',20)}ctx.restore();if(index===0&&blur){ctx.fillStyle='#183129';ctx.fillRect(15,15,270,35);text(ctx,'문제 설명용 흔들림 연출',26,39,'#f1d28c',16)}if(index===1){ctx.fillStyle='#193e32';ctx.fillRect(15,15,300,35);text(ctx,missing?'장애물 영역 누락':'분할 출력 · 개념도',26,39,'#fff',16)}}
function classLabel(ctx,title,subtitle,x,y,color){ctx.font='bold 17px "Malgun Gothic", sans-serif';const titleWidth=ctx.measureText(title).width;ctx.font='bold 12px "Malgun Gothic", sans-serif';const w=Math.max(titleWidth,ctx.measureText(subtitle).width)+22;x=Math.min(x,710-w);ctx.fillStyle='#102b24e8';ctx.fillRect(x,y,w,49);ctx.fillStyle=color;ctx.fillRect(x,y,4,49);text(ctx,title,x+12,y+20,'#fff',17);text(ctx,subtitle,x+12,y+39,'#c6d9ce',12)}
function annotateClasses(){if(kind!=='static')return;const ctx=ctxs[1],miss=mode[0]==='miss'&&time>3,small=mode[0]==='small';classLabel(ctx,'sky','하늘',510,70,'#4c88b6');classLabel(ctx,'dense_vegetation','조밀 식생',18,155,'#11952f');classLabel(ctx,'unpaved_surface','비포장면 · 통행 가능 후보',34,378,'#b7a184');ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(390,294);ctx.lineTo(458,259);ctx.stroke();classLabel(ctx,miss?'unpaved_surface':'natural_obstacle',miss?'오분류: 바위가 비포장면으로 전달':small?'자연 장애물 · 실제보다 작은 마스크':'자연 장애물 · 바위',430,205,miss?'#b7a184':'#6e4a2e');if(small){ctx.strokeStyle='#ffdd87';ctx.setLineDash([5,5]);ctx.strokeRect(301,254,122,84);ctx.setLineDash([]);text(ctx,'실제 바위 범위',278,359,'#183c2f',15)} }
function collisionOverlay(){
 const id=mode[0],t=time;const risk=(kind==='dynamic'&&id==='partial'&&t>=4.5)||(id==='miss'&&(kind==='dynamic'?t>=4.5&&t<6.5:kind==='rough'?t>4&&t<7:t>4))||(id==='small'&&t>4);if(!risk)return;
 const ctx=ctxs[2],oy=kind==='dynamic'?265:300;
 let ry=kind==='dynamic'?Math.max(299,345-(t-4.5)*28):Math.max(320,420-Math.min(t,8)*23);
 const rx=id==='small'?360+Math.sin(Math.min(t/10,1)*Math.PI)*55:360;
 const overlap=ry-39<=oy+30&&ry+21>=oy-43&&Math.abs(rx-360)<88;
 ctx.save();ctx.fillStyle='#ec453344';ctx.strokeStyle='#e34435';ctx.lineWidth=3;
 ctx.beginPath();ctx.moveTo(rx-35,ry+12);ctx.lineTo(305,oy-45);ctx.lineTo(416,oy-45);ctx.lineTo(rx+35,ry+12);ctx.closePath();ctx.fill();ctx.stroke();
 ctx.strokeStyle='#ff5845';ctx.lineWidth=5;ctx.setLineDash([8,5]);ctx.strokeRect(295,oy-53,132,99);ctx.setLineDash([]);
 ctx.fillStyle='#9f251eea';ctx.fillRect(18,18,684,50);text(ctx,overlap?'접촉 구간 진입 · 설명용 예시':'충돌 위험 · 예상 진행 영역과 장애물 중첩',32,50,'#fff',20);
 ctx.strokeStyle='#ed4738';ctx.lineWidth=8;ctx.strokeRect(5,5,710,440);
 if(overlap){const hx=(rx+360)/2,hy=oy+20;ctx.strokeStyle='#ffe0a0';ctx.lineWidth=5;for(let i=0;i<10;i++){const a=i*Math.PI/5;ctx.beginPath();ctx.moveTo(hx+Math.cos(a)*18,hy+Math.sin(a)*18);ctx.lineTo(hx+Math.cos(a)*36,hy+Math.sin(a)*36);ctx.stroke()}ctx.fillStyle='#b32b21';ctx.beginPath();ctx.arc(hx,hy,19,0,Math.PI*2);ctx.fill();text(ctx,'!',hx-5,hy+7,'#fff',24)}
 ctx.fillStyle='#9f251eea';ctx.fillRect(18,374,360,48);text(ctx,id==='partial'?'몸통·다리가 길로 분류 → 직진':id==='small'?'인식한 영역보다 실제 바위가 큼':'인지 누락 → 장애물 방향으로 전진',30,405,'#fff',17);ctx.restore()
}
function syncDynamicTitles(){
 if(kind!=='dynamic')return;
 const titles={success:'사람이 지나가면 멈추고, 길이 비면 다시 출발',partial:'사람 일부를 길로 오분류하면, 직진하다 접촉',guarded:'분할이 깨져도, 같은 사람의 이력을 이어서 대기',wrongclass:'사람을 식생으로 분류하면, 사람 식별 실패'};
 document.querySelector('.heading h1').textContent=titles[mode[0]];
 document.title=titles[mode[0]]+' · AI 환경 인식';
 document.querySelector('.heading h1 + p').textContent=mode[0]==='guarded'?'특징점 추적 → ID 1 연결 → 최근 관측 저장 → 불확실성 비용 → 재출발 판단':mode[0]==='partial'?'사람의 머리 일부만 검출되고 몸통·다리는 길로 분류되어, 진행 공간을 잘못 판단하는 예시입니다.':mode[0]==='wrongclass'?'사람의 위치는 비통행 영역으로 남지만 사람이라는 의미가 사라지는 예시입니다.':'사람 진입 → 정지·대기 → 실제 이탈 확인 → 재출발';
 document.getElementById('caption0').textContent=mode[0]==='partial'?'실제 사람은 길 안에 그대로 서 있습니다.':'사람은 길 안에서 멈췄다가 길 밖으로 이동합니다.';
 document.getElementById('caption1').textContent=mode[0]==='partial'?'빨강: person / 몸통·다리의 베이지 영역: unpaved_surface 오분류. 점선은 오류 위치 설명입니다.':'화면 전체를 클래스 색으로 채운 의미 분할 개념도입니다. 실제 모델 출력이 아닙니다.';
 document.querySelector('.legend').innerHTML='<span><i style="background:#e71d3d"></i>person · 사람</span><span><i style="background:#b7a184"></i>unpaved_surface · 비포장면</span><span><i style="background:#11952f"></i>dense_vegetation · 조밀 식생</span><span><i style="background:#4c88b6"></i>sky · 하늘</span>';
}
function dynamicInfo(){
 if(kind!=='dynamic')return;const ctx=ctxs[1],t=time,x=150+Math.min(t/4,1)*210+(mode[0]==='partial'?0:Math.max(0,Math.min((t-7)/2,1))*240);
 const error=t>=4.5&&(mode[0]==='partial'||t<6.5),partial=mode[0]==='partial'&&error,wrong=mode[0]==='wrongclass'&&error;
 base(ctx,true);
 if(partial){ctx.save();ctx.beginPath();ctx.rect(x-24,218,24,37);ctx.clip();person(ctx,x,265,'#e71d3d');ctx.restore();classLabel(ctx,'person','머리 일부만 사람',430,190,'#e71d3d');classLabel(ctx,'unpaved_surface','몸통·다리를 길로 오분류',420,292,'#b7a184');ctx.strokeStyle='#f9f5e9';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.strokeRect(x-23,253,46,62);ctx.setLineDash([])}
 else if(wrong){person(ctx,x,265,'#11952f');classLabel(ctx,'dense_vegetation','실제 사람 → 조밀 식생으로 오분류',390,245,'#11952f')}
 else{person(ctx,x,265,'#e71d3d');classLabel(ctx,'person · 사람',t>=9?'길 밖으로 이탈':t>=7?'길 밖으로 이동 중':t>=4?'정지한 사람도 계속 인식':'이동하는 사람을 인식',Math.min(x+35,440),230,'#e71d3d')}
 ctx.fillStyle=partial||wrong?'#9f251e':'#193e32';ctx.fillRect(15,15,690,46);text(ctx,partial?'신체 일부가 마스크에서 잘림':wrong?'형태는 남지만 클래스가 잘못됨':t>=9?'사람 이탈 확인 → 진행 경로 확보':'person 영역을 후속 모듈에 전달',28,46,'#fff',20);
 classLabel(ctx,'sky','하늘',530,76,'#4c88b6');classLabel(ctx,'dense_vegetation','조밀 식생',15,140,'#11952f');classLabel(ctx,'unpaved_surface','비포장면',25,375,'#b7a184');
 const out=ctxs[2];base(out,false);person(out,x,265,'#c36a4f');const ry=partial?Math.max(299,345-(t-4.5)*28):t>9?345-(t-9)*46:Math.max(345,420-Math.min(t,8)*23);robot(out,360,ry);out.fillStyle=partial?'#9f251e':'#193e32';out.fillRect(18,18,684,46);text(out,partial?'신체를 길로 판단 → 직진 → 접촉 위험':t>=9?'통로 확보 → 재출발':wrong?'식생도 비통행 → 정지 유지 · 사람 식별 실패':t>=4?'사람이 길 안에 있음 → 정지·대기':'사람 접근 → 감속',30,49,'#fff',18);
}
function roughBoundaryDamage(ctx,t,strength){
 // Vary class boundaries independently of camera motion. No rigid image translation.
 const phase=t*5.11;
 ctx.fillStyle='#11952f';ctx.beginPath();ctx.moveTo(0,172);ctx.lineTo(720,172);ctx.lineTo(720,450);ctx.lineTo(0,450);ctx.closePath();ctx.fill();
 const left=[],right=[];
 for(let i=0;i<=25;i++){const y=170+i*12,u=i/25;const wave=(Math.sin(i*1.8+phase)*39+Math.sin(i*.71-phase*1.4)*29)*strength*(.4+u);left.push([290-200*u+wave,y]);right.push([430+186*u+Math.cos(i*1.5-phase)*60*strength*(.4+u),y])}
 ctx.fillStyle='#b7a184';ctx.beginPath();ctx.moveTo(...left[0]);for(const p of left.slice(1))ctx.lineTo(...p);for(const p of right.reverse())ctx.lineTo(...p);ctx.closePath();ctx.fill();
 if(strength>.2){
  for(let j=0;j<6;j++){const cx=245+(j*71)%245+Math.sin(phase+j)*17,cy=235+(j*43)%180;ctx.fillStyle=j%3===0?'#6e4a2e':'#11952f';ctx.beginPath();for(let k=0;k<=18;k++){const a=k/18*Math.PI*2,r=(11+5*Math.sin(k*2.3+j+phase))*strength;const x=cx+Math.cos(a)*r*1.8,y=cy+Math.sin(a)*r;if(!k)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.closePath();ctx.fill()}
 }
}
function roughSeverity(t){const smooth=v=>v*v*(3-2*v);return t<2?0:t<3?smooth(t-2):t<6?1:t<8?1-smooth((t-6)/2):0}
function staticMissMotion(){if(kind!=='static'||mode[0]!=='miss')return;const ctx=ctxs[2],y=Math.max(320,420-time*23);base(ctx,false);rock(ctx,360,300);ctx.strokeStyle='#df765b';ctx.lineWidth=5;ctx.setLineDash([9,8]);ctx.beginPath();ctx.moveTo(360,445);ctx.lineTo(360,y);ctx.stroke();ctx.setLineDash([]);robot(ctx,360,y);ctx.fillStyle='#193e32';ctx.fillRect(18,18,684,46);text(ctx,'처음부터 노면으로 오분류 → 직진',30,49,'#fff',20)}
function renderSegmentation(){
 const ctx=ctxs[1],t=time,id=mode[0],shake=kind==='rough'&&t>2&&t<7;
 ctx.clearRect(0,0,720,450);ctx.save();
 base(ctx,true);
 const severity=kind==='rough'?roughSeverity(t):0;
 if(severity>0){ctx.filter=`blur(${severity*(id==='success'?.3:2.2)}px)`;roughBoundaryDamage(ctx,id==='success'?t*.18:t,severity*(id==='success'?.11:id==='false'?1.25:.95));}
 let note='전체 화면의 색은 픽셀별 클래스입니다. 범례는 아래에 표시됩니다.';
 if(kind==='dynamic'){
  const x=150+Math.min(t/4,1)*210+(id==='partial'?0:Math.max(0,Math.min((t-7)/2,1))*240);
  const error=t>=4.5&&(id==='partial'||t<6.5);
  if(id==='partial'&&error){
   // Keep irregular fragments of the true silhouette; lost body pixels inherit the road class.
   ctx.save();ctx.beginPath();ctx.moveTo(x-19,222);ctx.bezierCurveTo(x-6,217,x+8,224,x+5,234);ctx.bezierCurveTo(x+1,243,x-10,240,x-8,253);ctx.bezierCurveTo(x-15,261,x-21,250,x-19,243);ctx.bezierCurveTo(x-27,235,x-22,229,x-19,222);ctx.closePath();ctx.clip();person(ctx,x,265,'#e71d3d');ctx.restore();
   note='person의 머리·어깨 일부만 남고 몸통·다리는 unpaved_surface로 섞입니다.';
  }else{person(ctx,x,265,id==='wrongclass'&&error?'#11952f':'#e71d3d');note=id==='wrongclass'&&error?'사람 윤곽은 남지만 dense_vegetation으로 잘못 분류됩니다.':'빨강 person / 베이지 unpaved_surface / 초록 dense_vegetation / 파랑 sky';}
 }else{
  const failed=id==='miss'&&(kind==='rough'?severity>.01:true);
 if(!failed){
   if(id==='small'){
    ctx.save();ctx.beginPath();ctx.moveTo(339,276);ctx.bezierCurveTo(352,262,374,270,379,288);ctx.bezierCurveTo(384,304,367,310,352,304);ctx.bezierCurveTo(334,302,331,289,339,276);ctx.closePath();ctx.clip();rock(ctx,360,300,'#e2a35a');ctx.restore();
    note='바위 전체 중 가운데 일부만 natural_obstacle로 남고 가장자리 마스크가 누락됩니다.';
   }else{rock(ctx,360,300,'#e2a35a');if(kind==='rough'&&id==='success'&&severity>0){ctx.save();ctx.globalAlpha=.22*severity;ctx.translate(Math.sin(t*5)*3,Math.cos(t*4)*2);rock(ctx,360,300,'#e2a35a');ctx.restore()}}
  }else{note=kind==='static'?'처음부터 바위를 unpaved_surface로 오분류합니다. 실제 바위는 원본에 계속 존재합니다.':'바위 가장자리가 점차 노면으로 섞이고 natural_obstacle 조각만 남습니다.';if(kind==='rough'){ctx.save();ctx.beginPath();const edge=270+70*(1-severity);ctx.moveTo(295,252);ctx.bezierCurveTo(330,edge-12,375,edge+14,423,edge);ctx.lineTo(428,245);ctx.lineTo(295,245);ctx.closePath();ctx.clip();rock(ctx,360,300,'#e2a35a');ctx.restore()}}
  if(kind==='rough'&&id==='false'&&severity>0){
   ctx.save();ctx.globalAlpha=severity;roadShape(ctx,true);ctx.clip();ctx.fillStyle='#11952f';ctx.beginPath();ctx.moveTo(435,250);ctx.bezierCurveTo(403,266,428,287,380,294);ctx.bezierCurveTo(346,300,367,325,320,337);ctx.bezierCurveTo(283,353,327,372,292,390);ctx.bezierCurveTo(270,412,326,426,340,450);ctx.lineTo(720,450);ctx.lineTo(720,240);ctx.closePath();ctx.fill();ctx.restore();
   note='식생과 노면의 경계를 잘못 잡아 dense_vegetation 마스크가 길 안쪽으로 번집니다.';
  }
  if(kind==='rough'){
   const stage=t<2?'① 안정 입력':t<3?'② 흔들림 증가':t<6?'③ 심한 블러·분류 혼동':t<8?'④ 입력 회복·경계 복구':'⑤ 안정된 분류';
   note=id==='success'?stage+' — 정상 비교: 흔들림에도 클래스 경계를 대체로 유지하는 목표 예시.':stage+(t<2?' — 노면과 식생의 경계, 바위 윤곽이 구분됩니다.':t<3?' — 길 가장자리가 번지고 들쭉날쭉해지며 바위 윤곽이 부분적으로 깨집니다.':t<6?' — 식생이 길로 침범하고, 길 안에 잘못된 식생·장애물 조각이 생깁니다. 프레임마다 분류 범위가 달라집니다.':t<8?' — 오분류 조각이 줄어들고 길·식생·바위 경계가 점차 돌아옵니다.':' — 입력 회복 후 클래스 영역이 다시 안정됩니다.');
  }
 }
 ctx.restore();
 const caption=document.getElementById('caption1');if(caption.textContent!==note)caption.textContent=note;
}
let renderedAt=0;
function tick(now){if(now-renderedAt<1000/30){requestAnimationFrame(tick);return}renderedAt=now;if(last&&playing)time=Math.min(12,time+Math.min(.1,(now-last)/1000));last=now;if(time>=12){playing=false;document.getElementById('play').textContent='다시 재생'}if(typeof renderLinkedWorld==='function'){renderLinkedWorld()}else{ctxs.forEach(draw);staticMissMotion();dynamicInfo();renderSegmentation();collisionOverlay();}document.getElementById('timeline').value=time;document.getElementById('clock').textContent=`${time.toFixed(1)} / 12초`;requestAnimationFrame(tick)}
function restoreMedia(){const s=mediaState[mode[0]]||{};[0,1,2].forEach(i=>{document.getElementById(`media${i}`).replaceChildren();document.querySelector(`[data-upload="${i}"]`).value='';document.getElementById(`filename${i}`).textContent=s[i]?.name||'자료 미등록';if(s[i])appendMedia(i,s[i])});document.getElementById('resultStatus').value=s.status||'미시험 / 예시';document.getElementById('memo').value=s.memo||''}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{const old=mediaState[mode[0]]||{};old.status=document.getElementById('resultStatus').value;old.memo=document.getElementById('memo').value;mediaState[mode[0]]=old;mode=c.modes[+b.dataset.mode];time=0;playing=true;document.getElementById('play').textContent='일시정지';document.querySelectorAll('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',x===b));updateCopy();restoreMedia()}));
document.getElementById('play').onclick=()=>{if(time>=12)time=0;playing=!playing;document.getElementById('play').textContent=playing?'일시정지':'재생'};document.getElementById('restart').onclick=()=>{time=0;playing=true;document.getElementById('play').textContent='일시정지'};document.getElementById('timeline').oninput=e=>{time=+e.target.value;playing=false;document.getElementById('play').textContent='재생'};
function appendMedia(i,file){const el=document.createElement(file.type.startsWith('video/')?'video':'img');el.src=file.url;if(el.tagName==='VIDEO')el.controls=true;else el.alt='사용자가 불러온 실제 시험 자료';document.getElementById(`media${i}`).replaceChildren(el)}
document.querySelectorAll('[data-upload]').forEach(input=>input.onchange=()=>{const f=input.files[0];if(!f)return;if(!f.type.startsWith('video/')&&!f.type.startsWith('image/'))return;const i=input.dataset.upload;mediaState[mode[0]]??={};const prior=mediaState[mode[0]][i];if(prior)URL.revokeObjectURL(prior.url);const entry={name:f.name,type:f.type,url:URL.createObjectURL(f)};mediaState[mode[0]][i]=entry;appendMedia(i,entry);document.getElementById(`filename${i}`).textContent=f.name});
document.getElementById('save').onclick=()=>{const s=mediaState[mode[0]]||{};const data={scenario:kind,condition:mode[1],status:document.getElementById('resultStatus').value,observation:document.getElementById('memo').value,files:[0,1,2].map(i=>s[i]?.name||null),note:'애니메이션은 가정 기반 예시. 등록 파일의 실제 시험 결과와 구분.',savedAt:new Date().toISOString()};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download=`${kind}-${mode[0]}-record.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
if(kind==='static'){document.querySelector('.legend').innerHTML='<span><i style="background:#b7a184"></i>unpaved_surface · 비포장면</span><span><i style="background:#6e4a2e"></i>natural_obstacle · 자연 장애물</span><span><i style="background:#11952f"></i>dense_vegetation · 조밀 식생</span><span><i style="background:#4c88b6"></i>sky · 하늘</span>';}
if(kind==='rough'){document.querySelector('.legend').innerHTML='<span><i style="background:#b7a184"></i>unpaved_surface · 비포장면</span><span><i style="background:#6e4a2e"></i>natural_obstacle · 자연 장애물</span><span><i style="background:#11952f"></i>dense_vegetation · 조밀 식생</span><span><i style="background:#4c88b6"></i>sky · 하늘</span>';}
document.body.classList.add('presentation-clean');
updateCopy();requestAnimationFrame(tick);
