require('dotenv').config();
const axios = require('axios');

const BASE = 'https://api.hubapi.com';
const headers = () => ({
  'Authorization': `Bearer ${process.env.HUBSPOT_TOKEN}`,
  'Content-Type': 'application/json'
});

async function createOrUpdateContact(lead) {
  try {
    const response = await axios.post(`${BASE}/crm/v3/objects/contacts`, {
      properties: {
        firstname: lead.first_name,
        lastname: lead.last_name || '',
        email: lead.email,
        phone: lead.phone,
        hs_lead_status: 'NEW'
      }
    }, { headers: headers() });
    return { success: true, id: response.data.id };
  } catch (error) {
    if (error.response?.status === 409) {
      // Contact exists - get their ID
      try {
        const search = await axios.post(`${BASE}/crm/v3/objects/contacts/search`, {
          filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: lead.email }] }]
        }, { headers: headers() });
        const id = search.data.results?.[0]?.id;
        return { success: true, id, exists: true };
      } catch(e) {
        return { success: false, error: e.message };
      }
    }
    console.error('HubSpot contact error:', error.response?.data?.message || error.message);
    return { success: false, error: error.message };
  }
}

async function createDeal(lead, contactId) {
  try {
    // Get pipeline and stage IDs dynamically
    const pipelinesRes = await axios.get(`${BASE}/crm/v3/pipelines/deals`, { headers: headers() });
    const pipeline = pipelinesRes.data.results?.find(p => p.label === 'RE Agent Leads');
    const pipelineId = pipeline?.id;
    const stage = pipeline?.stages?.find(s => s.label === 'New Inquiry');
    const stageId = stage?.id;

    if (!pipelineId || !stageId) {
      console.error('Pipeline or stage not found - check HubSpot pipeline name');
      return { success: false, error: 'Pipeline not found' };
    }

    const dealRes = await axios.post(`${BASE}/crm/v3/objects/deals`, {
      properties: {
        dealname: `${lead.first_name} ${lead.last_name} - Edmonton RE Lead`.trim(),
        pipeline: pipelineId,
        dealstage: stageId
      }
    }, { headers: headers() });

    const dealId = dealRes.data.id;

    // Associate deal with contact
    if (contactId) {
      await axios.put(`${BASE}/crm/v3/objects/deals/${dealId}/associations/contacts/${contactId}/deal_to_contact`,
        {}, { headers: headers() });
    }

    console.log(`HubSpot deal created: ${dealId}`);
    return { success: true, id: dealId };
  } catch (error) {
    console.error('HubSpot deal error:', error.response?.data?.message || error.message);
    return { success: false, error: error.message };
  }
}

async function updateDealStage(email, stageName) {
  try {
    // Find contact by email
    const search = await axios.post(`${BASE}/crm/v3/objects/contacts/search`, {
      filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }]
    }, { headers: headers() });

    const contact = search.data.results?.[0];
    if (!contact) return { success: false, error: 'Contact not found' };

    // Get pipeline stage ID dynamically
    const pipelinesRes = await axios.get(`${BASE}/crm/v3/pipelines/deals`, { headers: headers() });
    const pipeline = pipelinesRes.data.results?.find(p => p.label === 'RE Agent Leads');
    const stage = pipeline?.stages?.find(s => s.label === stageName);
    if (!stage) return { success: false, error: `Stage "${stageName}" not found` };

    // Get associated deals
    const assocRes = await axios.get(`${BASE}/crm/v3/objects/contacts/${contact.id}/associations/deals`, { headers: headers() });
    const dealId = assocRes.data.results?.[0]?.id;
    if (!dealId) return { success: false, error: 'No deal found' };

    // Update deal stage
    await axios.patch(`${BASE}/crm/v3/objects/deals/${dealId}`, {
      properties: { dealstage: stage.id }
    }, { headers: headers() });

    console.log(`HubSpot deal updated to "${stageName}"`);
    return { success: true };
  } catch (error) {
    console.error('HubSpot update error:', error.response?.data?.message || error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { createOrUpdateContact, createDeal, updateDealStage };
