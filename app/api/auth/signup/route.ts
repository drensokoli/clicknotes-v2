import { NextRequest, NextResponse } from "next/server"
import * as bcrypt from "bcryptjs"
import clientPromise from "@/lib/mongodb"
import { sendEmail, emailTemplates, EmailConfig } from "@/lib/email-service"
import crypto from "crypto"
import { validateSignup } from "@/lib/validation"

const db = process.env.MONGODB_DB_NAME || "clicknotes-v2"

export async function POST(request: NextRequest) {
          try {
          const { name, email, password } = await request.json()

          // Comprehensive validation
          const validation = validateSignup({ name, email, password, confirmPassword: password })
          
          if (!validation.isValid) {
            return NextResponse.json(
              { error: "Validation failed", details: validation.errors },
              { status: 400 }
            )
          }

    // Connect to MongoDB
    const client = await clientPromise
    const dbInstance = client.db(db)
    const usersCollection = dbInstance.collection("users")

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email: email.toLowerCase() })
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const user = {
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

               const result = await usersCollection.insertOne(user)

           // Generate email verification token
           const verificationToken = crypto.randomBytes(32).toString("hex")
           const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

           // Store verification token
           await dbInstance.collection("verificationTokens").insertOne({
             identifier: user.email,
             token: verificationToken,
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

             const verificationLink = `${process.env.NEXTAUTH_URL}/verify-email?token=${verificationToken}`
             const { subject, html, text } = emailTemplates.emailVerification(verificationLink, user.name)
             
             await sendEmail(emailConfig as EmailConfig, user.email, subject, html, text)
             
             console.log(`Verification email sent to ${user.email}`)
           } catch (emailError) {
             console.error('Failed to send verification email:', emailError)
             // Don't fail the signup if email fails, just log it
           }

           // Create response without password
           const userResponse = {
             name: user.name,
             email: user.email,
             createdAt: user.createdAt,
             updatedAt: user.updatedAt,
             id: result.insertedId
           }

    return NextResponse.json(
      { 
        message: "User created successfully",
        user: userResponse
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Signup error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
