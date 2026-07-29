// Chat state management hook using Supabase real-time subscriptions
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

console.log('[Chat] Supabase client created')

export default function useChat(isChatOpen) {
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const isChatOpenRef = useRef(false)
  const lastReadAtRef = useRef(new Date().toISOString())
  // Unique channel name per hook instance — prevents collision when
  // useChat is called in multiple components (ChatPanel + Sidebar)
  const channelName = useRef(`messages-${Date.now()}-${Math.random().toString(36).slice(2)}`)

  function markAsRead() {
    lastReadAtRef.current = new Date().toISOString()
    setUnreadCount(0)
  }

  useEffect(() => {
    isChatOpenRef.current = isChatOpen
    if (isChatOpen) markAsRead()
  }, [isChatOpen])

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(50)

        if (error) {
          console.error('Error fetching messages:', error)
          return
        }

        console.log('[Chat] Initial messages loaded:', (data || []).length)
        setMessages(data || [])
      } catch (err) {
        console.error('Failed to fetch messages:', err)
      }
    }

    fetchMessages()

    const channel = supabase
      .channel(channelName.current)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          console.log('[Chat] New message received:', payload.new)
          setMessages((prev) => [...prev, payload.new])

          if (!isChatOpenRef.current) {
            if (payload.new.created_at > lastReadAtRef.current) {
              setUnreadCount(prev => Math.min(prev + 1, 10))
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const insertMessage = useCallback(async ({ content = '', attachmentUrl = null, attachmentType = null }) => {
    const sessionId = localStorage.getItem('session_id')

    if (!sessionId) {
      console.error('No session_id found in localStorage')
      return
    }

    setIsLoading(true)

    try {
      // Ensure session exists in sessions table before inserting message
      await supabase
        .from('sessions')
        .upsert({ id: sessionId, last_seen: new Date().toISOString() })

      // Routed through an RPC (T-078): messages' INSERT grant is gone from
      // anon, since a direct REST insert could flood the room unthrottled —
      // chat had no rate limit at all, client-side or otherwise, before this.
      // See db/sql/0047_social_write_hardening.sql.
      const { data: res, error } = await supabase.rpc('send_message', {
        p_session_id: sessionId,
        p_content: content,
        p_attachment_url: attachmentUrl,
        p_attachment_type: attachmentType,
      })

      if (error || !res?.success) {
        console.error('Error sending message:', error || res?.error)
      }
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const sendMessage = useCallback((content) => {
    if (!content.trim()) return
    return insertMessage({ content: content.trim() })
  }, [insertMessage])

  const sendAttachment = useCallback((url, kind) => {
    if (!url) return
    return insertMessage({ attachmentUrl: url, attachmentType: kind })
  }, [insertMessage])

  return {
    messages,
    sendMessage,
    sendAttachment,
    isLoading,
    unreadCount,
    markAsRead,
  }
}