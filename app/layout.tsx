import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
import { ModalProvider } from "@/components/modal-provider";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Analytics } from "@vercel/analytics/next"
import Footer from "@/components/footer"

export const metadata: Metadata = {
  title: "ClickNotes v2",
  description: "Save and organize your favorite movies, TV shows, and books",
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
          </ThemeProvider>
        </AuthProvider>
        <Footer />
      </body>
    </html>
  );
}
