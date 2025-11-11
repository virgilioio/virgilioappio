import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GetInvoicesRequest {
  customerId: string
  limit?: number
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create authenticated Supabase client
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Authentication error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user is platform admin
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .select('user_type')
      .eq('user_id', user.id)
      .eq('user_status', 'active')
      .single()

    if (memberError || memberData?.user_type !== 'platform_admin') {
      console.error('Permission check failed:', memberError)
      return new Response(
        JSON.stringify({ error: 'Forbidden: Platform admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { customerId, limit = 10 }: GetInvoicesRequest = await req.json()

    if (!customerId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: customerId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Fetching invoices for Stripe customer:', customerId)

    // Get Stripe secret key
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Stripe integration not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch invoices from Stripe API
    const stripeResponse = await fetch(
      `https://api.stripe.com/v1/invoices?customer=${customerId}&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )

    if (!stripeResponse.ok) {
      const errorData = await stripeResponse.json()
      console.error('Stripe API error:', errorData)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch invoices from Stripe', details: errorData }),
        { status: stripeResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const stripeData = await stripeResponse.json()
    
    // Extract relevant invoice data
    const invoices = stripeData.data.map((invoice: any) => ({
      id: invoice.id,
      amount: invoice.amount_due,
      currency: invoice.currency,
      status: invoice.status,
      created: invoice.created,
      invoice_pdf: invoice.invoice_pdf,
      hosted_invoice_url: invoice.hosted_invoice_url,
      period_start: invoice.period_start,
      period_end: invoice.period_end,
    }))

    console.log(`Successfully fetched ${invoices.length} invoices`)

    return new Response(
      JSON.stringify({ invoices }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error in get-stripe-invoices:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
