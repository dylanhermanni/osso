// The existing database constraint requires a nonblank value for an override.
// Null still restores the default. This reserved value represents hidden copy.
export const hiddenCopyValue = "\u2063";

export function decodeCopyRecord<T extends { value: string | null }>(
  record: T,
): T {
  return record.value === hiddenCopyValue ? { ...record, value: "" } : record;
}
