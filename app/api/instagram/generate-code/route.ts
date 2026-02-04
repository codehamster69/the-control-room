import { createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

// Generate a 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check if user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { instagram_username } = body;

    if (!instagram_username || typeof instagram_username !== "string") {
      return NextResponse.json(
        { error: "Instagram username is required" },
        { status: 400 }
      );
    }

    // Clean the username (remove @ if present)
    const cleanUsername = instagram_username.replace(/^@/, "").trim();

    if (cleanUsername.length < 1 || cleanUsername.length > 30) {
      return NextResponse.json(
        { error: "Invalid Instagram username" },
        { status: 400 }
      );
    }

    // Get user profile
    let profile = null;
    let profileError = null;
    try {
      const result = await supabase
        .from("profiles")
        .select("id, instagram_username, is_instagram_verified")
        .eq("id", user.id)
        .single();
      profile = result.data;
      profileError = result.error;
    } catch (e) {
      profileError = { message: "Profile table or columns not found" };
    }

    // Create profile if it doesn't exist (this prevents foreign key violations)
    if (profileError || !profile) {
      // Generate username from email or use user ID as fallback
      const username = user.email?.split("@")[0] || user.id.slice(0, 8);
      
      // Check if username exists and add suffix if needed
      let finalUsername = username;
      let counter = 1;
      let usernameExists = true;
      
      while (usernameExists) {
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", finalUsername)
          .single();
        
        if (!existing) {
          usernameExists = false;
        } else {
          finalUsername = `${username}${counter}`;
          counter++;
        }
      }

      // Create the profile
      const { data: newProfile, error: createError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          username: finalUsername,
          avatar_url: user.user_metadata?.avatar_url || null,
        })
        .select("id, instagram_username, is_instagram_verified")
        .single();

      if (createError) {
        console.error("Error creating profile:", createError);
        return NextResponse.json(
          { error: "Failed to create user profile" },
          { status: 500 }
        );
      }

      profile = newProfile;
    }

    // Check if already verified
    if (profile?.is_instagram_verified && profile?.instagram_username === cleanUsername) {
      return NextResponse.json(
        { 
          message: "Already verified",
          verified: true
        },
        { status: 200 }
      );
    }

    // Check if there's a pending verification that hasn't expired yet
    let lastVerification = null;
    try {
      const { data } = await supabase
        .from("instagram_verifications")
        .select("created_at, expires_at")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString()) // Only check non-expired verifications
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      lastVerification = data;
    } catch (e) {
      // No active verification exists
      lastVerification = null;
    }

    // Check if the existing verification is still valid (not expired)
    if (lastVerification) {
      const expiresAt = new Date(lastVerification.expires_at);
      const now = new Date();
      
      // If the code is still valid (not expired), don't allow generating a new one
      if (now < expiresAt) {
        const remainingMs = expiresAt.getTime() - now.getTime();
        const remainingMinutes = Math.ceil(remainingMs / 1000 / 60);
        
        return NextResponse.json(
          { 
            error: `You already have an active verification code. Please use it or wait ${remainingMinutes} minute(s) before requesting a new code.`,
            waitTime: remainingMinutes,
            expiresInMinutes: remainingMinutes,
            existingCodeActive: true
          },
          { status: 429 }
        );
      }
      // If expired, we can proceed to generate a new code
    }

    // Generate new verification code
    const verificationCode = generateVerificationCode();

    //10 minutes from now Set expiry to  using UTC
    // Use Date.now() which is always UTC epoch milliseconds
    const now = Date.now();
    const expiresAt = new Date(now + 10 * 60 * 1000);

    // DEBUG: Log timestamps
    console.log("DEBUG generate-code:", {
      nowMs: now,
      expiresAtMs: expiresAt.getTime(),
      diffMs: expiresAt.getTime() - now,
      diffMinutes: (expiresAt.getTime() - now) / 1000 / 60,
      expiresAtISO: expiresAt.toISOString()
    });

    // Store verification record
    let verification = null;
    let insertError = null;
    try {
      const result = await supabase
        .from("instagram_verifications")
        .insert({
          user_id: user.id,
          verification_code: verificationCode,
          expires_at: expiresAt.toISOString(),
          status: "pending",
          instagram_username: cleanUsername,
        })
        .select()
        .single();
      verification = result.data;
      insertError = result.error;
    } catch (e) {
      insertError = { message: "Instagram_verifications table not found. Please run the database migrations." };
    }

    if (insertError) {
      console.error("Error inserting verification:", insertError);
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      verification_id: verification.id,
      verification_code: verificationCode,
      expires_in_minutes: 10,
      expires_at: expiresAt.toISOString(),
      username: cleanUsername,
      message: `Verification code generated. Please add this code to your Instagram bio.`,
      instructions: [
        `1. Open Instagram and go to your profile`,
        `2. Tap "Edit Profile"`,
        `3. Add "${verificationCode}" to your bio section`,
        `4. Save changes`,
        `5. Click "Verify" button below`
      ]
    });

  } catch (error) {
    console.error("Error in generate-code:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

