/** @format */

const { sql } = require("@vercel/postgres");
const express = require("express");
const cors = require("cors");
const path = require("path");

// Setup express app
const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "../public")));

// Ports
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../public", "login.html"));
});

app.get("/admin", async (req, res) => {
    const key = req.headers.cookie;
    // res.cookie("key", process.env.ADMIN_KEY, { path: "/admin", secure: true, httpOnly: true });

    if (!key || !key.includes(`key=${process.env.ADMIN_KEY}`)) {
        return res.status(403).sendFile(path.join(__dirname, "../public", "admin_error.html"));
    }
    return res.status(200).sendFile(path.join(__dirname, "admin.html"));
});

app.get("/admin/users", async (req, res) => {
    const key = req.headers.cookie;
    if (!key || !key.includes(`key=${process.env.ADMIN_KEY}`)) {
        return res.status(403).send("access denied");
    }

    const { rows } = await sql`SELECT * FROM users;`;
    return res.status(200).send(rows);
});

app.post("/admin/new_user", async (req, res) => {
    const key = req.headers.cookie;
    console.log(key);
    if (!key || !key.includes(`key=${process.env.ADMIN_KEY}`)) {
        return res.status(403).send("access denied");
    }

    if (!req.body || !req.body.username || !req.body.email || req.body.personal == undefined) return res.status(400).send("Please fill in all fields");
    const result = await sql`INSERT INTO users (username, email, personal) VALUES ('${req.body.username}', '${req.body.email}', TRUE) RETURNING * FROM users;`;
    return res.status(200).send(result);
});

app.post("/login", async (req, res) => {
    // CREATE TABLE users (id SERIAL PRIMARY KEY, username VARCHAR(50) NOT NULL, email VARCHAR(100), personal BOOLEAN, last_login TIMESTAMP, auth_token TEXT);
    if (!req.body || !req.body.name || !req.body.password) return res.status(400).send("Please fill in all fields");
    if (req.body.password != process.env.DASHBOARD_LOGIN_PASS) return res.status(400).send("Wrong password.");

    const { test } = await sql`SELECT * FROM users WHERE username = ${req.body.name};`;
    const { test2 } = await sql`SELECT auth_token FROM users WHERE username = ${req.body.name};`;

    res.status(200).send(`success: ${test}, also: ${test2}`);
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
