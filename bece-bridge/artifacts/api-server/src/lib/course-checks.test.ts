import { test } from "node:test";
import assert from "node:assert/strict";
import { courseQuestions, extraLessons, isCorrectAnswer } from "./course-checks";
import { makeQuestions, lessons } from "./bridge-learning";

test("fixed reference examples reproduce all nine new skills", () => {
  const cases: [string, number[], number[]][] = [
    ["110", [12,4,2,4,3,2], [3,8,4.5]],
    ["120", [45,246,5], [45,-10,0]],
    ["220", [5,4,3,2,12,-3], [15,10,9]],
  ];
  for (const [course, values, expected] of cases) {
    let i=0;
    const qs=courseQuestions(course, (()=>values[i++]!) as Parameters<typeof courseQuestions>[1]);
    assert.deepEqual(qs.map(q=>q.expected),expected);
    assert.equal(new Set(qs.map(q=>q.id)).size,3);
    for(const q of qs) {
      assert.ok(q.explanation.includes("="));
      assert.ok(extraLessons.some(l=>l.id===q.lessonId && l.courseId===course && l.concept===q.concept));
    }
  }
});

test("randomized questions match independently recomputed prompt answers", () => {
  for(let run=0;run<100;run++) for(const course of ["110","120","220"]) {
    const qs=makeQuestions(course);
    const numbers=(s:string)=>s.match(/-?\d+/g)!.map(Number);
    if(course==="110"){
      const [r,v]=numbers(qs[0]!.prompt);
      assert.equal(qs[0]!.expected,v!/r!);
      const [vs,top,bottom]=numbers(qs[1]!.prompt);
      assert.equal(qs[1]!.expected,vs!*bottom!/(top!+bottom!));
      const [pr,pv]=numbers(qs[2]!.prompt);
      assert.equal(qs[2]!.expected,pv!**2/pr!);
    } else if(course==="120"){
      assert.equal(qs[0]!.expected,parseInt(qs[0]!.prompt.match(/[01]{8}/)![0],2));
      assert.equal(qs[1]!.expected,parseInt(qs[1]!.prompt.match(/[01]{8}/)![0],2)-256);
      const [a,b,c]=numbers(qs[2]!.prompt);
      assert.equal(qs[2]!.expected,Number(Boolean(a&&b)||!c));
    } else {
      const n=Number(qs[0]!.prompt.match(/i<=(\d+)/)![1]);
      assert.equal(qs[0]!.expected,Array.from({length:n},(_,i)=>i+1).reduce((a,b)=>a+b,0));
      const arr=qs[1]!.prompt.match(/\{([^}]+)\}/)![1]!.split(",").map(Number);
      const k=Number(qs[1]!.prompt.match(/a\[(\d+)\] read/)![1]);
      assert.equal(qs[1]!.expected,arr[k]);
      const reg=Number(qs[2]!.prompt.match(/decimal (\d+)/)![1]);
      const imm=Number(qs[2]!.prompt.match(/#(-?\d+)/)![1]);
      assert.equal(qs[2]!.expected,reg+imm);
    }
  }
});

test("legacy ECE 210 IDs remain stable and unsupported coverage fails explicitly",()=>{
  assert.deepEqual(lessons.filter(l=>l.courseId==="210").map(l=>l.id),["circuits","complex","rc"]);
  assert.equal(makeQuestions().length,3);
  assert.throws(()=>makeQuestions("999"),/No assessed coverage/);
});

test("integer skills require exact answers; circuit checks permit rounding",()=>{
  for(const course of ["120","220"]){
    assert.equal(isCorrectAnswer(course,254,255),false);
    assert.equal(isCorrectAnswer(course,0.01,0),false);
    assert.equal(isCorrectAnswer(course,-10,-10),true);
  }
  assert.equal(isCorrectAnswer("110",1.33,4/3),true);
  assert.equal(isCorrectAnswer("210",1.33,4/3),true);
  assert.equal(isCorrectAnswer("110",NaN,3),false);
});
