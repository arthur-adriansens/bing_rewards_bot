/** @format */

const { put } = require("@vercel/blob");
const multer = require("multer");
const express = require("express");
const upload = multer();
const path = require("path");

module.exports = function (app) {
    // Middleware for handling `multipart/form-data`
    app.use("/api/upload", upload.single("file"));

    // API endpoint for image upload
    app.post("/api/upload", async (req, res) => {
        // `file` will be available at `req.file`, and other fields at `req.body`
        const { cookiestring, username } = req.body;
        if (!req.file || !username) {
            return res.status(400).json({ error: "No file or username uploaded" });
        }

        try {
            const fileName = `${cookiestring == "true" ? "cookie" : "image"}-${username}.png`;

            // Upload the file buffer
            const result = await put(fileName, req.file.buffer, {
                access: "public",
                addRandomSuffix: false,
                contentType: "image/png",
            });

            res.json(result);
        } catch (error) {
            console.error("Upload error:", error);
            res.status(500).json({ error: "Failed to upload file" });
        }
    });

    // Serve uploaded files statically
    app.use("/uploads", express.static(path.join(__dirname, "uploads")));
};
