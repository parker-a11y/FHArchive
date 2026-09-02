/**
 * Compact mailing/postal block for the Letter intake and edit forms.
 *
 * Records only what is observable on the physical envelope: whether the item
 * was forwarded (and where to), the postage used, and any unusual postal
 * markings. The original Mailing Destination is never overwritten.
 */

import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategorySelect } from "@/components/CategorySelect";
import { addPostalService, usePostalServiceOptions } from "@/lib/postal";

export type PostalValues = {
  forwarded: boolean;
  forwarded_to: string;
  postal_service: string;
  postal_notes: string;
};

export function PostalFields({
  values,
  onChange,
}: {
  values: PostalValues;
  onChange: (key: keyof PostalValues, value: string | boolean) => void;
}) {
  const qc = useQueryClient();
  const options = usePostalServiceOptions();

  return (
    <div className="col-span-full grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5">
        <Label className="field-label">Postal service / postage</Label>
        <CategorySelect
          value={values.postal_service}
          onChange={(v) => onChange("postal_service", v)}
          options={options}
          allowEmpty
          placeholder="—"
          onCreate={async (label) => {
            const value = await addPostalService(label, options);
            await qc.invalidateQueries({ queryKey: ["postal-services"] });
            return value;
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="field-label">Forwarded</Label>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={values.forwarded}
            onChange={(e) => onChange("forwarded", e.target.checked)}
          />
          Forwarded by the post office
        </label>
      </div>

      {values.forwarded && (
        <div className="space-y-1.5">
          <Label className="field-label">Forwarded to</Label>
          <Input
            value={values.forwarded_to}
            onChange={(e) => onChange("forwarded_to", e.target.value)}
            placeholder="Miami, Florida"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="field-label text-muted-foreground">Postal notes (optional)</Label>
        <Input
          value={values.postal_notes}
          onChange={(e) => onChange("postal_notes", e.target.value)}
          placeholder="Unusual postmark, censor marking…"
        />
      </div>
    </div>
  );
}
