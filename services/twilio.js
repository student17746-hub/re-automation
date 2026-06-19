require('dotenv').config();
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function sendSMS(to, message) {
  if (!to || to.trim() === '') {
    console.error('SMS skipped: no phone number provided');
    return { success: false, error: 'No phone number' };
  }
  try {
    const result = await client.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to.trim(),
      body: message
    });
    console.log(`SMS sent to ${to}: ${result.sid}`);
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error(`SMS failed to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function sendInstantSMS(lead) {
  const message = `Hi ${lead.first_name}, it's ${lead.agent_name} - Edmonton REALTOR! Just saw your ${lead.inquiry} inquiry. Free for a quick call? Book here: ${process.env.CAL_BOOKING_LINK} Reply STOP to opt out.`;
  return sendSMS(lead.phone, message);
}

module.exports = { sendSMS, sendInstantSMS };
