// Oracle route: emulate a successful external planner using the complete virtual layout.
// state.x remains a 0..14 progress parameter; the displayed distance is true route arc length.
const route={points:[],length:14,obstacles:[],minimumClearance:Infinity,planningRadius:.72,validationRadius:.65,mapGroups:[],laneChoice:null};
function routeDistance(progress){return clamp(progress/END,0,1)*route.length;}
function routeProgressForDistance(distance){return clamp(distance/route.length,0,1)*END;}
function routeAt(progress){if(route.points.length<2)return {x:progress,z:0,heading:0};const s=routeDistance(progress),pts=route.points;let lo=0,hi=pts.length-1;while(lo+1<hi){const m=(lo+hi)>>1;if(pts[m].s<=s)lo=m;else hi=m;}const a=pts[lo],b=pts[Math.min(lo+1,pts.length-1)],u=clamp((s-a.s)/Math.max(1e-10,b.s-a.s),0,1);return {x:a.x+(b.x-a.x)*u,z:a.z+(b.z-a.z)*u,heading:Math.atan2(b.z-a.z,b.x-a.x)};}
function progressForWorldX(x){if(!route.points.length)return x;let best=route.points[0];for(const p of route.points)if(Math.abs(p.x-x)<Math.abs(best.x-x))best=p;return routeProgressForDistance(best.s);}
function routeClearance(x,z){let min=Infinity;for(const b of route.obstacles){const dx=Math.max(b.x0-x,0,x-b.x1),dz=Math.max(b.z0-z,0,z-b.z1);min=Math.min(min,Math.hypot(dx,dz));}return min;}
function routePointFree(p,r=route.planningRadius){return Math.abs(p.z)<=3.6&&p.x>=0&&p.x<=14&&routeClearance(p.x,p.z)>=r;}
function routeSegmentFree(a,b,r=route.planningRadius){const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.02));for(let i=0;i<=n;i++){const t=i/n;if(!routePointFree({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},r))return false;}return true;}
function routeHeapPush(heap,item){heap.push(item);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].f<=item.f)break;heap[i]=heap[p];i=p;}heap[i]=item;}
function routeHeapPop(heap){const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(last.f<=heap[c].f)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;}
function compareLanePoints(cameraPoints){
  const regions=[{key:'left',z0:-1.8,z1:-.5,x0:3,x1:8},{key:'right',z0:.85,z1:2.15,x0:6.3,x1:8}];
  const fits=regions.map(region=>{const points=cameraPoints.filter(p=>p.semantic===0&&p.x>=region.x0&&p.x<=region.x1&&p.z>=region.z0&&p.z<=region.z1);return {...region,fit:fitGradePatch(points),count:points.length};});
  const [left,right]=fits,ready=!!(left.fit&&right.fit),chosen=ready?(left.fit.angle<=right.fit.angle?'left':'right'):null;
  return {left,right,ready,chosen,observationX:0};
}
function buildRoute(){
  // Reset the previous scenario's route so this observation is exactly at A, yaw=0.
  route.points=[];route.length=14;route.laneChoice=null;
  if(isSplitTerrain())route.laneChoice=compareLanePoints(sample(0)[1]);
  route.obstacles=obstacleMeshes.filter(o=>o.box).map(o=>({x0:o.box.min.x,x1:o.box.max.x,z0:o.box.min.z,z1:o.box.max.z}));if(state.obstacles!=='none'&&state.rough>0)for(const s of terrainStones)route.obstacles.push({x0:s.x-s.rx,x1:s.x+s.rx,z0:s.z-s.rz,z1:s.z+s.rz});
  let waypoints;
  if(route.laneChoice?.ready){const z=route.laneChoice.chosen==='left'?-1.1:1.1;waypoints=[{x:0,z:0},{x:2,z:0},{x:4.8,z},{x:11.5,z},{x:14,z:0}];}
  else if(routeSegmentFree({x:0,z:0},{x:14,z:0}))waypoints=[{x:0,z:0},{x:14,z:0}];
  else{
    const nx=141,nz=73,total=nx*nz,start=8*nz+36,goal=132*nz+36,mask=new Uint8Array(total),closed=new Uint8Array(total),g=new Float64Array(total),parent=new Int32Array(total),heap=[];g.fill(Infinity);parent.fill(-1);
    const point=i=>({x:Math.floor(i/nz)*.1,z:((i%nz)-36)*.1});for(let i=0;i<total;i++)mask[i]=routePointFree(point(i))?0:1;if(mask[start]||mask[goal])throw Error('가정 경로의 출발 또는 도착 지지가 장애물과 겹칩니다.');
    g[start]=0;routeHeapPush(heap,{i:start,f:12.4});const dirs=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    while(heap.length){const {i}=routeHeapPop(heap);if(closed[i])continue;closed[i]=1;if(i===goal)break;const ix=Math.floor(i/nz),iz=i%nz,a=point(i);for(const [dx,dz]of dirs){const xx=ix+dx,zz=iz+dz;if(xx<0||xx>=nx||zz<0||zz>=nz)continue;const ni=xx*nz+zz;if(mask[ni]||closed[ni])continue;if(dx&&dz&&(mask[(ix+dx)*nz+iz]||mask[ix*nz+iz+dz]))continue;const b=point(ni),cost=g[i]+Math.hypot(dx,dz)*.1*(1+.018*Math.abs(b.z));if(cost>=g[ni])continue;g[ni]=cost;parent[ni]=i;routeHeapPush(heap,{i:ni,f:cost+Math.hypot(13.2-b.x,b.z)});}}
    if(parent[goal]<0)throw Error('현재 배치에서 안전 여유를 확보한 우회 경로를 만들지 못했습니다.');const raw=[];for(let i=goal;i>=0;i=parent[i]){raw.push(point(i));if(i===start)break;}raw.reverse();const simplified=[raw[0]];for(let i=0;i<raw.length-1;){let j=raw.length-1;while(j>i+1&&!routeSegmentFree(raw[i],raw[j]))j--;simplified.push(raw[j]);i=j;}waypoints=[{x:0,z:0},...simplified,{x:14,z:0}];
  }
  const dense=[];const append=p=>{const prev=dense.at(-1);if(!prev){dense.push({...p});return;}const n=Math.max(1,Math.ceil(Math.hypot(p.x-prev.x,p.z-prev.z)/.02));for(let j=1;j<=n;j++)dense.push({x:prev.x+(p.x-prev.x)*j/n,z:prev.z+(p.z-prev.z)*j/n});};
  append(waypoints[0]);for(let i=1;i<waypoints.length-1;i++){const a=waypoints[i-1],b=waypoints[i],c=waypoints[i+1],l1=Math.hypot(b.x-a.x,b.z-a.z),l2=Math.hypot(c.x-b.x,c.z-b.z);let cut=Math.min(.6,l1*.28,l2*.28),arc=null;
    for(let attempt=0;attempt<6;attempt++){const p={x:b.x+(a.x-b.x)*cut/l1,z:b.z+(a.z-b.z)*cut/l1},q={x:b.x+(c.x-b.x)*cut/l2,z:b.z+(c.z-b.z)*cut/l2},candidate=[];const n=Math.max(12,Math.ceil(cut*2/.015));for(let j=0;j<=n;j++){const t=j/n;candidate.push({x:(1-t)**2*p.x+2*(1-t)*t*b.x+t*t*q.x,z:(1-t)**2*p.z+2*(1-t)*t*b.z+t*t*q.z});}if(candidate.every(v=>routePointFree(v,route.validationRadius))&&routeSegmentFree(dense.at(-1),p,route.validationRadius)){arc=candidate;break;}cut*=.5;}
    if(arc){append(arc[0]);for(const p of arc.slice(1))append(p);}else append(b);
  }append(waypoints.at(-1));
  route.length=0;route.minimumClearance=Infinity;for(let i=0;i<dense.length;i++){if(i)route.length+=Math.hypot(dense[i].x-dense[i-1].x,dense[i].z-dense[i-1].z);dense[i].s=route.length;route.minimumClearance=Math.min(route.minimumClearance,routeClearance(dense[i].x,dense[i].z));if(!routePointFree(dense[i],route.validationRadius))throw Error('우회 경로 검증에서 여유 공간이 부족합니다.');}route.points=dense;
  terrain.cutY=sensor(pose(0),state.ch).y;
}
function updateRouteVisual(){free(routeMarkers);for(const [x,label,c]of [[0,'A / 0 m','#c2f5df'],[14,'B / 14 m','#c2f5df']])textSprite(routeMarkers,label,[x,height(x,-2.1)+.4,-2.1],c,.23);if(isSplitTerrain()){
    for(const [z,label,color]of [[-1.15,'FLAT / 0°','#65e0ce'],[1.45,'RAMP / 10°','#ffb774']]){textSprite(routeMarkers,label,[9,height(9,z)+.4,z],color,.25);const edge=[];for(let x=6;x<=14;x+=.1)edge.push(V(x,height(x,z)+.035,z));line(routeMarkers,edge,z<0?0x65e0ce:0xffb774,.7);}
  }
  const points=route.points.map(p=>V(p.x,height(p.x,p.z)+.035,p.z));line(routeMarkers,points,0xeff4c1,.9);
  while(route.mapGroups.length<2){const g=new THREE.Group();mapScenes[route.mapGroups.length].add(g);route.mapGroups.push(g);}for(const g of route.mapGroups){free(g);line(g,points,0xdfe6cf,.7);}
  $('routeLength').textContent=route.length.toFixed(2)+'m';$('routeClearance').textContent=Number.isFinite(route.minimumClearance)?Math.floor((route.minimumClearance-.36)*100)+'cm 이상':'장애물 없음';
}
