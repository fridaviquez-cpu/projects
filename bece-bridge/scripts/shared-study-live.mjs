// Run against development only. Creates four anonymous drafts, then deletes them.
// Retrieval/citation assertions and factual answer checks are reported separately.
import assert from "node:assert/strict";
const base = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}/api` : "";
assert.ok(base, "Run in the development workspace");
const cases = [
  {courseId:"110", topic:"Use Ohm's law: an ideal 2000 ohm resistor has 10 V across it. Find current in mA. End with BENCHMARK: followed by your calculated current in mA.", label:"S-ohm", answer:/BENCHMARK:\s*5(?:\.0+)?\s*mA/i},
  {courseId:"120", topic:"Evaluate the XOR gate output for A=1 and B=1. Explain. End with BENCHMARK: followed by the output bit.", label:"S-gates", answer:/BENCHMARK:\s*0\b/i},
  {courseId:"210", topic:"For an ideal inductor L=0.02 H at angular frequency omega=1000 rad/s, calculate impedance. End with BENCHMARK: j followed by the reactance in ohms.", label:"S-impedance", answer:/BENCHMARK:\s*j\s*20(?:\.0+)?\s*(?:ohm|Ω)/i},
  {courseId:"220", topic:"Trace this valid C pointer code: int x=4; int *p=&x; *p=9; What is x now? Do not claim you executed it. End with BENCHMARK: followed by the final integer.", label:"S-pointers", answer:/BENCHMARK:\s*9\b/i},
];
// Oracles are independent arithmetic/truth-table/language-semantics expectations.
assert.equal(10/2000*1000,5);
assert.equal(1^1,0);
assert.equal(1000*0.02,20);
await Promise.all(cases.map(async c=>{
  let cookie = "", resource;
  const headers = () => ({"Content-Type":"application/json", ...(cookie ? {cookie} : {})});
  try {
    const response = await fetch(`${base}/bridge/resources`, {method:"POST",headers:headers(),body:JSON.stringify({courseId:c.courseId,topic:c.topic,kind:"explanation",sourceMode:"library"})});
    cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
    resource = await response.json();
    assert.equal(response.status,200,JSON.stringify(resource));
    assert.ok(resource.sources.some(s=>s.kind.includes(`[${c.label}]`)));
    assert.ok(resource.content.includes(`[${c.label}]`));
    assert.match(resource.content,/creativecommons.org\/licenses\/by-sa\/4.0/);
    assert.equal(resource.materialIds.length,0);
    console.log(`ECE ${c.courseId}: retrieval/citation PASS`);
    const body = resource.content.split("## Retrieved evidence")[0].replaceAll("*","");
    assert.match(body,c.answer);
    console.log(`ECE ${c.courseId}: factual benchmark PASS`);
    const saved = await fetch(`${base}/bridge/resources`, {headers:headers()}).then(r=>r.json());
    assert.ok(saved.some(r=>r.id===resource.id && r.content===resource.content), "Persisted draft lost provenance");
  } finally {
    if (resource?.id) {
      const removed = await fetch(`${base}/bridge/resources/${resource.id}`,{method:"DELETE",headers:headers()});
      assert.equal(removed.status,204);
    }
  }
}));
