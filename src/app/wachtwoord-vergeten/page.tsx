import { PasswordRecovery } from "@/components/password-recovery";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return <PasswordRecovery invalidLink={params.error === "link"} />;
}
