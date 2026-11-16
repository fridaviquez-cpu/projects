/** Shared kingfisher, torch and circuit emblem across every brand placement. */
export function Emblem({ className = "h-9 w-9", title }: { className?: string; title?: string }) {
  return (
    <img src={`${import.meta.env.BASE_URL}kingfisher-emblem.svg`} className={`${className} object-contain`} alt={title ?? ""} width={80} height={80} />
  );
}

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Emblem className="h-9 w-9 shrink-0" />
      <span className="font-display font-extrabold text-lg">BECE <span className="text-accent">Bridge</span></span>
    </span>
  );
}

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <figure className={`rounded-lg bg-primary text-primary-foreground p-5 grid-paper flex flex-col items-center text-center ${className}`}>
      <Emblem className="h-32 w-32" title="BECE Bridge emblem: an orange-and-blue kingfisher intertwined with a torch and circuit traces" />
      <figcaption className="mt-3">
        <span className="block font-display font-extrabold text-3xl">BECE <span className="text-accent">Bridge</span></span>
        <span className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] opacity-75">
          <span className="h-px w-4 bg-accent" />Your bridge to success in ECE<span className="h-px w-4 bg-accent" />
        </span>
      </figcaption>
    </figure>
  );
}
