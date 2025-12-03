const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, checkRole } = require('../middleware/auth');

// 1. CUSTOMER: Tạo đơn hàng
router.post('/create', verifyToken, checkRole(['Customer']), async (req, res) => {
    const { description, address } = req.body;
    try {
        await db.query('INSERT INTO orders (customer_id, description, address) VALUES (?, ?, ?)', 
        [req.user.id, description, address]);
        res.status(201).json({ message: "Tạo đơn thành công!" });
    } catch (error) {
        res.status(500).json(error);
    }
});

// 2. CUSTOMER: Xem đơn hàng của mình
router.get('/my-orders', verifyToken, checkRole(['Customer']), async (req, res) => {
    try {
        // Lấy thêm tên Shipper (nếu đã được phân công)
        const sql = `
            SELECT o.*, s.name as staff_name 
            FROM orders o
            LEFT JOIN users s ON o.staff_id = s.id
            WHERE o.customer_id = ?
            ORDER BY o.created_at DESC
        `;
        const [orders] = await db.query(sql, [req.user.id]);
        res.json(orders);
    } catch (error) {
        res.status(500).json(error);
    }
});

// 3. MANAGER/ADMIN: Xem TẤT CẢ đơn hàng
router.get('/all', verifyToken, checkRole(['Admin', 'Manager']), async (req, res) => {
    try {
        // JOIN để lấy tên Khách hàng và tên Shipper
        const sql = `
            SELECT o.*, c.name as customer_name, s.name as staff_name
            FROM orders o
            JOIN users c ON o.customer_id = c.id
            LEFT JOIN users s ON o.staff_id = s.id
            ORDER BY o.created_at DESC
        `;
        const [orders] = await db.query(sql);
        res.json(orders);
    } catch (error) {
        res.status(500).json(error);
    }
});

// 4. MANAGER: Phân công đơn hàng
router.put('/assign/:orderId', verifyToken, checkRole(['Manager', 'Admin']), async (req, res) => {
    const { staff_id } = req.body;
    const { orderId } = req.params;
    
    try {
        await db.query('UPDATE orders SET staff_id = ?, status = ? WHERE id = ?', 
        [staff_id, 'Assigned', orderId]);
        res.json({ message: "Đã phân công nhân viên!" });
    } catch (error) {
        res.status(500).json(error);
    }
});

// 5. STAFF: Xem đơn hàng được phân công
router.get('/assigned-tasks', verifyToken, checkRole(['Staff']), async (req, res) => {
    try {
        // Lấy tên khách hàng để Shipper biết giao cho ai
        const sql = `
            SELECT o.*, c.name as customer_name
            FROM orders o
            JOIN users c ON o.customer_id = c.id
            WHERE o.staff_id = ?
            ORDER BY o.created_at DESC
        `;
        const [tasks] = await db.query(sql, [req.user.id]);
        res.json(tasks);
    } catch (error) {
        res.status(500).json(error);
    }
});

// 6. STAFF: Cập nhật trạng thái
router.put('/update-status/:orderId', verifyToken, checkRole(['Staff']), async (req, res) => {
    const { status } = req.body;
    const { orderId } = req.params;

    const validStatuses = ['In Progress', 'Completed', 'Cancelled'];
    if(!validStatuses.includes(status)) return res.status(400).json({message: "Trạng thái không hợp lệ"});

    try {
        const [result] = await db.query('UPDATE orders SET status = ? WHERE id = ? AND staff_id = ?', 
        [status, orderId, req.user.id]);
        
        if(result.affectedRows === 0) return res.status(404).json({message: "Không tìm thấy đơn hoặc không phải đơn của bạn"});
        
        res.json({ message: "Cập nhật thành công!" });
    } catch (error) {
        res.status(500).json(error);
    }
});

module.exports = router;