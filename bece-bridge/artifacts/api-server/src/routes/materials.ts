import { Router, type IRouter } from "express";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import { randomUUID } from "node:crypto";
import { db, bridgeMaterials, bridgeResources, bridgeVisuals } from "@workspace/db";
import { and, eq, arrayContains } from "drizzle-orm";
import { objectStorageClient, ObjectStorageService } from "../lib/objectStorage";
import { configuredCourses } from "../lib/pilot-courses";
import { deleteMaterialRecords } from "../lib/material-lifecycle";

const router: IRouter = Router();
const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:1}});
const storage = new ObjectStorageService();
const counts = new Map<string,{n:number;until:number}>();
router.use("/materials", (req,res,next) => {
  res.setHeader("Cache-Control","no-store");
  if (!req.isAuthenticated()) { res.status(401).json({error:"Log in to access private materials."}); return; }
  if(req.method==="POST"){
    const now=Date.now(), old=counts.get(req.user.id);
    if(counts.size>10000) for(const [key,value] of counts) if(value.until<now) counts.delete(key);
    if(old && old.until>now && old.n>=10){res.status(429).json({error:"Upload limit reached. Try again in an hour."});return;}
    counts.set(req.user.id,{n:old&&old.until>now?old.n+1:1,until:old&&old.until>now?old.until:now+3600000});
  }
  next();
});
router.get("/materials",async(req,res)=>{
  const rows=await db.select().from(bridgeMaterials).where(eq(bridgeMaterials.ownerId,req.user!.id));
  res.json(rows.map(r=>({id:r.id,courseId:r.courseId,title:r.title,pageCount:r.pages.length,createdAt:r.createdAt.toISOString()})));
});
router.post("/materials", (req,res,next)=>upload.single("file")(req,res,err=>{
  if(err){res.status(400).json({error:"Upload one PDF or text file, at most 5 MB."});return;}next();
}),async(req,res)=>{
  const file=req.file, courseId=req.body.courseId;
  if(!file || !(await configuredCourses()).some(c => c.id === courseId && c.isPilot)){res.status(400).json({error:"Select an enabled pilot course and file."});return;}
  let pages:{page:number;text:string}[]=[];
  if(file.buffer.subarray(0,5).toString()==="%PDF-"){
    const parser=new PDFParse({data:file.buffer});
    try{
      const info=await parser.getInfo();
      if(info.total>100){res.status(400).json({error:"Maximum 100 PDF pages per upload."});return;}
      const result=await parser.getText();
      pages=result.pages.map(p=>({page:p.num,text:p.text}));
    }catch{res.status(422).json({error:"Could not read this PDF. Use an unencrypted PDF with selectable text."});return;}
    finally{await parser.destroy();}
  }else if(/\.txt$/i.test(file.originalname) && !file.buffer.includes(0)){
    pages=[{page:1,text:file.buffer.toString("utf8")}];
  }else{res.status(415).json({error:"Only selectable-text PDF and UTF-8 text files are supported. Images, slides, and scanned PDFs need conversion first."});return;}
  if(pages.every(p=>p.text.trim().length<20) || pages.reduce((n,p)=>n+p.text.length,0)>300000){res.status(422).json({error:"No usable text, or too much text. Scanned pages need OCR; upload a smaller selectable-text document."});return;}
  const id=randomUUID(), dir=storage.getPrivateObjectDir().replace(/^\/+/,"");
  const [bucket,...parts]=dir.split("/");
  const objectName=`${parts.join("/")}/materials/${id}`;
  const object=objectStorageClient.bucket(bucket!).file(objectName);
  await object.save(file.buffer,{resumable:false,metadata:{contentType:"application/octet-stream"}});
  try{
    const [row]=await db.insert(bridgeMaterials).values({id,ownerId:req.user!.id,courseId,title:file.originalname.slice(0,160),objectPath:`/objects/materials/${id}`,pages}).returning();
    res.status(201).json({id,courseId,title:row!.title,pageCount:pages.length,createdAt:row!.createdAt.toISOString()});
  }catch(err){await object.delete({ignoreNotFound:true});throw err;}
});
router.get("/materials/:id",async(req,res)=>{
  const [row]=await db.select().from(bridgeMaterials).where(and(eq(bridgeMaterials.id,String(req.params.id)),eq(bridgeMaterials.ownerId,req.user!.id)));
  if(!row){res.status(404).json({error:"Material not found."});return;}
  res.json({id:row.id,title:row.title,pages:row.pages});
});
router.delete("/materials/:id",async(req,res)=>{
  const [row]=await db.select().from(bridgeMaterials).where(and(eq(bridgeMaterials.id,String(req.params.id)),eq(bridgeMaterials.ownerId,req.user!.id)));
  if(!row){res.status(404).json({error:"Material not found."});return;}
  try{
    const file=await storage.getObjectEntityFile(row.objectPath);
    await file.delete({ignoreNotFound:true});
  }catch(error){
    if(!(error instanceof Error && error.name==="ObjectNotFoundError")) throw error;
  }
  await deleteMaterialRecords(row.id, req.user!.id, row.courseId);
  res.status(204).end();
});
export default router;
