import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
import { SavedMediaProvider } from "@/components/saved-media-provider";
import { BrowsableListProvider } from "@/components/browsable-list-provider";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Analytics } from "@vercel/analytics/next"
import Footer from "@/components/footer"
import { PWAInstallToast } from "@/components/pwa-install-toast"
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  title: "ClickNotes",
  description: "Save and organize your favorite movies, Series, and books",
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
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
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
            <SavedMediaProvider>
              {/* Wraps both slots (not just children) so the modal - a server-rendered
                  sibling under app/@modal, not a descendant of the page - can read the
                  list a page like Home publishes. See browsable-list-provider.tsx. */}
              <BrowsableListProvider>
                {children}
                {modal}
              </BrowsableListProvider>
              <Analytics />
            </SavedMediaProvider>
            <Footer />
            <PWAInstallToast />
            <Toaster />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
