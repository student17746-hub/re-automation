require('dotenv').config();
const axios = require('axios');

async function scoreLead(lead) {
  try {
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'deepseek/deepseek-chat:free',
      messages: [
        {
          role: 'system',
          content: 'You are a real estate lead scoring AI for Edmonton, Canada. Score leads 1-10 based on intent and quality. Return ONLY valid JSON with no markdown: {"score": 8, "reason": "brief reason under 15 words", "priority": "high|medium|low"}'
        },
        {
          role: 'user',
          content: `Score this Edmonton real estate lead:
Name: ${lead.first_name} ${lead.last_name}
Inquiry: ${lead.inquiry}
Phone provided: ${lead.phone ? 'yes' : 'no'}
Email provided: ${lead.email ? 'yes' : 'no'}
Submitted: ${new Date(lead.submitted_at).toLocaleString('en-CA')}`
        }
      ],
      max_tokens: 100
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const content = response.data.choices[0].message.content.trim();
    const cleaned = content.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('AI scoring error:', error.message);
    return { score: 5, reason: 'Manual review needed', priority: 'medium' };
  }
}

async function getQualificationResponse(lead, conversationHistory) {
  try {
    const messages = [
      {
        role: 'system',
        content: `You are an SMS assistant for ${lead.agent_name}, a top Edmonton REALTOR.
Qualify leads by asking these 3 questions ONE AT A TIME:
Q1: Are you looking to buy, sell, or both in Edmonton?
Q2: Which area of Edmonton are you focused on?
Q3: What is your timeline - within 3 months, 6 months, or just exploring?
After all 3 answers say: "Perfect! ${lead.agent_name} has availability this week. Book here: ${process.env.CAL_BOOKING_LINK}"
Rules:
- Keep every message under 160 characters
- Sound warm and human not robotic
- Ask only one question at a time
- If lead seems ready to book skip qualification and send booking link
- Only add "Reply STOP to opt out." on the very first message`
      },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    ];

    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'deepseek/deepseek-chat:free',
      messages,
      max_tokens: 160
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('AI qualification error:', error.message);
    return `Hi ${lead.first_name}! Quick question - are you looking to buy, sell, or both in Edmonton? Reply STOP to opt out.`;
  }
}

module.exports = { scoreLead, getQualificationResponse };
