import test from 'node:test';
import assert from 'node:assert/strict';
import { importTs } from './helpers/import-ts.mjs';
const { sceneLabelStyle,layoutBodyLabels }=await importTs(new URL('../core/sceneLabels.ts',import.meta.url));

test('label roles have bounded CSS sizes; tiny regions fade rather than becoming microscopic',()=>{
 for(const extent of [0,.001,1,20,40,100,1000,1e12]) {
  for(const role of ['body','region','star','grid','constellation']) {
   const s=sceneLabelStyle(role,extent);assert.ok(s.fontSize>=10&&s.fontSize<=30);assert.ok(s.opacity>=0&&s.opacity<=1);
  }
 }
 assert.equal(sceneLabelStyle('region',10).opacity,0);
 assert.ok(sceneLabelStyle('region',50).fontSize<sceneLabelStyle('region',200).fontSize);
 assert.equal(sceneLabelStyle('body',.00001).fontSize,sceneLabelStyle('body',1e10).fontSize);
});
test('body names keep their own anchor when neighbours move, reorder or overlap',()=>{
 const make=(id,x=150,y=150)=>({id,text:'天体'+id,x,y,radius:2,opacity:1,color:'#aaa',priority:40,emphasized:false});
 const labels=[make('A'),make('B'),make('C')];
 const single=layoutBodyLabels([labels[0]],300,300)[0];
 const crowded=layoutBodyLabels(labels,300,300);
 assert.equal(crowded.length,3,'overlap must not suppress names');
 assert.deepEqual(crowded[0],single);
 assert.deepEqual(layoutBodyLabels([...labels].reverse(),300,300).find(l=>l.id==='A'),single);
 const moved=layoutBodyLabels([{...labels[0],x:180,y:123},make('B',180,123)],300,300)[0];
 assert.equal(moved.x-single.x,30);assert.equal(moved.y-single.y,-27);
});
test('viewport edges never relocate a body name; invisible and invalid labels remain filtered',()=>{
 const label={id:'a',text:'天体',x:-2,y:299,radius:3,opacity:1,color:'#aaa',priority:40,emphasized:false};
 const a=layoutBodyLabels([label],300,300)[0];
 assert.equal(a.x,-2);assert.ok(a.y>300);
 assert.deepEqual(a,layoutBodyLabels([label],1000,600)[0]);
 assert.equal(layoutBodyLabels([{...label,opacity:0},{...label,x:NaN}],300,300).length,0);
});
