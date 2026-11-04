import type { Metadata, Viewport } from "next";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "./globals.css";
import { ContentProvider, CopyScope } from "@/components/content-provider";
import { loadSiteCopy, serverCopy } from "@/lib/site-copy/server";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: await serverCopy("Cheese the Rooster — alles voor ons thuis"),
    description: await serverCopy(
      "Een fijne plek voor jullie ideeën, plannen en alles rondom jullie huis.",
    ),
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: await serverCopy("Cheese the Rooster"),
    },
    icons: { icon: "/rooster-icon-192.png", apple: "/rooster-apple-icon.png" },
  };
}
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#66539d",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const content = await loadSiteCopy();
  return (
    <html lang="nl">
      <body>
        <ContentProvider {...content}>
          <CopyScope>{children}</CopyScope>
        </ContentProvider>
      </body>
    </html>
  );
}
