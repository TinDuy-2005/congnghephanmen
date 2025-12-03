const mysql = require("mysql2");
const dotenv = require("dotenv")
dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: "root",
    password: process.env.PASS_DB,
    database: process.env.NAME_DB
});

// db.connect((err) => {
//     if (err) console.log("Lỗi kết nối DB:", err);
//     else console.log("Kết nối MySQL OK!");
// });

module.exports = pool.promise();
