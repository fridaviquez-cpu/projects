export type ResourceCategory = "office-hours" | "videos" | "pdfs" | "websites" | "campus" | "groups";
import type { Course } from "@workspace/api-client-react";
import { ADVANCED_RESOURCES } from "./advanced-resources";
export type CourseTag = string;
export type Standing = "official" | "student-run" | "general";

export interface Resource {
  id: string;
  title: string;
  category: ResourceCategory;
  courses: CourseTag[];
  standing: Standing;
  source: string;
  description: string;
  note?: string;
  url: string;
  cta: string;
}

export const CATEGORIES: { id: ResourceCategory; label: string; blurb: string }[] = [
  { id: "office-hours", label: "Office hours", blurb: "Where to find real people to ask" },
  { id: "videos", label: "Videos", blurb: "Lectures and explainers" },
  { id: "pdfs", label: "PDFs", blurb: "Notes collections to read" },
  { id: "websites", label: "Websites", blurb: "Reference and study sites" },
  { id: "campus", label: "Campus support", blurb: "Tutoring, wellbeing, access, careers" },
  { id: "groups", label: "Student groups", blurb: "Community beyond coursework" },
];

export const STANDING_LABEL: Record<Standing, string> = {
  official: "Official UIUC",
  "student-run": "Student-run",
  general: "General supplement",
};

export const LINKS_CHECKED = "Nov 7, 2026";

const courseHours = (n: string, url: string): Resource => ({
  id: `oh-ece${n}`,
  title: `ECE ${n} course page`,
  category: "office-hours",
  courses: [n],
  standing: "official",
  source: "ECE Illinois",
  description: `Official department page for ECE ${n}. Open it, then follow the current course website or syllabus for office hours.`,
  note: "Hours are not listed here. The course schedule may require a campus login.",
  url,
  cta: "Open official course page",
});

/** Derive course resources from actual pilot records and their verified source URLs. */
export function resourcesForPilots(courses: Course[]): Resource[] {
  return [...courses.filter(c => c.isPilot).flatMap(c => {
    const official = c.sources.find(s => s.url.startsWith("https://ece.illinois.edu/academics/courses/"));
    const hkn = c.sources.find(s => s.url.startsWith("https://wiki.hkn.illinois.edu/"));
    const entries: Resource[] = official ? [courseHours(c.id, official.url)] : [];
    if (hkn) entries.push({
      id: `hkn-${c.id}`, title: `${c.code} course guide`, category: "websites", courses: [c.id],
      standing: "student-run", source: "HKN course wiki",
      description: `Student guidance for ${c.title}: topics, preparation and course advice.`,
      note: "Student-maintained guidance, not the current semester syllabus. Check official requirements.",
      url: hkn.url, cta: "Open course guide",
    });
    return entries;
  }), ...RESOURCES];
}

export const RESOURCES: Resource[] = [
  ...ADVANCED_RESOURCES,
  {
    id: "care-tutoring", title: "CARE tutoring", category: "office-hours", courses: ["all"], standing: "official",
    source: "Grainger Engineering", description: "Free drop-in tutoring at the Center for Academic Resources in Engineering, 4th floor of Grainger Library, west wing.",
    note: "Check the CARE site for current hours.", url: "https://care.grainger.illinois.edu/tutoring", cta: "Visit CARE tutoring",
  },
  {
    id: "care-schedule", title: "CARE schedule by subject", category: "office-hours", courses: ["all"], standing: "official",
    source: "Grainger Engineering", description: "Find which CARE tutors cover your subject and when they are on shift.",
    url: "https://care.grainger.illinois.edu/tutoring/schedule-by-subject", cta: "See schedule by subject",
  },
  {
    id: "hkn-tutoring", title: "HKN tutoring and service", category: "office-hours", courses: ["all"], standing: "student-run",
    source: "Eta Kappa Nu, Alpha chapter", description: "Peer tutoring and service programs from the ECE honor society, linked from CARE.",
    url: "https://hkn.illinois.edu/service/", cta: "Visit HKN service",
  },
  {
    id: "neso-channel", title: "Neso Academy", category: "videos", courses: ["110", "120", "210"], standing: "general",
    source: "YouTube", description: "Short, structured explainers on circuits, digital logic and signals. Good for a second angle on a topic.",
    url: "https://www.youtube.com/@nesoacademy", cta: "Open channel",
  },
  {
    id: "neso-digital", title: "Neso Academy: Digital electronics playlist", category: "videos", courses: ["120"], standing: "general",
    source: "YouTube", description: "Number systems, Boolean algebra, gates and sequential logic, in order.",
    url: "https://www.youtube.com/playlist?list=PLBlnK6fEyqRjMH3mWf6kwqiTbT798eAOm", cta: "Open playlist",
  },
  {
    id: "mit-6002-video", title: "MIT 6.002 video lectures", category: "videos", courses: ["110", "210"], standing: "general",
    source: "MIT OpenCourseWare", description: "Full lecture recordings from MIT's Circuits and Electronics, Spring 2007.",
    url: "https://ocw.mit.edu/courses/6-002-circuits-and-electronics-spring-2007/video_galleries/video-lectures/", cta: "Open video gallery",
  },
  {
    id: "mit-6002-notes", title: "MIT 6.002 lecture notes", category: "pdfs", courses: ["110", "210"], standing: "general",
    source: "MIT OpenCourseWare", description: "Landing page for the lecture notes collection. Individual PDFs are listed there.",
    note: "Notes date from 2000, posted with the 2007 course.",
    url: "https://ocw.mit.edu/courses/6-002-circuits-and-electronics-spring-2007/pages/lecture-notes/", cta: "Open notes collection",
  },
  {
    id: "mit-6002-l2", title: "MIT 6.002 notes: basic circuit analysis", category: "pdfs", courses: ["110", "210"], standing: "general",
    source: "MIT OpenCourseWare", description: "KVL, KCL and node methods. A useful refresher before circuit-heavy units.",
    url: "https://ocw.mit.edu/courses/6-002-circuits-and-electronics-spring-2007/resources/6002_l2/", cta: "Open resource page",
  },
  {
    id: "mit-6002-l12", title: "MIT 6.002 notes: capacitors", category: "pdfs", courses: ["210"], standing: "general",
    source: "MIT OpenCourseWare", description: "Capacitor behavior and first-order response, which pairs with RC work in ECE 210.",
    url: "https://ocw.mit.edu/courses/6-002-circuits-and-electronics-spring-2007/resources/6002_l12/", cta: "Open resource page",
  },
  {
    id: "hkn-wiki", title: "HKN wiki", category: "websites", courses: ["all"], standing: "student-run",
    source: "Eta Kappa Nu, Alpha chapter", description: "Student-maintained notes and course information from the ECE honor society.",
    url: "https://wiki.hkn.illinois.edu/", cta: "Open wiki",
  },
  {
    id: "care-campus", title: "Campus resource directory", category: "campus", courses: ["all"], standing: "official",
    source: "Grainger Engineering", description: "One page linking DRES, the Counseling Center, career services and other campus support.",
    url: "https://care.grainger.illinois.edu/campus-resources", cta: "Open directory",
  },
  {
    id: "care-dres", title: "Disability resources (DRES)", category: "campus", courses: ["all"], standing: "official",
    source: "Via CARE directory", description: "Accommodations and accessibility support. Reach it from the CARE campus directory.",
    url: "https://care.grainger.illinois.edu/campus-resources", cta: "View directory",
  },
  {
    id: "care-counseling", title: "Counseling and career services", category: "campus", courses: ["all"], standing: "official",
    source: "Via CARE directory", description: "Mental health support and career help are both listed in the CARE campus directory.",
    url: "https://care.grainger.illinois.edu/campus-resources", cta: "View directory",
  },
  {
    id: "org-directory", title: "ECE student organizations", category: "groups", courses: ["all"], standing: "official",
    source: "ECE Illinois", description: "The department's directory of ECE student groups, with contact and links for each.",
    url: "https://ece.illinois.edu/academics/student-organizations", cta: "View directory",
  },
  ...([
    ["hkn", "HKN (Eta Kappa Nu)", "Honor society running tutoring, review sessions and service."],
    ["ieee", "IEEE student branch", "Professional society with technical and social programs."],
    ["wece", "WECE", "Women in Electrical and Computer Engineering community."],
    ["acm", "ACM", "Computing community with special interest groups."],
    ["nsbe", "NSBE", "National Society of Black Engineers chapter."],
    ["irobotics", "iRobotics", "Hands-on robotics builds and competitions."],
    ["pure", "PURE", "Undergraduate research mentoring program."],
  ] as const).map(([id, title, d]): Resource => ({
    id: `group-${id}`, title, category: "groups", courses: ["all"], standing: "student-run",
    source: "Listed in ECE directory", description: d,
    url: "https://ece.illinois.edu/academics/student-organizations", cta: "View directory",
  })),
];
