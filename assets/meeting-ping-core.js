/** Shared coordinate and packet validation, independent of the transport. */
export function canonicalPath(path){return path.replace(/\/index\.html$/i,'/').replace(/\/+$/,'')||'/';}
export function validPing(p){
  if(!p||p.v!==1||typeof p.id!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(p.id))return false;
  if(!Array.isArray(p.point)||!p.point.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1e8))return false;
  if(p.kind==='element')return p.point.length===2&&p.point.every(n=>n>=0&&n<=1)&&typeof p.selector==='string'&&p.selector.length<=1000&&/^[a-zA-Z0-9_#.:()> \-\\]+$/.test(p.selector);
  if(!['three','map','plotly'].includes(p.kind)||typeof p.view!=='string'||p.view.length>1100)return false;
  if(p.kind==='plotly'&&!/^.+\|scene\d*$/.test(p.view))return false;
  return p.point.length===(p.kind==='map'?2:3);
}
export function selectorFor(el){
  const parts=[];let node=el;
  while(node&&node.nodeType===1&&parts.length<14){
    if(node.id&&/^[a-zA-Z][\w-]*$/.test(node.id)){parts.unshift('#'+node.id);break;}
    const tag=node.localName, siblings=[...(node.parentElement?.children||[])].filter(n=>n.localName===tag);
    parts.unshift(tag+(siblings.length>1?`:nth-of-type(${siblings.indexOf(node)+1})`:''));node=node.parentElement;
  }
  return parts.join(' > ');
}
export function pointInRect(x,y,r,width,height){
  if(!Number.isFinite(x)||!Number.isFinite(y))return null;
  const loX=Math.max(18,r.left+18), hiX=Math.min(width-18,r.right-18),loY=Math.max(18,r.top+18),hiY=Math.min(height-48,r.bottom-18);
  if(hiX<loX||hiY<loY)return null;
  return {x:Math.max(loX,Math.min(hiX,x)),y:Math.max(loY,Math.min(hiY,y)),outside:x<loX||x>hiX||y<loY||y>hiY};
}
