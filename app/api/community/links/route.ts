import { createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

// GET - Fetch active community links (public)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Fetch only active community links ordered by display_order
    const { data: links, error } = await supabase
      .from("community_links")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ links: links || [] });
  } catch (error) {
    console.error("Error fetching community links:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

