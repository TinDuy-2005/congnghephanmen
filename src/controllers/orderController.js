// src/controllers/orderController.js
const db = require('../config/db');

// Lưu ý: Đảm bảo đã import và sử dụng đúng các hàm trong orderRoutes.js

// 1. TẠO ĐƠN (Customer) - Giữ nguyên
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

// 2. XEM ĐƠN CỦA MÌNH (Customer) - Giữ nguyên
const getMyOrders = async (req, res) => {
    try {
        const customer_id = req.user.id;
    
        const sql = `
            SELECT o.*, s.full_name as staff_name 
            FROM orders o
            LEFT JOIN users s ON o.staff_id = s.id
            WHERE o.customer_id = ?
            ORDER BY o.created_at DESC
        `;
        const [orders] = await db.query(sql, [customer_id]);
        
        res.json(orders); 
    } catch (error) { 
        console.error("Lỗi getMyOrders:", error);
        res.status(500).json({ message: "Lỗi hệ thống." });
    }
};

// 3. XEM TẤT CẢ ĐƠN (Manager/Admin) - Giữ nguyên
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

// 4. PHÂN CÔNG (Manager/Admin) - Giữ nguyên (Đã có Transaction)
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

// 5. XEM ĐƠN ĐƯỢC GÁN (Staff) - Giữ nguyên
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

// 6. CẬP NHẬT TRẠNG THÁI (Staff) 
const updateOrderStatus = async (req, res) => {
    const { status } = req.body;
    const { orderId } = req.params;
    const staff_id = req.user.id;

    const validStatuses = ['In Progress', 'Completed', 'Delivered', 'Cancelled']; 
    if(!validStatuses.includes(status)) {
        console.error("Trạng thái không hợp lệ được gửi:", status);
        return res.status(400).json({message: "Trạng thái cập nhật không hợp lệ."});
    }
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Cập nhật bảng ORDERS (Chỉ cập nhật đơn được gán cho Staff này)
 
        const [result] = await connection.query(
            'UPDATE orders SET status = ? WHERE id = ? AND staff_id = ?', 
            [status, orderId, staff_id]
        );
        
        if(result.affectedRows === 0) {
            await connection.rollback();
            // Lỗi 403: Không có đơn hàng đó, hoặc không được gán cho Staff này
            return res.status(403).json({message: "Không tìm thấy đơn hàng hoặc bạn không được phép cập nhật."});
        }
        
        // 2. Chèn vào bảng DELIVERIES (Ghi lại lịch sử cập nhật trạng thái)
        await connection.query(
            'INSERT INTO deliveries (order_id, staff_id, assigned_by, status) VALUES (?, ?, ?, ?)',
            [orderId, staff_id, staff_id, status] // staff_id = assigned_by vì Staff tự cập nhật
        );

        await connection.commit();
        res.json({ message: "Cập nhật thành công!" });
    } catch (error) {
        await connection.rollback();
        console.error("LỖI CƠ SỞ DỮ LIỆU TRONG UPDATE STATUS:", error);
        res.status(500).json({ message: "Lỗi hệ thống khi cập nhật trạng thái." });
    } finally {
        connection.release();
    }
};
// 7. SỬA ĐƠN HÀNG (Customer/Admin)
const updateOrder = async (req, res) => {
    const { id } = req.params;
    const { description, address, phone, total } = req.body; 
    const user_id = req.user.id; 
    const user_role = req.user.role; // Lấy vai trò của người dùng

    if (!description || !address || !phone) {
        return res.status(400).json({ message: 'Thiếu thông tin cập nhật.' });
    }

    const connection = await db.getConnection(); 
    try {
        await connection.beginTransaction(); 

        // 1. Kiểm tra quyền và trạng thái đơn hàng
        const [check] = await connection.query('SELECT customer_id, status FROM orders WHERE id = ?', [id]);
        
        if (check.length === 0) {
            await connection.rollback(); return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
        }
        
        const orderStatus = check[0].status;

        // KIỂM TRA QUYỀN SỬA:
        // A. Từ chối nếu đã Completed hoặc Cancelled (Ngay cả Admin cũng không nên sửa)
        if (orderStatus === 'Completed' || orderStatus === 'Cancelled') {
            await connection.rollback();
            return res.status(400).json({ message: 'Không thể sửa đơn hàng đã hoàn thành hoặc bị hủy.' });
        }

        // B. Admin có quyền sửa mọi đơn hàng chưa hoàn thành
        // C. Customer chỉ sửa đơn của mình VÀ phải đang Pending
        if (user_role !== 'Admin' && (check[0].customer_id !== user_id || orderStatus !== 'Pending')) {
            await connection.rollback();
            return res.status(403).json({ message: 'Bạn không có quyền sửa đơn hàng này.' });
        }

        // 2. Thực hiện cập nhật
        const query = `
            UPDATE orders 
            SET description = ?, delivery_address = ?, phone_number = ?, total_amount = ?
            WHERE id = ?;
        `;
        await connection.query(query, [description, address, phone, total || 0, id]);
        
        await connection.commit();
        res.status(200).json({ message: `Đơn hàng #${id} đã được cập nhật thành công.` });
    } catch (error) {
        await connection.rollback();
        console.error("LỖI SQL KHI CẬP NHẬT ĐƠN:", error);
        res.status(500).json({ message: "Lỗi hệ thống khi cập nhật đơn hàng." });
    } finally {
        connection.release();
    }
};
const deleteOrder = async (req, res) => {
    const { id } = req.params;
    const customer_id = req.user.id; 
    const user_role = req.user.role;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Kiểm tra tồn tại, quyền và trạng thái
        const [check] = await connection.query('SELECT customer_id, status FROM orders WHERE id = ?', [id]);
        
        if (check.length === 0) {
            await connection.rollback(); 
            return res.status(404).json({ message: 'Không tìm thấy đơn hàng này.' });
        }
        
        const orderStatus = check[0].status;
        const orderOwnerId = check[0].customer_id;

        // KIỂM TRA QUYỀN VÀ TRẠNG THÁI:
        // Admin có thể xóa mọi đơn hàng CHƯA hoàn thành/hủy.
        // Customer chỉ xóa đơn của mình VÀ phải đang Pending.
        
        if (orderStatus === 'Completed' || orderStatus === 'Cancelled') {
            await connection.rollback(); 
            return res.status(400).json({ message: 'Không thể xóa đơn hàng đã hoàn thành hoặc bị hủy.' });
        }
        
        // Nếu không phải Admin, PHẢI là chủ sở hữu VÀ trạng thái phải là Pending
        if (user_role !== 'Admin' && (orderOwnerId !== customer_id || orderStatus !== 'Pending')) {
            await connection.rollback(); 
            return res.status(403).json({ message: 'Bạn không có quyền xóa đơn hàng này.' });
        }

        // Xóa lịch sử giao hàng liên quan đến order_id này
        await connection.query('DELETE FROM deliveries WHERE order_id = ?', [id]);

        // 3. Thực hiện xóa ORDERS
        await connection.query('DELETE FROM orders WHERE id = ?', [id]);
        
        await connection.commit();
        res.status(200).json({ message: `Đơn hàng #${id} đã được xóa thành công.` });
    } catch (error) {
        await connection.rollback();
        console.error("LỖI SQL KHI XÓA ĐƠN:", error);
        // Trả về lỗi 500 nếu Transaction thất bại
        res.status(500).json({ message: "Lỗi hệ thống khi xóa đơn hàng. (Chi tiết lỗi SQL đã được ghi log)" });
    } finally {
        connection.release();
    }
};
const unassignShipper = async (req, res) => {
    const { id } = req.params;
    const manager_id = req.user.id; // Người thực hiện thao tác hủy

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Cập nhật bảng ORDERS: Xóa staff_id và manager_id, đưa về Pending
        const sql = `
            UPDATE orders 
            SET staff_id = NULL, manager_id = NULL, status = 'Pending' 
            WHERE id = ? AND status IN ('Assigned', 'In Progress') 
        `;
        const [updateResult] = await connection.query(sql, [id]);
        
        if (updateResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Không thể hủy. Đơn hàng không ở trạng thái Assigned hoặc In Progress.' });
        }

        // 2. 
        // Ta sử dụng manager_id cho staff_id trong bản ghi lịch sử, vì đây là người thực hiện hành động hủy.
        await connection.query(
            `INSERT INTO deliveries (order_id, staff_id, assigned_by, status) 
             VALUES (?, ?, ?, 'Cancelled')`, 
            [id, manager_id, manager_id] // ✨ ĐÃ BỔ SUNG staff_id (đặt bằng manager_id)
        );

        await connection.commit();
        res.json({ message: `Đơn hàng #${id} đã được hủy phân công thành công và chuyển về Pending.` });
    } catch (error) {
        await connection.rollback();
        console.error("Lỗi hủy phân công:", error);
        res.status(500).json({ message: "Lỗi hệ thống." });
    } finally {
        connection.release();
    }
};


module.exports = {
    createOrder, getMyOrders, getAllOrders, assignOrder, getAssignedTasks, updateOrderStatus,updateOrder, deleteOrder,unassignShipper
};