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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    var authHeader = req.headers['authorization'] || '';
    var token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) { res.status(401).json({ error: 'Not signed in' }); return; }
    var user = await getUser(token);
    if (!user || !user.id) { res.status(401).json({ error: 'Invalid session' }); return; }

    var body = req.body || {};
    var correct = !!body.correct;

    var q = '/learning_profiles?user_id=eq.' + user.id + '&subject=eq.' + encodeURIComponent(SUBJECT) + '&topic=eq.' + encodeURIComponent(TOPIC) + '&select=*';
    var profRes = await sbFetch(q, token);
    var profRows = await profRes.json();
    var profile = Array.isArray(profRows) && profRows[0] ? profRows[0] : null;
    if (!profile) { res.status(404).json({ error: 'No profile found for this user/subject/topic' }); return; }

    var newLevel = profile.understanding_level;
    if (correct && newLevel < 5) newLevel += 1;

    var patchRes = await sbFetch('/learning_profiles?id=eq.' + profile.id, token, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ understanding_level: newLevel, updated_at: new Date().toISOString() })
    });
    var patchRows = await patchRes.json();
    var updated = Array.isArray(patchRows) && patchRows[0] ? patchRows[0] : null;

    if (!updated) {
      res.status(500).json({ error: 'Update did not affect any row (RLS or id mismatch)' });
      return;
    }

    await sbFetch('/progress_events', token, {
      method: 'POST',
      body: JSON.stringify({
        user_id: user.id,
        subject: SUBJECT,
        topic: TOPIC,
        event_type: 'level_check',
        detail: { correct: correct, new_level: newLevel }
      })
    });

    res.status(200).json({ level: updated.understanding_level });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + (err && err.message) });
  }
};
