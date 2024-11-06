/** @format */

import { put } from "@vercel/blob";

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

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
