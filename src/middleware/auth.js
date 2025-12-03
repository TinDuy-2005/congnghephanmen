const jwt = require('jsonwebtoken');

// 1. Xác thực đăng nhập
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).send("Token is required");

    try {
        const decoded = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET);
        req.user = decoded; // Lưu thông tin user vào request
        next();
    } catch (err) {
        return res.status(401).send("Invalid Token");
    }
};

// 2. Kiểm tra Role (Cho phép truyền vào mảng các role được phép)
const checkRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Access Denied: You do not have permission." });
        }
        next();
    };
};

module.exports = { verifyToken, checkRole };