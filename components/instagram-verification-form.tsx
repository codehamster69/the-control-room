"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Instagram,
  RefreshCw,
} from "lucide-react";

interface VerificationStatus {
  is_verified: boolean;
  instagram_username: string | null;
  avatar_url: string | null;
  verification: {
    verification_id: string;
    code: string;
    expires_in_minutes: number;
    expires_at: string;
  } | null;
}

interface InstagramConflictData {
  alreadyBound: boolean;
  maskedEmail: string;
}

// Constants
const EXPIRY_DURATION_MS = 10 * 60 * 1000; // 10 minutes

// Local storage key for storing the verification creation time
const VERIFICATION_CREATED_AT_KEY = "instagram_verification_created_at";

// Helper: Get stored creation time from localStorage (uses UTC)
function getStoredCreatedAt(): number | null {
  const stored = localStorage.getItem(VERIFICATION_CREATED_AT_KEY);
  if (stored) {
    return parseInt(stored, 10);
  }
  return null;
}

// Helper: Store creation time in localStorage (uses UTC)
function setStoredCreatedAt(timestamp: number): void {
  localStorage.setItem(VERIFICATION_CREATED_AT_KEY, timestamp.toString());
}

// Helper: Clear stored creation time
function clearStoredCreatedAt(): void {
  localStorage.removeItem(VERIFICATION_CREATED_AT_KEY);
}

export default function InstagramVerification({
  allowRelink = false,
  onVerified,
  redirectOnSuccess = true,
}: InstagramVerificationProps) {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [username, setUsername] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [conflictData, setConflictData] = useState<InstagramConflictData | null>(
    null,
  );
  const [isTransferring, setIsTransferring] = useState(false);

  // Calculate countdown directly from status (no need for separate state)
  const countdown = (() => {
    if (!status?.verification?.expires_at) {
      return { minutes: 0, seconds: 0, isExpired: true };
    }

    const expiresAt = new Date(status.verification.expires_at).getTime();
    const now = currentTime;
    const remaining = Math.max(0, expiresAt - now);

    if (remaining <= 0) {
      return { minutes: 0, seconds: 0, isExpired: true };
    }

    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return { minutes: mins, seconds: secs, isExpired: false };
  })();

  useEffect(() => {
    checkStatus();

    // Poll for status updates every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Update current time every second to refresh countdown
  useEffect(() => {
    if (!status?.verification?.expires_at) return;

    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [status?.verification?.expires_at]);

  const checkStatus = async () => {
    try {
      // First check if user is authenticated
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) return;

      // Try to get profile with new Instagram columns
      // If columns don't exist, we'll get an error - handle gracefully
      let profileData = null;
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select(
            "instagram_username, instagram_avatar_url, is_instagram_verified",
          )
          .eq("id", authUser.id)
          .single();

        if (!error && data) {
          profileData = data;
        }
      } catch (profileError) {
        // Columns might not exist yet, use defaults
        profileData = null;
      }

      // Also get verification details (if table exists)
      let verificationData = null;
      try {
        const { data: verification } = await supabase
          .from("instagram_verifications")
          .select("id, verification_code, expires_at, status, created_at")
          .eq("user_id", authUser.id)
          .in("status", ["pending", "failed", "verified"])
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (verification) {
          verificationData = verification;
        }
      } catch (verifyError) {
        verificationData = null;
      }

      // Calculate time remaining using the database expires_at as the source of truth
      const nowMs = Date.now();
      let expiresInMs = -1;
      let expiresIn = 0;
      let createdAtMs = getStoredCreatedAt();

      // If we have Supabase data but no localStorage, try to use it (fallback)
      if (!createdAtMs && verificationData?.created_at) {
        // Use the Supabase timestamp converted to UTC milliseconds
        createdAtMs = new Date(verificationData.created_at).getTime();
        // Store it for future use
        if (createdAtMs) {
          setStoredCreatedAt(createdAtMs);
        }
      }

      // Use expires_at from database as the source of truth
      if (verificationData?.expires_at) {
        const expiresAtMs = new Date(verificationData.expires_at).getTime();
        expiresInMs = Math.max(0, expiresAtMs - nowMs);
        expiresIn = expiresInMs / 1000 / 60;
      }

      // Check if verification is still valid
      const isVerified = verificationData?.status === "verified";
      const isPendingOrFailed = ["pending", "failed"].includes(
        verificationData?.status || "",
      );
      const isNotExpired = expiresInMs > 0;
      const isVerificationValid =
        (isVerified || (isPendingOrFailed && isNotExpired)) && verificationData;

      setStatus({
        is_verified: profileData?.is_instagram_verified || false,
        instagram_username: profileData?.instagram_username || null,
        avatar_url: profileData?.instagram_avatar_url || null,
        verification: isVerificationValid
          ? {
              verification_id: verificationData!.id,
              code: verificationData!.verification_code,
              expires_in_minutes: Math.max(0, Math.ceil(expiresIn)),
              expires_at: verificationData!.expires_at,
            }
          : null,
      });
    } catch (err) {
      // Silently fail - user can retry later
    }
  };

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setError(null);
    setSuccess(null);
    setConflictData(null);
    setInstructions([]);

    try {
      const response = await fetch("/api/instagram/generate-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ instagram_username: username }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          setError(`${data.error} Please wait ${data.waitTime} minute(s).`);
        } else {
          setError(data.error || "Failed to generate verification code");
        }
        return;
      }

      setSuccess(data.message);
      setInstructions(data.instructions || []);

      // Store creation time using UTC milliseconds
      const nowUTC = new Date().toUTCString();
      setStoredCreatedAt(new Date(nowUTC).getTime());

      // Update status immediately with the verification data from the response
      if (data.verification_id) {
        const expiresInMinutes = data.expires_in_minutes || 10;
        const expiresAtMs =
          new Date(nowUTC).getTime() + expiresInMinutes * 60 * 1000;
        setStatus((prev) =>
          prev
            ? {
                ...prev,
                verification: {
                  verification_id: data.verification_id,
                  code: data.verification_code,
                  expires_in_minutes: expiresInMinutes,
                  expires_at:
                    data.expires_at || new Date(expiresAtMs).toISOString(),
                },
              }
            : null,
        );
      }
    } catch (err) {
      setError("Failed to generate verification code. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVerify = async () => {
    if (!status?.verification?.verification_id) {
      setError("No verification code found. Please generate a code first.");
      return;
    }

    setIsVerifying(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/instagram/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          verification_id: status.verification.verification_id,
          verification_code: status.verification.code,
          instagram_username: username,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.expired) {
          setError(
            "Your verification code has expired. Please generate a new one.",
          );
        } else if (data.codeNotFound) {
          setError(
            "Verification code not found in your bio. Please add it to your bio.",
          );
          setInstructions([
            `1. Open Instagram and go to your profile`,
            `2. Tap "Edit Profile"`,
            `3. Add "${status.verification.code}" to your bio section`,
            `4. Save changes`,
            `5. Click "Verify" button again`,
          ]);
        } else if (data.scrapingFailed) {
          setError(`${data.error} ${data.suggestion || ""}`);
        } else if (response.status === 409 && data.alreadyBound) {
          setConflictData({
            alreadyBound: true,
            maskedEmail: data.maskedEmail || "another email",
          });
        } else {
          setError(data.error || "Verification failed");
        }
        return;
      }

      setConflictData(null);
      setSuccess(data.message || "Verification successful!");
      clearStoredCreatedAt(); // Clear the stored time since verification is done

      // Refresh status
      await checkStatus();

      if (onVerified) {
        onVerified();
      }

      if (redirectOnSuccess) {
        // Redirect to home page after a short delay to show success message
        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 1500);
      }
    } catch (err) {
      setError("Failed to verify. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleTransferBinding = async () => {
    if (!status?.verification?.verification_id) {
      setError("No verification code found. Please generate a code first.");
      return;
    }

    setIsTransferring(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/instagram/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          verification_id: status.verification.verification_id,
          verification_code: status.verification.code,
          instagram_username: username,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Transfer failed. Please try again.");
        return;
      }

      setConflictData(null);
      await checkStatus();
      await handleVerify();
    } catch (err) {
      setError("Failed to transfer Instagram binding. Please try again.");
    } finally {
      setIsTransferring(false);
    }
  };

  // Already verified view
  if (status?.is_verified && !allowRelink) {
    return (
      <Card className="w-full max-w-md mx-auto bg-black/50 border-cyan-500/30">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 p-1">
              {status.avatar_url ? (
                <img
                  src={status.avatar_url}
                  alt="Instagram Profile"
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-gray-800 flex items-center justify-center">
                  <Instagram className="w-10 h-10 text-pink-500" />
                </div>
              )}
            </div>
          </div>
          <CardTitle className="text-cyan-400 font-mono text-xl">
            INSTAGRAM VERIFIED
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="flex items-center justify-center gap-2 text-green-400 mb-4">
            <CheckCircle className="w-6 h-6" />
            <span className="font-mono">@{status.instagram_username}</span>
          </div>
          <p className="text-gray-400 text-sm font-mono">
            Your Instagram account has been verified.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Unified verification view - single window for both generate and verify
  return (
    <>
      <AlertDialog
        open={Boolean(conflictData?.alreadyBound)}
        onOpenChange={(open) => {
          if (!open) {
            setConflictData(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md bg-black border-pink-500/30 text-white font-mono">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-pink-500 font-mono text-left">
              INSTAGRAM ALREADY BOUND
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300 font-mono text-sm leading-relaxed text-left">
              This Instagram is already bound to
              <span className="text-cyan-400"> {conflictData?.maskedEmail}</span>
              .
            </AlertDialogDescription>
            <AlertDialogDescription className="text-gray-400 font-mono text-xs text-left">
              Confirm to delink it from the old account and link it to your
              current account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isTransferring}
              className="border-cyan-500/30 bg-transparent text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 font-mono"
              onClick={() => {
                setError(
                  "Please sign in with the previous email if you want to keep the current binding.",
                );
              }}
            >
              Keep Existing Link
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isTransferring}
              onClick={(event) => {
                event.preventDefault();
                handleTransferBinding();
              }}
              className="bg-pink-600 hover:bg-pink-700 text-white font-mono"
            >
              {isTransferring ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  TRANSFERRING...
                </>
              ) : (
                "Transfer & Link"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="w-full max-w-md mx-auto bg-black/80 border-pink-500/30">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 p-1 animate-pulse">
            <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
              <Instagram className="w-8 h-8 text-pink-500" />
            </div>
          </div>
          </div>
          <CardTitle className="text-pink-500 font-mono text-xl">
          CONNECT INSTAGRAM
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerateCode} className="space-y-4">
          {/* Username Input - Always Visible */}
          <div className="space-y-2">
            <label className="text-cyan-400 font-mono text-sm">
              INSTAGRAM USERNAME
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-500 font-mono">
                @
              </span>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_username"
                className="pl-8 bg-black/50 border-pink-500/30 text-white font-mono placeholder:text-gray-600 focus:border-pink-500 focus:ring-pink-500/20"
                required
              />
            </div>
          </div>

          {/* Verification Code Section - Shows after generation */}
          {status?.verification ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* Code Display with Countdown */}
              <div className="bg-black/50 border border-pink-500/30 rounded-lg p-4 text-center">
                <p className="text-cyan-400 font-mono text-sm mb-2">
                  YOUR VERIFICATION CODE
                </p>
                <div className="text-3xl font-bold text-white tracking-widest font-mono">
                  {status.verification.code}
                </div>
                <div className="mt-2 text-sm font-mono">
                  {countdown.isExpired ? (
                    <span className="text-red-400">EXPIRED</span>
                  ) : (
                    <span className="text-gray-400">
                      Expires in{" "}
                      <span className="text-yellow-400">
                        {countdown.minutes}:
                        {countdown.seconds.toString().padStart(2, "0")}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-yellow-400 font-mono text-xs mb-2">
                  ADD TO BIO:
                </p>
                <ol className="list-decimal list-inside text-gray-300 text-xs space-y-1 font-mono">
                  <li>Open Instagram and go to your profile</li>
                  <li>Tap "Edit Profile"</li>
                  <li>Add the code above to your bio</li>
                  <li>Save changes</li>
                  <li>Click Verify button below</li>
                </ol>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleVerify}
                  disabled={isVerifying}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-mono"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      VERIFY
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      VERIFY
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  onClick={handleGenerateCode}
                  disabled={isGenerating || !countdown.isExpired}
                  variant="outline"
                  className="border-pink-500/30 text-pink-400 hover:bg-pink-500/10 font-mono"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {!countdown.isExpired && (
                <p className="text-xs text-gray-500 text-center font-mono">
                  Can generate new code after {countdown.minutes}:
                  {countdown.seconds.toString().padStart(2, "0")}
                </p>
              )}
            </div>
          ) : (
            /* Generate Button - Shows when no code exists */
            <Button
              type="submit"
              disabled={isGenerating || !username.trim()}
              className="w-full bg-pink-600 hover:bg-pink-700 text-white font-mono"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  GENERATING...
                </>
              ) : (
                <>GENERATE VERIFICATION CODE</>
              )}
            </Button>
          )}
          </form>

          {/* Error Alert */}
        {error && (
          <Alert
            variant="destructive"
            className="mt-4 bg-red-900/20 border-red-500/30"
          >
            <XCircle className="h-4 w-4" />
            <AlertDescription className="text-red-400 font-mono text-sm">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Success Alert */}
        {success && (
          <Alert className="mt-4 bg-green-900/20 border-green-500/30">
            <CheckCircle className="h-4 w-4 text-green-400" />
            <AlertDescription className="text-green-400 font-mono text-sm">
              {success}
            </AlertDescription>
          </Alert>
        )}

        {/* Instructions */}
        {instructions.length > 0 && (
          <div className="mt-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
            <p className="text-cyan-400 font-mono text-xs mb-2">
              INSTRUCTIONS:
            </p>
            <ol className="list-decimal list-inside text-gray-300 text-xs space-y-1 font-mono">
              {instructions.map((instruction, index) => (
                <li key={index}>{instruction}</li>
              ))}
            </ol>
          </div>
        )}
        </CardContent>
      </Card>
    </>
  );
}
