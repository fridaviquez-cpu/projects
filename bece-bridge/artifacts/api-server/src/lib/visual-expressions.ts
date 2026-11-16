// Tiny arithmetic interpreter. No eval, Function, property access, JS, imports or I/O.
type Node = {name:string;args:Node[]} | {value:number};
type Vars = Record<string,number>;
export function parseExpression(text:string):Node {
  if(text.length>800)throw Error("Expression is too long.");
  const tokens=text.match(/\d*\.?\d+(?:e[+-]?\d+)?|[a-zA-Z][a-zA-Z0-9_]*|[()+\-*/^,]/g)??[];
  if(tokens.join("")!==text.replace(/\s/g,"")||tokens.length>300)throw Error("Use arithmetic expressions only.");
  let i=0,depth=0;
  const expr=(min=0):Node=>{
    if(++depth>30)throw Error("Expression nesting is too deep.");
    const t=tokens[i++];let left:Node;
    if(t==="-"||t==="+")left={name:t==="-"?"neg":"pos",args:[expr(3)]};
    else if(t==="("){left=expr();if(tokens[i++]!==")")throw Error("Missing closing parenthesis.");}
    else if(t&&/^\d|^\./.test(t))left={value:Number(t)};
    else if(t&&/^[a-zA-Z]/.test(t)){
      const args:Node[]=[];
      if(tokens[i]==="("){i++; if(tokens[i]!==")"){do{args.push(expr());if(tokens[i]!==",")break;i++;}while(true);}if(tokens[i++]!==")")throw Error("Missing closing parenthesis.");}
      left={name:t,args};
    }else throw Error("Invalid expression.");
    while(i<tokens.length){
      const op=tokens[i]!,p=({"+":1,"-":1,"*":2,"/":2,"^":4} as Record<string,number>)[op];
      if(p===undefined||p<min)break;i++;left={name:op,args:[left,expr(p+(op==="^"?0:1))]};
    }
    depth--;return left;
  };
  const root=expr();if(i!==tokens.length)throw Error("Unexpected expression token.");return root;
}
export function evaluator(){
  let budget=4_000_000;
  const cache=new Map<string,number[]>();
  const run=(node:Node,v:Vars):number=>{
    if(--budget<0)throw Error("Calculation budget exceeded; reduce sample counts or nested sums.");
    if("value" in node)return node.value;
    const {name,args}=node;
    if(!args.length){if(name==="pi")return Math.PI;if(name==="e")return Math.E;if(Object.hasOwn(v,name))return v[name]!;throw Error(`Unknown variable ${name}.`);}
    if(name==="sum"){
      if(args.length!==3)throw Error("sum(count, expression-in-n, start) requires three arguments.");
      const count=run(args[0]!,v),start=run(args[2]!,v);
      if(!Number.isInteger(count)||count<1||count>256||!Number.isInteger(start))throw Error("Sum count must be an integer from 1 to 256.");
      let s=0;for(let n=start;n<start+count;n++)s+=run(args[1]!,{...v,n});return s;
    }
    if(name==="fft"){
      if(args.length!==3)throw Error("fft(signal-in-n, N, k) requires three arguments.");
      const N=run(args[1]!,v),k=run(args[2]!,v);
      if(!Number.isInteger(N)||N<2||N>256||(N&(N-1))!==0||Math.abs(k-Math.round(k))>1e-7||Math.round(k)<0||Math.round(k)>N-1)throw Error("FFT requires power-of-two N from 2 to 256 and integer bin k.");
      // x is the output-bin coordinate, not an input-signal parameter.
      const {x:_,...parameters}=v;
      const key=JSON.stringify([args[0],N,parameters]);
      let magnitudes=cache.get(key);
      if(!magnitudes){
        const transform=(a:{r:number;i:number}[]):{r:number;i:number}[]=>{
          if(a.length===1)return a;
          const even=transform(a.filter((_,j)=>j%2===0)),odd=transform(a.filter((_,j)=>j%2===1)),out=Array(a.length);
          for(let j=0;j<a.length/2;j++){const w=-2*Math.PI*j/a.length,c=Math.cos(w),s=Math.sin(w),r=c*odd[j]!.r-s*odd[j]!.i,im=s*odd[j]!.r+c*odd[j]!.i;out[j]={r:even[j]!.r+r,i:even[j]!.i+im};out[j+a.length/2]={r:even[j]!.r-r,i:even[j]!.i-im};}return out;
        };
        magnitudes=transform(Array.from({length:N},(_,n)=>({r:run(args[0]!,{...parameters,n}),i:0}))).map(z=>Math.hypot(z.r,z.i));cache.set(key,magnitudes);
      }return magnitudes[Math.round(k)]!;
    }
    // Conditional has lazy branches so removable singularities can be expressed explicitly.
    if(name==="if"){if(args.length!==3)throw Error("if(condition, yes, no) requires three arguments.");return run(args[run(args[0]!,v)?1:2]!,v);}
    const a=args.map(n=>run(n,v));
    const functions:Record<string,{arity:number;fn:(...a:number[])=>number}>={
      "+":{arity:2,fn:(a,b)=>a+b},"-":{arity:2,fn:(a,b)=>a-b},"*":{arity:2,fn:(a,b)=>a*b},"/":{arity:2,fn:(a,b)=>a/b},"^":{arity:2,fn:Math.pow},
      neg:{arity:1,fn:a=>-a},pos:{arity:1,fn:a=>a},sin:{arity:1,fn:Math.sin},cos:{arity:1,fn:Math.cos},tan:{arity:1,fn:Math.tan},exp:{arity:1,fn:Math.exp},log:{arity:1,fn:Math.log},log2:{arity:1,fn:Math.log2},sqrt:{arity:1,fn:Math.sqrt},abs:{arity:1,fn:Math.abs},floor:{arity:1,fn:Math.floor},ceil:{arity:1,fn:Math.ceil},min:{arity:2,fn:Math.min},max:{arity:2,fn:Math.max},lt:{arity:2,fn:(a,b)=>Number(a<b)},eq:{arity:2,fn:(a,b)=>Number(a===b)}
    };
    const f=Object.hasOwn(functions,name)?functions[name]:undefined;
    if(!f||f.arity!==a.length)throw Error(`Unknown function or wrong argument count: ${name}.`);
    const y=f.fn(...a);if(!Number.isFinite(y))throw Error("Formula is undefined in the requested range.");return y;
  };
  return run;
}
