import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") || "/"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Create or update user profile
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).single()

        if (!profile) {
          // Generate username from email (part before @)
          const username = user.email?.split("@")[0] || "user"
          
          // Check if username exists and add suffix if needed
          let finalUsername = username
          let counter = 1
          while (true) {
            const { data: existing } = await supabase
              .from("profiles")
              .select("id")
              .eq("username", finalUsername)
              .single()
            
            if (!existing) break
            finalUsername = `${username}${counter}`
            counter++
          }

          await supabase.from("profiles").insert([
            {
              id: user.id,
              username: finalUsername,
              avatar_url: user.user_metadata?.avatar_url || null,
            },
          ])
        }
      }

      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  return NextResponse.redirect(new URL("/auth/error", request.url))
}
