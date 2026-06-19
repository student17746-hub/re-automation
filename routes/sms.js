const express = require('express');
const router = express.Router();
const twilioService = require('../services/twilio');
const aiService = require('../services/ai');

// Inbound SMS handler
router.post('/twilio-sms', async (req, res) => {
  try {
    const from = req.body.From;
    const body = req.body.Body?.trim() || '';

    // CASL opt-out handling
    if (['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(body.toUpperCase())) {
      const lead = global.leads.find(l => l.phone === from);
      if (lead) {
        lead.opted_out = true;
        lead.opted_out_at = new Date().toISOString();
        lead.status = 'opted_out';
        lead.updated_at = new Date().toISOString();
        global.io.emit('lead_updated', lead);
        global.io.emit('lead_opted_out', { lead_id: lead.id, phone: from });
      }
      await twilioService.sendSMS(from, 'You have been unsubscribed and will receive no further messages. Reply START to re-subscribe.');
      return res.set('Content-Type', 'text/xml').send('<Response></Response>');
    }

    // Opt back in
    if (body.toUpperCase() === 'START') {
      const lead = global.leads.find(l => l.phone === from);
      if (lead) {
        lead.opted_out = false;
        lead.updated_at = new Date().toISOString();
        global.io.emit('lead_updated', lead);
      }
      await twilioService.sendSMS(from, 'You have been re-subscribed. Reply STOP at any time to unsubscribe.');
      return res.set('Content-Type', 'text/xml').send('<Response></Response>');
    }

    // Find lead
    const lead = global.leads.find(l => l.phone === from);
    if (!lead || lead.opted_out) {
      return res.set('Content-Type', 'text/xml').send('<Response></Response>');
    }

    // Add message to conversation
    lead.conversation.push({
      role: 'user',
      content: body,
      timestamp: new Date().toISOString()
    });
    lead.status = 'replied';
    lead.updated_at = new Date().toISOString();

    // Get AI response
    const aiResponse = await aiService.getQualificationResponse(lead, lead.conversation);

    // Add AI response to conversation
    lead.conversation.push({
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date().toISOString()
    });

    // Send AI response as SMS
    await twilioService.sendSMS(from, aiResponse);

    global.io.emit('conversation_update', {
      lead_id: lead.id,
      conversation: lead.conversation
    });
    global.io.emit('lead_updated', lead);

    return res.set('Content-Type', 'text/xml').send('<Response></Response>');

  } catch (error) {
    console.error('SMS webhook error:', error.message);
    return res.set('Content-Type', 'text/xml').send('<Response></Response>');
  }
});

// Missed call handler
router.post('/twilio-voice', async (req, res) => {
  try {
    const callStatus = req.body.CallStatus;
    const from = req.body.From;
    const to = req.body.To;

    if (callStatus === 'no-answer' || callStatus === 'busy') {
      await twilioService.sendSMS(from,
        `Hey! Sorry I missed your call - it's Sarah Johnson, Edmonton REALTOR. I'm with a client right now. What were you calling about? I'll call right back! Reply STOP to opt out.`
      );
      global.io.emit('missed_call', {
        from,
        to,
        time: new Date().toISOString(),
        status: callStatus
      });
      console.log(`Missed call text-back sent to ${from}`);
    }

    return res.set('Content-Type', 'text/xml').send('<Response></Response>');

  } catch (error) {
    console.error('Voice webhook error:', error.message);
    return res.set('Content-Type', 'text/xml').send('<Response></Response>');
  }
});

module.exports = router;
