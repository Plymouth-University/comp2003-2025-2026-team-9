// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: queuedCount, error: enqueueError } = await admin.rpc('enqueue_session_reminder_events');
  if (enqueueError) {
    return new Response(JSON.stringify({ error: enqueueError.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let dispatchStatus: number | null = null;
  let dispatchPayload: unknown = null;
  let dispatchError: string | null = null;

  try {
    const dispatchResponse = await fetch(`${supabaseUrl}/functions/v1/push-dispatch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ limit: 100 }),
    });

    dispatchStatus = dispatchResponse.status;
    if (dispatchResponse.ok) {
      dispatchPayload = await dispatchResponse.json().catch(() => null);
    } else {
      dispatchError = await dispatchResponse.text();
    }
  } catch (error) {
    dispatchError = error instanceof Error ? error.message : 'Unknown dispatch error';
  }

  return new Response(
    JSON.stringify({
      remindersQueued: queuedCount ?? 0,
      dispatchStatus,
      dispatchPayload,
      dispatchError,
    }),
    { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  );
});
