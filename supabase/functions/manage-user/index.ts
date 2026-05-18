import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { action, email, password, colaborador_id, user_id, role } = await req.json()

    console.log(`Action: ${action}, Email: ${email}, Role: ${role}`)

    if (action === 'get-user') {
      if (!user_id) throw new Error('user_id is required')

      const { data: userData, error } = await supabaseAdmin.auth.admin.getUserById(user_id)
      if (error) throw error

      return new Response(
        JSON.stringify({ email: userData.user?.email }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'create') {
      // Create user in auth
      const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      })

      if (createError) {
        console.error('Error creating user:', createError)
        throw createError
      }

      console.log('User created:', userData.user?.id)

      // Assign role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: userData.user?.id,
          role: role || 'colaborador',
          colaborador_id: colaborador_id || null
        })

      if (roleError) {
        console.error('Error assigning role:', roleError)
        // Rollback user creation
        await supabaseAdmin.auth.admin.deleteUser(userData.user!.id)
        throw roleError
      }

      return new Response(
        JSON.stringify({ success: true, user_id: userData.user?.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'delete') {
      if (!user_id) throw new Error('user_id is required for delete action')

      const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id)
      if (error) throw error

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'update-password') {
      if (!user_id || !password) throw new Error('user_id and password are required')

      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password })
      if (error) throw error

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'update-email') {
      if (!user_id || !email) throw new Error('user_id and email are required')

      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { email })
      if (error) throw error

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'update-role') {
      if (!user_id || !role) throw new Error('user_id and role are required')

      const { error } = await supabaseAdmin
        .from('user_roles')
        .update({ role })
        .eq('user_id', user_id)

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    throw new Error('Invalid action')
  } catch (error: unknown) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
