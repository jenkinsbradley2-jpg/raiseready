const BASE_ID    = 'appiVl7JuggYmBz6k';
const TABLE_NAME = 'RaiseReady Submissions';

async function airtableFetch(path, options = {}) {
  const token = process.env.AIRTABLE_TOKEN;
  const url = path.startsWith('http') ? path : `https://api.airtable.com${path}`;
  return fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
}

async function ensureTable() {
  let resp;
  try {
    resp = await airtableFetch(`/v0/meta/bases/${BASE_ID}/tables`);
  } catch (e) {
    return;
  }
  if (!resp.ok) return;

  const data = await resp.json();
  if (data.tables && data.tables.some(t => t.name === TABLE_NAME)) return;

  const fields = [
    { name: 'Founder Name',         type: 'singleLineText' },
    { name: 'Email',                type: 'email' },
    { name: 'Company Name',         type: 'singleLineText' },
    { name: 'Website',              type: 'url' },
    { name: 'Q1 Score',             type: 'number', options: { precision: 0 } },
    { name: 'Q2 Score',             type: 'number', options: { precision: 0 } },
    { name: 'Q3 Score',             type: 'number', options: { precision: 0 } },
    { name: 'Q4 Score',             type: 'number', options: { precision: 0 } },
    { name: 'Q5 Score',             type: 'number', options: { precision: 0 } },
    { name: 'Q6 Score',             type: 'number', options: { precision: 0 } },
    { name: 'Q7 Score',             type: 'number', options: { precision: 0 } },
    { name: 'Q8 Score',             type: 'number', options: { precision: 0 } },
    { name: 'Q9 Score',             type: 'number', options: { precision: 0 } },
    { name: 'Q10 Score',            type: 'number', options: { precision: 0 } },
    { name: 'Total Score',          type: 'number', options: { precision: 0 } },
    { name: 'Score Band',           type: 'singleLineText' },
    { name: 'Resources Needed',     type: 'multilineText' },
    { name: 'Goals With Resources', type: 'multilineText' },
    { name: 'Submission Date',      type: 'date', options: { dateFormat: { name: 'iso' } } }
  ];

  try {
    await airtableFetch(`/v0/meta/bases/${BASE_ID}/tables`, {
      method: 'POST',
      body: JSON.stringify({ name: TABLE_NAME, fields })
    });
  } catch (e) {
    // Ignore — record creation will surface the real error
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!process.env.AIRTABLE_TOKEN) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'AIRTABLE_TOKEN environment variable is not set.' })
    };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
  }

  const { founderName, email, companyName, website, scores, totalScore, scoreBand, resourcesNeeded, goalsWithResources } = data;

  if (!founderName || !email || !companyName || !Array.isArray(scores) || scores.length !== 10) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields.' }) };
  }

  await ensureTable();

  const fields = {
    'Founder Name':         founderName,
    'Email':                email,
    'Company Name':         companyName,
    'Q1 Score':             scores[0],
    'Q2 Score':             scores[1],
    'Q3 Score':             scores[2],
    'Q4 Score':             scores[3],
    'Q5 Score':             scores[4],
    'Q6 Score':             scores[5],
    'Q7 Score':             scores[6],
    'Q8 Score':             scores[7],
    'Q9 Score':             scores[8],
    'Q10 Score':            scores[9],
    'Total Score':          totalScore,
    'Score Band':           scoreBand,
    'Resources Needed':     resourcesNeeded,
    'Goals With Resources': goalsWithResources,
    'Submission Date':      new Date().toISOString().split('T')[0]
  };

  if (website) fields['Website'] = website;

  let resp;
  try {
    resp = await airtableFetch(
      `/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`,
      { method: 'POST', body: JSON.stringify({ fields }) }
    );
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Failed to reach Airtable.' }) };
  }

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    return {
      statusCode: resp.status,
      body: JSON.stringify({ error: err.error?.message || 'Airtable save failed.' })
    };
  }

  const record = await resp.json();
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: record.id })
  };
};
