const express = require('express');
const router = express.Router();
const db = require('../config/db'); 
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv')
dotenv.config()

// 1. ĐĂNG KÝ (Register) - Giữ nguyên
router.post('/register', async (req, res) => {
    // Nhận thông tin, bao gồm role_id để gán vai trò ban đầu
    const { username, password, full_name, phone_number, role_id } = req.body; 

    if (!username || !password || !role_id) {
        return res.status(400).json({ message: "Thiếu thông tin bắt buộc (username, password, role_id)." });
    }

    const connection = await db.getConnection(); 

    try {
        await connection.beginTransaction(); 

        // 1. Mã hóa mật khẩu
        const hashedPassword = await bcrypt.hash(password, 10);

        // 2. BƯỚC 1: Chèn vào bảng 'users' 
        const userSql = `
            INSERT INTO users (username, password, full_name, phone_number) 
            VALUES (?, ?, ?, ?)
        `;
        const [userResult] = await connection.query(userSql, [username, hashedPassword, full_name, phone_number]);
        const newUserId = userResult.insertId;

        // 3. BƯỚC 2: Chèn vào bảng 'user_roles' 
        const roleSql = `
            INSERT INTO user_roles (user_id, role_id) 
            VALUES (?, ?)
        `;
        await connection.query(roleSql, [newUserId, role_id]);

        await connection.commit();

        const [roles] = await db.query('SELECT name FROM roles WHERE id = ?', [role_id]);
        const roleName = roles[0] ? roles[0].name : 'Unknown';

        res.status(201).json({ 
            message: "Đăng ký thành công và đã gán vai trò.", 
            userId: newUserId,
            role: roleName
        });

    } catch (error) {
        await connection.rollback(); 
        console.error(error); 
        
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: "Tên đăng nhập đã tồn tại." });
        }
        res.status(500).json({ message: "Lỗi đăng ký hệ thống", error: error.message });
    } finally {
        connection.release(); 
    }
});

// 2. ĐĂNG NHẬP (Login) -> ĐÃ KHẮC PHỤC LỖ HỔNG BẢO MẬT
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // ✨ SỬA LỖI: BẮT BUỘC SELECT CỘT is_active
        const sql = `
            SELECT 
                u.id, 
                u.username, 
                u.password, 
                u.is_active,  /* ✨ CỘT CẦN THIẾT ĐỂ KIỂM TRA KHÓA ✨ */
                r.name as role_name 
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id 
            JOIN roles r ON ur.role_id = r.id
            WHERE u.username = ?
            LIMIT 1
        `;

        const [users] = await db.query(sql, [username]);

        if (users.length === 0) {
            return res.status(404).json({ message: "Người dùng không tồn tại" });
        }

        const user = users[0];

        // ✨ BƯỚC KHẮC PHỤC LỖ HỔNG: KIỂM TRA TRẠNG THÁI KHÓA TRƯỚC KHI TẠO TOKEN
        if (!user.is_active) {
            return res.status(403).json({ message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên." });
        }
        // Kết thúc kiểm tra bảo mật --------------------------
        
        // BƯỚC 2: So sánh mật khẩu
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            return res.status(401).json({ message: "Mật khẩu không chính xác" });
        }

        // BƯỚC 3: Tạo JWT Token
        const token = jwt.sign(
            { id: user.id, role: user.role_name, username: user.username }, 
            process.env.JWT_SECRET || 'secret_key_tam_thoi', 
            { expiresIn: '1d' } 
        );

        res.json({ 
            message: "Đăng nhập thành công!", 
            token: token,
            username: user.username,
            role: user.role_name,
            user_id: user.id // Cần trả về user_id để Admin Panel dùng cho logic khóa chính mình
        });

    } catch (error) {
        console.error("Lỗi đăng nhập:", error);
        res.status(500).json({ message: "Lỗi hệ thống khi đăng nhập", error: error.message });
    }
});

// 3. Lấy danh sách nhân viên (Staff) - Giữ nguyên
router.get('/staffs', async (req, res) => {
    try {
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