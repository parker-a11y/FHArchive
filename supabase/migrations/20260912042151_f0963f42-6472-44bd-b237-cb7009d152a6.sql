-- Remove the overly permissive SELECT policy that let ANY authenticated user read
-- research_chunks (full letter transcripts, embeddings, metadata), bypassing the
-- can_read_archive() approval gate enforced elsewhere.
-- The can_read_archive-gated policy remains the sole read path.
DROP POLICY IF EXISTS "Authenticated accounts can read research chunks" ON public.research_chunks;
DROP POLICY IF EXISTS "research_chunks_true_policy" ON public.research_chunks;