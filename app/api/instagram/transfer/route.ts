import { createAdminClient, createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { verification_id, verification_code, instagram_username } = body;

    if (!verification_id || !verification_code || !instagram_username) {
      return NextResponse.json(
        { error: "Verification ID, code, and Instagram username are required" },
        { status: 400 },
      );
    }

    const cleanUsername = instagram_username.replace(/^@/, "").trim();

    if (!cleanUsername) {
      return NextResponse.json(
        { error: "Instagram username is required" },
        { status: 400 },
      );
    }

    const { data: verification, error: verificationError } = await supabase
      .from("instagram_verifications")
      .select("id, verification_code, instagram_username, status, expires_at")
      .eq("id", verification_id)
      .eq("user_id", user.id)
      .in("status", ["pending", "failed"])
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (verificationError || !verification) {
      return NextResponse.json(
        {
          error:
            "Verification record not found, expired, or already used. Please generate a new code.",
        },
        { status: 404 },
      );
    }

    if (verification.verification_code !== verification_code) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
    }

    if (
      verification.instagram_username &&
      verification.instagram_username.toLowerCase() !== cleanUsername.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Instagram username does not match the active verification" },
        { status: 400 },
      );
    }

    const adminSupabase = await createAdminClient();

    const { data: existingBinding, error: existingBindingError } = await adminSupabase
      .from("profiles")
      .select("id")
      .ilike("instagram_username", cleanUsername)
      .eq("is_instagram_verified", true)
      .neq("id", user.id)
      .limit(1)
      .maybeSingle();

    if (existingBindingError) {
      return NextResponse.json(
        { error: "Failed to locate existing Instagram binding" },
        { status: 500 },
      );
    }

    if (!existingBinding?.id) {
      return NextResponse.json(
        {
          success: true,
          message: "No existing Instagram binding found to transfer.",
        },
        { status: 200 },
      );
    }

    const { error: delinkError } = await adminSupabase
      .from("profiles")
      .update({
        instagram_username: null,
        instagram_avatar_url: null,
        is_instagram_verified: false,
      })
      .eq("id", existingBinding.id);

    if (delinkError) {
      return NextResponse.json(
        { error: "Failed to delink previous account" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Previous Instagram binding removed. You can now verify this account.",
    });
  } catch (error) {
    console.error("Error in transfer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
