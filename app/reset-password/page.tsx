"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { validatePassword } from "@/lib/validation"
import { PasswordStrengthIndicator } from "@/components/password-strength-indicator"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [token, setToken] = useState("")
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const tokenParam = searchParams.get("token")
    if (!tokenParam) {
      setError("Invalid reset link. Please request a new password reset.")
      return
    }
    setToken(tokenParam)
  }, [searchParams])

  // Real-time password strength calculation
  useEffect(() => {
    if (password) {
      const validation = validatePassword(password)
      setPasswordStrength(validation.strength)
    }
  }, [password])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setMessage("")
    setFieldErrors({})

    // Comprehensive password validation
    const passwordValidation = validatePassword(password)
    
    if (!passwordValidation.isValid) {
      setFieldErrors({ password: passwordValidation.errors.join('. ') })
      setIsLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: "Passwords do not match" })
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.error && data.error.includes("different from your current password")) {
          setError("New password must be different from your current password")
        } else {
          throw new Error(data.error || "Failed to reset password")
        }
        setIsLoading(false)
        return
      }

      setMessage("Password reset successfully! Redirecting to login...")
      setTimeout(() => {
        router.push("/login")
      }, 2000)
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Link href="/" className="flex items-center gap-2 self-center font-medium">
            <Image src="/logo-blue.png" alt="ClickNotes" width={100} height={100} />
          </Link>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-red-700 dark:text-red-400 mb-4">{error}</p>
                <Link href="/forgot-password" className="text-primary hover:underline">
                  Request new password reset
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
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-medium">
          <Image src="/logo-blue.png" alt="ClickNotes" width={100} height={100} />
        </Link>
        
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Reset Password</CardTitle>
            <CardDescription>
              Enter your new password below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-6">
                <div className="grid gap-3">
                  <Label htmlFor="password">New Password</Label>
                  <PasswordInput
                    id="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className={fieldErrors.password ? "border-red-500" : ""}
                  />
                  {password && <PasswordStrengthIndicator strength={passwordStrength} />}
                  {fieldErrors.password && (
                    <p className="text-sm text-red-700 dark:text-red-400">{fieldErrors.password}</p>
                  )}
                </div>
                
                <div className="grid gap-3">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <PasswordInput
                    id="confirmPassword"
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className={fieldErrors.confirmPassword ? "border-red-500" : ""}
                  />
                  {fieldErrors.confirmPassword && (
                    <p className="text-sm text-red-700 dark:text-red-400">{fieldErrors.confirmPassword}</p>
                  )}
                </div>
                
                {error && (
                  <div className="text-sm text-red-700 dark:text-red-400 text-center">
                    {error}
                  </div>
                )}
                
                {message && (
                  <div className="text-sm text-gray-700 dark:text-gray-300 text-center">
                    {message}
                  </div>
                )}
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Resetting..." : "Reset Password"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        
        <div className="text-center">
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
