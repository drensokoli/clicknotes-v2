import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

const db = process.env.MONGODB_DB_NAME || "clicknotes-v2"

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json(
        { error: "Verification token is required" },
        { status: 400 }
      )
    }

    // Connect to MongoDB
    const client = await clientPromise
    const dbInstance = client.db(db)
    const verificationTokensCollection = dbInstance.collection("verificationTokens")
    const usersCollection = dbInstance.collection("users")

    // Find and validate verification token
    const verificationToken = await verificationTokensCollection.findOne({
      token,
      type: "email-verification",
      expires: { $gt: new Date() }
    })

    if (!verificationToken) {
      return NextResponse.json(
        { error: "Invalid or expired verification token" },
        { status: 400 }
      )
    }

    // Update user email verification status
    const result = await usersCollection.updateOne(
      { email: verificationToken.identifier },
      { 
        $set: { 
          emailVerified: true,
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

    // Delete used verification token
    await verificationTokensCollection.deleteOne({ token })

    return NextResponse.json(
      { message: "Email verified successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Email verification error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
