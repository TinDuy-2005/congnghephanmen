DROP TABLE IF EXISTS deliveries;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;
-- 2️⃣ Chọn database
USE cnpm;

-- 3️⃣ Bảng Roles (Vai trò người dùng)
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- Insert các role mẫu
INSERT INTO roles (name) VALUES ('Admin'), ('Manager'), ('Staff'), ('Customer');

-- 4️⃣ Bảng Users (ĐÃ XÓA CỘT role_id)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- Lưu password đã hash
    full_name VARCHAR(255),
    phone_number VARCHAR(20)
    -- KHÔNG CÓ role_id
);
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
-- 5️⃣ Bảng user_roles (Mối quan hệ N-N)
CREATE TABLE user_roles (
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
);
INSERT INTO user_roles (user_id, role_id) VALUES (1, 1);
INSERT INTO user_roles (user_id, role_id) VALUES (2, 2);
INSERT INTO user_roles (user_id, role_id) VALUES (3, 3);
-- 6️⃣ Bảng Orders
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL, 
    manager_id INT NULL,      
    staff_id INT NULL,        
    status ENUM('Pending', 'Assigned', 'In Progress', 'Delivered', 'Cancelled') DEFAULT 'Pending',
    description TEXT,
    delivery_address VARCHAR(255),
    phone_number VARCHAR(20),
    total_amount DECIMAL(18,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (manager_id) REFERENCES users(id),
    FOREIGN KEY (staff_id) REFERENCES users(id)
);
ALTER TABLE orders
MODIFY status ENUM('Pending', 'Assigned', 'In Progress', 'Delivered', 'Cancelled', 'Completed') 
DEFAULT 'Pending';
-- 7️⃣ Bảng Deliveries
CREATE TABLE deliveries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    staff_id INT NOT NULL,
    assigned_by INT NOT NULL,
    assignment_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('Assigned', 'In Progress', 'Delivered', 'Cancelled') DEFAULT 'Assigned',
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (staff_id) REFERENCES users(id),
    FOREIGN KEY (assigned_by) REFERENCES users(id)
);
-- CHỈ CHẠY CÂU LỆNH NÀY TRONG MYSQL CLIENT CỦA BẠN
ALTER TABLE deliveries
MODIFY status ENUM('Assigned', 'In Progress', 'Delivered', 'Cancelled', 'Completed', 'Unassigned') 
DEFAULT 'Assigned';