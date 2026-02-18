import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  createTransferIntent,
  maskEmail,
  normalizeInstagramUsername,
} from "@/lib/instagram/transfer-intent";
import { type NextRequest, NextResponse } from "next/server";
import { ApifyClient } from "apify-client";

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;

// Download image and upload to Supabase Storage using service role (bypasses RLS)
async function downloadAndUploadAvatar(
  userId: string,
  avatarUrl: string
): Promise<string | null> {
  try {
    console.log("Downloading avatar from:", avatarUrl);

    // Download the image
    const response = await fetch(avatarUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.error("Failed to download avatar:", response.status);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate unique filename
    const fileExt = avatarUrl.split('.').pop()?.split('?')[0] || 'jpg';
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    console.log("Uploading avatar to user-avatars:", filePath);

    // Create admin client to bypass RLS
    const adminSupabase = await createAdminClient();
    
    // Upload to Supabase Storage with service role (bypasses RLS)
    const { data, error } = await adminSupabase.storage
      .from("user-avatars")
      .upload(filePath, buffer, {
        contentType: response.headers.get("content-type") || "image/jpeg",
        upsert: true,
      });

    if (error) {
      console.error("Failed to upload avatar:", error);
      return null;
    }

    // Get public URL
    const { data: urlData } = adminSupabase.storage.from("user-avatars").getPublicUrl(filePath);
    console.log("Avatar uploaded successfully:", urlData.publicUrl);

    return urlData.publicUrl;
  } catch (error) {
    console.error("Error processing avatar:", error);
    return null;
  }
}

// Scrape Instagram profile using Apify
async function scrapeInstagramProfile(username: string): Promise<{
  success: boolean;
  bio?: string;
  profilePicUrl?: string;
  error?: string;
}> {
  // Check if Apify token is configured
  if (!APIFY_API_TOKEN) {
    console.error("APIFY_API_TOKEN not configured");
    return {
      success: false,
      error: "Instagram scraping service not configured. Please set APIFY_API_TOKEN environment variable."
    };
  }

  try {
    // Initialize the ApifyClient
    const client = new ApifyClient({
      token: APIFY_API_TOKEN,
    });

    // Prepare Actor input - Apify uses "usernames" not "profiles"
    const input = {
      usernames: [username],
    };

    console.log(`Starting Apify actor for: ${username}`);

    // Run the Actor and wait for it to finish
    const run = await client.actor("apify/instagram-profile-scraper").call(input);

    console.log(`Apify run started: ${run.id}, status: ${run.status}`);
    console.log(`💾 Check your data here: https://console.apify.com/storage/datasets/${run.defaultDatasetId}`);

    if (run.status !== "SUCCEEDED") {
      return {
        success: false,
        error: `Apify run failed with status: ${run.status}`
      };
    }

    // Fetch results from the run's dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`Apify returned ${items.length} items`);

    if (items.length > 0) {
      const profile = items[0] as Record<string, unknown>;
      
      // Apify returns the bio as "biography" or "biography" in different versions
      const bio = (profile.biography || profile.bio || "") as string;
      const profilePicUrl = (profile.profilePicUrl || profile.profile_pic_url || profile.picture || "") as string;

      console.log(`Bio found: "${bio}"`);
      console.log(`Profile pic found: ${profilePicUrl ? "yes" : "no"}`);

      return {
        success: true,
        bio: bio,
        profilePicUrl: profilePicUrl
      };
    }

    return {
      success: false,
      error: "No profile data returned from Apify"
    };

  } catch (error) {
    console.error("Apify Instagram scraping error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to scrape Instagram profile"
    };
  }
}

function maskEmail(email: string): string {
  const [localPart = "", domainPart = ""] = email.split("@");

  if (!localPart || !domainPart) {
    return "another email";
  }

  const visiblePrefix = localPart.slice(0, 2);
  const hiddenLocal = "*".repeat(Math.max(localPart.length - 2, 1));

  return `${visiblePrefix}${hiddenLocal}@${domainPart}`;

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  const message = (error as { message?: string }).message || "";
  return code === "23505" || message.toLowerCase().includes("duplicate key");
}

// Check if code exists in bio
function codeInBio(bio: string, code: string): boolean {
  if (!bio) return false;

  const normalizedBio = bio.toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizedCode = code.trim().toLowerCase();

  // Check if the code appears as a standalone word in the bio
  const words = normalizedBio.split(/\s+/);
  return words.includes(normalizedCode);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

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
    const { verification_id, instagram_username, verification_code } = body;

    if (!verification_id || !verification_code) {
      return NextResponse.json(
        { error: "Verification ID and code are required" },
        { status: 400 }
      );
    }

    // Get the verification record
    let verification = null;
    let verifyError = null;
    try {
      const result = await supabase
        .from("instagram_verifications")
        .select("*")
        .eq("id", verification_id)
        .eq("user_id", user.id)
        .in("status", ["pending", "failed"])
        .gt("expires_at", new Date().toISOString())
        .single();
      verification = result.data;
      verifyError = result.error;
    } catch (e) {
      verifyError = { message: "Table not found or no valid verification" };
    }

    if (verifyError || !verification) {
      return NextResponse.json(
        { error: "Verification record not found, expired, or already used. Please generate a new code." },
        { status: 404 }
      );
    }

    // Check if already verified
    if (verification.status === "verified") {
      return NextResponse.json({
        success: true,
        verified: true,
        message: "Already verified!"
      });
    }

    // Reset status to pending if it was failed, allowing retry
    if (verification.status === "failed") {
      try {
        await supabase
          .from("instagram_verifications")
          .update({ status: "pending" })
          .eq("id", verification_id);
      } catch (e) {}
    }

    // Verify the code matches
    if (verification_code !== verification.verification_code) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    const targetUsername = verification.instagram_username || instagram_username;
    const normalizedUsername = normalizeInstagramUsername(targetUsername || "");

    if (!targetUsername) {
      return NextResponse.json(
        { error: "Instagram username not found" },
        { status: 400 }
      );
    }

    // Check if this Instagram is already bound to a different account
    const adminSupabase = await createAdminClient();
    const { data: existingBinding } = await adminSupabase
      .from("profiles")
      .select("id")
      .eq("instagram_username", targetUsername)
      .eq("is_instagram_verified", true)
      .neq("id", user.id)
      .limit(1)
      .maybeSingle();

    if (existingBinding?.id) {
      const { data: existingAuthUser } = await adminSupabase.auth.admin.getUserById(
        existingBinding.id,
      );
      const maskedEmail = existingAuthUser?.user?.email
        ? maskEmail(existingAuthUser.user.email)
        : "another email";

      return NextResponse.json(
        {
          error: "Instagram account is already bound to another user",
          alreadyBound: true,
          maskedEmail,
        },
        { status: 409 },
      );
    }

    // Scrape Instagram profile using Apify
    console.log(`Scraping Instagram profile for: ${targetUsername}`);
    const scrapeResult = await scrapeInstagramProfile(targetUsername);

    // DEBUG: Log scraped data
    console.log("=== DEBUG: scrapeInstagramProfile ===");
    console.log("username:", targetUsername);
    console.log("scrapeResult:", JSON.stringify(scrapeResult, null, 2));
    console.log("bio found:", scrapeResult.bio ? `"${scrapeResult.bio}"` : "empty");
    console.log("profilePicUrl found:", scrapeResult.profilePicUrl ? "yes" : "no");

    if (!scrapeResult.success) {
      try {
        await supabase
          .from("instagram_verifications")
          .update({
            status: "failed",
            error_message: scrapeResult.error
          })
          .eq("id", verification_id);
      } catch (e) {}

      return NextResponse.json(
        {
          error: scrapeResult.error || "Failed to verify Instagram account",
          scrapingFailed: true,
          suggestion: "If Instagram is blocking our request, please try again or make your profile public."
        },
        { status: 400 }
      );
    }

    // Check if verification code is in the bio
    const hasCode = codeInBio(scrapeResult.bio || "", verification_code);

    console.log(`Checking for code "${verification_code}" in bio: ${hasCode ? "FOUND" : "NOT FOUND"}`);
    console.log(`Bio content: "${scrapeResult.bio}"`);

    if (!hasCode) {
      try {
        await supabase
          .from("instagram_verifications")
          .update({
            status: "failed",
            error_message: "Code not found in bio"
          })
          .eq("id", verification_id);
      } catch (e) {}

      return NextResponse.json(
        {
          error: "Verification code not found in your Instagram bio. Please add it to your bio.",
          codeNotFound: true,
          currentBio: scrapeResult.bio || "(empty)",
          expectedCode: verification_code,
          debugBio: scrapeResult.bio,
          debugProfilePic: scrapeResult.profilePicUrl ? "[url hidden]" : "none"
        },
        { status: 400 }
      );
    }

    const adminSupabase = await createAdminClient();

    const { data: conflictingProfile, error: conflictingProfileError } = await adminSupabase
      .from("profiles")
      .select("id, instagram_username")
      .neq("id", user.id)
      .eq("is_instagram_verified", true)
      .ilike("instagram_username", normalizedUsername)
      .maybeSingle();

    if (conflictingProfileError) {
      console.error("Error checking instagram ownership conflict:", conflictingProfileError);
      return NextResponse.json(
        { error: "Failed to verify Instagram ownership conflict" },
        { status: 500 }
      );
    }

    if (conflictingProfile) {
      const { data: oldOwnerUser, error: oldOwnerUserError } = await adminSupabase.auth.admin.getUserById(
        conflictingProfile.id
      );

      if (oldOwnerUserError) {
        console.error("Error loading old owner user for conflict response:", oldOwnerUserError);
      }

      const transferIntent = createTransferIntent({
        newOwnerId: user.id,
        oldOwnerId: conflictingProfile.id,
        instagramUsername: normalizedUsername,
        instagramAvatarUrl: scrapeResult.profilePicUrl,
      });

      return NextResponse.json(
        {
          error: "Instagram account is already bound to another profile",
          alreadyBound: true,
          oldOwner: {
            emailMasked: maskEmail(oldOwnerUser?.user?.email),
          },
          oldOwnerProfileId: conflictingProfile.id,
          transferIntent: {
            token: transferIntent.token,
            intentId: transferIntent.intentId,
            expiresAt: transferIntent.expiresAt,
          },
        },
        { status: 409 }
      );
    }

    // Success! Update verification status
    try {
      await supabase
        .from("instagram_verifications")
        .update({
          status: "verified",
          profile_pic_url: scrapeResult.profilePicUrl
        })
        .eq("id", verification_id);
    } catch (e) {
      console.error("Error updating verification status:", e);
    }

    // Download and store avatar in Supabase Storage
    let storedAvatarUrl = null;
    let avatarStorageError = null;
    if (scrapeResult.profilePicUrl) {
      try {
        storedAvatarUrl = await downloadAndUploadAvatar(
          user.id,
          scrapeResult.profilePicUrl
        );
        if (!storedAvatarUrl) {
          avatarStorageError = "Upload returned null";
        }
      } catch (storageError) {
        console.error("Avatar storage error:", storageError);
        avatarStorageError = storageError instanceof Error ? storageError.message : "Storage error";
      }
    }

    // Use stored URL or fall back to original Instagram URL
    const finalAvatarUrl = storedAvatarUrl || scrapeResult.profilePicUrl;
    
    if (!storedAvatarUrl) {
      console.log("Using original Instagram URL for avatar:", scrapeResult.profilePicUrl);
    }

    // Update user profile with stored avatar URL
    try {
      const { error: updateProfileError } = await supabase
        .from("profiles")
        .update({
          instagram_username: normalizedUsername,
          instagram_avatar_url: finalAvatarUrl,
          is_instagram_verified: true,
          avatar_url: finalAvatarUrl
        })
        .eq("id", user.id);

      if (updateProfileError) {
        if (isUniqueViolation(updateProfileError)) {
          return NextResponse.json(
            {
              error: "Instagram username was claimed concurrently. Please retry verification.",
              alreadyBound: true,
              raceConditionDetected: true,
            },
            { status: 409 }
          );
        }

        throw updateProfileError;
      }
    } catch (e) {
      console.error("Error updating profile:", e);
      return NextResponse.json(
        { error: "Failed to update profile with verified Instagram account" },
        { status: 500 }
      );
    }

    // Delete all verification entries for this user after successful verification
    // This prevents old verification codes from being reused and keeps the table clean
    try {
      const { error: deleteError } = await supabase
        .from("instagram_verifications")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) {
        console.error("Error deleting verification entries:", deleteError);
      } else {
        console.log(`Deleted all verification entries for user ${user.id}`);
      }
    } catch (deleteError) {
      console.error("Failed to delete verification entries:", deleteError);
    }

    return NextResponse.json({
      success: true,
      verified: true,
      message: "Instagram account verified successfully!",
      profile: {
        username: targetUsername,
        avatarUrl: finalAvatarUrl
      },
      debugBio: scrapeResult.bio,
      debugProfilePic: "[url hidden]",
      debugAvatarStorage: storedAvatarUrl ? "stored" : "original"
    });

  } catch (error) {
    console.error("Error in verify:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
