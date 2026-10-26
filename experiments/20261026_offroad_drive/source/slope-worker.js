'use strict';
// Points are [forward x, elevation y, lateral z] in metres.
// This estimator has no access to the simulated road height or slope.
function smallestEigen(a){
  const v=[1,0,0,0,1,0,0,0,1];
  for(let it=0;it<16;it++){
    let p=0,q=1;
    if(Math.abs(a[2])>Math.abs(a[1])){p=0;q=2;}
    if(Math.abs(a[5])>Math.abs(a[p*3+q])){p=1;q=2;}
    if(Math.abs(a[p*3+q])<1e-14)break;
    const ap=a[p*3+p],aq=a[q*3+q],apq=a[p*3+q];
    const phi=.5*Math.atan2(2*apq,aq-ap),c=Math.cos(phi),s=Math.sin(phi);
    for(let r=0;r<3;r++)if(r!==p&&r!==q){const rp=a[r*3+p],rq=a[r*3+q];a[r*3+p]=a[p*3+r]=c*rp-s*rq;a[r*3+q]=a[q*3+r]=s*rp+c*rq;}
    a[p*3+p]=c*c*ap-2*c*s*apq+s*s*aq;a[q*3+q]=s*s*ap+2*c*s*apq+c*c*aq;a[p*3+q]=a[q*3+p]=0;
    for(let r=0;r<3;r++){const vp=v[r*3+p],vq=v[r*3+q];v[r*3+p]=c*vp-s*vq;v[r*3+q]=s*vp+c*vq;}
  }
  let k=0;if(a[4]<a[0])k=1;if(a[8]<a[k*3+k])k=2;
  return {value:Math.max(0,a[k*3+k]),normal:[v[k],v[3+k],v[6+k]]};
}
self.onmessage=({data})=>{
  const started=performance.now(),{id,signature,inputs,res,radius,x}=data;
  const points=[],seen=new Set();
  for(const input of inputs)for(let i=0;i<input.length;i+=3){const a=input[i],b=input[i+1],c=input[i+2],key=((Math.floor(a/.03)+4096)*8192+Math.floor(c/.03)+4096)*8192+Math.floor((b+1e-6)/.03)+4096;if(seen.has(key))continue;seen.add(key);points.push([a,b,c,Math.floor(a/.03)*1048576+Math.floor(c/.03)]);}
  const hash=new Map(),key=(i,j)=>i*1048576+j;
  for(const p of points){const ix=Math.floor(p[0]/res),iz=Math.floor(p[2]/res),k=key(ix,iz);if(!hash.has(k))hash.set(k,{ix,iz,points:[]});hash.get(k).points.push(p);}
  const reach=Math.ceil(radius/res)+1,r2=radius*radius,rows=[],reasons=[0,0,0,0,0],offsets=[];let valid=0;
  for(let dx=-reach;dx<=reach;dx++)for(let dz=-reach;dz<=reach;dz++)if((Math.max(0,Math.abs(dx)-.5)*res)**2+(Math.max(0,Math.abs(dz)-.5)*res)**2<=r2)offsets.push([dx,dz]);
  for(const cell of hash.values()){
    const cx=(cell.ix+.5)*res,cz=(cell.iz+.5)*res,near=[],bins=new Set();
    for(const [dx,dz] of offsets){
      const bucket=hash.get(key(cell.ix+dx,cell.iz+dz));if(!bucket)continue;
      for(const p of bucket.points)if((p[0]-cx)**2+(p[2]-cz)**2<=r2){near.push(p);bins.add(p[3]);}
    }
    const n=near.length;let status=0,angle=NaN,rms=NaN,minor=0,ratio=0;
    if(n<12)status=1;else if(bins.size<6)status=2;else{
      let mx=0,my=0,mz=0;for(const p of near){mx+=p[0];my+=p[1];mz+=p[2];}mx/=n;my/=n;mz/=n;
      let xx=0,xy=0,xz=0,yy=0,yz=0,zz=0;for(const p of near){const a=p[0]-mx,b=p[1]-my,c=p[2]-mz;xx+=a*a;xy+=a*b;xz+=a*c;yy+=b*b;yz+=b*c;zz+=c*c;}
      xx/=n;xy/=n;xz/=n;yy/=n;yz/=n;zz/=n;
      const disc=Math.hypot(xx-zz,2*xz),small=Math.max(0,(xx+zz-disc)/2),big=(xx+zz+disc)/2;minor=Math.sqrt(small);ratio=big>0?small/big:0;
      if(minor<.01||ratio<.02)status=3;else{
        const eig=smallestEigen([xx,xy,xz,xy,yy,yz,xz,yz,zz]);rms=Math.sqrt(eig.value);const [nx,ny,nz]=eig.normal;angle=Math.atan2(Math.hypot(nx,nz),Math.abs(ny))*180/Math.PI;
        if(rms>.01)status=4;
      }
    }
    if(status===0)valid++;reasons[status]++;
    // x-cell, z-cell, status, slope, support count, RMS, minor spread, spread ratio, own points, XY bins.
    rows.push(cell.ix,cell.iz,status,angle,n,rms,minor,ratio,cell.points.length,bins.size);
  }
  const result=new Float64Array(rows);
  self.postMessage({id,signature,x,res,radius,rows:result,points:points.length,observed:hash.size,valid,reasons,ms:performance.now()-started},[result.buffer]);
};
