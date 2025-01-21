from flask import Flask, request, jsonify
import psycopg2
import redis

app = Flask(__name__)

# Database connection
conn = psycopg2.connect(
    host="db",
    database="url_shortener",
    user="user",
    password="password"
)
cursor = conn.cursor()

# Redis connection
cache = redis.Redis(host="cache", port=6379)

@app.route("/shorten", methods=["POST"])
def shorten_url():
    original_url = request.json.get("original_url")
    short_url = original_url[:6]  # Example shortener logic
    cursor.execute("INSERT INTO urls (original_url, short_url) VALUES (%s, %s)", (original_url, short_url))
    conn.commit()
    return jsonify({"short_url": short_url}), 201

@app.route("/<short_url>", methods=["GET"])
def expand_url(short_url):
    cached_url = cache.get(short_url)
    if cached_url:
        return jsonify({"original_url": cached_url.decode()}), 200
    
    cursor.execute("SELECT original_url FROM urls WHERE short_url = %s", (short_url,))
    result = cursor.fetchone()
    if result:
        original_url = result[0]
        cache.set(short_url, original_url)  # Cache it
        return jsonify({"original_url": original_url}), 200
    return jsonify({"error": "URL not found"}), 404

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
