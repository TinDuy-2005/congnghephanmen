Dự án sử dụng Node.js + express +ejs + MySQL
Hướng Dẫn Chạy Project
1. MySQL Workbench
2. Tạo database tên: cnpm
3. Import file: db.sql nằm trong thư mục dự án
4. Cài đặt Node.js 
5. Chạy lệnh cài đặt:
   npm install
6. Cấu hình môi trường:
   Tạo file .env:
      JWT_SECRET= 231d6966a2286b8a09be9adf
      DB_HOST=localhost
      DB_USER=root
      DB_PASS=
      DB_NAME=cnpm

7. Chạy server:
   npm run dev

8. Chạy Unit Test:
   npm test

9. Truy cập giao diện login:
   http://localhost:3000/login


