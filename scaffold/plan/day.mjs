// day.mjs — the date as the user reads it: this computer's local day (YYYY-MM-DD), for folder names, labels and the
// brief. Stored timestamps (`at`) stay UTC ISO; usage statistics keep their UTC day.
export function localDay(d = new Date()) {
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
