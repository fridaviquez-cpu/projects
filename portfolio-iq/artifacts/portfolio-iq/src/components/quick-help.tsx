import { useState } from "react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const GUIDES = [
  { title: "Add your first investment", text: "Open Holdings → Add holding. Enter its ticker symbol (for example, VTI), a name, how many units you own, and a price you looked up. Choose Add holding to save. A holding is simply an investment you own.", href: "/portfolio", link: "Open Holdings" },
  { title: "Understand total paid and gain", text: "Total paid is the cost of the entire position, not one share. If you bought 10 shares at $20 each, enter $200. Leave it blank if you don't know. Unrealized gain compares today's entered value with total paid; it is not money you've received or historical performance.", href: "/portfolio", link: "Review your holdings" },
  { title: "Save your work without an account", text: "Choose Save or Add when you finish a form. After the server confirms, the app shows Saved. Your browser remembers your private workspace. Drafts aren't saved just by typing; keep the form open if a save fails.", href: "/settings", link: "How saving works" },
  { title: "Use another device or recover access", text: "Open Settings → Recovery key → Create recovery key. Copy or download it and keep it private, like a password. On another device, open Settings → Restore a workspace and paste the key. Replacing a key makes the old key stop working.", href: "/settings#recovery", link: "Set up recovery" },
  { title: "Try sample data safely", text: "On an empty Overview, choose Explore sample portfolio. Sample holdings are labeled and stay separate from other visitors. They are editable records in your workspace, not real investments or live prices. Remove them in Holdings before recording your own portfolio.", href: "/", link: "Open Overview" },
  { title: "Record monthly income and spending", text: "Open Budget, choose a month, then Add entry. Select Income or Expense and enter a positive dollar amount. The date determines which month contains the entry. Budget records are separate from your investments and are not sent to the assistant.", href: "/budget", link: "Open Budget" },
  { title: "Reflect before buying or selling", text: "A thesis is your reason for an investment. In Thesis journal, write what you believe and what could prove you wrong. Choose Archived to keep an old idea without deleting its history.", href: "/thesis", link: "Open Thesis journal" },
  { title: "Know the app's limits", text: "All amounts are US dollars. Prices are snapshots you enter or confirm from an optional screenshot import, not live quotes. No bank or broker is connected. The wealth sketch is an illustration, not a prediction. The optional AI assistant explains concepts; it does not give investment advice.", href: "/learn", link: "Start learning" },
];

export function QuickHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [search, setSearch] = useState("");
  const matches = GUIDES.filter((guide) => `${guide.title} ${guide.text}`.toLowerCase().includes(search.toLowerCase().trim()));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto bg-background sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl">How can we help?</DialogTitle>
          <DialogDescription>Short answers for using PortfolioIQ. No tutorial to memorize.</DialogDescription>
        </DialogHeader>
        <Input type="search" aria-label="Search help" placeholder="Search saving, cost basis, recovery…" value={search} onChange={(event) => setSearch(event.target.value)} data-testid="input-help-search" />
        <div className="divide-y">
          {matches.map((guide) => <details key={guide.title} className="py-3">
            <summary className="cursor-pointer text-sm font-medium">{guide.title}</summary>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{guide.text}</p>
            <Link href={guide.href} onClick={() => onOpenChange(false)} className="mt-2 inline-block text-xs font-medium text-accent underline underline-offset-4">{guide.link}</Link>
          </details>)}
          {!matches.length && <p role="status" className="py-5 text-sm text-muted-foreground">No help topics match. Try “save,” “holding,” or “recovery.”</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
