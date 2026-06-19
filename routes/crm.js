const express = require('express');
const router = express.Router();

// GET all leads
router.get('/leads', (req, res) => {
  const { status, priority, search } = req.query;
  let leads = [...global.leads];

  if (status) leads = leads.filter(l => l.status === status);
  if (priority) leads = leads.filter(l => l.ai_priority === priority);
  if (search) {
    const s = search.toLowerCase();
    leads = leads.filter(l =>
      l.first_name?.toLowerCase().includes(s) ||
      l.last_name?.toLowerCase().includes(s) ||
      l.email?.toLowerCase().includes(s) ||
      l.phone?.includes(s)
    );
  }

  leads.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  return res.json({ success: true, total: leads.length, leads });
});

// GET single lead
router.get('/leads/:id', (req, res) => {
  const lead = global.leads.find(l => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  return res.json({ success: true, lead });
});

// UPDATE lead
router.patch('/leads/:id', (req, res) => {
  const lead = global.leads.find(l => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const allowed = ['status', 'ai_score', 'ai_priority', 'ai_reason', 'notes'];
  allowed.forEach(field => {
    if (req.body[field] !== undefined) lead[field] = req.body[field];
  });
  lead.updated_at = new Date().toISOString();

  global.io.emit('lead_updated', lead);
  return res.json({ success: true, lead });
});

// DELETE lead
router.delete('/leads/:id', (req, res) => {
  const index = global.leads.findIndex(l => l.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Lead not found' });
  global.leads.splice(index, 1);
  global.io.emit('lead_deleted', { id: req.params.id });
  return res.json({ success: true });
});

// GET stats
router.get('/stats', (req, res) => {
  const leads = global.leads;
  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    qualifying: leads.filter(l => l.status === 'ai_qualifying').length,
    replied: leads.filter(l => l.status === 'replied').length,
    booked: leads.filter(l => l.status === 'booked').length,
    opted_out: leads.filter(l => l.opted_out).length,
    high_priority: leads.filter(l => l.ai_priority === 'high').length,
    avg_score: leads.length > 0
      ? (leads.reduce((sum, l) => sum + (l.ai_score || 0), 0) / leads.length).toFixed(1)
      : 0,
    sms_sent: leads.filter(l => l.sms_sent).length,
    emails_sent: leads.filter(l => l.email_sent).length,
    bookings: leads.filter(l => l.booking).length
  };
  return res.json({ success: true, stats });
});

// GET conversation for a lead
router.get('/leads/:id/conversation', (req, res) => {
  const lead = global.leads.find(l => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  return res.json({ success: true, conversation: lead.conversation });
});

module.exports = router;
