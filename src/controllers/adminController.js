// src/controllers/adminController.js
const db = require('../config/db');
const bcrypt = require('bcryptjs');

// ----------------------------------------------------
// 1. QUẢN LÝ VAI TRÒ (ROLES)
// ----------------------------------------------------

/**
 * Lấy danh sách tất cả Roles (Dùng cho dropdown khi tạo/sửa User)
 */
const getAllRoles = async (req, res) => {
    try {
        const [roles] = await db.query('SELECT * FROM roles');
        res.json(roles);
    } catch (error) {
        console.error('Lỗi lấy Roles:', error);
        res.status(500).json({ message: 'Lỗi hệ thống khi lấy danh sách vai trò.' });
    }
};


// ----------------------------------------------------
// 2. QUẢN LÝ NGƯỜI DÙNG (USERS - CRUD & LOCK)
// ----------------------------------------------------

/**
 * Lấy danh sách tất cả Users và Roles của họ (Admin Only)
 */
const getAllUsers = async (req, res) => {
    try {
        const sql = `
            SELECT u.id, u.username, u.full_name, u.phone_number, u.is_active, 
                   GROUP_CONCAT(r.name SEPARATOR ', ') as roles_list
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            GROUP BY u.id, u.username, u.full_name, u.phone_number, u.is_active  
            ORDER BY u.id ASC
        `;
        const [users] = await db.query(sql);
        res.json(users);
    } catch (error) {
        console.error('Lỗi SQL trong getAllUsers:', error); // Log lỗi ra console Node.js
        res.status(500).json({ message: 'Lỗi hệ thống khi tải danh sách người dùng.' });
    }
};

/**
 * Tạo User mới (Admin tạo) - DÙNG TRANSACTION
 */
const createUser = async (req, res) => {
    const { username, password, full_name, phone_number, role_id } = req.body;
    
    if (!username || !password || !role_id) {
        return res.status(400).json({ message: 'Thiếu thông tin bắt buộc.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const hashedPassword = await bcrypt.hash(password, 10);

        // B1: Chèn vào bảng users
        const userSql = 'INSERT INTO users (username, password, full_name, phone_number) VALUES (?, ?, ?, ?)';
        const [userResult] = await connection.query(userSql, [username, hashedPassword, full_name, phone_number]);
        const newUserId = userResult.insertId;

        // B2: Chèn vào bảng user_roles
        const roleSql = 'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)';
        await connection.query(roleSql, [newUserId, role_id]);

        await connection.commit();
        res.status(201).json({ message: 'Tạo người dùng và gán vai trò thành công!', userId: newUserId });

    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Tên đăng nhập đã tồn tại.' });
        }
        console.error('Lỗi tạo User:', error);
        res.status(500).json({ message: 'Lỗi hệ thống khi tạo người dùng.' });
    } finally {
        connection.release();
    }
};

/**
 * Cập nhật User (Admin sửa) - DÙNG TRANSACTION
 */
const updateUser = async (req, res) => {
    const { id } = req.params;
    const { full_name, phone_number, new_role_id, new_password } = req.body;
    
    if (!new_role_id) {
        return res.status(400).json({ message: 'Phải chỉ định vai trò mới.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Cập nhật thông tin cơ bản và mật khẩu (nếu có)
        let updateSql = 'UPDATE users SET full_name = ?, phone_number = ? WHERE id = ?';
        let params = [full_name, phone_number, id];

        if (new_password) {
            const hashedPassword = await bcrypt.hash(new_password, 10);
            updateSql = 'UPDATE users SET full_name = ?, phone_number = ?, password = ? WHERE id = ?';
            params = [full_name, phone_number, hashedPassword, id];
        }

        const [userResult] = await connection.query(updateSql, params);

        if (userResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        }

        // 2. Cập nhật vai trò: Xóa cũ, chèn mới (hoặc sử dụng logic phức tạp hơn cho N-N)
        await connection.query('DELETE FROM user_roles WHERE user_id = ?', [id]);
        await connection.query('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [id, new_role_id]);

        await connection.commit();
        res.status(200).json({ message: 'Cập nhật người dùng thành công!' });

    } catch (error) {
        await connection.rollback();
        console.error('Lỗi cập nhật User:', error);
        res.status(500).json({ message: 'Lỗi hệ thống khi cập nhật người dùng.' });
    } finally {
        connection.release();
    }
};

/**
 * Khóa/Mở khóa User (Sử dụng cột is_active)
 */
const lockUser = async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body; 
    
    if (req.user.id === parseInt(id)) {
        return res.status(403).json({ message: "Không thể khóa tài khoản của chính mình." });
    }

    try {
        const [result] = await db.query(
            'UPDATE users SET is_active = ? WHERE id = ?', 
            [isActive, id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Không tìm thấy người dùng." });
        }
        
        res.json({ message: `Người dùng #${id} đã được ${isActive ? 'mở khóa' : 'khóa'} thành công.` });
    } catch (error) {
        console.error("Lỗi khóa User:", error);
        res.status(500).json({ message: "Lỗi hệ thống." });
    }
};

/**
 * Xóa User (Admin xóa) - DÙNG TRANSACTION
 */
const deleteUser = async (req, res) => {
    const { id } = req.params;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Xóa các vai trò liên quan (phải làm trước)
        await connection.query('DELETE FROM user_roles WHERE user_id = ?', [id]);

        // 2. Xử lý Khóa ngoại trong các bảng tham chiếu (orders, deliveries)
        // LƯU Ý: Nếu bạn thiết lập ON DELETE RESTRICT, bạn cần xóa hết orders/deliveries
        // Nếu bạn thiết lập ON DELETE SET NULL, bạn cần cập nhật các trường liên quan thành NULL
        // Tạm thời bỏ qua nếu bạn dùng SET NULL cho FK.

        // 3. Xóa User
        const [result] = await connection.query('DELETE FROM users WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        }
        
        await connection.commit();
        res.status(200).json({ message: `Người dùng ID ${id} đã được xóa.` });

    } catch (error) {
        await connection.rollback();
        console.error('Lỗi xóa User:', error);
        res.status(500).json({ message: 'Lỗi hệ thống khi xóa người dùng.' });
    } finally {
        connection.release();
    }
};


module.exports = {
    getAllRoles,
    getAllUsers,
    createUser,
    updateUser,
    lockUser,
    deleteUser,
};