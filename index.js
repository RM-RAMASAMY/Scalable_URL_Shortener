require('dotenv').config();
const express = require('express');
const redis = require('redis');
const shortid = require('shortid');

const app = express();
app.use(express.json());

const redisClients = [
  redis.createClient({ host: process.env.REDIS_HOST_1, port: process.env.REDIS_PORT_1 }),
  redis.createClient({ host: process.env.REDIS_HOST_2, port: process.env.REDIS_PORT_2 }),
  redis.createClient({ host: process.env.REDIS_HOST_3, port: process.env.REDIS_PORT_3 })
];

// Connect to Redis clients
redisClients.forEach(client => {
  client.on('error', (err) => console.error('Redis client error', err));
  client.connect().catch(err => console.error('Redis client connection error', err));
});

// Hash function to distribute keys among Redis clients
function getRedisClient(key) {
  const hash = key.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return redisClients[hash % redisClients.length];
}

// Endpoint to shorten a URL with expiration
app.post('/shorten', async (req, res) => {
  const { url, ttl } = req.body; // ttl (time-to-live) is optional
  if (!url) return res.status(400).send('URL is required');

  const shortId = shortid.generate();
  const redisClient = getRedisClient(shortId);

  try {
    await redisClient.set(shortId, url, 'EX', ttl || 3600); // Default TTL of 1 hour
    res.json({ shortUrl: `http://localhost:${process.env.PORT}/${shortId}` });
  } catch (err) {
    console.error('Error setting value in Redis', err);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to retrieve the original URL
app.get('/:shortId', async (req, res) => {
  const { shortId } = req.params;
  const redisClient = getRedisClient(shortId);

  try {
    const url = await redisClient.get(shortId);
    if (!url) {
      console.log(`Cache miss for key: ${shortId}`);
      return res.status(404).send('URL not found');
    }
    console.log(`Cache hit for key: ${shortId}`);
    res.redirect(url);
  } catch (err) {
    console.error('Error getting value from Redis', err);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});