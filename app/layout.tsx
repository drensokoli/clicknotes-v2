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
  icons: {
    icon: [
      // { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192x192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-256x256.png", type: "image/png", sizes: "256x256" },
      { url: "/icons/icon-512x512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/icons/icon-192x192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-256x256.png", type: "image/png", sizes: "256x256" },
    ],
    // shortcut: "/favicon.ico",
  },
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
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let session = null;
  
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    console.warn('Failed to get server session:', error);
    session = null;
  }

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
