/** @format */

import { put } from "@vercel/blob";
const express = require("express");
const cors = require("cors");
const path = require("path");

// Initialize express app
const app = express();
const port = process.env.PORT || 3000;

// Set up CORS to allow requests from other domains
app.use(cors());

// Serve static files for the home page
app.use("/", express.static(path.join(__dirname, "../public")));

// API endpoint for image upload
app.use(express.raw({ type: "image/*", limit: "10mb" }));
app.post("/api/upload", async (req, res) => {
    if (!req.body || req.body.length === 0) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    try {
        const { url } = await put("uploaded-image", req.body, {
            access: "public",
        });

        res.json({ url });
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ error: "Failed to upload file" });
    }
});

// Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
