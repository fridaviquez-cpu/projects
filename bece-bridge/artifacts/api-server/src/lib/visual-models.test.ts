import assert from "node:assert/strict";
import { calculateVisual, visualModels } from "./visual-models";

const near=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
const value=(course:string,model:string,index:number,values:Record<string,number>={})=>calculateVisual(course,model,values).series[0]!.points[index]!.y;
near(value("110","ohm",120,{r:2}),6);
near(value("220","array",3,{base:1000,size:4}),1012);
near(value("210","sinusoid",50,{a:3,f:2,phase:0}),3);
near(value("210","rc",20,{r:2,cap:10,v:5}),5/Math.E);
near(value("310","fir",0,{n:4}),1);
near(value("310","fir",256,{n:4}),0);
near(value("313","normal",200),1/Math.sqrt(2*Math.PI));
near(value("329","wave",0),1);
near(value("333","solar",100),400);
near(value("340","diode",40),0);
near(value("342","amplifier",100,{gm:2,rd:2}),-40);
assert.deepEqual(calculateVisual("120","logic").series[0]!.points.map(p=>p.y),[0,0,0,1]);
const phases=calculateVisual("330","threephase").series;
for(let i=0;i<401;i++)near(phases.reduce((sum,s)=>sum+s.points[i]!.y,0),0);
const covered=new Set<string>();
for(const [id,m] of Object.entries(visualModels)){
  m.courses.forEach(c=>covered.add(c));
  for(const edge of ["min","max"] as const){
    const result=calculateVisual(m.courses[0]!,id,Object.fromEntries(m.controls.map(c=>[c.key,c[edge]])));
    assert.ok(result.series.every(s=>s.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))));
  }
  for(const control of m.controls){
    assert.throws(()=>calculateVisual(m.courses[0]!,id,{[control.key]:control.min-1}));
    assert.throws(()=>calculateVisual(m.courses[0]!,id,{[control.key]:NaN}));
  }
}
assert.equal(covered.size,11);
// Renderer capability must never depend on course number or current pilot rollout.
for(const id of Object.keys(visualModels)) {
  for(const courseId of ["110","120","210","220","310","313","329","330","333","340","342","391","future-course"]) {
    assert.equal(calculateVisual(courseId,id).courseId,courseId);
  }
}
assert.throws(()=>calculateVisual("310","fir",{n:2.5}));
assert.throws(()=>calculateVisual("110","ohm",{untrusted:1}));
console.log("All 12 visual models: reference values, edge bounds, 11-course coverage and invalid inputs passed.");
