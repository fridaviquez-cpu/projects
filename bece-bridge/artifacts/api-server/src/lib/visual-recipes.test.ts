import assert from "node:assert/strict";
import { evaluator, parseExpression } from "./visual-expressions";
import { calculateRecipe } from "./visual-recipes";
const evaluate=(s:string,v:Record<string,number>={})=>evaluator()(parseExpression(s),v);
assert.equal(evaluate("-2^2+3*4"),8);
assert.equal(evaluate("if(eq(x,0),1,sin(x)/x)",{x:0}),1);
assert.equal(evaluate("sum(4,n,0)"),6);
// Reusable expressions rather than one preset per topic: circuit, probability,
// waveform, algorithm-cost, and finite convolution reference values.
assert.equal(evaluate("V*(1-exp(-x/(R*C)))",{V:5,x:0,R:2,C:10}),0);
assert.ok(Math.abs(evaluate("rate*exp(-rate*x)",{rate:2,x:0.5})-2/Math.E)<1e-12);
assert.equal(evaluate("a*sin(2*pi*f*x)+b*cos(2*pi*g*x)",{a:2,b:3,f:1,g:2,x:0}),3);
assert.equal(evaluate("x*log2(x)",{x:16}),64);
assert.equal(evaluate("sum(3,if(lt(x-n,0),0,if(lt(x-n,3),1,0)),0)",{x:2}),3);
for(const s of ["process.exit()","constructor(1)","x.foo","import('x')","[1,2]","1;2","sin(1,2)","unknown(x)","sum(9999,n,0)","1/0","sqrt(-1)"])assert.throws(()=>evaluate(s,{x:1}));
for(const N of [2,4,8,16,32,64]){
  for(let k=0;k<N;k++){
    const v={N,k};
    const direct=evaluate("sqrt(sum(N,(cos(2*pi*0.17*n)+0.3*sin(2*pi*0.31*n))*cos(2*pi*k*n/N),0)^2+sum(N,(cos(2*pi*0.17*n)+0.3*sin(2*pi*0.31*n))*sin(2*pi*k*n/N),0)^2)",v);
    const fast=evaluate("fft(cos(2*pi*0.17*n)+0.3*sin(2*pi*0.31*n),N,k)",v);
    assert.ok(Math.abs(direct-fast)<1e-9);
  }
}
const recipe={title:"Quadratic response",explanation:"Illustrative parameterized polynomial.",assumptions:"Dimensionless example.",controls:[{key:"a",label:"Coefficient",unit:"",min:1,max:4,step:1,value:2}],plots:[{title:"Curve",xLabel:"x",yLabel:"y",curves:[{name:"y",expression:"a*x^2",min:"0",max:"2",samples:"3",mode:"line"}]}]};
for(const course of ["110","120","210","220","310","313","329","330","333","340","342","391"]){
  assert.equal(calculateRecipe(course,recipe).series[0]!.points[2]!.y,8);
  assert.equal(calculateRecipe(course,recipe,{a:3}).series[0]!.points[2]!.y,12);
}
assert.throws(()=>calculateRecipe("110",recipe,{a:6}));
assert.throws(()=>calculateRecipe("110",{...recipe,plots:[{...recipe.plots[0],curves:[{...recipe.plots[0]!.curves[0],samples:"999999"}]}]}));
console.log("Safe expressions, Fourier FFT/DFT equivalence, course-agnostic recipes, edits and rejected inputs passed.");
