import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { getAdminProfile, PRIMARY_OWNER_EMAIL } from '../../lib/adminSupabase'

export function useAdmin() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { user: currentUser }, error } = await supabase.auth.getUser()
        
        if (error || !currentUser) {
          navigate('/admin')
          return
        }
        
        setUser(currentUser)
        
        // Get admin profile
        const adminProfile = await getAdminProfile(currentUser.id)
        setProfile(adminProfile)
      } catch (err) {
        console.error('Auth check failed:', err)
        navigate('/admin')
      } finally {
        setLoading(false)
      }
    }
    
    checkAuth()
  }, [navigate])

  const isPrimaryOwner = user?.email === PRIMARY_OWNER_EMAIL

  return { user, profile, loading, isPrimaryOwner }
}
