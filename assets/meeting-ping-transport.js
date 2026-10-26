/** Public demo broker, clean session, QoS 0, no retained pointers or offline queue. */
import {connect} from './vendor/mqtt.js';
export async function connectMeeting(path,{onPeers,onMessage,onStatus}) {
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('nomad-dna-meeting-v1:'+path)))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const topic='nomad-dna/meeting/v1/'+hash, id=crypto.randomUUID(), peers=new Map();
  let ready=false, ended=false;
  const client=connect('wss://broker.emqx.io:8084/mqtt',{
    clientId:'nomad-'+id,clean:true,protocolVersion:4,keepalive:20,
    reconnectPeriod:3000,connectTimeout:12000,queueQoSZero:false,
    will:{topic,payload:JSON.stringify({type:'bye',id}),qos:0,retain:false}
  });
  function publish(data){if(!ready||ended)return;client.publish(topic,JSON.stringify(data),{qos:0,retain:false});}
  function presence(){publish({type:'hello',id});}
  function refresh(){const now=Date.now();for(const [peer,seen] of peers)if(now-seen>35000)peers.delete(peer);onPeers(new Set(peers.keys()));}
  client.on('connect',()=>{
    client.subscribe(topic,{qos:0},error=>{if(error){onStatus('연결 실패 · 재접속 중');return;}ready=true;onStatus(null);presence();});
  });
  client.on('offline',()=>{ready=false;peers.clear();refresh();onStatus('연결 끊김 · 재접속 중');});
  client.on('error',()=>{ready=false;onStatus('연결 대기 · 네트워크 확인');});
  client.on('message',(_topic,bytes,packet)=>{
    if(packet.retain||bytes.length>4096)return;
    let message;try{message=JSON.parse(bytes.toString());}catch{return;}
    if(typeof message?.id!=='string'||message.id.length>64||message.id===id)return;
    if(message.type==='bye'){peers.delete(message.id);refresh();return;}
    if(!['hello','here','ping'].includes(message.type))return;
    const isNew=!peers.has(message.id);if(peers.size>=100&&isNew)return;
    peers.set(message.id,Date.now());refresh();
    if(message.type==='hello'&&isNew)publish({type:'here',id});
    if(message.type==='ping')onMessage(message.payload);
  });
  const heartbeat=setInterval(()=>{refresh();presence();},10000);
  function leave(){if(ended)return;publish({type:'bye',id});ended=true;ready=false;clearInterval(heartbeat);client.end(true);}
  return {send:payload=>publish({type:'ping',id,payload}),leave};
}
