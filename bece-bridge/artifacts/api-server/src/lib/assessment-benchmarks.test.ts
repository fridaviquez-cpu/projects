import assert from "node:assert/strict";
import { makeQuestions } from "./bridge-learning";

// Independent identities, not an LLM grading its own output.
// These check the supported numerical templates, not arbitrary generated prose.
for(let i=0;i<200;i++){
  const [dc,complex,rc]=makeQuestions();
  const values=(s:string)=>(s.match(/\d+(?:\.\d+)?/g)??[]).map(Number);
  const [v,r1,r2]=values(dc!.prompt);
  assert.ok(Math.abs(dc!.expected*(r1!+r2!)-v!)<1e-10,"KVL");
  const [a,b]=values(complex!.prompt);
  assert.ok(Math.abs(complex!.expected**2-a!**2-b!**2)<1e-10,"Pythagorean identity");
  const [c,r]=values(rc!.prompt);
  assert.ok(Math.abs(rc!.expected/1000-r!*1000*c!*1e-6)<1e-10,"RC dimensional conversion to seconds");
}
console.log("PASS: 200 randomized KVL, complex-magnitude and RC-unit benchmarks.");
