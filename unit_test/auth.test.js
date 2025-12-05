const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');

// Mock DB
jest.mock('../src/config/db', () => ({
    query: jest.fn(),
    getConnection: jest.fn()
}));

const db = require('../src/config/db');

// Tạo app express để test router
const app = express();
app.use(express.json());

// Import router
const authRouter = require('../src/routes/authRoutes');
app.use('/api/auth', authRouter);

// Mock JWT SECRET
process.env.JWT_SECRET = "TEST_SECRET";

// ---- TEST CASES ----
describe("Auth API: /login", () => {

    test("1. Đăng nhập thành công → 200 + token", async () => {
        // fake user trong DB
        db.query.mockResolvedValueOnce([[
            {
                id: 1,
                username: "tinduy",
                password: await bcrypt.hash("123456", 10),
                is_active: 1,
                role_name: "Admin"
            }
        ]]);

        const res = await request(app)
            .post("/api/auth/login")
            .send({ username: "tinduy", password: "123456" });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.username).toBe("tinduy");
        expect(res.body.role).toBe("Admin");
    });

    test("2. Tài khoản bị khóa → 403", async () => {
        db.query.mockResolvedValueOnce([[
            {
                id: 2,
                username: "locked",
                password: await bcrypt.hash("123456", 10),
                is_active: 0,
                role_name: "Staff"
            }
        ]]);

        const res = await request(app)
            .post("/api/auth/login")
            .send({ username: "locked", password: "123456" });

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/khóa/i);
    });

    test("3. Sai mật khẩu → 401", async () => {
        db.query.mockResolvedValueOnce([[
            {
                id: 3,
                username: "wrongpass",
                password: await bcrypt.hash("123456", 10), 
                is_active: 1,
                role_name: "Staff"
            }
        ]]);

        const res = await request(app)
            .post("/api/auth/login")
            .send({ username: "wrongpass", password: "000000" });

        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/Mật khẩu không chính xác/);
    });

    test("4. User không tồn tại → 404", async () => {
        db.query.mockResolvedValueOnce([[]]); // trả về rỗng

        const res = await request(app)
            .post("/api/auth/login")
            .send({ username: "ghost", password: "123" });

        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/không tồn tại/i);
    });

});
