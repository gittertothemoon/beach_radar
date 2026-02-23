import { getSupabaseClient } from "./supabase";
import type { Review } from "./types";

export type FetchReviewsResult =
    | { ok: true; reviews: Review[] }
    | { ok: false; error: "fetch_failed" | "unauthorized" | "not_configured" };

export async function fetchBeachReviews(beachId: string): Promise<FetchReviewsResult> {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: "not_configured" };

    try {
        const { data, error } = await supabase
            .from("beach_reviews")
            .select("id, beach_id, author_name, content, rating, created_at")
            .eq("beach_id", beachId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("fetchBeachReviews DB error", error);
            return { ok: false, error: "fetch_failed" };
        }

        if (!Array.isArray(data)) {
            return { ok: true, reviews: [] };
        }

        const reviews: Review[] = data.map((row) => ({
            id: row.id,
            beachId: row.beach_id,
            authorName: row.author_name,
            content: row.content,
            rating: row.rating,
            createdAt: Date.parse(row.created_at),
        }));

        return { ok: true, reviews };
    } catch (err) {
        console.warn("fetchBeachReviews error", err);
        return { ok: false, error: "fetch_failed" };
    }
}

export type SubmitReviewPayload = {
    beachId: string;
    authorName: string;
    content: string;
    rating: number;
};

export type SubmitReviewResult =
    | { ok: true; review: Review }
    | { ok: false; error: "submit_failed" | "unauthorized" | "not_configured" };

export async function submitBeachReview(
    payload: SubmitReviewPayload,
): Promise<SubmitReviewResult> {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: "not_configured" };

    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) {
            return { ok: false, error: "unauthorized" };
        }

        const { data, error } = await supabase
            .from("beach_reviews")
            .insert({
                beach_id: payload.beachId,
                user_id: sessionData.session.user.id,
                author_name: payload.authorName,
                content: payload.content,
                rating: payload.rating,
            })
            .select("id, beach_id, author_name, content, rating, created_at")
            .single();

        if (error) {
            console.error("submitBeachReview DB error", error);
            return { ok: false, error: "submit_failed" };
        }

        if (!data) {
            return { ok: false, error: "submit_failed" };
        }

        return {
            ok: true,
            review: {
                id: data.id,
                beachId: data.beach_id,
                authorName: data.author_name,
                content: data.content,
                rating: data.rating,
                createdAt: Date.parse(data.created_at),
            },
        };
    } catch (err) {
        console.warn("submitBeachReview error", err);
        return { ok: false, error: "submit_failed" };
    }
}
