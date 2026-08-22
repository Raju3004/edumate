module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { system, messages } = req.body;
    const contents = (messages || []).map(function(m) {
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      };
    });

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + process.env.GEMINI_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: contents
        })
      }
    );
    const data = await response.json();
    const text = data && data.candidates && data.candidates[0] && data.candidates[0].content
      ? data.candidates[0].content.parts.map(function(p){ return p.text; }).join('')
      : '';

    res.status(response.status).json({
      content: [{ type: 'text', text: text || '' }]
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};