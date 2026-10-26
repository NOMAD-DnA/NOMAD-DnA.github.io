// Ideal object labels and first visible surface. No neural-network inference is run.
const semanticClasses={ground:0,tree:1,rock:2,background:3};
const obstacleMeshes=[],obstacleDefinitions=[
  {kind:1,x:4.2,z:.04,r:.17,h:2.35},
  {kind:1,x:10.7,z:1.05,r:.14,h:2.05},
  {kind:2,x:2.6,z:-.85,rx:.36,ry:.24,rz:.30},
  {kind:2,x:7.8,z:.02,rx:.42,ry:.29,rz:.34},
  {kind:2,x:11.7,z:-.85,rx:.32,ry:.25,rz:.30},
  {kind:2,x:13.7,z:1.3,rx:.38,ry:.28,rz:.34}
];
const semanticRaycaster=new THREE.Raycaster(),semanticIntersection=V(),semanticHitBuffer=[];
function tagSemantic(obj,kind){obj.userData.semantic=kind;return obj;}
function registerObstacle(mesh,kind,parent){tagSemantic(mesh,kind);parent.add(mesh);obstacleMeshes.push({mesh,kind,box:null});return mesh;}
function placeObstacles(parent){obstacleMeshes.length=0;if(state.obstacles==='none')return;
  for(const o of obstacleDefinitions){if(state.obstacles==='rocks'&&o.kind===1)continue;const y=height(o.x,o.z);
    if(o.kind===1){const trunk=registerObstacle(new THREE.Mesh(new THREE.CylinderGeometry(o.r*.85,o.r,o.h,12),material(0x6f5037)),1,parent);trunk.position.set(o.x,y+o.h/2-.03,o.z);
      for(let i=0;i<2;i++){const crown=registerObstacle(new THREE.Mesh(new THREE.IcosahedronGeometry(.65-i*.09,1),material(i?0x75834c:0x506a3f)),1,parent);crown.position.set(o.x+(i?.14:-.08),y+o.h-.22+i*.45,o.z+(i?.12:-.09));crown.scale.set(1,.8,1);}
    }else{const rock=registerObstacle(new THREE.Mesh(new THREE.DodecahedronGeometry(1,1),material(0x8a877b,{flatShading:true})),2,parent);rock.position.set(o.x,y+o.ry*.62,o.z);rock.scale.set(o.rx,o.ry,o.rz);rock.rotation.y=o.x*.7;}
  }
}
function cacheObstacleBounds(){env.updateMatrixWorld(true);for(const item of obstacleMeshes)item.box=new THREE.Box3().setFromObject(item.mesh);}
function semanticHit(o,d,min=.001,max=8){const hit=ray(o,d,min,max),length=d.length();let best=hit?{...hit,kind:stoneHeight(hit.p.x,hit.p.z)>.008?2:0}:null;
  semanticRaycaster.ray.origin.copy(o);semanticRaycaster.ray.direction.copy(d).multiplyScalar(1/length);semanticRaycaster.near=min*length;semanticRaycaster.far=(best?best.t:max)*length;
  for(const item of obstacleMeshes){if(!item.box||!semanticRaycaster.ray.intersectsBox(item.box))continue;semanticHitBuffer.length=0;semanticRaycaster.intersectObject(item.mesh,false,semanticHitBuffer);if(!semanticHitBuffer.length)continue;const h=semanticHitBuffer[0],t=h.distance/length;if(!best||t<best.t){best={p:h.point.clone(),t,kind:item.kind};semanticRaycaster.far=h.distance;}}
  return best;
}
const semanticDirections=[];for(let j=0;j<48;j++)for(let i=0;i<64;i++)semanticDirections.push(V(1,-(2*(j+.5)/48-1)*Math.tan(27*D),(2*(i+.5)/64-1)*Math.tan(34.5*D)));
function sampleSemantics(x){const p=pose(x),origin=sensor(p,state.ch),hits=[];for(const d0 of semanticDirections){const h=semanticHit(origin,sensorDir(p,d0,state.ct),.4,8);if(h&&Math.abs(h.p.z)<=5&&h.p.x>=-2&&h.p.x<=22)hits.push(h.p.x,h.p.y,h.p.z,h.kind);}return new Float32Array(hits);}
