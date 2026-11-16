import type { Resource, ResourceCategory } from "./resources";

// Public external supplements reviewed against provider descriptions on Nov 7, 2026.
// Topic overlap does not imply equivalence to a UIUC course or full syllabus coverage.
function mit(id: string, title: string, courses: string[], category: ResourceCategory, path: string, description: string): Resource {
  return {
    id, title, courses, category, standing: "general", source: "MIT OpenCourseWare",
    description, url: `https://ocw.mit.edu/courses/${path}`,
    note: "External topic supplement, not UIUC course material. Match topics to your current syllabus.",
    cta: category === "videos" ? "Open videos" : "Open reading collection",
  };
}

const dsp = "res-6-008-digital-signal-processing-spring-2011";
const probability = "6-041-probabilistic-systems-analysis-and-applied-probability-fall-2010";
const fields = "6-013-electromagnetics-and-applications-spring-2009";
const solar = "2-627-fundamentals-of-photovoltaics-fall-2013";

export const ADVANCED_RESOURCES: Resource[] = [
  {
    id: "cs50-c-video", title: "Harvard CS50: C programming", courses: ["220"], category: "videos",
    standing: "general", source: "Harvard CS50",
    description: "Video introduction to C syntax, types, conditionals, loops and compilation. A refresher for the C portion of ECE 220.",
    note: "Does not cover the full ECE 220 systems or assembly-language syllabus.",
    url: "https://cs50.harvard.edu/x/weeks/1/", cta: "Open C lecture",
  },
  mit("mit-c-notes", "MIT: Practical Programming in C notes", ["220"], "pdfs",
    "6-087-practical-programming-in-c-january-iap-2010/pages/lecture-notes/",
    "Lecture PDFs on C programming, pointers, memory allocation and data structures. Some advanced topics go beyond ECE 220."),
  mit("mit-dsp-videos", "MIT: Digital Signal Processing videos", ["310"], "videos",
    `${dsp}/video_galleries/video-lectures/`,
    "Discrete-time convolution, z-transforms, Fourier transforms, digital filters and FFTs. An older, advanced supplement; choose lectures by topic."),
  mit("mit-dsp-notes", "MIT: Digital Signal Processing study notes", ["310"], "pdfs",
    `${dsp}/pages/study-materials/`,
    "Lecture study guides and problems for discrete-time signals, transforms and filter design."),
  mit("mit-probability-videos", "MIT: Applied probability videos", ["313"], "videos",
    `${probability}/video_galleries/video-lectures/`,
    "Probability models, conditioning, random variables and statistical inference, with lecture examples."),
  mit("mit-probability-notes", "MIT: Applied probability lecture notes", ["313"], "pdfs",
    `${probability}/pages/lecture-notes/`,
    "Lecture slides for probability models, random variables, expectation and related topics."),
  mit("mit-fields-videos", "MIT: Electromagnetics demonstrations", ["329"], "videos",
    `${fields}/pages/movie-demonstrations/`,
    "Demonstration videos illustrating electromagnetic phenomena. These are demonstrations, not a full lecture series."),
  mit("mit-fields-notes", "MIT: Electromagnetics lecture notes", ["329"], "pdfs",
    `${fields}/pages/lecture-notes/`,
    "Notes on electric and magnetic fields, Maxwell’s equations, waves and electromagnetic applications."),
  {
    id: "nptel-machines-video", title: "NPTEL: Introduction to Electrical Machines", courses: ["330"], category: "videos",
    standing: "general", source: "NPTEL IIT Delhi",
    description: "Introductory electrical-machines lecture supporting study of electrical-to-mechanical energy conversion.",
    note: "External introductory lecture, not the complete ECE 330 syllabus.",
    url: "https://www.youtube.com/watch?v=ikqXDWrwf4c", cta: "Watch lecture",
  },
  mit("mit-power-text", "MIT: Electric Power Systems textbook", ["330", "333"], "pdfs",
    "6-061-introduction-to-electric-power-systems-spring-2011/resources/6_061_s11_textbook_pdf/",
    "Open textbook on power systems and electromechanical energy conversion; useful power-system foundations for renewable energy."),
  mit("mit-solar-videos", "MIT: Photovoltaics videos and slides", ["333", "340"], "videos",
    `${solar}/video_galleries/lecture-videos-slides/`,
    "Solar-cell operation, photoelectric conversion, efficiency and photovoltaic technologies. For ECE 340, focus on semiconductor solar-cell physics."),
  mit("mit-solar-slides", "MIT: Photovoltaics lecture slides", ["333", "340"], "pdfs",
    `${solar}/video_galleries/lecture-videos-slides/`,
    "Lecture collection with downloadable slides alongside videos on solar energy and semiconductor photovoltaic devices."),
  mit("mit-microelectronics-notes", "MIT: Microelectronic Devices and Circuits notes", ["340", "342"], "pdfs",
    "6-012-microelectronic-devices-and-circuits-fall-2009/pages/lecture-notes/",
    "Semiconductor junctions, MOS devices, transistor models and small-signal amplifier analysis."),
  mit("mit-amplifier-videos", "MIT: Circuits and Electronics videos", ["342"], "videos",
    "6-002-circuits-and-electronics-spring-2007/video_galleries/video-lectures/",
    "Select the MOSFET, amplifier and small-signal lectures for ECE 342 foundations; earlier lectures review basic circuits."),
];
