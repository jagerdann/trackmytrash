import mysql.connector
import hashlib

db = mysql.connector.connect(
    host="localhost",
    port="3306",
    user="root",
    password="",
    database="trackmytrash"
)
cursor = db.cursor()

# Create admins table
cursor.execute("""
    CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
""")

# Insert admin
hashed = hashlib.sha256("admin123".encode()).hexdigest()
cursor.execute("""
    INSERT INTO admins (username, password) VALUES (%s, %s)
    ON DUPLICATE KEY UPDATE username = username
""", ("admin", hashed))

db.commit()
print("Admin created: admin / admin123")
cursor.close()
db.close()