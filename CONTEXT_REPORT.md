# StyleSync PWA - Context Report
## Generated: January 16, 2026

---

## Current State Summary

### What's Working
- **Smart SMS Parsing (v0.3.0)**: Zero data loss architecture with AI classification
- **iOS SMS Sync**: Shortcut → Webhook → raw_messages → AI processing pipeline
- **Multi-Message Types**: Handles bookings, cancellations, reschedules, reminders
- **Client Normalization**: Fuzzy matching via clients table with aliases
- **Duplicate Detection**: Prevents re-saving identical messages within 5 minutes
- **Stripe Integration**: Payments, subscriptions, trial period configured
- **VAPI Voice Assistant**: Diana voice assistant with enhanced booking data
- **PWA**: Mobile-responsive, installable progressive web app

### Known Limitations
- **iOS Background Restriction**: Automations don't fully execute when phone is locked
- **Calendar Sync**: NOT IMPLEMENTED - bookings save to DB but don't sync to Google Calendar
- **Android**: No SMS automation setup (iOS only)

---

## Database State

### Tables in Use
- `raw_messages` - Stores ALL incoming SMS (zero data loss, AI processing fields)
- `clients` - Normalized client data with aliases array for fuzzy matching
- `salon_bookings` - Stores parsed booking appointments (with client_id, status)
- `user_tokens` - User auth and StyleSeat sender numbers
- `synced_messages` - Legacy message hash tracking (deprecated)

### Recent Bookings (via ios_sms)
- Charlene Dean - Traditional Sew In - Jan 23 @ 2:30 PM
- Christina Little Price - Traditional Sew In - Jan 23 @ 2:30 PM
- Jessica Rabbit - Traditional Sew In - Jan 23 @ 2:30 PM

### Cleanup SQL (duplicates from testing)
```sql
DELETE FROM salon_bookings
WHERE customer_name = 'Charlene Dean'
  AND id != (
    SELECT id FROM salon_bookings
    WHERE customer_name = 'Charlene Dean'
    ORDER BY created_at ASC
    LIMIT 1
  );
```

---

## Architecture Overview

### Smart Parsing Flow (v0.3.0+)

```
iOS SMS → Shortcut → POST /api/sms-webhook?user=email
                          ↓
                    Store to raw_messages (ZERO DATA LOSS)
                          ↓
                    Return 200 OK immediately
                          ↓ (async)
                    /api/process-messages (GPT-4)
                          ↓
                    Classify message_type:
                      • new_booking → Create in salon_bookings
                      • cancellation → Update status to cancelled
                      • reschedule → Update booking time
                      • reminder → No action
                      • other → Flag for review
                          ↓
                    Match/create client in clients table
                          ↓
                    Diana Voice can query all data
                          ↓
                    TODO: Sync to Google Calendar
```

### Why Zero Data Loss Matters
- OLD: Regex parse fails → 400 error → Message LOST forever
- NEW: Store first → 200 OK → AI processes later → Nothing lost

---

## Critical Files

| File | Purpose |
|------|---------|
| `/app/api/sms-webhook/route.ts` | Smart SMS ingestion (stores to raw_messages, returns 200 OK) |
| `/app/api/process-messages/route.ts` | AI classification endpoint (GPT-4, async) |
| `/app/api/diana/route.ts` | Diana AI booking assistant (queries salon_bookings) |
| `/app/api/sms-webhook/batch/route.ts` | Batch message processing |
| `/app/api/stripe/webhook/route.ts` | Stripe payment webhooks |
| `/app/dashboard/page.tsx` | Main user dashboard |
| `/app/components/AIAssistantVAPI.tsx` | Voice assistant |

---

## Priority Fixes

### Completed (v0.3.0)
- [x] SMS parser rewritten (smart parsing, zero data loss)
- [x] Multi-message type support (cancellations, reschedules)
- [x] Client normalization with fuzzy matching
- [x] Code reduced from 250+ lines to ~100 lines

### Security (Critical)
1. Move session tokens from localStorage to httpOnly cookies
2. Add input validation (zod library)
3. Add rate limiting to webhooks
4. Add CSRF protection

### Code Quality
1. ~~Extract SMS parser~~ (No longer needed - smart parsing handles all formats)
2. Fix variable naming (`userId` actually contains email in some places)
3. Add environment variable validation

### Features
1. **Implement calendar sync** - Core feature is TODO
2. Complete settings persistence
3. Add cancel subscription functionality
4. Android SMS setup

### Testing
1. Add unit tests for AI classification
2. Add integration tests for webhooks
3. Add E2E tests for booking flow

---

## Environment Variables Required

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_xxx
STRIPE_SECRET_KEY=sk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
OPENAI_API_KEY=sk-xxx
NEXT_PUBLIC_MCP_SERVER_URL=https://xxx
NEXT_PUBLIC_VAPI_PUBLIC_KEY=xxx
```

---

## Deployment

- **Frontend**: Vercel (auto-deploys from git)
- **Database**: Supabase PostgreSQL
- **MCP Server**: Render (salon-mcp-server-9yzw.onrender.com)
- **Payments**: Stripe

---

## Next Session Tasks

1. [ ] Implement Google Calendar sync for saved bookings
2. [ ] Fix security issues (httpOnly cookies)
3. [ ] Extract SMS parser to shared utility
4. [ ] Add input validation
5. [ ] Decide: Forward SMS → Email route vs native iOS app
6. [ ] Test with real incoming StyleSeat SMS (not manual triggers)
7. [ ] Clean up duplicate test bookings

---

## iOS Shortcut Setup (Working)

1. Create automation: "When I receive message containing StyleSeat"
2. Action: Run Shortcut → [StyleSync Webhook Shortcut]
3. Input: Shortcut Input (the SMS content)

4. Shortcut makes POST to:
   ```
   https://stylesync-pwa.vercel.app/api/sms-webhook?user=YOUR_EMAIL
   ```
5. Body: `{"message": [Shortcut Input]}`

**Limitation**: Only works reliably when phone is unlocked.

---

## Code Critique Score

| Category | Score | Notes |
|----------|-------|-------|
| Architecture | 8/10 | Smart parsing, zero data loss, clear async flow |
| Security | 3/10 | localStorage auth, no validation |
| Code Quality | 7/10 | Clean webhook, AI handles edge cases |
| Testing | 1/10 | No tests |
| UX | 8/10 | Good mobile design |
| Completeness | 6/10 | Core SMS flow complete, calendar TODO |

**Overall: C+ (Solid MVP, calendar sync remaining)**

### v0.3.0 Improvements
- Architecture: +1 (zero data loss design)
- Code Quality: +2 (removed 150+ lines of fragile regex)
- Completeness: +1 (multi-message type support)
