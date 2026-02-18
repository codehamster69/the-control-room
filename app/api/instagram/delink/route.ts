import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("avatar_url, instagram_avatar_url")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 },
      );
    }

    const updatePayload: {
      instagram_username: null;
      instagram_avatar_url: null;
      is_instagram_verified: boolean;
      avatar_url?: null;
    } = {
      instagram_username: null,
      instagram_avatar_url: null,
      is_instagram_verified: false,
    };

    // Optional avatar fallback: clear avatar only if it currently points to IG avatar.
    if (profile.avatar_url && profile.avatar_url === profile.instagram_avatar_url) {
      updatePayload.avatar_url = null;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to delink Instagram" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Instagram account delinked successfully.",
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
