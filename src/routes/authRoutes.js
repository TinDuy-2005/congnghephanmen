const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Giả định module kết nối DB của bạn
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv')
dotenv.config()

// 1. ĐĂNG KÝ (Register) - Sử dụng Transaction cho 2 bảng
router.post('/register', async (req, res) => {
    // Nhận thông tin, bao gồm role_id để gán vai trò ban đầu
    const { username, password, full_name, phone_number, role_id } = req.body; 

    if (!username || !password || !role_id) {
        return res.status(400).json({ message: "Thiếu thông tin bắt buộc (username, password, role_id)." });
    }

    // Lấy kết nối từ Pool để thực hiện Transaction
    const connection = await db.getConnection(); 

    try {
        await connection.beginTransaction(); 

        // 1. Mã hóa mật khẩu
        const hashedPassword = await bcrypt.hash(password, 10);

        // 2. BƯỚC 1: Chèn vào bảng 'users' (KHÔNG CÓ cột role_id)
        const userSql = `
            INSERT INTO users (username, password, full_name, phone_number) 
            VALUES (?, ?, ?, ?)
        `;
        // SỬA: Sử dụng đúng tên cột (username, password)
        const [userResult] = await connection.query(userSql, [username, hashedPassword, full_name, phone_number]);
        const newUserId = userResult.insertId;

        // 3. BƯỚC 2: Chèn vào bảng 'user_roles' (Liên kết user_id và role_id)
        const roleSql = `
            INSERT INTO user_roles (user_id, role_id) 
            VALUES (?, ?)
        `;
        await connection.query(roleSql, [newUserId, role_id]);

        // 4. Commit Transaction
        await connection.commit();

        // 5. Lấy tên role để trả về
        const [roles] = await db.query('SELECT name FROM roles WHERE id = ?', [role_id]);
        const roleName = roles[0] ? roles[0].name : 'Unknown';

        res.status(201).json({ 
            message: "Đăng ký thành công và đã gán vai trò.", 
            userId: newUserId,
            role: roleName
        });

    } catch (error) {
        // Nếu có lỗi, Rollback và Log
        await connection.rollback(); 
        console.error(error); 
        
        if (error.code === 'ER_DUP_ENTRY') {
             return res.status(409).json({ message: "Tên đăng nhập đã tồn tại." });
        }
        res.status(500).json({ message: "Lỗi đăng ký hệ thống", error: error.message });
    } finally {
        // Trả lại kết nối về Pool
        connection.release(); 
    }
});

// 2. ĐĂNG NHẬP (Login) -> Lấy Token
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // BƯỚC 1: Tìm user, JOIN qua USER_ROLES để lấy Role Name
        const sql = `
            SELECT 
                u.id, 
                u.username, 
                u.password,  
                r.name as role_name 
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id 
            JOIN roles r ON ur.role_id = r.id
            WHERE u.username = ?
        `;

        const [users] = await db.query(sql, [username]);

        if (users.length === 0) {
            return res.status(404).json({ message: "Người dùng không tồn tại" });
        }

        const user = users[0];

        // BƯỚC 2: So sánh mật khẩu
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            return res.status(400).json({ message: "Sai mật khẩu" });
        }

        // BƯỚC 3: Tạo JWT Token (Chỉ lấy Role đầu tiên nếu có nhiều Roles)
        const token = jwt.sign(
            { id: user.id, role: user.role_name, username: user.username }, 
            process.env.JWT_SECRET , 
            { expiresIn: '1d' } 
        );

        res.json({ 
            message: "Đăng nhập thành công!", 
            token: token,
            username: user.username,
            role: user.role_name
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi hệ thống khi đăng nhập", error: error.message });
    }
});

// 3. Lấy danh sách nhân viên (Staff) - Dùng cho chức năng phân công
router.get('/staffs', async (req, res) => {
    try {
        // SỬA: JOIN qua user_roles để lấy danh sách Staff
        const [staffs] = await db.query(`
            SELECT u.id, u.username, u.full_name
            FROM users u 
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id 
            WHERE r.name = 'Staff'
        `);
        
        const result = staffs.map(s => ({ 
            id: s.id, 
            name: s.full_name || s.username 
        }));

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi khi lấy danh sách nhân viên.", error: error.message });
    }
});

module.exports = router;