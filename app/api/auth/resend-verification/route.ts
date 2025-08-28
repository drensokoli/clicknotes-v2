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
    const verificationTokensCollection = dbInstance.collection("verificationTokens")
    const usersCollection = dbInstance.collection("users")

    // Check if user exists and needs verification
    const user = await usersCollection.findOne({ 
      email: email.toLowerCase(),
      emailVerified: { $ne: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found or already verified" },
        { status: 400 }
      )
    }

    // Delete any existing verification tokens for this user
    await verificationTokensCollection.deleteMany({ 
      identifier: email.toLowerCase(),
      type: "email-verification"
    })

    // Generate new verification token
    const newVerificationToken = crypto.randomBytes(32).toString("hex")
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Store new verification token
    await verificationTokensCollection.insertOne({
      identifier: email.toLowerCase(),
      token: newVerificationToken,
      expires: tokenExpiry,
      type: "email-verification"
    })

    // Send verification email
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

      const verificationLink = `${process.env.NEXTAUTH_URL}/verify-email?token=${newVerificationToken}`
      const { subject, html, text } = emailTemplates.emailVerification(verificationLink, user.name || 'User')
      
      await sendEmail(emailConfig as EmailConfig, email.toLowerCase(), subject, html, text)
      
      console.log(`Verification email sent to ${email}`)
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError)
      // Don't fail the request if email fails, just log it
    }

    return NextResponse.json(
      { message: "Verification email sent successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Resend verification error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
