/** @format */

const { sql } = require("@vercel/postgres");
const express = require("express");
const cors = require("cors");
const nocache = require("nocache");
const path = require("path");
const cookieParser = require("cookie-parser");
if (process.env.NODE_ENV !== "production") {
    require("dotenv").config(path.resolve(process.cwd(), ".env"));
}
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

// Setup express app
const app = express();
const port = process.env.PORT || 3000;
const saltRounds = 10;
app.use(cors());
app.use(nocache());
app.use(express.json());
app.use(cookieParser());
app.use("/public", express.static(path.join(__dirname, "../public")));

async function authMiddleware(req, res, next) {
    if (!req.cookies.auth || !req.cookies.id) {
        return res.status(401).redirect("/");
    }

    // Check if token matches user id
    const { rows } = await sql`SELECT auth_token FROM users WHERE id = ${req.cookies.id}`;
    if (rows.length == 0 || req.cookies.auth != rows[0].auth_token) return res.status(401).redirect("/");

    next();
}

async function adminAuthMiddleware(req, res, next) {
    if (req.cookies.key != process.env.ADMIN_KEY) {
        return res.status(403).send("access denied");
    }

    next();
}
// Ports
app.get("/", (req, res) => {
    if (!req.cookies.auth || !req.cookies.id) {
        return res.sendFile(path.join(__dirname, "../public", "login.html"));
    }

    return res.status(200).redirect("/dashboard");
});

app.get("/admin", async (req, res) => {
    // res.cookie("key", process.env.ADMIN_KEY, { path: "/admin", secure: true, httpOnly: true });
    if (req.cookies.key != process.env.ADMIN_KEY) {
        return res.status(403).sendFile(path.join(__dirname, "../public", "admin_error.html"));
    }
    return res.status(200).sendFile(path.join(__dirname, "admin.html"));
});

app.get("/admin/users", adminAuthMiddleware, async (req, res) => {
    const { rows } = await sql`SELECT * FROM users;`;
    return res.status(200).send(rows);
});

app.post("/admin/new_user", adminAuthMiddleware, async (req, res) => {
    if (!req.body || !req.body.username || !req.body.email) {
        return res.status(400).send("Please fill in all fields");
    }

    // Check if email excist in bot botaccounts
    const { rows } = await sql`SELECT * FROM botaccounts WHERE email = ${req.body.email};`;
    // if (rows)

    const result = await sql`INSERT INTO users (username, email, auth_token) VALUES (${req.body.username}, ${req.body.email}, ${auth_token});`;
    return res.status(200).send(result);
});

app.post("/admin/new_bot", adminAuthMiddleware, async (req, res) => {
    if (!req.body || !req.body.email || !req.body.password || req.body.personal == undefined) {
        return res.status(400).send("Please fill in all fields");
    }

    const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
    const result = await sql`INSERT INTO botaccounts (email, password_hash, personal) VALUES (${req.body.email}, ${hashedPassword}, ${personal});`;
    return res.status(200).send(result);
});

app.post("/admin/remove_user", adminAuthMiddleware, async (req, res) => {
    if (!req.body?.username) return res.status(400).send("Please fill in all fields");
    const result = await sql`DELETE FROM users WHERE username=${req.body.username};`;
    return res.status(200).send(result);
});

app.post("/login", async (req, res) => {
    // CREATE TABLE users (id SERIAL PRIMARY KEY, username VARCHAR(50) NOT NULL, email VARCHAR(100), last_login TIMESTAMPTZ, auth_token TEXT);
    if (!req.body || !req.body.name || !req.body.password) {
        return res.status(400).send("Please fill in all fields");
    }

    // Check if the user is an admin
    if (req.body.name === "admin") {
        if (req.body.password !== process.env.ADMIN_KEY) {
            return res.status(400).send("Wrong password. Please contact me for help.");
        }

        // If authentication is successful, set a cookie or session token
        res.cookie("key", process.env.ADMIN_KEY, { httpOnly: true, secure: true });
        return res.status(200).redirect("/admin");
    }

    // Check if the regular user password matches
    if (req.body.password !== process.env.DASHBOARD_LOGIN_PASS) {
        return res.status(400).send("Wrong password. Please contact me for help.");
    }

    // Authentication successful
    const user = await sql`SELECT * FROM users WHERE username = ${req.body.name};`;
    if (user.rowCount == 0) return res.status(400).send("User doesn't excist. Please contact me for help.");

    let token = user.rows[0]?.auth_token;

    if (!token) {
        token = uuidv4();
        sql`UPDATE users SET auth_token = ${token} WHERE username = ${req.body.name}`;
    }

    res.cookie("auth", token, { httpOnly: true, secure: true });
    res.cookie("id", user.rows[0].id);
    res.status(200).redirect("/dashboard");
});

app.post("/logout", async (req, res) => {
    res.clearCookie("auth");
    res.clearCookie("id");
    res.status(200).redirect("/");
});

app.get("/dashboard", authMiddleware, async (req, res) => {
    // CREATE TABLE botAccounts (id SERIAL PRIMARY KEY, email VARCHAR(100), password_hash TEXT, personal BOOLEAN, last_collected TIMESTAMPTZ, points INTEGER, streak SMALLINT);
    const { rows: bot_email } = await sql`UPDATE users SET last_login = NOW() WHERE id = ${req.cookies.id} RETURNING email;`;
    if (!bot_email[0]?.email) return res.status(400).send("Database error. Please contact me for help.");

    const { rows: botAccount } = await sql`SELECT * FROM botaccounts WHERE email = ${bot_email[0]?.email};`;
    console.log(botAccount);
    return res.sendFile(path.join(__dirname, "dashboard.html"));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
