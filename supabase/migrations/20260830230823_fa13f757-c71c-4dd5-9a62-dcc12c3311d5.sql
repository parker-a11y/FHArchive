UPDATE public.record_shares
SET include_transcription = true
WHERE token = '4ae05000bc9bb42e0387f28365f4885c'
  AND letter_id = (SELECT id FROM public.letters WHERE archive_id = 'FH0011');