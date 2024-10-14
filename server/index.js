/** @format */

const express = require("express");
const { scrapeLogic } = require("./bot");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 4000;

// const multer = require("multer");
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => cb(null, __dirname + "/public/uploads/"),
// });
// const upload = multer({ storage: storage });

// app.use(cors());
app.use("/", express.static(path.join(__dirname, "../public")));

// app.get("/", (req, res) => {
//     res.send("<p>homepage</p>");
// });

app.get("/scrape", async (req, res) => {
    await scrapeLogic(res);
});

// app.post("/upload", upload.single("file"), (req, res) => {
//     if (!req.body) {
//         return res.status(400).send("No image data received");
//     }

//     console.log(req.file);

//     //const imagePath = path.join(__dirname, "public", "screenshot.png");
//     res.status(200).send("Image uploaded and saved successfully").json(req.file);
// });

app.listen(PORT, () => console.log(`Server ready on port ${PORT}.`));
