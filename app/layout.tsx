import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
import { ModalProvider } from "@/components/modal-provider";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Analytics } from "@vercel/analytics/next"
import Footer from "@/components/footer"
import { PWAInstallToast } from "@/components/pwa-install-toast"

export const metadata: Metadata = {
  title: "ClickNotes v2",
  description: "Save and organize your favorite movies, TV shows, and books",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ClickNotes",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <AuthProvider session={session}>
          <ThemeProvider
            attribute="data-theme"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange={true}
          >
            <ModalProvider>
              {children}
              <Analytics />
            </ModalProvider>
            <Footer />
            <PWAInstallToast />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
