import Link from "next/link"
import Image from "next/image"

import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-medium">
          <Image src="/logo-blue.png" alt="ClickNotes" width={100} height={100} />
        </Link>
        <LoginForm />
      </div>
    </div>
  )
}
