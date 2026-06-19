require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

async function sendWelcomeEmail(lead) {
  try {
    await transporter.sendMail({
      from: `${lead.agent_name} <${process.env.GMAIL_USER}>`,
      to: lead.email,
      subject: `${lead.first_name} - Your Edmonton Real Estate Inquiry`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <div style="background:#c8102e;padding:20px;border-radius:8px 8px 0 0">
            <h1 style="color:white;margin:0;font-size:24px">Edmonton Real Estate</h1>
          </div>
          <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px">
            <h2 style="color:#333">Hi ${lead.first_name}!</h2>
            <p style="color:#555;font-size:15px">Thanks for reaching out! I'm <strong>${lead.agent_name}</strong>, your Edmonton REALTOR.</p>
            <p style="color:#555;font-size:15px">I just received your inquiry about <strong>${lead.inquiry}</strong> and I'm already on it.</p>
            <p style="color:#555;font-size:15px">Book a free 15-minute consultation with me:</p>
            <div style="text-align:center;margin:24px 0">
              <a href="${process.env.CAL_BOOKING_LINK}" style="background:#c8102e;color:white;padding:14px 32px;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold">Book a Call Now</a>
            </div>
            <p style="color:#555">Talk soon,<br><strong>${lead.agent_name}</strong><br>${lead.agent_phone} | ${lead.agent_email}</p>
            <hr style="border:none;border-top:1px solid #ddd;margin:20px 0"/>
            <p style="color:#999;font-size:11px">You received this because you submitted an inquiry on ${new Date().toLocaleDateString('en-CA')}. To unsubscribe reply UNSUBSCRIBE to any SMS or email. ${lead.agent_name}, Edmonton AB. CASL consent recorded: ${lead.casl_timestamp}</p>
          </div>
        </div>
      `
    });
    console.log(`Welcome email sent to ${lead.email}`);
    return { success: true };
  } catch (error) {
    console.error('Email failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function sendBookingConfirmation(booking) {
  if (!booking.lead_email) return { success: false, error: 'No email' };
  try {
    await transporter.sendMail({
      from: `${booking.agent_name} <${process.env.GMAIL_USER}>`,
      to: booking.lead_email,
      subject: `Your call with ${booking.agent_name} is confirmed`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <div style="background:#c8102e;padding:20px;border-radius:8px 8px 0 0">
            <h1 style="color:white;margin:0">Booking Confirmed!</h1>
          </div>
          <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px">
            <h2 style="color:#333">Hi ${booking.lead_name}!</h2>
            <p style="color:#555;font-size:15px">Your 15-minute real estate consultation with <strong>${booking.agent_name}</strong> is confirmed.</p>
            <div style="background:white;padding:16px;border-radius:8px;border-left:4px solid #c8102e;margin:16px 0">
              <p style="margin:0;color:#333"><strong>When:</strong> ${booking.meeting_time} Edmonton time</p>
            </div>
            <p style="color:#555">I look forward to discussing your Edmonton real estate goals with you!</p>
            <p style="color:#555">Talk soon,<br><strong>${booking.agent_name}</strong></p>
            <hr style="border:none;border-top:1px solid #ddd;margin:20px 0"/>
            <p style="color:#999;font-size:11px">To unsubscribe reply UNSUBSCRIBE.</p>
          </div>
        </div>
      `
    });
    console.log(`Booking confirmation sent to ${booking.lead_email}`);
    return { success: true };
  } catch (error) {
    console.error('Booking email failed:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { sendWelcomeEmail, sendBookingConfirmation };
