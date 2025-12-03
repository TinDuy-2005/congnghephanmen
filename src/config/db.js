const mysql = require("mysql2");

const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "Tin008899@",
    database: "cnpm"
});

// db.connect((err) => {
//     if (err) console.log("Lỗi kết nối DB:", err);
//     else console.log("Kết nối MySQL OK!");
// });

module.exports = pool.promise();
