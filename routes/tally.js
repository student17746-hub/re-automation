const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const twilioService = require('../services/twilio');
const emailService = require('../services/email');
const hubspotService = require('../services/hubspot');
const aiService = require('../services/ai');

router.post('/tally', async (req, res) => {
  try {
    // Parse Tally fields
    const fields = req.body?.data?.fields || [];
    const getValue = (label) => {
      const field = fields.find(f => f.label === label);
      if (!field || field.value === null || field.value === undefined) return '';
      if (Array.isArray(field.value) && field.options && field.options.length > 0) {
        const match = field.options.find(o => o.id === field.value[0]);
        return match ? match.text : '';
      }
      if (typeof field.value === 'boolean') return String(field.value);
      return String(field.value || '');
    };

    // DYNAMIC - from lead
    const first_name = getValue('First Name');
    const last_name = getValue('Last Name') || '';
    const phone = getValue('Phone');
    const email = getValue('Email');
    const inquiry = getValue('What are you looking for?') || 'General inquiry';

    // DYNAMIC - from Tally hidden fields (per agent)
    const agent_name = getValue('Agent Name') || 'Sarah Johnson';
    const agent_phone = getValue('Agent Phone') || '+918807762575';
    const agent_email = getValue('Agent Email') || process.env.GMAIL_USER;

    // Validate required fields
    if (!phone) return res.status(400).json({ error: 'Phone number required' });
    if (!email) return res.status(400).json({ error: 'Email required' });
    if (!first_name) return res.status(400).json({ error: 'First name required' });

    // Build lead object
    const lead = {
      id: uuidv4(),
      first_name,
      last_name,
      phone,
      email,
      inquiry,
      agent_name,
      agent_phone,
      agent_email,
      status: 'new',
      ai_score: null,
      ai_reason: null,
      ai_priority: null,
      conversation: [],
      opted_out: false,
      casl_consent: true,
      casl_timestamp: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      hubspot_contact_id: null,
      hubspot_deal_id: null,
      booking: null,
      sms_sent: false,
      email_sent: false
    };

    // Store lead
    global.leads.push(lead);

    // Emit new lead to dashboard immediately
    global.io.emit('new_lead', lead);

    // Run all actions in parallel
    const [smsResult, emailResult, contactResult, scoreResult] = await Promise.all([
      twilioService.sendInstantSMS(lead),
      emailService.sendWelcomeEmail(lead),
      hubspotService.createOrUpdateContact(lead),
      aiService.scoreLead(lead)
    ]);

    // Update lead with results
    lead.sms_sent = smsResult.success;
    lead.email_sent = emailResult.success;

    if (contactResult.success && contactResult.id) {
      lead.hubspot_contact_id = contactResult.id;
      // Create deal after contact
      const dealResult = await hubspotService.createDeal(lead, contactResult.id);
      if (dealResult.success) lead.hubspot_deal_id = dealResult.id;
    }

    if (scoreResult) {
      lead.ai_score = scoreResult.score;
      lead.ai_reason = scoreResult.reason;
      lead.ai_priority = scoreResult.priority;
    }

    lead.status = 'contacted';
    lead.updated_at = new Date().toISOString();

    // Emit updated lead to dashboard
    global.io.emit('lead_updated', lead);
    global.io.emit('sms_sent', { lead_id: lead.id, phone: lead.phone, time: new Date().toISOString() });

    console.log(`Lead processed: ${lead.first_name} ${lead.last_name} | Score: ${lead.ai_score}/10`);

    // AI qualification bot - fires after 2 minutes if no reply
    setTimeout(async () => {
      const currentLead = global.leads.find(l => l.id === lead.id);
      if (currentLead && currentLead.conversation.length === 0 && !currentLead.opted_out) {
        console.log(`AI bot activating for ${currentLead.first_name}`);
        const aiMessage = await aiService.getQualificationResponse(currentLead, []);
        const botSMS = await twilioService.sendSMS(currentLead.phone, aiMessage);
        if (botSMS.success) {
          currentLead.conversation.push({
            role: 'assistant',
            content: aiMessage,
            timestamp: new Date().toISOString()
          });
          currentLead.status = 'ai_qualifying';
          currentLead.updated_at = new Date().toISOString();
          global.io.emit('ai_bot_activated', { lead_id: currentLead.id, message: aiMessage });
          global.io.emit('lead_updated', currentLead);
        }
      }
    }, 2 * 60 * 1000); // 2 minutes - change to 30000 for demo mode (30 seconds)

    return res.status(200).json({ success: true, lead_id: lead.id });

  } catch (error) {
    console.error('Tally webhook error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
