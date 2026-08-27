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
  try {
    var authHeader = req.headers['authorization'] || '';
    var token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) { res.status(401).json({ error: 'Not signed in' }); return; }

    var user = await getUser(token);
    if (!user || !user.id) { res.status(401).json({ error: 'Invalid session' }); return; }

    var q = '/learning_profiles?user_id=eq.' + user.id + '&subject=eq.' + encodeURIComponent(SUBJECT) + '&topic=eq.' + encodeURIComponent(TOPIC) + '&select=*';
    var profRes = await sbFetch(q, token);
    var profRows = await profRes.json();
    if (!profRes.ok) {
      res.status(500).json({ error: 'Could not look up profile: ' + (profRows && profRows.message ? profRows.message : JSON.stringify(profRows)) });
      return;
    }
    var profile = Array.isArray(profRows) && profRows[0] ? profRows[0] : null;

    if (!profile) {
      var createRes = await sbFetch('/learning_profiles', token, {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ user_id: user.id, subject: SUBJECT, topic: TOPIC })
      });
      var created = await createRes.json();
      if (!createRes.ok) {
        res.status(500).json({ error: 'Could not create learning profile: ' + (created && created.message ? created.message : JSON.stringify(created)) });
        return;
      }
      profile = Array.isArray(created) ? created[0] : created;
      if (!profile || !profile.id) {
        res.status(500).json({ error: 'Profile creation returned no row: ' + JSON.stringify(created) });
        return;
      }
    }

    var sessRes = await sbFetch('/tutor_sessions', token, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: user.id, subject: SUBJECT, topic: TOPIC })
    });
    var sessRows = await sessRes.json();
    if (!sessRes.ok) {
      res.status(500).json({ error: 'Could not create tutor session: ' + (sessRows && sessRows.message ? sessRows.message : JSON.stringify(sessRows)) });
      return;
    }
    var session = Array.isArray(sessRows) ? sessRows[0] : sessRows;

    res.status(200).json({
      profile: profile,
      session_id: session && session.id,
      subject: SUBJECT,
      topic: TOPIC,
      name: user.user_metadata && user.user_metadata.display_name
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + (err && err.message) });
  }
};
