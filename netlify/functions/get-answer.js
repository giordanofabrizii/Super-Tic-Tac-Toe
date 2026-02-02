// Stesso storage in-memory
const games = new Map();

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const gameId = event.queryStringParameters?.gameId;

    if (!gameId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "gameId è richiesto" }),
      };
    }

    const game = games.get(gameId);

    if (!game) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Partita non trovata" }),
      };
    }

    if (!game.answer) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Answer non ancora disponibile" }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ answer: game.answer }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
