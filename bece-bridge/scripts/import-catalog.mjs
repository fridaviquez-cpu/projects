// Explicit metadata refresh; no runtime scraping or restricted course-material ingestion.
import { readFile, writeFile, mkdir } from "node:fs/promises";
const url = "https://catalog.illinois.edu/courses-of-instruction/ece/";
const html = process.argv[2] ? await readFile(process.argv[2], "utf8") : await (await fetch(url)).text();
const text = (s) => s.replace(/<[^>]+>/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const checkedAt = new Date().toISOString();
const courses = [...html.matchAll(/<p class="courseblocktitle">([\s\S]*?)<\/p>\s*<p class="courseblockdesc">([\s\S]*?)<\/p>/g)].map((m) => {
  const heading = text(m[1]);
  const parts = heading.match(/^ECE\s+(\d+)\s+(.+?)\s+credit:\s+(.+?)\s*$/);
  if (!parts) throw new Error(`Unrecognized course heading: ${heading}`);
  const [, id, title, credits] = parts;
  const description = text(m[2]);
  return { id, code: `ECE ${id}`, title, credits, description, prerequisites: description.match(/Prerequisite:\s*(.*)/)?.[1] ?? "No prerequisite stated in the catalog. Check the current course schedule for restrictions.", level: Math.floor(Number(id) / 100) * 100, coverage: id === "210" ? "pilot" : "catalog", topics: id === "210" ? ["Circuit fundamentals", "Complex numbers", "RC response"] : [], sources: [{title: "Illinois 2026–2027 Academic Catalog", url: `${url}#ECE${id}`, kind: "Official course metadata", checkedAt}, {title: "Illinois Course Explorer",url:`https://courses.illinois.edu/schedule/terms/ECE/${id}`,kind:"Official course schedule",checkedAt}] };
});
if (courses.length < 100 || !courses.some(c=>c.id==="210")) throw new Error("Catalog incomplete; refusing to replace snapshot");
courses.find(c=>c.id==="210").sources.push({title:"HKN ECE 210 Course Wiki",url:"https://wiki.hkn.illinois.edu/Course%20Wiki/ECE%20Course%20Offerings/ECE210/",kind:"Student guide; not an official syllabus",checkedAt});
await mkdir("artifacts/api-server/src/data", {recursive:true});
await writeFile("artifacts/api-server/src/data/courses.json", JSON.stringify(courses,null,2));
console.log(`Imported ${courses.length} courses from ${url}`);
