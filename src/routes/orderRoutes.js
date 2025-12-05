// src/routes/orderRoutes.js

const express = require('express');
const router = express.Router();

// Import Middlewares
const { verifyToken: auth } = require('../middleware/auth'); 
const checkRole = require('../middleware/role'); 

// ✨ BƯỚC 1: Import Controller
const orderController = require('../controllers/orderController'); 

// ✨ BƯỚC 2: Khai báo các hàm cần thiết từ Controller
const { 
    updateOrder, 
    deleteOrder, 
    unassignShipper // Cần cho tính năng hoàn lại thao tác
} = orderController; 


// ----------------------------------------------------------------------
// 1. CUSTOMER: Tạo đơn hàng
router.post('/create', auth, checkRole(['Customer']), orderController.createOrder);

// 2. CUSTOMER: Xem đơn hàng của mình
router.get('/my-orders', auth, checkRole(['Customer']), orderController.getMyOrders);

// 3. MANAGER/ADMIN: Xem TẤT CẢ đơn hàng
router.get('/all', auth, checkRole(['Admin', 'Manager']), orderController.getAllOrders);

// 4. MANAGER/ADMIN: Phân công đơn hàng
router.put('/assign/:orderId', auth, checkRole(['Admin', 'Manager']), orderController.assignOrder);

// ✨ 4.5 MANAGER/ADMIN: Hủy Phân công (Hoàn lại thao tác)
// Route này sử dụng hàm unassignShipper để hoàn lại thao tác phân công
router.put('/unassign/:id', auth, checkRole(['Admin', 'Manager']), unassignShipper);


// 5. STAFF: Xem đơn hàng được phân công
router.get('/assigned-tasks', auth, checkRole(['Staff']), orderController.getAssignedTasks);

// 6. STAFF: Cập nhật trạng thái
router.put('/update-status/:orderId', auth, checkRole(['Staff']), orderController.updateOrderStatus);

// 7. SỬA ĐƠN HÀNG (Customer và Admin)
// Admin có quyền sửa mọi đơn hàng, Customer sửa đơn hàng Pending của mình
router.put('/update/:id', auth, checkRole(['Customer', 'Admin']), updateOrder);

// 8. XÓA ĐƠN HÀNG (Customer và Admin)
// Admin có quyền xóa mọi đơn hàng, Customer xóa đơn hàng Pending của mình
router.delete('/delete/:id', auth, checkRole(['Customer', 'Admin']), deleteOrder);


module.exports = router;