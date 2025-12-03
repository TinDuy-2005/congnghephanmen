const express = require('express');
const app = express();
const path = require('path'); // Thêm thư viện xử lý đường dẫn
const cors = require('cors');

// Import các Routes API cũ
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Để đọc dữ liệu form thông thường

// --- CẤU HÌNH EJS ---
app.set('view engine', 'ejs'); // Chọn EJS làm view engine
app.set('views', path.join(__dirname, 'views')); // Thư mục chứa file giao diện


// --- ROUTES GIAO DIỆN (UI) ---

// 1. Trang Đăng nhập
app.get('/login', (req, res) => {
    res.render('login');
});

// 2. Trang Đăng ký (THÊM MỚI)
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
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server chạy tại http://localhost:${PORT}`);
});