# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed - 2025-10-24

**CoreSignal Sourcing Feature Removal**

Complete removal of the external candidate sourcing functionality powered by CoreSignal API, including all associated database tables, RPCs, edge functions, UI components, and documentation.

#### Database Layer
- **Tables Dropped:**
  - `sourcing_events` - Event tracking for sourcing activities
  - `external_candidate_matches` - Storage for CoreSignal candidate data
  - `org_credit_usage` - Credit consumption tracking and limits

- **RPC Functions Dropped:**
  - `get_org_credits()` - Retrieve organization sourcing credits
  - `consume_sourcing_credits()` - Deduct credits from organization balance
  - `refill_org_sourcing_credits()` - Replenish monthly credit allocations

- **Archive Tables Preserved:**
  - `_archived_sourcing_events` - Historical event data (read-only)
  - `_archived_external_candidate_matches` - Historical candidate data (read-only)
  - `_archived_org_credit_usage` - Historical credit usage data (read-only)

#### Edge Functions
- **Removed Functions:**
  - `coresignal-search` - CoreSignal candidate search integration
  - `coresignal-collect` - CoreSignal candidate data collection

#### Frontend Components
- **Job Wizard:**
  - Removed "Sourcing" step from job creation wizard
  - Simplified wizard flow to core job setup steps only

- **AI Job Assistant:**
  - Removed "Sourcing" tab from AI Assistant
  - Removed sourcing insights and recommendations
  - Removed matching candidate displays from external sources

- **Deleted Components:**
  - `SourcingCreditsCard.tsx` - Credit balance display
  - `SourcingSearch.tsx` - Sourcing search interface
  - All sourcing-related UI components

- **Deleted Hooks:**
  - `useSourcingCredits.ts` - Credit management hook
  - `useSourcingSearch.ts` - Search functionality hook
  - All sourcing-related React hooks

#### Documentation
- **Archived to `docs/_archived_sourcing/`:**
  - `coresignal-path-correction.md`
  - `sourcing-credits-ui-implementation-report.md`
  - `sourcing-foundations-implementation-report.md`
  - `sourcing-search-implementation-report.md`
  - `sourcing-ui-search-only-implementation-report.md`

- **Cleanup Reports Created:**
  - `docs/sourcing-rpc-functions-removal-report.md`
  - `docs/sourcing-tables-deletion-report.md`
  - `docs/post-cleanup-verification-report.md`

#### Impact Assessment
- ✅ **Application Status:** Fully functional with no runtime errors
- ✅ **Data Integrity:** Historical data preserved in archive tables
- ✅ **Performance:** No performance degradation observed
- ✅ **Testing:** All job creation flows verified (Wizard and AI Assistant)
- ✅ **Code Quality:** Zero references to dropped tables/RPCs in active codebase

#### Migration Notes
- Archive tables retain Row-Level Security (RLS) policies
- All cleanup operations documented with rollback procedures
- No active features or user workflows affected by removal

---

## About This Changelog

This changelog documents all significant changes to the Virgilio ATS platform. Each entry includes:
- The date of the change
- A clear description of what changed
- The impact on users and the system
- Any migration or upgrade notes

For detailed technical implementation reports, see the `docs/` directory.
