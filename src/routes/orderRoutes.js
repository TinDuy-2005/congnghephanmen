// src/routes/orderRoutes.js

const express = require('express');
const router = express.Router();

// ✨ SỬA LỖI CÚ PHÁP: Import các thành phần đúng cách
const { verifyToken: auth } = require('../middleware/auth'); 
const checkRole = require('../middleware/role'); 
const orderController = require('../controllers/orderController'); 

// ----------------------------------------------------------------------
// 1. CUSTOMER: Tạo đơn hàng
router.post('/create', auth, checkRole(['Customer', 'Manager', 'Admin']), orderController.createOrder);

// 2. CUSTOMER: Xem đơn hàng của mình
router.get('/my-orders', auth, checkRole(['Customer']), orderController.getMyOrders);

// 3. MANAGER/ADMIN: Xem TẤT CẢ đơn hàng
router.get('/all', auth, checkRole(['Admin', 'Manager']), orderController.getAllOrders);

// 4. MANAGER/ADMIN: Phân công đơn hàng
router.put('/assign/:orderId', auth, checkRole(['Admin', 'Manager']), orderController.assignOrder);

// 5. STAFF: Xem đơn hàng được phân công
router.get('/assigned-tasks', auth, checkRole(['Staff']), orderController.getAssignedTasks);

// 6. STAFF: Cập nhật trạng thái
router.put('/update-status/:orderId', auth, checkRole(['Staff']), orderController.updateOrderStatus);

module.exports = router;