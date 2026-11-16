import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { BrandMark } from "@/components/brand";
import { Compass, FlaskConical, BookOpen, Library, Route as RouteIcon, LifeBuoy } from "lucide-react";

const NAV = [
  { href: "/", label: "Discover", icon: Compass },
  { href: "/learn", label: "Learn", icon: FlaskConical },
  { href: "/studio", label: "Studio", icon: BookOpen },
  { href: "/library", label: "Library", icon: Library },
  { href: "/resources", label: "Resources", icon: LifeBuoy },
  { href: "/journey", label: "Journey", icon: RouteIcon },
];

function active(loc: string, href: string) {
  return href === "/" ? loc === "/" || loc.startsWith("/courses") : loc.startsWith(href);
}

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  useEffect(() => {
    const page = NAV.find(n => n.href === loc)?.label ?? (loc.startsWith("/courses/") ? `ECE ${loc.split("/")[2]}${loc.endsWith("/learn") ? " workspace" : ""}` : loc.startsWith("/learn/210") ? "ECE 210 lessons" : "Learning");
    document.title = `${loc.startsWith("/admin") ? "Reviewer desk" : page} · BECE Bridge`;
    const description = `${page}: explore UIUC ECE courses and study in BECE Bridge's pilot workspaces for ECE pilot courses.`;
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", document.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
  }, [loc]);
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <a href="#main" className="skip-link" data-testid="link-skip">Skip to main content</a>
      <header className="sticky top-0 z-40 bg-sidebar text-sidebar-foreground">
        <div className="h-[3px] bg-accent" />
        <div className="mx-auto max-w-6xl px-4 md:px-6 h-14 flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 shrink-0" data-testid="link-home" aria-label="BECE Bridge home">
            <span className="flex flex-col"><BrandMark /><span className="hidden sm:block text-[10px] tracking-wide text-sidebar-foreground/75">Your bridge to success in ECE.</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-auto" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} data-testid={`nav-${n.label.toLowerCase().replace(" ", "-")}`}
                className={`relative px-3 py-2 text-sm rounded-md transition-colors ${active(loc, n.href) ? "text-sidebar-foreground bg-sidebar-accent" : "text-sidebar-foreground/65 hover:text-sidebar-foreground"}`}>
                {n.label}
                {active(loc, n.href) && <span className="absolute left-3 right-3 -bottom-[9px] h-[2px] bg-accent" />}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} key={loc} className="outline-none flex-1 mx-auto w-full max-w-6xl px-4 md:px-6 py-8 md:py-12 pb-28 md:pb-12">{children}</main>
      <footer className="border-t mt-auto">
        <div className="mx-auto max-w-6xl px-4 md:px-6 py-6 pb-24 md:pb-6 text-xs text-muted-foreground flex flex-col md:flex-row gap-2 md:justify-between">
          <p>Independent student learning tool. Not affiliated with or endorsed by the University of Illinois, its ECE department, or NSBE.</p>
          <p className="font-mono">Progress saved for this browser only. No account sync. <Link href="/admin/reports" className="underline hover:text-foreground" data-testid="link-admin">Reviewer desk</Link></p>
        </div>
      </footer>
      <nav aria-label="Mobile" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar text-sidebar-foreground border-t border-sidebar-border grid grid-cols-6">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} data-testid={`mnav-${n.href}`}
            className={`flex flex-col items-center gap-1 py-2.5 min-h-[56px] text-[10px] leading-tight ${active(loc, n.href) ? "text-accent" : "text-sidebar-foreground/70"}`}>
            <n.icon className="h-5 w-5" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
