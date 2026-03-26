import { supabase } from './supabase';
import { sendThreadMessage } from './chat-receipts';
import { createDailyRoom } from './daily';

const SESSION_DURATION_MINUTES = 30;

// ── Request ───────────────────────────────────────────────────────────
// Mentee sends a request. Tokens are escrowed immediately to prevent
// the mentee from going into negative balance.

export async function requestSession(
  menteeId: string,
  mentorId: string,
  description: string,
  scheduledStart: Date,
): Promise<{ requestId: number; threadId: number }> {
  // 1) Fetch mentor rate
  const { data: mentor, error: mentorErr } = await supabase
    .from('profiles')
    .select('mentor_session_rate')
    .eq('id', mentorId)
    .single();
  if (mentorErr || !mentor) throw new Error('Could not load mentor profile');
  const rate: number = mentor.mentor_session_rate ?? 0;

  // 2) Fetch mentee balance
  const { data: mentee, error: menteeErr } = await supabase
    .from('profiles')
    .select('tokens_balance')
    .eq('id', menteeId)
    .single();
  if (menteeErr || !mentee) throw new Error('Could not load your profile');
  const balance: number = mentee.tokens_balance ?? 0;

  if (balance < rate) {
    throw new Error(`Not enough tokens. You have ${balance} but this session costs ${rate}.`);
  }

  // 3) Deduct tokens (escrow)
  const { error: deductErr } = await supabase
    .from('profiles')
    .update({ tokens_balance: balance - rate })
    .eq('id', menteeId);
  if (deductErr) throw new Error('Failed to escrow tokens');

  // 4) Create a mentorship thread for chat
  const { data: thread, error: threadErr } = await supabase
    .from('threads')
    .insert({ type: 'mentorship' })
    .select('id')
    .single();
  if (threadErr || !thread) throw new Error('Failed to create chat thread');

  // 5) Compute end time
  const scheduledEnd = new Date(scheduledStart.getTime() + SESSION_DURATION_MINUTES * 60 * 1000);

  // 6) Insert mentor_request
  const { data: req, error: reqErr } = await supabase
    .from('mentor_requests')
    .insert({
      mentee: menteeId,
      mentor: mentorId,
      thread_id: thread.id,
      status: 'requested',
      scheduled_start: scheduledStart.toISOString(),
      scheduled_end: scheduledEnd.toISOString(),
      tokens_cost: rate,
      description: description.trim() || null,
    })
    .select('id')
    .single();
  if (reqErr || !req) throw new Error(reqErr?.message ?? 'Failed to create session request');

  await seedSessionRequestMessage(thread.id, description);

  return { requestId: req.id, threadId: thread.id };
}

// ── Accept ────────────────────────────────────────────────────────────
// Mentor accepts the request. Creates a Daily.co room + calendar event.

export async function acceptSession(requestId: number): Promise<void> {
  // 1) Load the request
  const { data: req, error: reqErr } = await supabase
    .from('mentor_requests')
    .select('id, mentee, mentor, status, scheduled_start, scheduled_end, tokens_cost')
    .eq('id', requestId)
    .single();
  if (reqErr || !req) throw new Error('Request not found');
  if (req.status !== 'requested') throw new Error('Request is no longer pending');

  // 2) Create Daily.co room
  const roomUrl = await createDailyRoom(req.id);

  // 3) Insert calendar event (best-effort — may fail if RLS policy is missing)
  const { error: calErr } = await supabase.from('calendar').insert({
    mentor_id: req.mentor,
    mentee_id: req.mentee,
    type: 'session',
    title: 'Mentorship Session',
    start_at: req.scheduled_start,
    end_at: req.scheduled_end,
  });
  if (calErr) {
    // Log but don't block acceptance — the session can still proceed
    console.warn('Calendar insert failed (RLS policy may need updating):', calErr.message);
  }

  // 4) Update request to scheduled
  const { error: updateErr } = await supabase
    .from('mentor_requests')
    .update({
      status: 'scheduled',
      video_link: roomUrl,
    })
    .eq('id', requestId);
  if (updateErr) throw new Error('Failed to update request status');
}

// ── Decline ───────────────────────────────────────────────────────────
// Mentor declines. Tokens refunded to mentee.

export async function declineSession(requestId: number): Promise<void> {
  const { data: req, error: reqErr } = await supabase
    .from('mentor_requests')
    .select('id, mentee, status, tokens_cost')
    .eq('id', requestId)
    .single();
  if (reqErr || !req) throw new Error('Request not found');
  if (req.status !== 'requested') throw new Error('Request is no longer pending');

  // Refund tokens to mentee
  await refundTokens(req.mentee, req.tokens_cost ?? 0);

  // Mark as cancelled
  const { error } = await supabase
    .from('mentor_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId);
  if (error) throw new Error('Failed to decline request');
}

// ── Complete ──────────────────────────────────────────────────────────
// Session finished. Tokens credited to mentor.

export async function completeSession(requestId: number): Promise<void> {
  const { data: req, error: reqErr } = await supabase
    .from('mentor_requests')
    .select('id, mentor, status, tokens_cost')
    .eq('id', requestId)
    .single();
  if (reqErr || !req) throw new Error('Request not found');
  if (req.status === 'done') return; // already completed

  // Credit mentor
  const cost = req.tokens_cost ?? 0;
  if (cost > 0) {
    const { data: mentorProfile } = await supabase
      .from('profiles')
      .select('tokens_balance')
      .eq('id', req.mentor)
      .single();
    const currentBalance: number = mentorProfile?.tokens_balance ?? 0;

    const { error: creditErr } = await supabase
      .from('profiles')
      .update({ tokens_balance: currentBalance + cost })
      .eq('id', req.mentor);
    if (creditErr) console.error('Failed to credit mentor', creditErr);
  }

  // Mark as done
  const { error } = await supabase
    .from('mentor_requests')
    .update({ status: 'done' })
    .eq('id', requestId);
  if (error) console.error('Failed to mark session as done', error);
}

// ── Cancel ────────────────────────────────────────────────────────────
// Either party cancels after acceptance. Tokens refunded to mentee.

export async function cancelSession(requestId: number): Promise<void> {
  const { data: req, error: reqErr } = await supabase
    .from('mentor_requests')
    .select('id, mentee, status, tokens_cost')
    .eq('id', requestId)
    .single();
  if (reqErr || !req) throw new Error('Request not found');
  if (req.status === 'done' || req.status === 'cancelled') return;

  // Refund tokens
  await refundTokens(req.mentee, req.tokens_cost ?? 0);

  const { error } = await supabase
    .from('mentor_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId);
  if (error) throw new Error('Failed to cancel session');
}

// ── Helpers ───────────────────────────────────────────────────────────

async function refundTokens(menteeId: string, amount: number): Promise<void> {
  if (amount <= 0) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('tokens_balance')
    .eq('id', menteeId)
    .single();
  const current: number = profile?.tokens_balance ?? 0;

  const { error } = await supabase
    .from('profiles')
    .update({ tokens_balance: current + amount })
    .eq('id', menteeId);
  if (error) console.error('Failed to refund tokens', error);
}

export async function seedSessionRequestMessage(
  threadId: number,
  description: string,
): Promise<void> {
  const body = description.trim();
  if (!body) return;

  try {
    await sendThreadMessage({
      threadId,
      body,
    });
  } catch (error) {
    console.warn('Failed to seed initial session message', error);
  }
}
