// src/controllers/orderController.js
const db = require('../config/db');

// Lưu ý: Đảm bảo đã import và sử dụng đúng các hàm trong orderRoutes.js

// 1. TẠO ĐƠN (Customer) - Logic đã đúng
const createOrder = async (req, res) => {
    const { description, address, phone, total } = req.body; 
    const customer_id = req.user.id; 

    if (!description || !address || !phone) {
        return res.status(400).json({ message: 'Thiếu Mô tả, Địa chỉ, hoặc Số điện thoại.' });
    }
    
    try {
        const query = `
            INSERT INTO orders (customer_id, description, delivery_address, phone_number, total_amount, status) 
            VALUES (?, ?, ?, ?, ?, 'Pending');
        `;
        const [result] = await db.query(query, [customer_id, description, address, phone, total || 0]);
        
        res.status(201).json({ 
            message: "Tạo đơn hàng thành công!", 
            orderId: result.insertId 
        });
    } catch (error) {
        console.error("LỖI SQL KHI TẠO ĐƠN:", error); 
        res.status(500).json({ message: "Lỗi hệ thống khi tạo đơn hàng." });
    }
};

// 2. XEM ĐƠN CỦA MÌNH (Customer) - Logic đã đúng
const getMyOrders = async (req, res) => {
    try {
        const sql = `
            SELECT o.*, s.full_name as staff_name 
            FROM orders o
            LEFT JOIN users s ON o.staff_id = s.id
            WHERE o.customer_id = ?
            ORDER BY o.created_at DESC
        `;
        const [orders] = await db.query(sql, [req.user.id]);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống." });
    }
};

// 3. XEM TẤT CẢ ĐƠN (Manager/Admin) - Logic đã đúng
const getAllOrders = async (req, res) => {
    try {
        const sql = `
            SELECT o.*, c.full_name as customer_name, s.full_name as staff_name
            FROM orders o
            JOIN users c ON o.customer_id = c.id
            LEFT JOIN users s ON o.staff_id = s.id
            ORDER BY o.created_at DESC
        `;
        const [orders] = await db.query(sql);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống." });
    }
};

// 4. PHÂN CÔNG (Manager/Admin) - ĐÃ TỐI ƯU KIỂM TRA TRẠNG THÁI
const assignOrder = async (req, res) => {
    const { staff_id } = req.body;
    const { orderId } = req.params;
    const manager_id = req.user.id; 

    if (!staff_id) return res.status(400).json({ message: 'Thiếu staff_id để phân công.' });

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Kiểm tra trạng thái hiện tại (Nếu đã hủy thì không gán được)
        const [orderCheck] = await connection.query('SELECT status FROM orders WHERE id = ?', [orderId]);
        if (orderCheck.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
        }
        if (orderCheck[0].status !== 'Pending') {
            await connection.rollback();
            return res.status(400).json({ message: `Không thể gán. Đơn hàng đang ở trạng thái: ${orderCheck[0].status}` });
        }

        // 2. Cập nhật bảng ORDERS
        const [updateResult] = await connection.query(
            'UPDATE orders SET staff_id = ?, manager_id = ?, status = ? WHERE id = ?', 
            [staff_id, manager_id, 'Assigned', orderId]
        );

        // 3. Chèn vào bảng DELIVERIES
        await connection.query(
            'INSERT INTO deliveries (order_id, staff_id, assigned_by, status) VALUES (?, ?, ?, ?)',
            [orderId, staff_id, manager_id, 'Assigned']
        );

        await connection.commit();
        res.json({ message: "Đã phân công nhân viên thành công!" });

    } catch (error) {
        await connection.rollback();
        console.error("Lỗi phân công:", error);
        res.status(500).json({ message: "Lỗi hệ thống khi phân công." });
    } finally {
        connection.release();
    }
};

// 5. XEM ĐƠN ĐƯỢC GÁN (Staff) - Logic đã đúng
const getAssignedTasks = async (req, res) => {
    try {
        const sql = `
            SELECT o.*, c.full_name as customer_name
            FROM orders o
            JOIN users c ON o.customer_id = c.id
            WHERE o.staff_id = ? AND o.status IN ('Assigned', 'In Progress')
            ORDER BY o.created_at DESC
        `;
        const [tasks] = await db.query(sql, [req.user.id]);
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống." });
    }
};

// 6. CẬP NHẬT TRẠNG THÁI (Staff) - Logic đã đúng
const updateOrderStatus = async (req, res) => {
    const { status } = req.body;
    const { orderId } = req.params;
    const staff_id = req.user.id;

    const validStatuses = ['In Progress', 'Delivered', 'Cancelled'];
    if(!validStatuses.includes(status)) return res.status(400).json({message: "Trạng thái không hợp lệ"});

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Cập nhật bảng ORDERS (chỉ cho phép Staff được gán)
        const [result] = await connection.query(
            'UPDATE orders SET status = ? WHERE id = ? AND staff_id = ?', 
            [status, orderId, staff_id]
        );
        
        if(result.affectedRows === 0) {
            await connection.rollback();
            // Lỗi 403: Không có quyền (vì không phải đơn của họ)
            return res.status(403).json({message: "Bạn không được phép cập nhật đơn hàng này."});
        }
        
        // 2. Chèn vào bảng DELIVERIES
        await connection.query(
            'INSERT INTO deliveries (order_id, staff_id, assigned_by, status) VALUES (?, ?, ?, ?)',
            [orderId, staff_id, staff_id, status] 
        );

        await connection.commit();
        res.json({ message: "Cập nhật thành công!" });
    } catch (error) {
        await connection.rollback();
        console.error("Lỗi cập nhật trạng thái:", error);
        res.status(500).json({ message: "Lỗi hệ thống khi cập nhật trạng thái." });
    } finally {
        connection.release();
    }
};

module.exports = {
    createOrder, getMyOrders, getAllOrders, assignOrder, getAssignedTasks, updateOrderStatus
};