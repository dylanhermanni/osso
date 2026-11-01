"use client";
import { fileURL } from "@/lib/actions";
/** Open synchronously so Safari retains the user's popup activation, then navigate to a fresh URL. */
export async function openPrivateFile(household: string, path: string) {
  const tab = window.open("about:blank", "_blank");
  if (!tab)
    throw new Error(
      "Sta het openen van een nieuw tabblad toe om dit bestand te bekijken.",
    );
  tab.opener = null;
  try {
    tab.location.href = await fileURL(household, path);
  } catch (error) {
    tab.close();
    throw error;
  }
}
