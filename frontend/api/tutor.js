var SUPABASE_URL = 'https://acbdsqhvsozgsrqorhgv.supabase.co';
var SUPABASE_KEY = 'sb_publishable_COvZqYtGWeDQuIdHO0UN_Q_sYm9g_8g';
var SUBJECT = 'Computer Science';
var TOPIC = 'Recursion';

async function getUser(token) {
  var res = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token }
  });
  if (!res.ok) return null;
  return res.json();
}

async function sbFetch(path, token, options) {
  options = options || {};
  var headers = Object.assign({
    apikey: SUPABASE_KEY,
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json'
  }, options.headers || {});
  return fetch(SUPABASE_URL + '/rest/v1' + path, Object.assign({}, options, { headers: headers }));
}

async function callGemini(system, message) {
  return fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=' + process.env.GEMINI_API_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: message }] }]
      })
    }
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    var authHeader = req.headers['authorization'] || '';
    var token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) { res.status(401).json({ reply: '[Debug] Not signed in' }); return; }

    var user = await getUser(token);
    if (!user || !user.id) { res.status(401).json({ reply: '[Debug] Invalid session' }); return; }

    var body = req.body || {};
    var sessionId = body.session_id;
    var message = body.message;
    if (!message) { res.status(400).json({ reply: '[Debug] No message provided' }); return; }

    var q = '/learning_profiles?user_id=eq.' + user.id + '&subject=eq.' + encodeURIComponent(SUBJECT) + '&topic=eq.' + encodeURIComponent(TOPIC) + '&select=*';
    var profRes = await sbFetch(q, token);
    var profRows = await profRes.json();
    var profile = Array.isArray(profRows) && profRows[0] ? profRows[0] : { understanding_level: 1, confidence: 0.5, pace: 'steady' };

    var system = "You are EduMate, a sharp, patient personal tutor. The learner is at understanding level " + profile.understanding_level + " of 5 (confidence " + profile.confidence + "). Answer clearly and correctly in 3-6 sentences, at a depth appropriate to that level. If they say they don't understand, re-explain differently and more simply. Occasionally ask a brief 'why' follow-up to check real understanding. Keep the tone confident and intelligent, never childish.";

    var response = await callGemini(system, message);
    var data = await response.json();
    var reply = '';
    if (response.ok && data.candidates && data.candidates[0] && data.candidates[0].content) {
      reply = data.candidates[0].content.parts.map(function(p){ return p.text; }).join('');
    }
    if (!reply) reply = '[Debug] ' + ((data.error && data.error.message) || 'No reply from model');

    await sbFetch('/messages', token, {
      method: 'POST',
      body: JSON.stringify([
        { session_id: sessionId, role: 'student', content: message },
        { session_id: sessionId, role: 'tutor', content: reply }
      ])
    });

    res.status(200).json({ reply: reply, level: profile.understanding_level });
  } catch (err) {
    res.status(500).json({ reply: '[Debug] Server error: ' + (err && err.message) });
  }
};
