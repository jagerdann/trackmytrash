from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
from flask_session import Session
import mysql.connector
import hashlib
import os
import re
import time
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app, supports_credentials=True, origins=["*"])

# Session configuration
app.config['SECRET_KEY'] = 'trackmytrash_secret_key_2024'
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_PERMANENT'] = False
Session(app)

# Upload configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)

UPLOAD_FOLDER = os.path.join(PROJECT_ROOT, 'img')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'PNG', 'JPG', 'JPEG', 'GIF'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Ensure upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ========== DATABASE CONNECTION ==========
# Try DATABASE_URL from Render environment first
DATABASE_URL = os.environ.get('DATABASE_URL')

if DATABASE_URL:
    # Parse mysql://user:pass@host:port/database
    match = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', DATABASE_URL)
    if match:
        db = mysql.connector.connect(
            host=match.group(3),
            port=int(match.group(4)),
            user=match.group(1),
            password=match.group(2),
            database=match.group(5)
        )
        print("✅ Connected to Aiven MySQL via DATABASE_URL")
    else:
        # Fallback to individual environment variables
        db = mysql.connector.connect(
            host=os.environ.get('DB_HOST', 'localhost'),
            port=os.environ.get('DB_PORT', 3306),
            user=os.environ.get('DB_USER', 'root'),
            password=os.environ.get('DB_PASSWORD', ''),
            database=os.environ.get('DB_NAME', 'trackmytrash')
        )
        print("✅ Connected via individual DB env vars")
else:
    # Local development
    db = mysql.connector.connect(
        host="localhost",
        port="3306",
        user="root",
        password="",
        database="trackmytrash"
    )
    print("✅ Connected to local MySQL")

cursor = db.cursor(dictionary=True)

# ========== SERVE FRONTEND FILES ==========
frontend_path = os.path.join(PROJECT_ROOT, 'frontend')
css_path = os.path.join(PROJECT_ROOT, 'css')
js_path = os.path.join(PROJECT_ROOT, 'js')
img_path = os.path.join(PROJECT_ROOT, 'img')

@app.route('/')
def serve_home():
    return send_from_directory(frontend_path, 'HomePage.html')

@app.route('/<path:filename>')
def serve_frontend(filename):
    return send_from_directory(frontend_path, filename)

@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory(css_path, filename)

@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory(js_path, filename)

@app.route('/img/<path:filename>')
def serve_img(filename):
    return send_from_directory(img_path, filename)

# ========== HELPER FUNCTION ==========
def calculate_departure_time(arrival_time, duration):
    """Calculate departure time based on arrival time and duration"""
    if not arrival_time or not duration:
        return arrival_time
    
    duration_str = str(duration)
    
    match = re.match(r'(\d+):(\d+)\s*(AM|PM)', arrival_time, re.IGNORECASE)
    if not match:
        return arrival_time
    
    hour = int(match.group(1))
    minute = int(match.group(2))
    period = match.group(3).upper()
    
    if period == 'PM' and hour != 12:
        hour += 12
    elif period == 'AM' and hour == 12:
        hour = 0
    
    duration_minutes = int(re.search(r'\d+', duration_str).group())
    total_minutes = hour * 60 + minute + duration_minutes
    
    new_hour = total_minutes // 60
    new_minute = total_minutes % 60
    new_period = 'AM' if new_hour < 12 else 'PM'
    new_hour_12 = new_hour % 12
    if new_hour_12 == 0:
        new_hour_12 = 12
    
    return f"{new_hour_12}:{new_minute:02d} {new_period}"

def reorder_stop_numbers():
    """Reassign stop numbers sequentially starting from 1"""
    cursor.execute("SELECT id FROM garbage_schedules ORDER BY stop_no, id")
    routes = cursor.fetchall()
    
    new_stop_no = 1
    for route in routes:
        cursor.execute("UPDATE garbage_schedules SET stop_no = %s WHERE id = %s", (new_stop_no, route['id']))
        new_stop_no += 1
    db.commit()

# ========== UPLOAD ROUTE IMAGE ==========
@app.route('/api/admin/upload_route_image', methods=['POST'])
def upload_route_image():
    if not session.get('admin_logged_in'):
        return jsonify({"success": False, "message": "Unauthorized"})
    
    if 'image' not in request.files:
        return jsonify({"success": False, "message": "No image file provided"})
    
    file = request.files['image']
    
    if file.filename == '':
        return jsonify({"success": False, "message": "No image selected"})
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        name, ext = os.path.splitext(filename)
        filename = f"{name}_{int(time.time())}{ext}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        return jsonify({
            "success": True, 
            "message": "Image uploaded successfully!",
            "filename": filename
        })
    else:
        return jsonify({"success": False, "message": "File type not allowed. Please upload PNG, JPG, or JPEG."})

# ========== ADMIN AUTH ==========
@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    cursor.execute("SELECT * FROM admins WHERE username = %s AND password = %s", (username, password))
    admin = cursor.fetchone()
    
    if admin:
        session['admin_id'] = admin['id']
        session['admin_username'] = admin['username']
        session['admin_logged_in'] = True
        session['logged_in'] = True
        session['is_admin'] = True
        return jsonify({"success": True, "message": "Admin login successful!", "is_admin": True})
    else:
        return jsonify({"success": False, "message": "Invalid username or password"})

@app.route('/api/admin/check_session', methods=['GET'])
def admin_check_session():
    if session.get('admin_logged_in'):
        return jsonify({
            "logged_in": True,
            "username": session.get('admin_username'),
            "is_admin": True
        })
    else:
        return jsonify({"logged_in": False})

@app.route('/api/admin/logout', methods=['POST'])
def admin_logout():
    session.clear()
    return jsonify({"success": True, "message": "Logged out successfully!"})

# ========== USER CRUD ==========
@app.route('/api/admin/users', methods=['GET'])
def admin_get_users():
    if not session.get('admin_logged_in'):
        return jsonify({"success": False, "message": "Unauthorized"})
    cursor.execute("SELECT id, username, email, barangay, contact_number, created_at FROM users ORDER BY id DESC")
    users = cursor.fetchall()
    return jsonify({"success": True, "users": users})

@app.route('/api/admin/users/<int:user_id>', methods=['GET'])
def admin_get_user(user_id):
    if not session.get('admin_logged_in'):
        return jsonify({"success": False, "message": "Unauthorized"})
    cursor.execute("SELECT id, username, email, barangay, contact_number, created_at FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone()
    if user:
        return jsonify({"success": True, "user": user})
    return jsonify({"success": False, "message": "User not found"})

@app.route('/api/admin/users', methods=['POST'])
def admin_create_user():
    if not session.get('admin_logged_in'):
        return jsonify({"success": False, "message": "Unauthorized"})
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    barangay = data.get('barangay')
    contact = data.get('contact_number')
    
    hashed_password = hashlib.sha256(password.encode()).hexdigest()
    
    try:
        cursor.execute("""
            INSERT INTO users (username, email, password, barangay, contact_number) 
            VALUES (%s, %s, %s, %s, %s)
        """, (username, email, hashed_password, barangay, contact))
        db.commit()
        return jsonify({"success": True, "message": "User created successfully!"})
    except mysql.connector.IntegrityError:
        return jsonify({"success": False, "message": "Username or email already exists!"})

@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
def admin_update_user(user_id):
    if not session.get('admin_logged_in'):
        return jsonify({"success": False, "message": "Unauthorized"})
    data = request.json
    username = data.get('username')
    email = data.get('email')
    barangay = data.get('barangay')
    contact = data.get('contact_number')
    
    try:
        cursor.execute("""
            UPDATE users SET username = %s, email = %s, barangay = %s, contact_number = %s 
            WHERE id = %s
        """, (username, email, barangay, contact, user_id))
        db.commit()
        return jsonify({"success": True, "message": "User updated successfully!"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
def admin_delete_user(user_id):
    if not session.get('admin_logged_in'):
        return jsonify({"success": False, "message": "Unauthorized"})
    cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
    db.commit()
    return jsonify({"success": True, "message": "User deleted successfully!"})

# ========== ROUTES CRUD ==========
@app.route('/api/admin/routes', methods=['GET'])
def admin_get_routes():
    if not session.get('admin_logged_in'):
        return jsonify({"success": False, "message": "Unauthorized"})
    cursor.execute("SELECT * FROM garbage_schedules ORDER BY stop_no")
    routes = cursor.fetchall()
    return jsonify({"success": True, "routes": routes})

@app.route('/api/admin/routes/next_stop', methods=['GET'])
def admin_get_next_stop():
    if not session.get('admin_logged_in'):
        return jsonify({"success": False, "message": "Unauthorized"})
    cursor.execute("SELECT MAX(stop_no) as max_stop FROM garbage_schedules")
    result = cursor.fetchone()
    next_stop = (result['max_stop'] or 0) + 1
    return jsonify({"success": True, "next_stop": next_stop})

@app.route('/api/admin/routes/<int:route_id>', methods=['GET'])
def admin_get_route(route_id):
    if not session.get('admin_logged_in'):
        return jsonify({"success": False, "message": "Unauthorized"})
    cursor.execute("SELECT * FROM garbage_schedules WHERE id = %s", (route_id,))
    route = cursor.fetchone()
    if route:
        return jsonify({"success": True, "route": route})
    return jsonify({"success": False, "message": "Route not found"})

@app.route('/api/admin/routes', methods=['POST'])
def admin_create_route():
    if not session.get('admin_logged_in'):
        return jsonify({"success": False, "message": "Unauthorized"})
    data = request.json
    area = data.get('area')
    landmark = data.get('landmark')
    arrival_time = data.get('arrival_time')
    duration = data.get('duration')
    barangay = data.get('barangay')
    route_image = data.get('route_image')
    
    if not route_image:
        return jsonify({"success": False, "message": "Route image is required! Please upload an image."})
    
    cursor.execute("SELECT MAX(stop_no) as max_stop FROM garbage_schedules")
    result = cursor.fetchone()
    next_stop = (result['max_stop'] or 0) + 1
    
    departure_time = calculate_departure_time(arrival_time, duration)
    
    cursor.execute("""
        SELECT id FROM garbage_schedules 
        WHERE area = %s OR landmark = %s OR arrival_time = %s
    """, (area, landmark, arrival_time))
    existing = cursor.fetchone()
    if existing:
        return jsonify({"success": False, "message": "Duplicate entry! Area, Landmark, or Arrival Time already exists."})
    
    cursor.execute("""
        INSERT INTO garbage_schedules (stop_no, area, landmark, arrival_time, duration, departure_time, barangay, route_image) 
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (next_stop, area, landmark, arrival_time, duration, departure_time, barangay, route_image))
    db.commit()
    
    reorder_stop_numbers()
    
    return jsonify({"success": True, "message": "Route created successfully!", "id": cursor.lastrowid, "stop_no": next_stop})

@app.route('/api/admin/routes/<int:route_id>', methods=['PUT'])
def admin_update_route(route_id):
    if not session.get('admin_logged_in'):
        return jsonify({"success": False, "message": "Unauthorized"})
    data = request.json
    stop_no = data.get('stop_no')
    area = data.get('area')
    landmark = data.get('landmark')
    arrival_time = data.get('arrival_time')
    duration = data.get('duration')
    barangay = data.get('barangay')
    route_image = data.get('route_image')
    
    departure_time = calculate_departure_time(arrival_time, duration)
    
    cursor.execute("""
        SELECT id FROM garbage_schedules 
        WHERE (area = %s OR landmark = %s OR arrival_time = %s)
        AND id != %s
    """, (area, landmark, arrival_time, route_id))
    existing = cursor.fetchone()
    if existing:
        return jsonify({"success": False, "message": "Duplicate entry! Area, Landmark, or Arrival Time already exists."})
    
    if route_image:
        cursor.execute("""
            UPDATE garbage_schedules SET stop_no = %s, area = %s, landmark = %s, arrival_time = %s, 
            duration = %s, departure_time = %s, barangay = %s, route_image = %s WHERE id = %s
        """, (stop_no, area, landmark, arrival_time, duration, departure_time, barangay, route_image, route_id))
    else:
        cursor.execute("""
            UPDATE garbage_schedules SET stop_no = %s, area = %s, landmark = %s, arrival_time = %s, 
            duration = %s, departure_time = %s, barangay = %s WHERE id = %s
        """, (stop_no, area, landmark, arrival_time, duration, departure_time, barangay, route_id))
    db.commit()
    
    reorder_stop_numbers()
    
    return jsonify({"success": True, "message": "Route updated successfully!"})

@app.route('/api/admin/routes/<int:route_id>', methods=['DELETE'])
def admin_delete_route(route_id):
    if not session.get('admin_logged_in'):
        return jsonify({"success": False, "message": "Unauthorized"})
    
    cursor.execute("DELETE FROM garbage_schedules WHERE id = %s", (route_id,))
    db.commit()
    
    reorder_stop_numbers()
    
    return jsonify({"success": True, "message": "Route deleted successfully! Stop numbers have been reordered."})

# ========== GET ALL AREAS FOR REGISTRATION ==========
@app.route('/api/routes/areas', methods=['GET'])
def get_all_areas():
    cursor.execute("SELECT DISTINCT area FROM garbage_schedules ORDER BY area")
    areas = cursor.fetchall()
    area_list = [area['area'] for area in areas]
    return jsonify({"success": True, "areas": area_list})

# ========== USER API ==========
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    barangay = data.get('barangay')
    contact = data.get('contact')
    
    hashed_password = hashlib.sha256(password.encode()).hexdigest()
    
    try:
        cursor.execute("""
            INSERT INTO users (username, email, password, barangay, contact_number) 
            VALUES (%s, %s, %s, %s, %s)
        """, (username, email, hashed_password, barangay, contact))
        db.commit()
        return jsonify({"success": True, "message": "Registered successfully!"})
    except mysql.connector.IntegrityError:
        return jsonify({"success": False, "message": "Username or email already exists!"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    # Check admin first
    cursor.execute("SELECT * FROM admins WHERE username = %s AND password = %s", (username, password))
    admin = cursor.fetchone()
    
    if admin:
        session.clear()
        session['admin_id'] = admin['id']
        session['admin_username'] = admin['username']
        session['admin_logged_in'] = True
        session['logged_in'] = True
        session['is_admin'] = True
        return jsonify({
            "success": True, 
            "message": "Admin login successful! Redirecting to Admin Panel...",
            "is_admin": True,
            "username": admin['username']
        })
    
    # Regular user login
    hashed_password = hashlib.sha256(password.encode()).hexdigest()
    cursor.execute("SELECT * FROM users WHERE username = %s AND password = %s", (username, hashed_password))
    user = cursor.fetchone()
    
    if user:
        session.clear()
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['logged_in'] = True
        session['is_admin'] = False
        return jsonify({
            "success": True, 
            "message": f"Welcome back {user['username']}!",
            "is_admin": False,
            "username": user['username']
        })
    else:
        return jsonify({"success": False, "message": "Invalid username or password"})

@app.route('/api/check_session', methods=['GET'])
def check_session():
    if session.get('logged_in'):
        return jsonify({
            "logged_in": True,
            "username": session.get('username') or session.get('admin_username'),
            "user_id": session.get('user_id'),
            "is_admin": session.get('is_admin', False)
        })
    else:
        return jsonify({"logged_in": False})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"success": True, "message": "Logged out successfully!"})

@app.route('/api/user/<username>', methods=['GET'])
def get_user_by_username(username):
    cursor.execute("SELECT id, username, email, barangay, contact_number FROM users WHERE username = %s", (username,))
    user = cursor.fetchone()
    
    if user:
        return jsonify({"success": True, "user": user})
    else:
        return jsonify({"success": False, "message": "User not found"})

@app.route('/api/feedback', methods=['POST'])
def feedback():
    data = request.json
    name = data.get('name')
    email = data.get('email')
    barangay = data.get('barangay')
    feedback_type = data.get('feedback_type')
    message = data.get('message')
    
    cursor.execute("""
        INSERT INTO feedback (name, email, barangay, feedback_type, message) 
        VALUES (%s, %s, %s, %s, %s)
    """, (name, email, barangay, feedback_type, message))
    db.commit()
    
    return jsonify({"success": True, "message": "Thank you for your feedback!"})

@app.route('/api/test', methods=['GET'])
def test():
    cursor.execute("SELECT * FROM garbage_schedules")
    schedules = cursor.fetchall()
    return jsonify({"count": len(schedules), "schedules": schedules})

# ========== PUBLIC ROUTES (no login required) ==========
@app.route('/api/public/routes', methods=['GET'])
def get_public_routes():
    cursor.execute("SELECT stop_no, area, arrival_time, duration, route_image FROM garbage_schedules ORDER BY stop_no")
    routes = cursor.fetchall()
    return jsonify({"success": True, "routes": routes})

if __name__ == '__main__':
    print("🚛 Track My Trash Server Running...")
    print("📍 http://localhost:5000")
    print("👑 Admin: admin / admin123")
    app.run(debug=True, port=5000)