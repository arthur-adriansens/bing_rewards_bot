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
const { v4: uuidv4 } = require("uuid");
const hbs = require("hbs");

// Setup express app
const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.use(nocache());
app.use(express.json());
app.use(cookieParser());
require(path.join(__dirname, "blobUpload.js"))(app);
app.use("/public", express.static(path.join(__dirname, "../public")));
app.set("view engine", "hbs");
// app.set("views", process.env.NODE_ENV === "production" ? "/var/task/server" : "./server");

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

app.get("/admin/bots", adminAuthMiddleware, async (req, res) => {
    const { rows } = await sql`SELECT * FROM botaccounts;`;
    return res.status(200).send(rows);
});

app.post("/admin/new_user", adminAuthMiddleware, async (req, res) => {
    if (!req.body?.username) {
        return res.status(400).send("Please fill in all fields.");
    }

    const result = await sql`INSERT INTO users (username) VALUES (${req.body.username});`;
    return res.status(200).send(result);
});

app.post("/admin/new_bot", adminAuthMiddleware, async (req, res) => {
    const { email, personal, username, password } = req.body;
    if (!email || (personal == undefined) | !username) {
        return res.status(400).send("Please fill in all fields");
    }

    // Check if user excist
    const user = await sql`SELECT * FROM users WHERE username = ${username};`;
    if (user.rowCount == 0) return res.status(400).send(`User ${username} doesn't excist.`);

    const result = await sql`INSERT INTO botaccounts (email, password, personal, username) VALUES (${email}, ${
        password || "unnecessary"
    }, ${personal},${username});`;
    return res.status(200).send(result);
});

app.post("/admin/remove_user", adminAuthMiddleware, async (req, res) => {
    const { id, bot } = req.body;
    if (!id) return res.status(400).send("Please fill in all fields");

    const query = bot ? sql`DELETE FROM botaccounts WHERE id = ${id}` : sql`DELETE FROM users WHERE id = ${id}`;

    const result = await query;
    return res.status(200).send(result);
});

app.post("/login", async (req, res) => {
    // CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(100), last_login TIMESTAMPTZ, auth_token TEXT);
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

const blobReadUrl = process.env.BLOB_READ_WRITE_TOKEN.replace("vercel_blob_rw_", "").split("_")[0];

app.get("/dashboard", authMiddleware, async (req, res) => {
    // CREATE TABLE botAccounts (id SERIAL PRIMARY KEY, email VARCHAR(100), password TEXT, username VARCHAR(50), personal BOOLEAN, last_collected TIMESTAMPTZ, points INTEGER, streak SMALLINT);
    const { rows: user } = await sql`UPDATE users SET last_login = NOW() WHERE id = ${req.cookies.id} RETURNING username;`;
    if (!user[0]?.username) return res.status(400).send("Database error. Please contact me for help.");

    const { rows: botAccount } = await sql`SELECT * FROM botaccounts WHERE username = ${user[0]?.username};`;

    for (let bot of botAccount) {
        bot.imageUrl = `https://${blobReadUrl}.public.blob.vercel-storage.com/image-${bot.email}.png`;
    }
    res.render("dashboard.hbs", { botAccount });
});

hbs.registerHelper("increment", (value) => {
    return parseInt(value) + 1;
});

hbs.registerHelper("formatDate", (value) => {
    const options = {
        timeZone: "Europe/Brussels",
        weekday: "short",
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "longOffset",
    };
    return new Date(value).toLocaleString("en-GB", options);
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
