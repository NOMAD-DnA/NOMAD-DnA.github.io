// One triangulated height field is shared by rendering, wheel supports and sensor returns.
const terrain={step:.1,x0:-4,x1:22,z0:-5,z1:5,nx:260,nz:100,values:null,min:0,max:0};
const isSplitTerrain=()=>state.scenario===2;
// Left side and center remain level; the right ramp joins through a 40cm shoulder.
const baseHeight=(x,z=0)=>Math.max(0,x-state.start)*Math.tan(state.slope*D)*(isSplitTerrain()?clamp((z-.4)/.4,0,1):1);
const terrainStones=[{x:2.4,z:1.25,rx:.27,rz:.22,h:.08},{x:4.3,z:-1.3,rx:.32,rz:.24,h:.10},{x:5.4,z:.92,rx:.21,rz:.18,h:.065},{x:7.8,z:-1.05,rx:.3,rz:.22,h:.09},{x:9.7,z:1.5,rx:.36,rz:.28,h:.12},{x:11.1,z:-.92,rx:.22,rz:.25,h:.075},{x:12.8,z:1.1,rx:.27,rz:.21,h:.085},{x:15.2,z:-1.35,rx:.34,rz:.26,h:.10},{x:3.5,z:3.1,rx:.45,rz:.34,h:.18},{x:8.5,z:-3.3,rx:.5,rz:.4,h:.20},{x:13.3,z:3.4,rx:.4,rz:.36,h:.15},{x:18,z:-2.8,rx:.5,rz:.4,h:.18}];
function gauss(dx,dz,sx,sz){return Math.exp(-(dx*dx/(sx*sx)+dz*dz/(sz*sz)));}
function roughField(x,z){
  let f=.40*Math.sin(1.7*x+.65*z)+.23*Math.sin(3.8*x-1.9*z)+.10*Math.sin(8.4*x+4.6*z)+.16*Math.sin(.75*x+1.3*z);
  f+=1.05*gauss(x-3.3,z-.12,.5,.65)-.85*gauss(x-5.1,z+.12,.4,.5);
  f+=.8*gauss(x-9.4,z,.5,.65)-.7*gauss(x-11.6,z-.17,.45,.6);
  f-=.30*(gauss(0,z-.235,1,.095)+gauss(0,z+.235,1,.095))*(.65+.35*Math.sin(.8*x)**2);
  return f;
}
function stoneHeight(x,z){if(state.obstacles==='none')return 0;let h=0;for(const s of terrainStones){const q=((x-s.x)/s.rx)**2+((z-s.z)/s.rz)**2;if(q<1)h+=s.h*(1-q)**.65;}return h*state.rough/.04;}
function terrainRaw(x,z){return baseHeight(x,z)+state.rough*(roughField(x,z)-roughField(0,0))+stoneHeight(x,z);}
function buildTerrain(){const t=terrain;t.values=new Float32Array((t.nx+1)*(t.nz+1));t.min=Infinity;t.max=-Infinity;for(let i=0;i<=t.nx;i++)for(let j=0;j<=t.nz;j++){const y=terrainRaw(t.x0+i*t.step,t.z0+j*t.step);t.values[i*(t.nz+1)+j]=y;t.min=Math.min(t.min,y);t.max=Math.max(t.max,y);}t.cutY=sensor(pose(0),state.ch).y;}
function height(x,z=0){if(!terrain.values)return terrainRaw(x,z);const t=terrain,fx=clamp((x-t.x0)/t.step,0,t.nx),fz=clamp((z-t.z0)/t.step,0,t.nz),i=Math.min(t.nx-1,Math.floor(fx)),j=Math.min(t.nz-1,Math.floor(fz)),u=fx-i,v=fz-j,k=i*(t.nz+1)+j,h00=t.values[k],h10=t.values[k+t.nz+1],h01=t.values[k+1],h11=t.values[k+t.nz+2];return u>=v?h00+(h10-h00)*u+(h11-h10)*v:h00+(h11-h01)*u+(h01-h00)*v;}
function pose(progress){const c=typeof routeAt==='function'?routeAt(progress):{x:progress,z:0,heading:0},ch=Math.cos(c.heading),sh=Math.sin(c.heading);const support=(f,z)=>height(c.x+f*ch-z*sh,c.z+f*sh+z*ch),fl=support(.24,-.235),fr=support(.24,.235),rl=support(-.24,-.235),rr=support(-.24,.235),pitch=Math.atan2((fl+fr-rl-rr)/2,.48),roll=-Math.atan2((fr+rr-fl-rl)/2,.47);const q=new THREE.Quaternion().setFromAxisAngle(V(0,1,0),-c.heading).multiply(new THREE.Quaternion().setFromAxisAngle(V(0,0,1),pitch)).multiply(new THREE.Quaternion().setFromAxisAngle(V(1,0,0),roll));return {x:c.x,z:c.z,heading:c.heading,y:(fl+fr+rl+rr)/4,pitch,roll,q};}
function rotate(v,a){return V(v.x*Math.cos(a)-v.y*Math.sin(a),v.x*Math.sin(a)+v.y*Math.cos(a),v.z);}
function sensor(p,h){return V(0,h,0).applyQuaternion(p.q).add(V(p.x,p.y,p.z??0));}
function sensorDir(p,v,tilt){return rotate(v,-tilt*D).applyQuaternion(p.q);}
function cutElevation(){return terrain.cutY??sensor(pose(0),state.ch).y;}
function ray(o,d,min=.001,max=Infinity){
  const g=terrain;if(!g.values)return null;let lo=min,hi=Math.min(max,150);
  for(const [origin,dir,a,b] of [[o.x,d.x,g.x0,g.x1],[o.z,d.z,g.z0,g.z1],[o.y,d.y,g.min-1e-5,g.max+1e-5]]){if(Math.abs(dir)<1e-12){if(origin<a||origin>b)return null;}else{let ta=(a-origin)/dir,tb=(b-origin)/dir;if(ta>tb)[ta,tb]=[tb,ta];lo=Math.max(lo,ta);hi=Math.min(hi,tb);if(lo>hi)return null;}}
  const eps=1e-8,s=g.step,nz=g.nz+1;let at=lo,i=clamp(Math.floor((o.x+d.x*(at+eps)-g.x0)/s),0,g.nx-1),j=clamp(Math.floor((o.z+d.z*(at+eps)-g.z0)/s),0,g.nz-1),sx=d.x>0?1:-1,sz=d.z>0?1:-1;
  let tx=Math.abs(d.x)<1e-12?Infinity:(g.x0+(i+(sx>0?1:0))*s-o.x)/d.x,tz=Math.abs(d.z)<1e-12?Infinity:(g.z0+(j+(sz>0?1:0))*s-o.z)/d.z;
  const dx=Math.abs(d.x)<1e-12?Infinity:s/Math.abs(d.x),dz=Math.abs(d.z)<1e-12?Infinity:s/Math.abs(d.z);
  for(let count=0;count<g.nx+g.nz+5&&i>=0&&i<g.nx&&j>=0&&j<g.nz&&at<=hi+eps;count++){
    const end=Math.min(tx,tz,hi),k=i*nz+j,h00=g.values[k],h10=g.values[k+nz],h01=g.values[k+1],h11=g.values[k+nz+1],x0=g.x0+i*s,z0=g.z0+j*s;
    let first=Infinity;
    for(let tri=0;tri<2;tri++){const bx=(tri===0?h10-h00:h11-h01)/s,bz=(tri===0?h11-h10:h01-h00)/s,den=d.y-bx*d.x-bz*d.z;if(Math.abs(den)<1e-12)continue;const t=(h00+bx*(o.x-x0)+bz*(o.z-z0)-o.y)/den;if(t<at-eps||t>end+eps||t<min||t>max)continue;const u=(o.x+d.x*t-x0)/s,v=(o.z+d.z*t-z0)/s;if(u< -1e-6||u>1+1e-6||v< -1e-6||v>1+1e-6||(tri===0?v>u+1e-6:u>v+1e-6))continue;first=Math.min(first,t);}
    if(first<Infinity)return {p:V(o.x+d.x*first,o.y+d.y*first,o.z+d.z*first),t:first};
    if(end>=hi-eps)break;const crossX=tx<=end+eps,crossZ=tz<=end+eps;at=end;if(crossX){i+=sx;tx+=dx;}if(crossZ){j+=sz;tz+=dz;}
  }return null;
}
