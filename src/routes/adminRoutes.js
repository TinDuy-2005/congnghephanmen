// src/routes/adminRoutes.js

const express = require('express');
const router = express.Router();

// Import Middlewares
const { verifyToken: auth } = require('../middleware/auth'); 
const checkRole = require('../middleware/role'); 

// Import Controller (Chứa logic quản lý người dùng và vai trò)
const adminController = require('../controllers/adminController'); 

// Áp dụng Middleware xác thực và phân quyền cho TẤT CẢ routes trong file này
router.use(auth, checkRole(['Admin'])); 

// =========================================================
// 1. TUYẾN ĐƯỜNG QUẢN LÝ NGƯỜI DÙNG (USERS)
// =========================================================

// Lấy danh sách tất cả Users
router.get('/users', adminController.getAllUsers);

// Tạo User mới (Admin tạo Manager/Staff/Customer)
router.post('/users', adminController.createUser);

// Cập nhật thông tin User (Tên, SĐT, Role)
router.put('/users/:id', adminController.updateUser);

// Khóa/Mở khóa User (Sử dụng cột is_active)
router.put('/users/:id/lock', adminController.lockUser);

// Xóa User
router.delete('/users/:id', adminController.deleteUser);


// =========================================================
// 2. TUYẾN ĐƯỜNG QUẢN LÝ VAI TRÒ (ROLES)
// =========================================================

// Lấy danh sách Roles (dùng cho dropdown khi tạo/sửa User)
router.get('/roles', adminController.getAllRoles);


module.exports = router;