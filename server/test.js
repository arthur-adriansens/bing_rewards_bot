/** @format */
//const axios = require("axios");
const fs = require("fs").promises;
const FormData = require("form-data");

async function test() {
    const image = await fs.readFile("./public/uploads/screenshot.png");
    const formData = new FormData();
    formData.append("file", image, "screenshot.png");

    await axios
        .post("https://snapchat-bot-ruddy.vercel.app/upload", formData, {
            headers: formData.getHeaders(),
        })
        .then((res) => {
            console.log(res);
        })
        .catch((error) => {
            console.log(error);
        });
}

test();
