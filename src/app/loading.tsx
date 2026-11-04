import { CopyScope } from "@/components/content-provider";
export default function Loading() {
  return (
    <CopyScope>
      {
        <main className="loading-state" aria-label="Cheese the Rooster laden">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </main>
      }
    </CopyScope>
  );
}
