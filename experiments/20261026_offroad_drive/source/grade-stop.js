// Vehicle limit supplied by the user. Inputs are observed ground returns only.
const GRADE_LIMIT=20,GRADE_RADIUS=.2,GRADE_LOOKAHEAD=1.2;
let gradeFrames=[];
function gradeExceedsLimit(angle){return Number.isFinite(angle)&&angle>GRADE_LIMIT+1e-6;}
function fitGradePatch(points){
  const n=points.length,bins=new Set(points.map(p=>Math.floor(p.x/.03)+','+Math.floor(p.z/.03)));
  if(n<12||bins.size<6)return null;
  let mx=0,my=0,mz=0;for(const p of points){mx+=p.x;my+=p.y;mz+=p.z;}mx/=n;my/=n;mz/=n;
  let xx=0,xy=0,xz=0,yy=0,yz=0,zz=0;
  for(const p of points){const x=p.x-mx,y=p.y-my,z=p.z-mz;xx+=x*x;xy+=x*y;xz+=x*z;yy+=y*y;yz+=y*z;zz+=z*z;}
  xx/=n;xy/=n;xz/=n;yy/=n;yz/=n;zz/=n;
  const disc=Math.hypot(xx-zz,2*xz),minor=Math.max(0,(xx+zz-disc)/2),major=(xx+zz+disc)/2;
  if(Math.sqrt(minor)<.01||major<=0||minor/major<.02)return null;
  const eig=smallestEigen([xx,xy,xz,xy,yy,yz,xz,yz,zz]),rms=Math.sqrt(eig.value);
  if(rms>.01)return null;
  const [nx,ny,nz]=eig.normal,angle=Math.atan2(Math.hypot(nx,nz),Math.abs(ny))*180/Math.PI;
  return {angle,n,rms};
}
function buildGradeFrames(frames=scanFrames){
  gradeFrames=[];state.gradeStopped=false;
  const buckets=new Map(),seen=new Set(),size=.25,key=(x,z)=>x+','+z;
  // Process in observation order: frame k never reads observations from k+1.
  for(let k=0;k<frames.length;k++){
    for(const sensorPoints of frames[k])for(const p of sensorPoints){
      if(p.semantic!==0)continue;
      const voxel=Math.floor(p.x/.03)+','+Math.floor(p.y/.03)+','+Math.floor(p.z/.03);if(seen.has(voxel))continue;seen.add(voxel);
      const b=key(Math.floor(p.x/size),Math.floor(p.z/size));if(!buckets.has(b))buckets.set(b,[]);buckets.get(b).push(p);
    }
    const progress=k*STEP,s=routeDistance(progress);let best=null;
    for(let ahead=.6;ahead<=GRADE_LOOKAHEAD+1e-9;ahead+=.2){
      if(s+ahead>route.length)break;
      const center=routeAt(routeProgressForDistance(s+ahead)),ix=Math.floor(center.x/size),iz=Math.floor(center.z/size),near=[];
      for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const p of buckets.get(key(ix+dx,iz+dz))||[])if((p.x-center.x)**2+(p.z-center.z)**2<=GRADE_RADIUS**2)near.push(p);
      const fit=fitGradePatch(near);if(fit&&(!best||fit.angle>best.angle))best={...fit,x:center.x,z:center.z,ahead};
    }
    gradeFrames.push(best?{...best,blocked:gradeExceedsLimit(best.angle),progress}:{angle:null,n:0,blocked:false,progress});
  }
}
function gradeReading(progress=state.x){return gradeFrames[clamp(Math.floor(progress/STEP+1e-8),0,gradeFrames.length-1)]||{angle:null,n:0,blocked:false};}
function advanceGradeMotion(next){
  if(next<state.x-1e-8){state.gradeStopped=false;return true;}
  const first=Math.floor(state.x/STEP+1e-8),last=Math.floor(next/STEP+1e-8);
  for(let k=first;k<=last;k++)if(gradeFrames[k]?.blocked){
    state.x=Math.max(state.x,k*STEP);state.playing=false;state.gradeStopped=true;
    $('play').textContent='■ 경사 한계 초과로 정지';return false;
  }
  state.gradeStopped=false;return true;
}
function seekProgress(next){state.playing=false;if(advanceGradeMotion(next))state.x=next;if(!state.gradeStopped)$('play').textContent='▶ 주행';update(true);}
function updateGradeUI(){
  const r=gradeReading(),stopped=state.gradeStopped;
  $('gradeAngle').textContent=r.angle==null?'미확정':r.angle.toFixed(1)+'°';
  $('gradeVerdict').textContent=stopped?'경사 한계 초과 / 정지':r.blocked?'경사 한계 초과 / 진입 불가':r.angle==null?'전방 지면 추정 대기':'20° 이하 / 경사 조건 통과';
  $('gradeVerdict').classList.toggle('warning',stopped||r.blocked);
  $('gradeEvidence').textContent=r.angle==null?'점이 없거나 평면 추정 조건을 충족하지 않은 구간은 통과 가능으로 확정하지 않습니다.':'현재까지 관측한 지면 '+r.n+'점 / X '+r.x.toFixed(2)+'m, 좌우 '+r.z.toFixed(2)+'m / 평면 RMS '+(r.rms*1000).toFixed(1)+'mm / 전방 최대 '+GRADE_LOOKAHEAD+'m 검사';
  if(stopped){$('phase').textContent='경사 20° 한계 초과로 진입 전 정지';$('semanticDecision').textContent=(occupancy.blocked.size?'장애물 검사와 별도로 ':'장애물 없음 / ')+'경사 한계 초과로 정지';}
}
window.gradeDemo={limit:GRADE_LIMIT,radius:GRADE_RADIUS,lookahead:GRADE_LOOKAHEAD,frames:()=>gradeFrames,fit:fitGradePatch,exceeds:gradeExceedsLimit,build:buildGradeFrames,reading:gradeReading,advance:advanceGradeMotion};
