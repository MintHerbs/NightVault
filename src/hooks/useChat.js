// Chat state management hook using Supabase real-time subscriptions
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

console.log('[Chat] Supabase client created')

// Read fresh on every message rather than cached at mount: usePresence is
// what creates session_id, and there's no ordering guarantee that it has
// run before this hook's subscription receives its first row.
function ownSessionId() {
  try {
    return localStorage.getItem('session_id')
  } catch {
    return null
  }
}

export default function useChat(isChatOpen) {
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  // Most recent message from someone else, for the Dynamic Island's
  // notification pill. Own messages never land here.
  const [lastIncoming, setLastIncoming] = useState(null)
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
          const message = payload.new
          console.log('[Chat] New message received:', message)
          setMessages((prev) => [...prev, message])

          // Your own message is not news. Nothing filtered on session_id
          // before, and the only reason it didn't inflate the badge is that
          // the panel has to be open to send — close it quickly enough
          // after sending and you used to notify yourself (T-079).
          if (message.session_id === ownSessionId()) return

          setLastIncoming(message)

          if (!isChatOpenRef.current && message.created_at > lastReadAtRef.current) {
            setUnreadCount(prev => Math.min(prev + 1, 10))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const sendMessage = useCallback(async (content) => {
    if (!content.trim()) return

    const sessionId = localStorage.getItem('session_id')

    if (!sessionId) {
      console.error('No session_id found in localStorage')
      return
    }

    setIsLoading(true)

    try {
      console.log('[Chat] Sending message:', content)
      
      // Ensure session exists in sessions table before inserting message
      await supabase
        .from('sessions')
        .upsert({ id: sessionId, last_seen: new Date().toISOString() })

      // Now insert the message
      const { error } = await supabase
        .from('messages')
        .insert({ session_id: sessionId, content: content.trim() })

      console.log('[Chat] Send result:', error)
      if (error) {
        console.error('Error sending message:', error)
      }
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    messages,
    sendMessage,
    isLoading,
    unreadCount,
    lastIncoming,
    markAsRead,
  }
}