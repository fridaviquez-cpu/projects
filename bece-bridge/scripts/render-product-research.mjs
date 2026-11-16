import {readFileSync,writeFileSync} from "node:fs";
const input=readFileSync("docs/bece-product-research.md","utf8");
const escape=s=>s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const inline=s=>escape(s).replace(/`([^`]+)`/g,"<code>$1</code>").replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/https:\/\/[^\s<]+/g,u=>`<a href="${u}" rel="noreferrer">${u}</a>`);
let html="",table=false,list=false;
const close=()=>{if(table){html+="</tbody></table></div>";table=false;}if(list){html+="</ul>";list=false;}};
for(const line of input.split("\n")){
  if(line.startsWith("|")){
    if(/^\|[\s|:-]+\|$/.test(line))continue;
    const cells=line.split("|").slice(1,-1).map(s=>s.trim());
    if(!table){close();table=true;html+='<div class="table-wrap" tabindex="0" aria-label="Scrollable comparison table"><table><thead><tr>'+cells.map(c=>`<th scope="col">${inline(c)}</th>`).join("")+"</tr></thead><tbody>";}
    else html+="<tr>"+cells.map(c=>`<td>${inline(c)}</td>`).join("")+"</tr>";
    continue;
  }
  if(line.startsWith("- ")){if(!list){close();html+="<ul>";list=true;}html+=`<li>${inline(line.slice(2))}</li>`;continue;}
  close();
  const heading=line.match(/^(#{1,3}) (.+)$/);
  if(heading)html+=`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`;
  else if(line.trim())html+=`<p>${inline(line)}</p>`;
}
close();
writeFileSync("docs/bece-product-research.html",`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BECE Bridge — Product Research &amp; Roadmap</title><style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f6f4ef;color:#172b49;font:16px/1.65 system-ui,sans-serif}header{background:#142a49;color:white;border-top:5px solid #f58220;padding:24px max(24px,calc((100vw - 1250px)/2));font-weight:750;letter-spacing:.05em}header span{color:#ffa85c}main{max-width:1300px;margin:auto;padding:32px 24px 64px}h1{font-size:clamp(28px,4vw,48px);line-height:1.12;max-width:950px;margin:12px 0 24px}h2{border-top:1px solid #d6d8db;padding-top:28px;margin-top:44px;font-size:26px;line-height:1.3}h3{font-size:21px;margin-top:30px}p,li{max-width:1000px}li{margin:8px 0}a{color:#1359a0;overflow-wrap:anywhere}code{font-size:.85em;background:#e9edf0;padding:2px 5px;border-radius:4px;overflow-wrap:anywhere}.table-wrap{overflow-x:auto;border:1px solid #d6d8db;border-radius:8px;background:white;margin:22px 0}.table-wrap:focus{outline:2px solid #d3630a}table{border-collapse:collapse;width:100%;font-size:13px;line-height:1.5}th{text-align:left;background:#142a49;color:white;padding:12px;min-width:110px}td{padding:12px;vertical-align:top;border-top:1px solid #e3e5e8;min-width:110px}tr:nth-child(even){background:#f7f8fa}footer{padding:24px;color:#576473;border-top:1px solid #ccc;text-align:center;font-size:13px}@media(max-width:600px){main{padding:22px 16px}table{min-width:760px}h2{font-size:23px}}@media print{body{background:white;font-size:10pt}header{padding:16px}main{max-width:none;padding:0}h1{font-size:25pt}h2{break-after:avoid;font-size:16pt}h3{break-after:avoid}p,li{max-width:none}table{font-size:7pt;min-width:0!important}th,td{min-width:0;padding:5px}thead{display:table-header-group}tr{break-inside:avoid}.table-wrap{overflow:visible;border:0}a{color:inherit;text-decoration:none}footer{display:none}@page{size:landscape;margin:14mm}}
</style></head><body><header>BECE <span>Bridge</span> · PRODUCT RESEARCH</header><main>${html}</main><footer>Evidence-based planning · Project-local development standards · No student data included</footer></body></html>`);
console.log("Rendered docs/bece-product-research.html");
