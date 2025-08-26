import { GalleryVerticalEnd } from "lucide-react"
import Link from "next/link"

export default function ForgotPasswordPage() {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-medium">
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <GalleryVerticalEnd className="size-4" />
          </div>
          ClickNotes
        </Link>
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">Forgot Password</h1>
          <p className="text-muted-foreground mb-6">
            This feature is not yet implemented. Please contact support or try signing in with Google.
          </p>
          <Link 
            href="/login" 
            className="text-primary hover:underline underline-offset-4"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
