// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const db = require('../config/db'); // ✨ CẦN IMPORT DB VÀO MIDDLEWARE NÀY

const verifyToken = async (req, res, next) => { // ✨ PHẢI THÊM 'async'
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ message: "Access Denied. Authorization header missing." });
    }

    const token = authHeader.split(' ')[1]; 
    const secret = process.env.JWT_SECRET || 'secret_key_tam_thoi';

    try {
        const decoded = jwt.verify(token, secret);
        
        // ✨ BƯỚC MỚI: KIỂM TRA LẠI TRẠNG THÁI TRONG DATABASE
        const [users] = await db.query('SELECT id, username, is_active FROM users WHERE id = ?', [decoded.id]);
        
        if (users.length === 0) {
            return res.status(401).json({ message: "User không tồn tại." });
        }
        
        const user = users[0];
        
        if (!user.is_active) {
            // Tài khoản bị khóa sau khi có Token
            return res.status(403).json({ message: "Tài khoản này đã bị khóa. Vui lòng đăng nhập lại." });
        }

        // Cập nhật req.user với dữ liệu mới từ DB (Đảm bảo lấy is_active)
        req.user = decoded; 
        req.user.is_active = user.is_active; // Thêm is_active vào req.user (Tuyệt vời cho debugging)
        
        next();
    } catch (ex) {
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }
};

module.exports = { verifyToken }; // Export lại verifyToken