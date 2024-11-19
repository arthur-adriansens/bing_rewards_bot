/** @format */

// SETUP
const puppeteer = require("puppeteer-extra");
const { sql } = require("@vercel/postgres");
const { list } = require("@vercel/blob");
const prompt = require("prompt-sync")();
const axios = require("axios");
require("dotenv").config();

const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

async function uploadJson(data, email) {
    try {
        const jsonBlob = new Blob([JSON.stringify(data)], { type: "application/json" });
        const formData = new FormData();

        // Append the file, cookiestring, and username
        formData.append("file", jsonBlob, "data.json");
        formData.append("cookiestring", "true");
        formData.append("username", email);

        // Send the FormData with axios
        const response = await axios.post("https://bing-rewards-bot.vercel.app/api/upload", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
                accept: "application/json",
            },
        });
        console.log(response.data?.url);
    } catch (error) {
        console.error("Error uploading:", error.response?.data || error.message);
    }
}

// LOGIN
async function login(page, email) {
    const { blobs } = await list();
    let url;
    for (let blob of blobs) {
        if (blob.pathname == `cookie-${email}.json`) {
            url = blob.downloadUrl;
            break;
        }
    }

    let setcookies = true;
    const cookiesPrevious = await axios.get(url).catch((error) => {
        console.log("cookies don't excist yet");
        setcookies = false;
    });
    if (setcookies) await page.setCookie(...cookiesPrevious.data);

    const { rows } = await sql`SELECT password FROM botaccounts WHERE email=${email}`;

    await page.goto("https://rewards.bing.com", { waitUntil: "networkidle0", timeout: 0 });
    prompt(`Please login user ${email} with password ${rows[0].password} Press enter (in this console) when you're logged in.`);

    const cookies = await page.cookies("https://rewards.bing.com", "https://bing.com");
    await uploadJson(cookies, email);
    console.log(`Updated ${email} succesfully!`);
    // console.clear();
    return;
}

// MAIN
async function scrapeLogic(email) {
    const browser = await puppeteer.launch({
        args: ["--disable-setuid-sandbox", "--no-sandbox"],
        executablePath: process.env.NODE_ENV === "production" ? process.env.PUPPETEER_EXECUTABLE_PATH : puppeteer.executablePath(),
        //headless: true,
        headless: false,
    });

    try {
        console.log("Browser started.");

        const page = await browser.newPage();
        await page.setViewport({ width: 800, height: 400 });
        await page.setGeolocation({ latitude: 51, longitude: 3 });

        // Login
        await login(page, email);
    } catch (e) {
        console.error("Error while running bot:", e);
    } finally {
        await browser.close();
        console.log("closed");
    }
}

async function update() {
    const { rows } = await sql`SELECT * FROM botaccounts;`;
    // await scrapeLogic(rows[1].email);

    for (let row of rows) {
        await scrapeLogic(row.email);
    }
}

update();
module.exports = { update };
