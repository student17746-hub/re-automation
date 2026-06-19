# Edmonton RE AI Automation System

Complete AI-powered lead automation for Edmonton real estate agents.

## Features
- Instant SMS + email response under 60 seconds
- AI lead scoring (1-10) with reasoning
- AI SMS qualification bot (OpenRouter DeepSeek)
- Cal.com booking handler with confirmations
- Missed call text-back
- CASL compliance built in
- Live real-time dashboard
- Full CRM CRUD API

## API Endpoints
- POST /webhook/tally - Tally form submissions
- POST /webhook/cal - Cal.com bookings
- POST /webhook/twilio-sms - Inbound SMS
- POST /webhook/twilio-voice - Missed calls
- GET /dashboard - Live dashboard
- GET /api/leads - All leads
- GET /api/leads/:id - Single lead
- PATCH /api/leads/:id - Update lead
- DELETE /api/leads/:id - Delete lead
- GET /api/stats - Statistics
- GET /api/leads/:id/conversation - AI conversation
- GET /health - Health check

## Environment Variables
Set these in Railway dashboard (never commit .env to GitHub):
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER,
OPENROUTER_API_KEY, HUBSPOT_TOKEN, GMAIL_USER, GMAIL_APP_PASSWORD,
CAL_BOOKING_LINK, PORT

## Deploy to Railway
1. Push to GitHub
2. Connect Railway to GitHub repo
3. Add environment variables in Railway dashboard
4. Railway auto-deploys
