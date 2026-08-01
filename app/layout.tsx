import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
import { SavedMediaProvider } from "@/components/saved-media-provider";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Analytics } from "@vercel/analytics/next"
import Footer from "@/components/footer"
import { PWAInstallToast } from "@/components/pwa-install-toast"
import { Toaster } from "@/components/ui/sonner"

const SITE_URL = "https://www.clicknotes.site"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "ClickNotes",
  description: "Save and organize your favorite movies, Series, and books",
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "ClickNotes",
    url: SITE_URL,
    title: "ClickNotes - Save Movies, Series & Books",
    description: "Save and organize your favorite movies, Series, and books",
    images: [{ url: "/logo-blue.png", width: 386, height: 184, alt: "ClickNotes" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ClickNotes - Save Movies, Series & Books",
    description: "Save and organize your favorite movies, Series, and books",
    images: ["/logo-blue.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
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

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ClickNotes",
    url: SITE_URL,
    description: "Save and organize your favorite movies, Series, and books",
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <AuthProvider session={session}>
          <ThemeProvider
            attribute="data-theme"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange={true}
          >
            <SavedMediaProvider>
              {children}
              {modal}
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
