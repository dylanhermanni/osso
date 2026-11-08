"use client";
import * as server from "@/app/actions";
async function unwrap<T>(
  response: Promise<{ ok: true; value: T } | { ok: false; message: string }>,
): Promise<T> {
  const result = await response;
  if (!result.ok) throw new Error(result.message);
  return result.value;
}
export const authenticate = (...args: Parameters<typeof server.authenticate>) =>
  unwrap(server.authenticate(...args));
export const signout = (...args: Parameters<typeof server.signout>) =>
  unwrap(server.signout(...args));
export const setupHousehold = (
  ...args: Parameters<typeof server.setupHousehold>
) => unwrap(server.setupHousehold(...args));
export const invite = (...args: Parameters<typeof server.invite>) =>
  unwrap(server.invite(...args));
export const saveRecord = (...args: Parameters<typeof server.saveRecord>) =>
  unwrap(server.saveRecord(...args));
export const removeRecord = (...args: Parameters<typeof server.removeRecord>) =>
  unwrap(server.removeRecord(...args));
export const recordExpense = (
  ...args: Parameters<typeof server.recordExpense>
) => unwrap(server.recordExpense(...args));
export const settle = (...args: Parameters<typeof server.settle>) =>
  unwrap(server.settle(...args));
export const reverseFinancial = (
  ...args: Parameters<typeof server.reverseFinancial>
) => unwrap(server.reverseFinancial(...args));
export const completeMaintenance = (
  ...args: Parameters<typeof server.completeMaintenance>
) => unwrap(server.completeMaintenance(...args));
export const convertIdea = (...args: Parameters<typeof server.convertIdea>) =>
  unwrap(server.convertIdea(...args));
export const addChild = (...args: Parameters<typeof server.addChild>) =>
  unwrap(server.addChild(...args));
export const toggleChild = (...args: Parameters<typeof server.toggleChild>) =>
  unwrap(server.toggleChild(...args));
export const uploadFile = (...args: Parameters<typeof server.uploadFile>) =>
  unwrap(server.uploadFile(...args));
export const fileURL = (...args: Parameters<typeof server.fileURL>) =>
  unwrap(server.fileURL(...args));
export const linkPurchase = (...args: Parameters<typeof server.linkPurchase>) =>
  unwrap(server.linkPurchase(...args));
export const deleteDocument = (
  ...args: Parameters<typeof server.deleteDocument>
) => unwrap(server.deleteDocument(...args));
export const realtimeToken = (
  ...args: Parameters<typeof server.realtimeToken>
) => unwrap(server.realtimeToken(...args));

export const addShoppingItem = (
  ...args: Parameters<typeof server.addShoppingItem>
) => unwrap(server.addShoppingItem(...args));
export const changeShoppingItem = (
  ...args: Parameters<typeof server.changeShoppingItem>
) => unwrap(server.changeShoppingItem(...args));
export const reorderRecords = (
  ...args: Parameters<typeof server.reorderRecords>
) => unwrap(server.reorderRecords(...args));
