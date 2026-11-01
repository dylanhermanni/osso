import { DateTime } from "luxon";
export const ZONE = "Europe/Amsterdam";
export function localToISO(value: string) {
  const d = DateTime.fromISO(value, { zone: ZONE });
  if (!d.isValid || d.toFormat("yyyy-MM-dd'T'HH:mm") !== value)
    throw new Error("Deze tijd bestaat niet door de overgang naar zomertijd.");
  if (d.getPossibleOffsets().length > 1)
    throw new Error(
      "Deze tijd komt tweemaal voor door wintertijd. Kies een tijd buiten het overgangsuur.",
    );
  return d.toUTC().toISO()!;
}
export function nextMaintenance(date: string, months: number) {
  return DateTime.fromISO(date, { zone: ZONE }).plus({ months }).toISODate()!;
}
export const today = () => DateTime.now().setZone(ZONE).toISODate()!;
