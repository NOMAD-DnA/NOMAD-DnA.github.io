/* NOMAD factory v1 — map geometry reconstructed from the archived SDF.
 * Public API: createNomadScene(element) -> update / setMode / setRoof / resize / dispose.
 * World convention: x east, y north, z up, yaw about +z. Pose is the GT vehicle body.
 * Lighting, location halo, and vehicle finish are presentation styling, not sensor data.
 */
(function () {
  'use strict';
  window.createNomadScene = function createNomadScene(container) {
    const T = window.THREE, data = window.NOMAD_SCENE_DATA;
    if (!T || !data) throw new Error('THREE and NOMAD_SCENE_DATA must be loaded before scene.js');
    const scene = new T.Scene();
    scene.background = new T.Color('#dfe8e8');
    scene.fog = new T.Fog('#dfe8e8', 100, 180);
    const camera = new T.PerspectiveCamera(48, 1, .08, 220); camera.up.set(0, 0, 1);
    const renderer = new T.WebGLRenderer({antialias:true, alpha:false, powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-label','실험 맵의 3D 재현. 드래그로 회전, 휠로 확대 및 축소');
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab;';
    container.appendChild(renderer.domElement);
    const resources = new Set(), looseTextures=[];
    const remember = v => (resources.add(v), v);
    const standard = props => remember(new T.MeshStandardMaterial({roughness:.89, metalness:0, ...props}));
    const unitBox = remember(new T.BoxGeometry(1,1,1));
    const matrix = new T.Matrix4(), quaternion = new T.Quaternion();
    const up = new T.Vector3(0,0,1), zero = new T.Vector3(), vecScale = new T.Vector3();
    const sunlight = new T.DirectionalLight(0xfff5db, 2.7); sunlight.position.set(-35,-38,65); sunlight.castShadow=true;
    sunlight.shadow.mapSize.set(2048,2048); sunlight.shadow.camera.left=-52; sunlight.shadow.camera.right=52;
    sunlight.shadow.camera.top=45; sunlight.shadow.camera.bottom=-45; sunlight.shadow.camera.near=1; sunlight.shadow.camera.far=140;
    sunlight.shadow.bias=-.00015; sunlight.shadow.normalBias=.035; scene.add(sunlight);
    scene.add(new T.AmbientLight(0xffffff,.55));
    const skyLight = new T.HemisphereLight(0xd5e5fa,0x7c8368,1.55);skyLight.position.set(0,0,100);scene.add(skyLight);
    const fill = new T.DirectionalLight(0xe3efff,.7);fill.position.set(25,30,30);scene.add(fill);

    // The original 80 x 60 m terrain, downsampled to 1 m. Photo-soil texture is
    // retained so the bare corridors and detailed exterior remain distinguishable.
    const terrain = data.terrain, terrainGeometry = remember(new T.BufferGeometry());
    terrainGeometry.setAttribute('position',new T.Float32BufferAttribute(terrain.vertices.flat(),3));
    const uv=[],indices=[];
    for(let j=0;j<terrain.height;j++)for(let i=0;i<terrain.width;i++)uv.push(i/(terrain.width-1),j/(terrain.height-1));
    for(let j=0;j<terrain.height-1;j++)for(let i=0;i<terrain.width-1;i++){
      const a=j*terrain.width+i,b=a+1,c=a+terrain.width,d=c+1;indices.push(a,b,d,a,d,c);
    }
    terrainGeometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));terrainGeometry.setIndex(indices);terrainGeometry.computeVertexNormals();
    const texture = new T.TextureLoader().load(terrain.texture);texture.colorSpace=T.SRGBColorSpace;
    texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);looseTextures.push(texture);
    const ground = new T.Mesh(terrainGeometry,standard({map:texture,color:0xd4d8cc}));ground.receiveShadow=true;scene.add(ground);
    const plinth = new T.Mesh(remember(new T.BoxGeometry(80,60,.9)),standard({color:0x889586}));plinth.position.z=-.58;plinth.receiveShadow=true;scene.add(plinth);
    const floor = new T.Mesh(remember(new T.PlaneGeometry(300,300)),standard({color:0xc7d2c7}));floor.position.z=-1.05;floor.receiveShadow=true;scene.add(floor);

    const building = new T.Group(), roof = new T.Group();scene.add(building,roof);
    const boxGroups = new Map();
    for(const item of data.boxes){
      const isRoof = /^(factory_roof|roof_vent_|vent_cap_)/.test(item.name);
      const key = (isRoof?'roof:':'body:')+item.color.join(',');
      if(!boxGroups.has(key))boxGroups.set(key,{isRoof,color:item.color,items:[]});boxGroups.get(key).items.push(item);
    }
    for(const group of boxGroups.values()){
      const color = new T.Color(...group.color).convertSRGBToLinear();
      const mesh = new T.InstancedMesh(unitBox,standard({color}),group.items.length);
      group.items.forEach((b,i)=>{
        const p=b.pose;quaternion.setFromEuler(new T.Euler(p[3],p[4],p[5],'XYZ'));
        matrix.compose(new T.Vector3(p[0],p[1],p[2]),quaternion,vecScale.fromArray(b.size));mesh.setMatrixAt(i,matrix);
      });
      mesh.castShadow=true;mesh.receiveShadow=true;(group.isRoof?roof:building).add(mesh);
    }
    roof.visible=false;

    // Actual mesh silhouettes, placements, scales and source colors; instanced
    // per original material rather than inventing a denser forest for this run.
    for(const kind of ['pine_tree','broadleaf_tree','rock']){
      const objects=[...data.trees,...data.rocks].filter(o=>o.kind===kind),asset=data.assets[kind];
      if(!objects.length)continue;
      for(const g of asset.groups){
        const geometry=remember(new T.BufferGeometry());geometry.setAttribute('position',new T.Float32BufferAttribute(asset.vertices.flat(),3));
        geometry.setIndex(g.indices);geometry.computeVertexNormals();
        const mesh=new T.InstancedMesh(geometry,standard({color:new T.Color(...g.color).convertSRGBToLinear(),flatShading:true}),objects.length);
        objects.forEach((o,i)=>{
          const p=o.pose;quaternion.setFromEuler(new T.Euler(p[3],p[4],p[5]));matrix.compose(new T.Vector3(p[0],p[1],p[2]),quaternion,vecScale.fromArray(o.scale));mesh.setMatrixAt(i,matrix);
        });mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
      }
    }

    // Representative NOMAD body; dimensions and wheel centers follow model.sdf.
    const vehicle = new T.Group();scene.add(vehicle);
    const bodyMat=standard({color:0x1765bb,roughness:.38,metalness:.25}),blackMat=standard({color:0x15232d,roughness:.7}),silverMat=standard({color:0xbac5ce,metalness:.5,roughness:.35});
    function carBox(size,pos,mat){const mesh=new T.Mesh(remember(new T.BoxGeometry(...size)),mat);mesh.position.set(...pos);mesh.castShadow=true;vehicle.add(mesh);return mesh;}
    carBox([.85,.5,.12],[0,0,.23],bodyMat);carBox([.42,.43,.13],[-.08,0,.355],silverMat);
    carBox([.18,.31,.1],[.29,0,.34],blackMat);carBox([.045,.32,.035],[.385,0,.4],silverMat);
    const sensor=carBox([.055,.21,.055],[.395,0,.42],blackMat);
    const glass=standard({color:0x6cc9eb,metalness:.1,roughness:.1});
    carBox([.007,.04,.035],[.427,-.074,.425],glass);carBox([.007,.04,.035],[.427,.074,.425],glass);
    const wheelGeo=remember(new T.CylinderGeometry(.15,.15,.08,16));
    for(const x of [-.36,.36])for(const y of [-.30,.30]){const wheel=new T.Mesh(wheelGeo,blackMat);wheel.position.set(x,y,.15);wheel.castShadow=true;vehicle.add(wheel);}
    const haloGeo=remember(new T.RingGeometry(.68,.78,48));
    const halo=new T.Mesh(haloGeo,remember(new T.MeshBasicMaterial({color:0x42b8fc,transparent:true,opacity:.78,side:T.DoubleSide,depthWrite:false})));halo.position.z=.045;vehicle.add(halo);
    // A tiny world-space arrow identifies heading without changing the vehicle geometry.
    const arrow=new T.Mesh(remember(new T.ConeGeometry(.12,.32,3)),remember(new T.MeshBasicMaterial({color:0x39bcff})));
    arrow.rotation.z=-Math.PI/2;arrow.position.set(1.02,0,.08);vehicle.add(arrow);

    let mode='follow', disposed=false, lastPose={x:-30,y:-7,z:.03,yaw:0},lastTime=null;
    let azimuth=-2.28,elevation=.76,distance=64,orbitCenter=new T.Vector3(0,1,0);
    let dragging=false,pointer=null,followDistance=9.5,followElevation=15,needsImmediate=true;
    const desiredPosition=new T.Vector3(),desiredTarget=new T.Vector3(),lookTarget=new T.Vector3();
    // A steep follow view keeps the small vehicle readable in the 6 m corridors.
    // Test sightlines against the real building boxes; adjust only the viewpoint,
    // never remove walls or alter the experiment geometry to make the car visible.
    const sightBlocks=data.boxes.filter(b=>b.size[2]>.35&&!/^(factory_roof|roof_vent_|vent_cap_)/.test(b.name));
    const sightTarget=new T.Vector3(),candidatePosition=new T.Vector3();
    function blockedSightline(from,to){
      for(const b of sightBlocks){
        const p=b.pose,c=Math.cos(p[5]),s=Math.sin(p[5]);
        const ax=from.x-p[0],ay=from.y-p[1],bx=to.x-p[0],by=to.y-p[1];
        const a=[c*ax+s*ay,-s*ax+c*ay,from.z-p[2]],z=[c*bx+s*by,-s*bx+c*by,to.z-p[2]];
        let lo=.015,hi=.995,hit=true;
        for(let k=0;k<3;k++){
          const half=b.size[k]/2+.035,delta=z[k]-a[k];
          if(Math.abs(delta)<1e-8){if(a[k]<-half||a[k]>half){hit=false;break;}}
          else{let q=(-half-a[k])/delta,r=(half-a[k])/delta;if(q>r){const t=q;q=r;r=t;}lo=Math.max(lo,q);hi=Math.min(hi,r);if(lo>hi){hit=false;break;}}
        }
        if(hit)return true;
      }
      return false;
    }
    function followView(p,c,s){
      sightTarget.set(p.x,p.y,p.z+.35);
      const choices=[
        [followDistance,followDistance*.13,followElevation],
        [followDistance,0,followElevation+3],
        [followDistance*.8,-followDistance*.15,followElevation+5],
        [followDistance*.45,0,followElevation+6],
        [Math.min(1.5,followDistance*.15),0,followElevation+5]
      ];
      for(const [back,side,height] of choices){
        candidatePosition.set(p.x-back*c+side*s,p.y-back*s-side*c,p.z+height);
        desiredPosition.copy(candidatePosition);
        if(!blockedSightline(sightTarget,candidatePosition))break;
      }
      desiredTarget.set(p.x+.6*c,p.y+.6*s,p.z+.3);
    }
    const renderCamera=(immediate=false)=>{
      const p=lastPose,c=Math.cos(p.yaw),s=Math.sin(p.yaw);
      if(mode==='camera'){
        desiredPosition.set(p.x+.47*c,p.y+.47*s,p.z+.43);
        desiredTarget.set(p.x+20*c,p.y+20*s,p.z+.43);vehicle.visible=false;
      }else if(mode==='follow'){
        followView(p,c,s);vehicle.visible=true;
      }else{
        desiredPosition.set(orbitCenter.x+distance*Math.cos(elevation)*Math.cos(azimuth),orbitCenter.y+distance*Math.cos(elevation)*Math.sin(azimuth),orbitCenter.z+distance*Math.sin(elevation));
        desiredTarget.copy(orbitCenter);vehicle.visible=true;
      }
      const a=immediate||mode==='camera'?1:.13;camera.position.lerp(desiredPosition,a);lookTarget.lerp(desiredTarget,a);if(mode==='follow'&&blockedSightline(sightTarget,camera.position))camera.position.copy(desiredPosition);camera.lookAt(lookTarget);
    };
    function resize(){const w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
    function update(pose,phase,time){
      if(!pose||!Number.isFinite(pose.x)||!Number.isFinite(pose.y))return;
      lastPose={x:pose.x,y:pose.y,z:Number.isFinite(pose.z)?pose.z:.03,yaw:Number.isFinite(pose.yaw)?pose.yaw:0};
      vehicle.position.set(lastPose.x,lastPose.y,lastPose.z);vehicle.rotation.z=lastPose.yaw;
      if(lastTime===null||Math.abs((time||0)-lastTime)>1)needsImmediate=true;lastTime=time||0;
      halo.material.opacity=.68+.15*Math.sin((time||0)*3);
    }
    function setMode(next){
      if(!['follow','orbit','camera'].includes(next))return;
      if(next==='orbit'&&mode!=='orbit'){
        orbitCenter.set(1,0,1);distance=67;azimuth=-2.15;elevation=.79;
      }
      mode=next;needsImmediate=true;container.dataset.sceneMode=next;
    }
    function setRoof(value){roof.visible=Boolean(value);}
    function onDown(e){if(e.button!==0)return;dragging=true;pointer={x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);renderer.domElement.style.cursor='grabbing';if(mode!=='orbit')setMode('orbit');}
    function onMove(e){if(!dragging||!pointer)return;azimuth-=(e.clientX-pointer.x)*.006;elevation=Math.max(.12,Math.min(1.48,elevation+(e.clientY-pointer.y)*.004));pointer={x:e.clientX,y:e.clientY};needsImmediate=true;}
    function onUp(e){dragging=false;pointer=null;renderer.domElement.style.cursor='grab';}
    function onWheel(e){e.preventDefault();if(mode==='camera')return;if(mode==='follow'){followDistance=Math.max(4,Math.min(35,followDistance*Math.exp(e.deltaY*.001)));followElevation=Math.max(10,followDistance*1.58);}else distance=Math.max(4,Math.min(115,distance*Math.exp(e.deltaY*.001)));needsImmediate=true;}
    renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointermove',onMove);renderer.domElement.addEventListener('pointerup',onUp);renderer.domElement.addEventListener('pointercancel',onUp);renderer.domElement.addEventListener('wheel',onWheel,{passive:false});
    const observer=new ResizeObserver(resize);observer.observe(container);resize();update(lastPose,0,0);renderCamera(true);
    let request=0,lastRender=0;
    function animate(now){if(disposed)return;request=requestAnimationFrame(animate);if(now-lastRender<22)return;lastRender=now;renderCamera(needsImmediate);needsImmediate=false;renderer.render(scene,camera);}
    request=requestAnimationFrame(animate);
    function dispose(){disposed=true;cancelAnimationFrame(request);observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointermove',onMove);renderer.domElement.removeEventListener('pointerup',onUp);renderer.domElement.removeEventListener('pointercancel',onUp);renderer.domElement.removeEventListener('wheel',onWheel);
      resources.forEach(r=>r.dispose());looseTextures.forEach(r=>r.dispose());renderer.dispose();renderer.domElement.remove();
    }
    return {update,setMode,setRoof,resize,dispose,getMode:()=>mode,
      getPingView:()=>({id:"factory-scene",canvas:renderer.domElement,scene,camera})};
  };
})();
