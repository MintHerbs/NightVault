import { useState, useEffect } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { getSessionId } from '../lib/sessionId';

export function useApiCalls() {
  const [remainingCalls, setRemainingCalls] = useState(10);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeApiCalls();
  }, []);

  async function initializeApiCalls() {
    try {
      if (!isSupabaseConfigured) {
        setRemainingCalls(10);
        setIsLoading(false);
        return;
      }

      // Always present now (src/lib/sessionId.js mints at module init). This
      // used to read the key directly and give up when it was missing, so a
      // visitor whose first action was an API call saw the quota fail to load
      // purely because no other hook had happened to mint the id yet.
      const sessionId = getSessionId();

      // Fetch the row for this session
      const { data, error } = await supabase
        .from('api_calls')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "not found" error, which is expected for new sessions
        // All other errors are silently handled
        setRemainingCalls(10);
        setIsLoading(false);
        return;
      }

      if (!data) {
        // No row exists, create one
        const { error: insertError } = await supabase
          .from('api_calls')
          .insert({
            session_id: sessionId,
            call_count: 0,
            last_reset: new Date().toISOString()
          });

        if (insertError) {
          // Handle error silently
        }

        setRemainingCalls(10);
        setIsLoading(false);
        return;
      }

      // Row exists, check if we need to reset
      const lastReset = new Date(data.last_reset);
      const now = new Date();
      const hoursSinceReset = (now - lastReset) / (1000 * 60 * 60);

      if (hoursSinceReset > 24) {
        // Reset call_count and update last_reset
        const { error: updateError } = await supabase
          .from('api_calls')
          .update({
            call_count: 0,
            last_reset: now.toISOString()
          })
          .eq('session_id', sessionId);

        if (updateError) {
          // Handle error silently
        }

        setRemainingCalls(10);
      } else {
        // Use existing call_count
        setRemainingCalls(Math.max(0, 10 - data.call_count));
      }

      setIsLoading(false);
    } catch (err) {
      // Handle all errors silently
      setRemainingCalls(10);
      setIsLoading(false);
    }
  }

  async function decrementCall() {
    try {
      if (!isSupabaseConfigured) return;
      const sessionId = getSessionId();

      // Upsert: increment call_count by 1
      const { data, error } = await supabase
        .from('api_calls')
        .select('call_count')
        .eq('session_id', sessionId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // Handle error silently
        return;
      }

      const currentCount = data ? data.call_count : 0;
      const newCount = currentCount + 1;

      const { error: upsertError } = await supabase
        .from('api_calls')
        .upsert({
          session_id: sessionId,
          call_count: newCount,
          last_reset: new Date().toISOString()
        }, {
          onConflict: 'session_id'
        });

      if (upsertError) {
        // Handle error silently
        return;
      }

      // Update local state
      setRemainingCalls(Math.max(0, 10 - newCount));
    } catch (err) {
      // Handle all errors silently
    }
  }

  return {
    remainingCalls,
    decrementCall,
    isLoading
  };
}
