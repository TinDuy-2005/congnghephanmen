// src/middleware/role.js

/**
 * Middleware kiểm tra vai trò của người dùng.
 * @param {Array<string>} roles - Mảng các tên vai trò được phép (ví dụ: ['Admin', 'Manager'])
 */
const checkRole = (roles) => {
    return (req, res, next) => {
        // 1. Kiểm tra xem thông tin User và Role đã được đính kèm chưa
        // (Đây là dấu hiệu cho thấy verifyToken đã chạy)
        if (!req.user || !req.user.role) {
            // Trường hợp này xảy ra nếu middleware bị gọi sai thứ tự hoặc thiếu token
            return res.status(403).json({ message: "Access Denied. User role information is missing." });
        }
        
        const userRole = req.user.role;

        // 2. Kiểm tra xem vai trò của người dùng có nằm trong danh sách cho phép không
        if (roles.includes(userRole)) {
            next(); // Vai trò được phép, tiếp tục
        } else {
            // 3. Nếu không có quyền (403: Forbidden)
            return res.status(403).json({ message: "Access Denied: You do not have the required role." });
        }
    };
};

module.exports = checkRole;