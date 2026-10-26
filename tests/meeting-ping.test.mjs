import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalPath,validPing,pointInRect} from '../assets/meeting-ping-core.js';

test('same page uses the same room despite index.html and trailing slash',()=>{
  assert.equal(canonicalPath('/experiments/index.html'),canonicalPath('/experiments/'));
  assert.equal(canonicalPath('/'),'/');
  assert.notEqual(canonicalPath('/experiments/'),canonicalPath('/scenarios/'));
});
test('reject malformed or unbounded remote coordinates before rendering',()=>{
  const base={v:1,id:'test-1',kind:'three',view:'world',point:[1,2,3]};
  assert.equal(validPing(base),true);
  for(const point of [[NaN,1,2],[Infinity,0,0],[1e12,0,0],[1,2],['1',2,3]]) assert.equal(validPing({...base,point}),false);
  assert.equal(validPing({...base,kind:'unknown'}),false);
  assert.equal(validPing({...base,kind:'element',selector:'#map',point:[.3,.8]}),true);
  assert.equal(validPing({...base,kind:'element',selector:'#map',point:[-1,1]}),false);
  assert.equal(validPing({...base,kind:'plotly',view:'#plot|scene2'}),true);
  assert.equal(validPing({...base,kind:'plotly',view:'#plot|untrusted.layout'}),false);
});
test('offscreen pings remain at the visible map edge; fully hidden map is suppressed',()=>{
  assert.deepEqual(pointInRect(100,100,{left:0,top:0,right:800,bottom:500},1000,700),{x:100,y:100,outside:false});
  assert.deepEqual(pointInRect(10000,-100,{left:0,top:0,right:800,bottom:500},1000,700),{x:782,y:18,outside:true});
  assert.deepEqual(pointInRect(200,110,{left:100,top:100,right:300,bottom:124},1000,700),{x:200,y:112,outside:true});
  assert.equal(pointInRect(1,1,{left:0,top:800,right:800,bottom:1000},1000,700),null);
});
