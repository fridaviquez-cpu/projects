import {readFileSync,existsSync} from "node:fs";
import assert from "node:assert/strict";
const names=["ece-curriculum-expert","source-grounded-ai","engineering-visualization","engineering-verification","learning-science","bece-design-system","competitive-product-research","quality-assurance"];
for(const name of names){
  const file=`.agents/skills/${name}/SKILL.md`;
  assert.ok(existsSync(file),`Missing ${file}`);
  const text=readFileSync(file,"utf8");
  const front=text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(front,`Missing frontmatter: ${name}`);
  assert.ok(front[1].split("\n").includes(`name: ${name}`));
  const description=front[1].match(/^description: (.+)$/m)?.[1];
  assert.ok(description&&description.length<=1024&&description.includes("Use "));
  for(const section of ["Activation","Instructions","Quality standards","Acceptance criteria","Activation example"])assert.ok(text.includes(`## ${section}\n`),`${name}: missing ${section}`);
  assert.ok(text.split("\n").length<500);
  console.log(`PASS ${file} — metadata, activation, workflow and acceptance criteria`);
}
console.log("8/8 project skills structurally valid. Platform auto-routing is not independently instrumented by this check.");
