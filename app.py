from flask import Flask, request, jsonify, session
from flask_cors import CORS
import sqlite3
import os
import hashlib

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "jobtracker@sumit2024secretkey!")
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True

CORS(app, supports_credentials=True, origins=[
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "https://sumitbehera720.github.io"
])

DB_PATH = os.path.join(os.path.dirname(__file__), "database.db")

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin')
    allowed_origins = [
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "https://sumitbehera720.github.io"
    ]
    if origin in allowed_origins:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    return response

@app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
def handle_options(path):
    response = jsonify({})
    response.status_code = 200
    return response

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            company TEXT NOT NULL,
            role TEXT NOT NULL,
            date_applied TEXT NOT NULL,
            status TEXT DEFAULT 'Applied',
            notes TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    conn.commit()
    conn.close()

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (username, password) VALUES (?, ?)",
                       (username, hash_password(password)))
        conn.commit()
        conn.close()
        return jsonify({"message": "Account created successfully!"}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username already exists!"}), 409

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, username FROM users WHERE username=? AND password=?",
                   (username, hash_password(password)))
    user = cursor.fetchone()
    conn.close()
    if user:
        session['user_id'] = user[0]
        session['username'] = user[1]
        return jsonify({"message": "Login successful!", "username": user[1]})
    return jsonify({"error": "Invalid username or password!"}), 401

@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"message": "Logged out!"})

@app.route('/me', methods=['GET'])
def me():
    if 'user_id' in session:
        return jsonify({"username": session['username'], "logged_in": True})
    return jsonify({"logged_in": False})

@app.route('/jobs', methods=['GET'])
def get_jobs():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs WHERE user_id=? ORDER BY date_applied DESC", (session['user_id'],))
    jobs = cursor.fetchall()
    conn.close()
    return jsonify([{
        "id": j[0], "company": j[2], "role": j[3],
        "date_applied": j[4], "status": j[5], "notes": j[6]
    } for j in jobs])

@app.route('/jobs', methods=['POST'])
def add_job():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO jobs (user_id, company, role, date_applied, status, notes) VALUES (?, ?, ?, ?, ?, ?)",
        (session['user_id'], data['company'], data['role'], data['date_applied'],
         data.get('status', 'Applied'), data.get('notes', '')))
    conn.commit()
    conn.close()
    return jsonify({"message": "Job added successfully!"}), 201

@app.route('/jobs/<int:job_id>', methods=['PUT'])
def update_job(job_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE jobs SET status=?, notes=? WHERE id=? AND user_id=?",
        (data['status'], data.get('notes', ''), job_id, session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({"message": "Job updated successfully!"})

@app.route('/jobs/<int:job_id>', methods=['DELETE'])
def delete_job(job_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM jobs WHERE id=? AND user_id=?", (job_id, session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({"message": "Job deleted successfully!"})

init_db()

if __name__ == '__main__':
    app.run(debug=True)

