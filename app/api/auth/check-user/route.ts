import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

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

    // Find user by email
    const user = await usersCollection.findOne({ 
      email: email.toLowerCase() 
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Check if user has expired verification tokens
    const verificationTokensCollection = dbInstance.collection("verificationTokens")
    const expiredToken = await verificationTokensCollection.findOne({
      identifier: email.toLowerCase(),
      type: "email-verification",
      expires: { $lt: new Date() }
    })

    // Return user verification status and token info
    return NextResponse.json({
      email: user.email,
      emailVerified: user.emailVerified || false,
      name: user.name,
      hasExpiredToken: !!expiredToken
    })

  } catch (error) {
    console.error("Check user error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
