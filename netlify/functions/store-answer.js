// Stesso storage in-memory
const games = new Map();

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

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
    const { gameId, answer } = JSON.parse(event.body);

    if (!gameId || !answer) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'gameId e answer sono richiesti' })
      };
    }

    const game = games.get(gameId);

    if (!game) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Partita non trovata' })
      };
    }

    // Salva l'answer
    game.answer = answer;
    games.set(gameId, game);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};