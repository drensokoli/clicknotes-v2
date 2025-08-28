import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import crypto from "crypto"
import { sendEmail, emailTemplates, EmailConfig } from "@/lib/email-service"

const db = process.env.MONGODB_DB_NAME || "clicknotes-v2"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    // Connect to MongoDB
    const client = await clientPromise
    const dbInstance = client.db(db)
    const usersCollection = dbInstance.collection("users")
    const verificationTokensCollection = dbInstance.collection("verificationTokens")

    // Check if user exists
    const user = await usersCollection.findOne({ email: email.toLowerCase() })
    if (!user) {
      // Tell user that email doesn't exist
      return NextResponse.json(
        { error: "No account found with this email address. Please check the email address or create a new account." },
        { status: 404 }
      )
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex")
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Store reset token
    await verificationTokensCollection.insertOne({
      identifier: email.toLowerCase(),
      token: resetToken,
      expires: resetTokenExpiry,
      type: "password-reset"
    })

    // Send password reset email
    try {
      const emailConfig = {
        provider: (process.env.EMAIL_PROVIDER as string | undefined) || 'smtp',
        apiKey: process.env.EMAIL_API_KEY,
        fromEmail: process.env.EMAIL_FROM || 'noreply@clicknotes.com',
        fromName: process.env.EMAIL_FROM_NAME || 'ClickNotes',
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : undefined,
        secure: process.env.EMAIL_SECURE === 'true',
        user: process.env.EMAIL_USER,
        password: process.env.EMAIL_PASSWORD
      }

      console.log('Email config:', {
        provider: emailConfig.provider,
        fromEmail: emailConfig.fromEmail,
        fromName: emailConfig.fromName
      })

      const resetLink = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`
      const { subject, html, text } = emailTemplates.passwordReset(resetLink, user.name || 'User')
      
      await sendEmail(emailConfig as EmailConfig, email.toLowerCase(), subject, html, text)
      
      console.log(`Password reset email sent to ${email}`)
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError)
      // Don't fail the request if email fails, just log it
    }

    return NextResponse.json(
      { message: "Password reset email sent successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Forgot password error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
