import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { MongoDBAdapter } from "@next-auth/mongodb-adapter"
import clientPromise from "@/lib/mongodb"
import * as bcrypt from "bcryptjs"

const db = process.env.MONGODB_DB_NAME || "clicknotes-v2"

// Development environment configuration
// Fix SSL certificate issues in development
if (process.env.NODE_ENV === 'development' && !process.env.VERCEL_ENV) {
  // This is safe for development only - allows self-signed certificates
  // Never set this in production environments like Vercel
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise, {
    databaseName: db,
    collections: {
      Sessions: "sessions",
      Users: "users", 
      VerificationTokens: "verificationRequests",
    },
  }),
  debug: process.env.NODE_ENV === 'development',
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          const client = await clientPromise
          const dbInstance = client.db(db)
          const usersCollection = dbInstance.collection("users")

          const user = await usersCollection.findOne({ 
            email: credentials.email.toLowerCase() 
          })

          if (!user || !user.password) {
            return null
          }

          // Email verification is checked in the login form before calling signIn

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          )

          if (!isPasswordValid) {
            return null
          }

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            image: user.image,
          }
        } catch (error) {
          console.error("Credentials auth error:", error)
          return null
        }
      }
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt" as const,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user && token?.id) {
        session.user = { ...session.user, id: token.id as string }
      }
      return session
    },
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        console.log('Google OAuth sign in successful:', { 
          email: user.email, 
          name: user.name 
        })
      }
      return true
    },
  },
  pages: {
    signIn: "/login",
    newUser: "/signup",
  },
}
