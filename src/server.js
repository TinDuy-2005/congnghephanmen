const express = require('express');
const app = express();
const path = require('path'); 
const cors = require('cors');
const dotenv = require('dotenv');

// Load .env variables
dotenv.config();

// Import các Routes API
const authRoutes = require('./routes/authRoutes'); // Thường chứa /login, /register, /staffs
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes'); // ✨ IMPORT ROUTES ADMIN MỚI

// --- MIDDLEWARE TOÀN CỤC ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

// --- CẤU HÌNH EJS ---
app.set('view engine', 'ejs'); 
app.set('views', path.join(__dirname, 'views')); 


// --- ROUTES GIAO DIỆN (UI) ---

// 1. Trang Đăng nhập
app.get('/login', (req, res) => {
    res.render('login');
});

// 2. Trang Đăng ký
app.get('/register', (req, res) => {
    res.render('register');
});

// 3. Trang Dashboard
app.get('/dashboard', (req, res) => {
    res.render('dashboard');
});

// --- ROUTES API (BACKEND) ---
app.get('/', (req, res) => {
    res.send("Server đang chạy. Truy cập /login để đăng nhập.");
});

// Đăng ký và phân nhóm Routes API
app.use('/api/auth', authRoutes);      // API: /api/auth/login, /api/auth/staffs, etc.
app.use('/api/orders', orderRoutes);    // API: /api/orders/create, /api/orders/all, etc.
app.use('/api/admin', adminRoutes);     // API: /api/admin/users, /api/admin/roles, etc. ✨

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server chạy tại http://localhost:${PORT}`);
});