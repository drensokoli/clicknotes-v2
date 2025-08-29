"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, CheckCircle, RefreshCw } from "lucide-react"

export default function VerificationPendingPage() {
  const [isResending, setIsResending] = useState(false)
  const [resendMessage, setResendMessage] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get("email")

  const handleResendVerification = async () => {
    if (!email) return
    
    setIsResending(true)
    setResendMessage("")

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to resend verification")
      }

      setResendMessage("Verification email sent! Check your inbox.")
    } catch (error) {
      setResendMessage(error instanceof Error ? error.message : "An error occurred. Please try again.")
    } finally {
      setIsResending(false)
    }
  }

  const handleGoToSignIn = () => {
    router.push("/login")
  }

  if (!email) {
    return (
      <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Link href="/" className="flex items-center gap-2 self-center font-medium">
            <Image src="/logo-blue.png" alt="ClickNotes" width={100} height={100} />
          </Link>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-red-700 dark:text-red-400 mb-4">Invalid verification page.</p>
                <Link href="/signup" className="text-primary hover:underline">
                  Go back to signup
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-medium">
          <Image src="/logo-blue.png" alt="ClickNotes" width={100} height={100} />
        </Link>
        
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
              <Mail className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-xl">Check Your Email</CardTitle>
            <CardDescription>
              We&apos;ve sent a verification link to <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Click the verification link in your email to activate your account.
                </p>
                <p className="text-xs text-muted-foreground">
                  The link will expire in 24 hours.
                </p>
              </div>

              {resendMessage && (
                <div className={`text-sm text-center p-3 rounded-md`}>
                  {resendMessage}
                </div>
              )}

              <div className="space-y-3">
                <Button 
                  onClick={handleResendVerification} 
                  disabled={isResending}
                  variant="outline"
                  className="w-full hover:cursor-pointer"
                >
                  {isResending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Resend Verification Email
                    </>
                  )}
                </Button>

                <Button 
                  onClick={handleGoToSignIn}
                  className="w-full"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  I&apos;ve Verified My Email - Sign In
                </Button>
              </div>

              <div className="text-center text-sm text-muted-foreground">
                Didn&apos;t receive the email? Check your spam folder or{" "}
                <button 
                  onClick={handleResendVerification}
                  disabled={isResending}
                  className="text-primary hover:underline disabled:opacity-50"
                >
                  resend it
                </button>
                .
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="text-center">
          <Link 
            href="/signup" 
            className="text-primary hover:underline underline-offset-4"
          >
            Back to Sign Up
          </Link>
        </div>
      </div>
    </div>
  )
}
