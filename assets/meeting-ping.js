/** Anonymous, transient meeting pointers. No recordings, media, or identity. */
import {connectMeeting} from './meeting-ping-transport.js';
import {canonicalPath, validPing, selectorFor, pointInRect} from './meeting-ping-core.js';

if (!document.querySelector('nomad-meeting-ping')) start();
function start() {
  const TTL=5000, embedded=window!==window.top;
  const host=document.createElement('nomad-meeting-ping');
  host.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  const shadow=host.attachShadow({mode:'open'});
  shadow.innerHTML=`<style>
    :host{font:12px/1.4 system-ui,sans-serif;color:#eef3f8}
    .panel{position:absolute;right:14px;bottom:14px;pointer-events:auto;background:#182433f2;border:1px solid #64748b;border-radius:12px;padding:8px 10px;box-shadow:0 3px 18px #0003;max-width:270px}
    .row{display:flex;gap:9px;align-items:center}button{font:600 13px system-ui;color:#fff;background:#334155;border:1px solid #8192a7;border-radius:7px;padding:7px 12px;cursor:pointer}
    button[aria-pressed=true]{background:#c73535;border-color:#ffb1ab}button:focus-visible{outline:3px solid #f4b860;outline-offset:2px}
    .status{font-size:11px;color:#c7d2df;white-space:nowrap}.hint{font-size:11px;color:#c7d2df;margin-top:5px} .note{color:#f8b4ac}
    .marker{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border:3px solid #ff3636;border-radius:50%;box-sizing:border-box;box-shadow:0 0 0 2px #fff,0 0 8px #0006;background:#ff282826;pointer-events:none}
    .marker:before{content:'';position:absolute;inset:-8px;border:2px solid #ff3636;border-radius:50%;animation:ripple 1.1s ease-out infinite}
    .marker:after{content:'';position:absolute;width:6px;height:6px;left:9px;top:9px;background:#ff3636;border-radius:50%}
    .tag{position:absolute;top:34px;left:50%;transform:translateX(-50%);background:#812626ed;color:white;white-space:nowrap;padding:2px 5px;border-radius:4px;font:11px system-ui}
    @keyframes ripple{to{transform:scale(1.6);opacity:0}}@media(prefers-reduced-motion:reduce){.marker:before{animation:none}}
    @media(max-width:600px){.panel{right:8px;bottom:8px;max-width:235px}}
  </style><div class="panel"><div class="row"><button aria-pressed="false" title="핑 모드에서 클릭하면 같은 페이지의 참여자에게 5초 동안 표시됩니다. Esc로 종료합니다.">핑 켜기</button><span class="status" role="status">연결 중</span></div><div class="hint" hidden>클릭해서 공유 · 5초 후 사라짐 · Esc 종료</div></div><div class="markers" aria-hidden="true"></div>`;
  document.documentElement.append(host);
  const button=shadow.querySelector('button'), status=shadow.querySelector('.status'), hint=shadow.querySelector('.hint'), markers=shadow.querySelector('.markers');
  if(embedded) shadow.querySelector('.panel').style.display='none';
  const peers=new Set(), seen=new Set(), active=[], plotlyGraphs=new Map();
  let enabled=false, action, room, lastSent=0, raf=0, stopped=false, received=0;
  const stats={sent:0,received:0};
  function connection(message) {
    status.textContent=message || (peers.size?`상대 ${peers.size}명 연결`:'상대 접속 대기');
    host.dataset.peers=String(peers.size);
  }
  function setMode(value,fromParent=false) {
    enabled=Boolean(value); button.setAttribute('aria-pressed',String(enabled));button.textContent=enabled?'핑 끄기':'핑 켜기';hint.hidden=!enabled;
    document.documentElement.style.setProperty('--nomad-ping-cursor',enabled?'crosshair':'');
    documentCursor.textContent=enabled?'html *{cursor:crosshair!important}':'';
    for(const frame of document.querySelectorAll('iframe')){try{frame.contentWindow.postMessage({nomadMeeting:'mode',enabled},location.origin);}catch{/* Cross-origin frames have their own controls. */}}
    if(!fromParent && embedded) window.parent.postMessage({nomadMeeting:'mode',enabled},location.origin);
  }
  const documentCursor=document.createElement('style');document.head.append(documentCursor);
  button.addEventListener('click',()=>setMode(!enabled));
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&enabled)setMode(false);if(e.altKey&&e.code==='KeyP'&&!e.repeat&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){e.preventDefault();setMode(!enabled);}});
  window.addEventListener('message',e=>{
    if(e.origin!==location.origin||e.data?.nomadMeeting!=='mode')return;
    if(e.source===window.parent&&embedded)setMode(e.data.enabled,true);
    else if([...document.querySelectorAll('iframe')].some(f=>f.contentWindow===e.source))setMode(e.data.enabled);
  });
  // A freshly loaded embedded viewer inherits its parent's current ping mode.
  if(embedded){try{const p=parent.document.querySelector('nomad-meeting-ping');setMode(p?.shadowRoot?.querySelector('button')?.getAttribute('aria-pressed')==='true',true);}catch{}}
  function adapters(){return window.NomadPingAdapters?.()||[];}
  function threeViews(){return [...(window.sim?.pingViews||[]),...(window.nomadScene?.getPingView?[window.nomadScene.getPingView()]:[])].filter(v=>v?.canvas&&v.scene&&v.camera);}
  function hitThree(view,e){
    const T=window.THREE;if(!T)return null;
    const r=view.canvas.getBoundingClientRect(), ray=new T.Raycaster();
    ray.params.Points.threshold=.12;
    ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),view.camera);
    const hits=ray.intersectObjects(view.scene.children,true);
    const hit=hits.find(h=>{let o=h.object; if(!o.isMesh&&!o.isPoints)return false;while(o){if(!o.visible)return false;o=o.parent;}return true;});
    return hit?{kind:'three',view:view.id,point:hit.point.toArray()}:null;
  }
  function capture(e){
    const adapter=adapters().find(v=>v.canvas===e.target);
    if(adapter){const point=adapter.pick(e.clientX,e.clientY);if(point)return {kind:'map',view:adapter.id,point};}
    const view=threeViews().find(v=>v.canvas===e.target);
    if(view){const hit=hitThree(view,e);if(hit)return hit;}
    const el=e.target.closest('canvas,video,img,svg,h1,h2,h3,p,li,a,button,section,article')||e.target;
    const r=el.getBoundingClientRect();
    return r.width&&r.height?{kind:'element',selector:selectorFor(el),point:[(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height]}:null;
  }
  function ownEvent(e){return e.composedPath().includes(host);}
  function plotOf(target){return target.closest?.('.modebar')?null:target.closest?.('.js-plotly-plot');}
  document.addEventListener('pointerdown',e=>{
    if(!enabled||ownEvent(e)||e.button!==0)return;
    if(!plotOf(e.target)){e.preventDefault();e.stopImmediatePropagation();}
  },true);
  document.addEventListener('click',e=>{
    if(!enabled||ownEvent(e)||e.button!==0)return;
    const gd=plotOf(e.target);
    if(gd){
      // gl3d emits its point event during rendering, sometimes before mouseup.
      // Commit after mouseup; never relayout recursively inside a render callback.
      setTimeout(()=>{if(!enabled)return;const hovered=plotlyGraphs.get(gd)?.last;
        send(hovered&&performance.now()-hovered.time<800?hovered.packet:capture(e));
      },120);return;
    }
    e.preventDefault();e.stopImmediatePropagation();send(capture(e));
  },true);
  function send(payload){
    const now=performance.now();if(!payload||now-lastSent<180)return;lastSent=now;
    const packet={v:1,id:crypto.randomUUID(),...payload};if(!validPing(packet))return;
    remember(packet.id);display(packet);stats.sent++;host.dataset.sent=String(stats.sent);
    if(action&&peers.size)action.send(packet);
    else connection('상대 접속 대기 · 내 화면에만 표시');
  }
  function remember(id){seen.add(id);if(seen.size>256)seen.delete(seen.values().next().value);}
  function receive(packet){
    if(!validPing(packet)||seen.has(packet.id))return;
    // Bound incoming traffic independently of display frame rate.
    const now=performance.now();if(now-received<90)return;received=now;remember(packet.id);
    stats.received++;host.dataset.received=String(stats.received);display(packet);
  }
  function display(packet){
    if(active.length>=8)remove(active[0]);
    host.dataset.lastKind=packet.kind;
    const item={packet,until:performance.now()+TTL};active.push(item);
    {item.el=document.createElement('div');item.el.className='marker';item.el.dataset.kind=packet.kind;item.el.dataset.point=JSON.stringify(packet.point);item.el.innerHTML='<span class="tag">핑</span>';markers.append(item.el);}
    if(raf)cancelAnimationFrame(raf);
    draw(performance.now());
  }
  function remove(item){const i=active.indexOf(item);if(i>=0)active.splice(i,1);item.el?.remove();}
  function position(packet){
    if(packet.kind==='element'){
      let el;try{el=document.querySelector(packet.selector);}catch{return null;}
      if(!el)return null;const r=el.getBoundingClientRect();return {x:r.left+r.width*packet.point[0],y:r.top+r.height*packet.point[1],r};
    }
    if(packet.kind==='map'){
      const v=adapters().find(v=>v.id===packet.view);return v?{...v.project(packet.point),r:v.canvas.getBoundingClientRect()}:null;
    }
    if(packet.kind==='plotly'){
      // These saved viewers bundle Plotly. Read its existing camera matrices only;
      // relayout inside a gl3d point event can recursively redraw the same event.
      const [selector,name]=packet.view.split('|');let gd;try{gd=document.querySelector(selector);}catch{return null;}
      const scene=gd?._fullLayout?.[name]?._scene, camera=scene?.glplot?.cameraParams;
      if(!scene||!camera?.projection||!camera.view||!camera.model)return null;
      const axes=['x','y','z'],point=packet.point.map((n,i)=>scene.fullSceneLayout[axes[i]+'axis'].r2l(n)*scene.dataScale[i]);
      const mul=(matrix,v)=>[0,1,2,3].map(i=>v.reduce((sum,n,j)=>sum+matrix[4*j+i]*n,0));
      const clip=mul(camera.projection,mul(camera.view,mul(camera.model,[...point,1]))),r=scene.container.getBoundingClientRect();
      if(!clip[3])return null;
      return {x:r.left+(.5+.5*clip[0]/clip[3])*r.width,y:r.top+(.5-.5*clip[1]/clip[3])*r.height,r,behind:clip[3]<0};
    }
    if(packet.kind==='three'){
      const v=threeViews().find(v=>v.id===packet.view),T=window.THREE;if(!v||!T)return null;
      const r=v.canvas.getBoundingClientRect(),p=new T.Vector3(...packet.point).project(v.camera);
      return {x:r.left+(p.x+1)/2*r.width,y:r.top+(1-p.y)/2*r.height,r,behind:p.z>1};
    }
    return null;
  }
  function draw(now){
    raf=0;
    for(const item of [...active]){
      if(now>=item.until){remove(item);continue;}
      if(!item.el)continue;
      const p=position(item.packet);
      if(!p||p.r.width<=0||p.r.height<=0){item.el.hidden=true;continue;}
      const bounded=pointInRect(p.x,p.y,p.r,innerWidth,innerHeight);
      item.el.hidden=!bounded;if(!bounded)continue;
      item.el.style.left=bounded.x+'px';item.el.style.top=bounded.y+'px';
      item.el.querySelector('.tag').textContent=(bounded.outside||p.behind)?'화면 밖 핑':(item.packet.kind==='element'?'화면 핑':'핑');
    }
    if(active.length)raf=requestAnimationFrame(draw);
  }
  function watchPlots(){
    for(const gd of document.querySelectorAll('.js-plotly-plot')){
      if(plotlyGraphs.has(gd)||!gd.on||!gd.data)continue;
      const record={last:null};plotlyGraphs.set(gd,record);host.dataset.plots=String(plotlyGraphs.size);
      function pointPacket(event){
        const point=event.points?.find(p=>(p.fullData?.type||p.data?.type)==='scatter3d');if(!point)return null;
        return {kind:'plotly',view:selectorFor(gd)+'|'+(point.fullData?.scene||point.data?.scene||'scene'),point:[point.x,point.y,point.z]};
      }
      gd.on('plotly_hover',event=>{const packet=pointPacket(event);if(packet)record.last={packet,time:performance.now()};});
      gd.on('plotly_unhover',()=>{record.last=null;});
      gd.on('plotly_click',event=>{
        if(!enabled)return;host.dataset.plotlyEvents=String(1+Number(host.dataset.plotlyEvents||0));
        const packet=pointPacket(event);if(!packet)return;
        record.last={packet,time:performance.now()};
      });
    }
  }
  watchPlots();host.dataset.plots=String(plotlyGraphs.size);let plotPoll=setInterval(watchPlots,1800);
  async function connect(){
    if(!window.isSecureContext){connection('HTTPS로 열어야 공유 가능');return;}
    try{
      room=await connectMeeting(location.host+canonicalPath(location.pathname),{
        onPeers:next=>{peers.clear();for(const id of next)peers.add(id);connection();},
        onMessage:receive,onStatus:connection
      });action=room;connection();
    }catch{connection('연결 실패 · 새로고침');}
  }
  connect();
  window.addEventListener('pagehide',()=>{if(stopped)return;stopped=true;clearInterval(plotPoll);documentCursor.remove();if(raf)cancelAnimationFrame(raf);room?.leave();});
  window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
}
