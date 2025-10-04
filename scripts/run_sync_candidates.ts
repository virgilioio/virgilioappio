#!/usr/bin/env tsx
/**
 * One-time script to sync legacy job_candidates data to modern model
 * (candidates + job_candidate_associations)
 * 
 * Run: npx tsx scripts/run_sync_candidates.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables!')
  console.error('   Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set in .env')
  process.exit(1)
}

async function runSync() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  
  console.log('🔄 Starting candidate data sync...')
  console.log('   Legacy: job_candidates → Modern: candidates + job_candidate_associations\n')
  
  try {
    const { data, error } = await supabase.rpc('sync_job_candidates_to_independent')
    
    if (error) {
      console.error('❌ Sync failed:', error.message)
      console.error('   Details:', error)
      process.exit(1)
    }
    
    if (!data || !data[0]) {
      console.error('❌ Unexpected response format from RPC')
      process.exit(1)
    }
    
    const result = data[0]
    
    console.log('✅ Sync completed successfully!')
    console.log(`   📊 Synced: ${result.synced_count} candidates`)
    console.log(`   ⏭️  Skipped: ${result.skipped_count} (already exist)`)
    
    if (result.details && Array.isArray(result.details) && result.details.length > 0) {
      console.log('\n📋 Sample details (first 5):')
      result.details.slice(0, 5).forEach((detail: any, idx: number) => {
        console.log(`   ${idx + 1}. ${detail.action}: ${detail.candidate_name} (${detail.location || 'Unknown'})`)
      })
      
      if (result.details.length > 5) {
        console.log(`   ... and ${result.details.length - 5} more`)
      }
    }
    
    console.log('\n📊 Next steps:')
    console.log('   1. Re-run parity checks from docs/migrations/phase2-cycle1.md')
    console.log('   2. Verify counts match between legacy and modern tables')
    console.log('   3. If parity confirmed, proceed with code deployment')
    console.log('   4. After code is merged, lock and drop job_candidates table\n')
    
  } catch (err: any) {
    console.error('❌ Unexpected error:', err.message || err)
    process.exit(1)
  }
}

runSync()
