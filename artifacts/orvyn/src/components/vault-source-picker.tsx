import { useId } from 'react';
import { useRecords } from '@/lib/orvyn';
import { Button } from '@/components/ui/button';

/** Undefined keeps automatic sampling; [] deliberately excludes Vault sources. */
export function VaultSourcePicker({ value, onChange, disabled }: {
  value: string[] | undefined;
  onChange: (value: string[] | undefined) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const vault = useRecords('experience');
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-2 rounded-md border p-3">
      <legend className="px-1 text-sm">Vault evidence</legend>
      <label htmlFor={id} className="flex items-center gap-2 text-sm">
        <input id={id} type="checkbox" checked={value !== undefined}
          onChange={event => onChange(event.target.checked ? [] : undefined)} />
        Choose sources myself
      </label>
      <p className="text-xs text-muted-foreground">
        {value === undefined ? 'Automatic: sample recently updated Vault records.' : `${value.length}/40 selected in click order. No selections means no Vault evidence.`}
        {' '}Selection is not verified relevance. Whole-record size and count limits still apply; useful or contradictory evidence may be omitted. Any source resume remains separate.
      </p>
      {value !== undefined && (
        vault.isLoading ? <p role="status" className="text-xs">Loading Vault…</p> :
        vault.isError ? <div role="alert" className="text-xs">Could not load Vault evidence. <Button type="button" variant="ghost" size="sm" onClick={() => vault.refetch()}>Retry</Button></div> :
        <div className="max-h-44 space-y-1 overflow-y-auto">
          {!vault.items.length && <p className="text-xs">No Vault evidence yet.</p>}
          {value.some(source => !vault.items.some(record => record.id === source)) && <p role="alert" className="text-xs">A selected source is no longer available. Clear the selection and choose again.</p>}
          {vault.items.map(record => (
            <label key={record.id} className="flex items-start gap-2 py-1 text-sm">
              <input type="checkbox" className="mt-1 shrink-0" checked={value.includes(record.id)}
                disabled={!value.includes(record.id) && value.length >= 40}
                onChange={event => onChange(event.target.checked ? [...value, record.id] : value.filter(source => source !== record.id))} />
              <span className="min-w-0 break-words">{record.title}{record.company ? ` / ${record.company}` : ''}</span>
            </label>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>Clear selection</Button>
        </div>
      )}
    </fieldset>
  );
}
