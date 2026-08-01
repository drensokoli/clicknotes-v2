import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Verification Pending - ClickNotes",
  robots: { index: false, follow: false },
}

export default function VerificationPendingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
