// In-memory storage (resetta ad ogni cold start)
const games = new Map();

// Pulizia automatica delle partite vecchie (>30 minuti)
setInterval(() => {
  const now = Date.now();
  for (const [gameId, game] of games.entries()) {
    if (now - game.timestamp > 30 * 60 * 1000) {
      games.delete(gameId);
    }
  }
}, 5 * 60 * 1000); // ogni 5 minuti

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { gameId, offer } = JSON.parse(event.body);

    if (!gameId || !offer) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'gameId e offer sono richiesti' })
      };
    }

    // Salva l'offer in memoria
    games.set(gameId, {
      offer,
      answer: null,
      timestamp: Date.now()
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, gameId })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};