import { createAdminClient, createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
import {
  normalizeInstagramUsername,
  verifyTransferIntent,
} from "@/lib/instagram/transfer-intent";
import { NextResponse } from "next/server";

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  const message = (error as { message?: string }).message || "";
  return code === "23505" || message.toLowerCase().includes("duplicate key");
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const adminSupabase = await createAdminClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { instagram_username } = body;

    if (!instagram_username || typeof instagram_username !== "string") {
      return NextResponse.json(
        { error: "Instagram username is required" },
        { status: 400 },
      );
    }

    const cleanUsername = instagram_username.replace(/^@/, "").trim();

    const adminSupabase = await createAdminClient();

    const { data: existingBinding, error: existingBindingError } = await adminSupabase
      .from("profiles")
      .select("id")
      .eq("instagram_username", cleanUsername)
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
    const { transfer_token, intent_id } = body;

    if (!transfer_token || typeof transfer_token !== "string") {
      return NextResponse.json({ error: "transfer_token is required" }, { status: 400 });
    }

    let transferIntent;
    try {
      transferIntent = verifyTransferIntent(transfer_token, user.id);
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Invalid transfer token",
          tokenInvalid: true,
        },
        { status: 400 }
      );
    }

    if (intent_id && intent_id !== transferIntent.intentId) {
      return NextResponse.json(
        {
          error: "Intent mismatch",
          tokenInvalid: true,
        },
        { status: 400 }
      );
    }

    const normalizedUsername = normalizeInstagramUsername(transferIntent.instagramUsername);

    const { error: transferError } = await adminSupabase.rpc(
      "transfer_verified_instagram_binding",
      {
        p_old_owner_id: transferIntent.oldOwnerId,
        p_new_owner_id: user.id,
        p_instagram_username: normalizedUsername,
        p_instagram_avatar_url: transferIntent.instagramAvatarUrl || null,
      }
    );

    if (transferError) {
      if (isUniqueViolation(transferError)) {
        return NextResponse.json(
          {
            error: "Instagram username was claimed concurrently. Please retry verification.",
            raceConditionDetected: true,
          },
          { status: 409 }
        );
      }

      if (transferError.code === "P0002") {
        return NextResponse.json(
          {
            error: "Instagram ownership changed. Please restart verification.",
            ownershipChanged: true,
          },
          { status: 409 }
        );
      }

      console.error("Failed to transfer IG binding:", transferError);
      return NextResponse.json(
        { error: "Failed to transfer Instagram ownership" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Previous Instagram binding removed. You can now verify this account.",
    });
  } catch (error) {
    console.error("Error in transfer:", error);
      transferred: true,
      profile: {
        id: user.id,
        instagram_username: normalizedUsername,
      },
    });
  } catch (error) {
    console.error("Error in transfer route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
