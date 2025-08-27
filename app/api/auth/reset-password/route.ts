import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import bcrypt from "bcryptjs"
import { validatePassword } from "@/lib/validation"

const db = process.env.MONGODB_DB_NAME || "clicknotes-v2"

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      )
    }

    // Comprehensive password validation
    const passwordValidation = validatePassword(password)
    
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: "Password validation failed", details: passwordValidation.errors },
        { status: 400 }
      )
    }

    // Connect to MongoDB
    const client = await clientPromise
    const dbInstance = client.db(db)
    const verificationTokensCollection = dbInstance.collection("verificationTokens")
    const usersCollection = dbInstance.collection("users")

    // Find and validate reset token
    const resetToken = await verificationTokensCollection.findOne({
      token,
      type: "password-reset",
      expires: { $gt: new Date() }
    })

    if (!resetToken) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 }
      )
    }

    // Get current user to check existing password
    const currentUser = await usersCollection.findOne({ 
      email: resetToken.identifier 
    })

    if (!currentUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Check if new password is the same as current password
    const isSamePassword = await bcrypt.compare(password, currentUser.password)
    
    if (isSamePassword) {
      return NextResponse.json(
        { error: "New password must be different from your current password" },
        { status: 400 }
      )
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Update user password
    const result = await usersCollection.updateOne(
      { email: resetToken.identifier },
      { 
        $set: { 
          password: hashedPassword,
          updatedAt: new Date()
        }
      }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Delete used reset token
    await verificationTokensCollection.deleteOne({ token })

    return NextResponse.json(
      { message: "Password reset successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Reset password error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
