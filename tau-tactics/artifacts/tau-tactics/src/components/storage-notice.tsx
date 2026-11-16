import { useState } from "react";
import { repairStorage, useStorageIssues } from "@/lib/store";

export function StorageNotice() {
  const issues = useStorageIssues();
  const [error, setError] = useState("");
  if (!issues.length) return null;
  return <section role="alert" className="mb-6 rounded-xl border border-border bg-card p-4 text-sm">
    <h2 className="font-semibold">Device storage needs attention</h2>
    {issues.map(issue => <div key={issue.key} className="mt-3">
      <p>{issue.error}</p>
      {issue.raw !== undefined && <div className="mt-2 flex flex-wrap gap-2">
        <button className="rounded-full border px-3 py-2" onClick={() => {
          const url = URL.createObjectURL(new Blob([issue.raw!], { type: "text/plain" }));
          const link = document.createElement("a");
          link.href = url; link.download = `${issue.key}-original.txt`; link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}>Download original data</button>
        <button className="rounded-full border px-3 py-2" onClick={() => {
          if (!confirm("Keep readable records and quarantine the original on this device? Unreadable records will only remain in the original copy. Download it first for safekeeping.")) return;
          const result = repairStorage(issue);
          setError(result.ok ? "" : result.error);
        }}>Repair readable data</button>
      </div>}
    </div>)}
    {error && <p className="mt-2">{error}</p>}
  </section>;
}
