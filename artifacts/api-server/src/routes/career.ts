import { Router, type IRouter } from "express";
import { rateLimit } from "express-rate-limit";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { AssistCareerBody, AssistCareerResponse, ExtractResumeBody, ExtractResumeResponse } from "@workspace/api-zod";
import { generateCareerDraft } from "../lib/career-ai";
import { careerAiLimiter, acquireCareerAiSlot } from "../lib/career-ai-limits";
import screenshotRouter from "./career-screenshots";

const router: IRouter = Router();
router.use(screenshotRouter);
const importLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, limit: 15, standardHeaders: "draft-8", legacyHeaders: false,
  message: { error: "Too many file imports. Please wait a few minutes and try again." },
});

router.post("/career/assist", careerAiLimiter, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = AssistCareerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Some career information is missing or too long. Check your inputs and try again." });
    return;
  }
  const input = parsed.data;
  if (input.mode === "feedback" && (!input.question?.trim() || !input.answer?.trim())) {
    res.status(400).json({ error: "Enter an interview question and your answer before requesting feedback." }); return;
  }
  if (input.mode === "questions" &&
      !input.records.some(r => r.kind === "opportunity" && r.id === input.opportunityId)) {
    res.status(400).json({ error: "Choose an available tracked opportunity first." }); return;
  }
  if (input.mode === "resume" && !input.instructions?.trim() &&
      !input.records.some(r => r.kind === "opportunity" && r.id === input.opportunityId)) {
    res.status(400).json({ error: "Choose a tracked opportunity or paste the job description before tailoring." }); return;
  }
  if (input.sourceResumeId && !input.records.some(r => r.id === input.sourceResumeId && r.kind === "resume")) {
    res.status(400).json({ error: "The selected resume is no longer available. Choose it again." }); return;
  }
  if (input.selectedExperienceIds?.some(id => !input.records.some(r => r.kind === "experience" && r.id === id))) {
    res.status(400).json({ error: "A selected Vault source is no longer available. Clear the selection and choose again." }); return;
  }
  const release = acquireCareerAiSlot();
  if (!release) {
    res.status(429).json({ error: "The coach is busy right now. Please try again in a moment." }); return;
  }
  try {
    const result = await generateCareerDraft(input);
    res.json(AssistCareerResponse.parse(result));
  } catch (error) {
    // Do not log SDK errors: they may contain submitted career evidence.
    const tooLarge = error instanceof Error && error.message === "EVIDENCE_TOO_LARGE";
    req.log.warn({ category: tooLarge ? "context_limit" : "ai_unavailable" }, "Career draft could not be generated");
    res.status(tooLarge ? 400 : 503).json({ error: tooLarge ?
      "The selected evidence is too long. Select fewer Vault entries or shorten the source resume." :
      "The AI service could not finish this draft. Your saved work has not changed. Please try again." });
  } finally {
    release();
  }
});

router.post("/career/import", importLimiter, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = ExtractResumeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a PDF, DOCX or TXT file smaller than 10 MB." }); return;
  }
  const { dataBase64, contentType } = parsed.data;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(dataBase64)) {
    res.status(400).json({ error: "This file could not be read. Choose the file again." }); return;
  }
  const buffer = Buffer.from(dataBase64, "base64");
  if (!buffer.length || buffer.length > 10 * 1024 * 1024) {
    res.status(400).json({ error: "Choose a non-empty file smaller than 10 MB." }); return;
  }
  try {
    let content = "";
    if (contentType === "application/pdf") {
      if (!buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))) throw new Error("INVALID_PDF");
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText({ first: 1, last: 30 });
        if (result.total > 30) {
          res.status(400).json({ error: "This PDF is longer than 30 pages. Import a shorter resume." }); return;
        }
        content = result.text;
      } finally { await parser.destroy(); }
    } else if (contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      if (buffer.subarray(0, 2).toString() !== "PK") throw new Error("INVALID_DOCX");
      // Inspect the central directory before decompression to reject zip bombs.
      let totalExpanded = 0;
      let entries = 0;
      for (let offset = 0; offset + 46 <= buffer.length; offset++) {
        if (buffer.readUInt32LE(offset) !== 0x02014b50) continue;
        totalExpanded += buffer.readUInt32LE(offset + 24);
        entries++;
        if (totalExpanded > 25 * 1024 * 1024 || entries > 2000) throw new Error("DOCX_TOO_LARGE");
        offset += 45 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
      }
      if (entries === 0) throw new Error("INVALID_DOCX");
      content = (await mammoth.extractRawText({ buffer })).value;
    } else {
      content = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      if (content.includes("\0")) throw new Error("BINARY_FILE");
    }
    content = content.trim();
    if (!content) {
      res.status(400).json({ error: "No readable text was found. For a scanned PDF, copy the text into a TXT file and import that instead." }); return;
    }
    if (content.length > 80000) {
      res.status(400).json({ error: "This resume contains too much text. Please import a shorter version." }); return;
    }
    res.json(ExtractResumeResponse.parse({ content }));
  } catch {
    res.status(400).json({ error: "We could not read this file. Try an unlocked, text-based PDF, a DOCX file, or a UTF-8 TXT file." });
  }
});

export default router;
