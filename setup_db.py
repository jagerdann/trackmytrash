import mysql.connector
import os

print("Connecting to Aiven MySQL...")

# Get password from environment variable (set manually when running)
PASSWORD = os.environ.get('DB_PASSWORD', '')

if not PASSWORD:
    print("❌ Please set DB_PASSWORD environment variable first!")
    print("Run: set DB_PASSWORD=your_password")
    exit(1)

try:
    db = mysql.connector.connect(
        host="mysql-1cd8a8a3-trackmytrash.l.aivencloud.com",
        port=13351,
        user="avnadmin",
        password=PASSWORD,
        database="defaultdb"
    )
    
    cursor = db.cursor()
    print("✅ Connected to database!")
    
    # Create tables
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(100) NOT NULL UNIQUE,
            email VARCHAR(100) NOT NULL,
            password VARCHAR(255) NOT NULL,
            barangay VARCHAR(100),
            contact_number VARCHAR(20),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("✅ Users table created")
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS admins (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(100) NOT NULL,
            password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("✅ Admins table created")
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS garbage_schedules (
            id INT AUTO_INCREMENT PRIMARY KEY,
            stop_no INT NOT NULL,
            area VARCHAR(200) NOT NULL,
            landmark VARCHAR(200),
            arrival_time VARCHAR(20),
            duration VARCHAR(20),
            departure_time VARCHAR(20),
            barangay VARCHAR(100),
            route_image VARCHAR(255)
        )
    """)
    print("✅ Garbage schedules table created")
    
    cursor.execute("INSERT IGNORE INTO admins (username, password) VALUES ('admin', 'admin123')")
    db.commit()
    print("✅ Admin user created: admin / admin123")
    
    print("\n🎉 All done! Database is ready.")
    
    cursor.close()
    db.close()
    
except Exception as e:
    print(f"❌ Error: {e}")