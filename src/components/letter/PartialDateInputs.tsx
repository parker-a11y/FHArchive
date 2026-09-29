import { useEffect, useState, type Ref } from "react";
import { Input } from "@/components/ui/input";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Free-typing year box; only commits a date once four digits are entered. */
export function YearInput({
  value,
  onChange,
  inputRef,
}: {
  value: string;
  onChange: (date: string) => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const [text, setText] = useState(value ? value.slice(0, 4) : "");
  useEffect(() => {
    const y = value ? value.slice(0, 4) : "";
    if (y !== text && (text.length === 4 || value)) setText(y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <Input
      ref={inputRef}
      inputMode="numeric"
      placeholder="e.g. 1944"
      value={text}
      onChange={(e) => {
        const y = e.target.value.replace(/\D/g, "").slice(0, 4);
        setText(y);
        onChange(y.length === 4 ? `${y}-01-01` : "");
      }}
    />
  );
}

/** Month picker + typed year; works in every browser (no native month input). */
export function MonthYearInput({
  value,
  onChange,
  inputRef,
}: {
  value: string;
  onChange: (date: string) => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const [month, setMonth] = useState(value ? value.slice(5, 7) : "");
  const [year, setYear] = useState(value ? value.slice(0, 4) : "");
  useEffect(() => {
    if (value) {
      setMonth(value.slice(5, 7));
      setYear(value.slice(0, 4));
    }
  }, [value]);
  const commit = (m: string, y: string) => onChange(m && y.length === 4 ? `${y}-${m}-01` : "");
  return (
    <div className="flex gap-2">
      <select
        className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
        value={month}
        onChange={(e) => {
          setMonth(e.target.value);
          commit(e.target.value, year);
        }}
        aria-label="Month"
      >
        <option value="">Month…</option>
        {MONTH_NAMES.map((n, i) => (
          <option key={n} value={String(i + 1).padStart(2, "0")}>
            {n}
          </option>
        ))}
      </select>
      <Input
        ref={inputRef}
        className="w-24"
        inputMode="numeric"
        placeholder="Year"
        aria-label="Year"
        value={year}
        onChange={(e) => {
          const y = e.target.value.replace(/\D/g, "").slice(0, 4);
          setYear(y);
          commit(month, y);
        }}
      />
    </div>
  );
}
