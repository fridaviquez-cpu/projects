import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 font-display text-5xl">Nothing filed here.</h1>
      <p className="mt-2 text-muted-foreground">That page doesn't exist in your workspace.</p>
      <Link href="/" className="mt-6 inline-block rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground" data-testid="link-back-home">Back to overview</Link>
    </div>
  );
}
