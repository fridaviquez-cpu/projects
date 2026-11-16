import { ComputeVisualBody, type VisualRecipe } from "@workspace/api-zod";
import { evaluator, parseExpression } from "./visual-expressions";

export function calculateRecipe(courseId:string,input:unknown,values:Record<string,number>={}){
  const parsed=ComputeVisualBody.parse({courseId,model:"custom",values,recipe:input});
  const recipe=parsed.recipe as VisualRecipe;
  if(!recipe)throw Error("A visual recipe is required.");
  const keys=recipe.controls.map(c=>c.key);
  if(new Set(keys).size!==keys.length||keys.some(k=>!/^[A-Za-z][A-Za-z0-9_]{0,24}$/.test(k)||["x","n","pi","e","constructor","prototype","__proto__"].includes(k)))throw Error("Invalid parameter names.");
  if(Object.keys(values).some(k=>!keys.includes(k)))throw Error("Unknown parameter.");
  const controls=recipe.controls.map(c=>{
    const value=values[c.key]??c.value;
    if(![c.min,c.max,c.step,c.value,value].every(Number.isFinite)||c.min>=c.max||c.step<=0||value<c.min||value>c.max||c.value<c.min||c.value>c.max||(c.step===1&&!Number.isInteger(value)))throw Error(`Invalid ${c.label} parameter.`);
    return {...c,value};
  });
  const v=Object.fromEntries(controls.map(c=>[c.key,c.value])),run=evaluator();
  const panels=recipe.plots.map(p=>({...p,series:p.curves.map(s=>{
    const lo=run(parseExpression(s.min),v),hi=run(parseExpression(s.max),v),count=run(parseExpression(s.samples),v),formula=parseExpression(s.expression);
    if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo>=hi||!Number.isInteger(count)||count<2||count>513)throw Error("Plot ranges must increase and contain 2–513 samples.");
    return {name:s.name,mode:s.mode,points:Array.from({length:count},(_,i)=>{
      const x=lo+(hi-lo)*i/(count-1),y=run(formula,{...v,x});
      if(!Number.isFinite(y)||Math.abs(y)>1e100)throw Error("Plot contains an unbounded result.");
      return{x,y};
    })};
  })}));
  const first=panels[0]!;
  return {courseId,model:"custom",recipe,title:recipe.title,explanation:recipe.explanation,assumptions:recipe.assumptions,controls,panels,
    formula:recipe.plots.flatMap(p=>p.curves.map(s=>`${s.name}: ${s.expression}`)).join("\n"),xLabel:first.xLabel,yLabel:first.yLabel,series:first.series};
}

export const recipeInstructions=`When an existing model is not a direct fit, construct a custom visual, not an unrelated preset.
Return {model:"custom",values:{},recipe:{title,explanation,assumptions,controls:[{key,label,unit,min,max,step,value}],plots:[{title,xLabel,yLabel,curves:[{name,expression,min,max,samples,mode:"line"|"points"}]}]},unsupportedReason:""}.
Max 8 controls, 4 plots, 4 curves each. Expression/min/max/samples are STRINGS. Controls use simple variable names except x,n,pi,e. x is plotted coordinate; pi is constant.
Arithmetic + - * / ^ parentheses and functions sin cos tan exp log log2 sqrt abs floor ceil min(a,b) max(a,b) lt(a,b) eq(a,b) if(condition,yes,no).
sum(count,expression-in-n,start) evaluates a finite sum (integer count1..256), binds n, supports nested sums with operation budget.
fft(signal-expression-in-n,N,k) computes actual radix2 FFT magnitude for real sequence, power-of-two N2..256, integer bin k0..N-1. Signal expression must NOT use x. For zero-padding use if(lt(n,L),signal,0).
Plot samples2..513; ranges and samples may depend on controls. Points mode must be used for discrete samples; do not interpolate them as a continuous transform.
For DTFT/DFT/FFT comparison: demonstrate a finite real sequence, DTFT magnitude via sqrt(sum(L,signal*cos(2*pi*x*n),0)^2+sum(L,signal*sin(2*pi*x*n),0)^2) on dense cycles/sample x, DFT at k/N using same sum with x=k/N, FFT magnitude fft(if(lt(n,L),signal,0),N,x*N) at same x values. Choose N=2^ceil(log2(L)+padding), constrain L and padding so N<=256; samples N; x range0..(N-1)/N. FFT is an algorithm for exactly the same DFT, not a third transform. Explain finite-window leakage and zero-padding interpolates spectrum, not increased observation resolution. Include signal plot if useful. No invented runtimes; operation counts must be labeled theoretical.
Generalize to piecewise waveforms, polynomial/exponential curves, distributions, conditional densities, convolution by finite sums, frequency responses, comparisons, parameter sweeps and algorithm costs. Explicitly state assumptions, units and illustrative choices. Do NOT claim AI formulas are verified; interpreter validates arithmetic, not physics. Missing user values can use clearly stated illustrative defaults. Ask a precise clarifying question only when a consequential ambiguity cannot use a labeled default.
For requests that cannot be represented safely (3D geometry, arbitrary circuit solving etc), return model:null with an explanation of the missing capability and a relevant next step or clarification for THIS request, never an unrelated example.`;
