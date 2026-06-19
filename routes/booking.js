const express = require('express');
const router = express.Router();
const twilioService = require('../services/twilio');
const emailService = require('../services/email');
const hubspotService = require('../services/hubspot');

router.post('/cal', async (req, res) => {
  try {
    const payload = req.body?.payload || req.body;
    const attendees = payload.attendees || [];
    const organizer = payload.organizer || {};

    // DYNAMIC - from Cal.com webhook
    const leadAttendee = attendees.find(a => a.email !== organizer.email) || attendees[0] || {};
    const booking = {
      lead_name: leadAttendee.name || payload.responses?.name?.value || 'Lead',
      lead_email: leadAttendee.email || payload.responses?.email?.value || '',
      lead_phone: leadAttendee.phoneNumber || payload.responses?.phone?.value || '',
      meeting_time: payload.startTime ? new Date(payload.startTime).toLocaleString('en-CA', {
        timeZone: 'America/Edmonton',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'TBD',
      agent_name: organizer.name || 'Sarah Johnson',
      agent_email: organizer.email || process.env.GMAIL_USER,
      booking_uid: payload.uid || '',
      booked_at: new Date().toISOString()
    };

    // Find lead in memory and update
    const lead = global.leads.find(l =>
      l.email === booking.lead_email ||
      l.phone === booking.lead_phone
    );

    if (lead) {
      lead.booking = booking;
      lead.status = 'booked';
      lead.updated_at = new Date().toISOString();
    }

    // Run all actions in parallel
    const tasks = [
      // SMS to agent (DYNAMIC agent_phone from lead record or organizer)
      twilioService.sendSMS(
        lead?.agent_phone || process.env.TWILIO_PHONE_NUMBER,
        `NEW BOOKING! ${booking.lead_name} booked for ${booking.meeting_time}. Email: ${booking.lead_email} Phone: ${booking.lead_phone}`
      ),
      // Email confirmation to lead
      emailService.sendBookingConfirmation(booking),
      // Update HubSpot deal stage
      hubspotService.updateDealStage(booking.lead_email, 'Appointment Set')
    ];

    // Only send confirmation SMS to lead if phone exists
    if (booking.lead_phone) {
      tasks.push(twilioService.sendSMS(
        booking.lead_phone,
        `Hi ${booking.lead_name}, your call with ${booking.agent_name} is confirmed for ${booking.meeting_time} Edmonton time. See you then! Reply STOP to opt out.`
      ));
    }

    await Promise.all(tasks);

    global.io.emit('new_booking', booking);
    if (lead) global.io.emit('lead_updated', lead);

    console.log(`Booking confirmed: ${booking.lead_name} at ${booking.meeting_time}`);
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Booking webhook error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
