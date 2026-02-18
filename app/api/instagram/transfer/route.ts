import { createAdminClient, createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

const PROFILE_PROGRESS_FIELDS = [
  "token_balance",
  "total_items_collected",
  "current_items_owned",
  "total_power",
  "monthly_power_gain",
  "bot_accumulated_progress",
  "bot_running_until",
  "bot_session_runtime_minutes",
  "last_free_run_at",
  "bot_items_per_hour_level",
  "bot_runtime_level",
  "satellite_level",
  "cost_per_hour_level",
  "subscription_expiry",
  "owned_ticket_ids",
  "inventory",
  "collection_history",
  "chaos_stat",
  "simp_stat",
] as const;

const PROFILE_PROGRESS_RESET_VALUES: Record<
  (typeof PROFILE_PROGRESS_FIELDS)[number],
  unknown
> = {
  token_balance: 0,
  total_items_collected: 0,
  current_items_owned: 0,
  total_power: 0,
  monthly_power_gain: 0,
  bot_accumulated_progress: 0,
  bot_running_until: null,
  bot_session_runtime_minutes: null,
  last_free_run_at: null,
  bot_items_per_hour_level: 0,
  bot_runtime_level: 0,
  satellite_level: 0,
  cost_per_hour_level: 0,
  subscription_expiry: null,
  owned_ticket_ids: [],
  inventory: {},
  collection_history: {},
  chaos_stat: 0,
  simp_stat: 0,
};

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

    const selectFields = ["id", ...PROFILE_PROGRESS_FIELDS].join(", ");
    const { data: oldProfile, error: oldProfileError } = await adminSupabase
      .from("profiles")
      .select(selectFields)
      .eq("id", existingBinding.id)
      .single();

    if (oldProfileError || !oldProfile) {
      return NextResponse.json(
        { error: "Failed to load previous account progress" },
        { status: 500 },
      );
    }

    const oldProfileAny = oldProfile as unknown as Record<string, unknown>;
    const transferredProgress = PROFILE_PROGRESS_FIELDS.reduce<
      Record<string, unknown>
    >((acc, field: (typeof PROFILE_PROGRESS_FIELDS)[number]) => {
      acc[field] = oldProfileAny[field] ?? PROFILE_PROGRESS_RESET_VALUES[field];
      return acc;
    }, {});

    const { error: moveProgressError } = await adminSupabase
      .from("profiles")
      .update(transferredProgress)
      .eq("id", user.id);

    if (moveProgressError) {
      return NextResponse.json(
        { error: "Failed to transfer previous account progress" },
        { status: 500 },
      );
    }

    const { error: moveLegacyTicketsError } = await adminSupabase
      .from("tickets")
      .update({ owner_id: user.id })
      .eq("owner_id", existingBinding.id);

    if (moveLegacyTicketsError) {
      return NextResponse.json(
        { error: "Failed to transfer legacy ticket ownership" },
        { status: 500 },
      );
    }

    const { error: moveMarketplaceTicketsError } = await adminSupabase
      .from("marketplace_tickets")
      .update({ owner_user_id: user.id })
      .eq("owner_user_id", existingBinding.id);

    if (moveMarketplaceTicketsError) {
      return NextResponse.json(
        { error: "Failed to transfer ticket ownership" },
        { status: 500 },
      );
    }

    const { error: delinkError } = await adminSupabase
      .from("profiles")
      .update({
        ...PROFILE_PROGRESS_RESET_VALUES,
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
      message:
        "Previous Instagram binding removed and progress transferred. You can now verify this account.",
    });
  } catch (error) {
    console.error("Error in transfer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
