/** @format */

// SETUP
const puppeteer = require("puppeteer-extra");
const { sql } = require("@vercel/postgres");
const { list } = require("@vercel/blob");
const axios = require("axios");
require("dotenv").config();

const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

function cleanCookies(cookies) {
    return cookies.map((cookie) => {
        const { partitionKey, sourceScheme, sourcePort, ...validCookieFields } = cookie;
        return validCookieFields;
    });
}

// LOGIN
async function login(page, blobs, email) {
    let url;
    for (let blob of blobs) {
        if (blob.pathname == `cookie-${email}.json`) {
            url = blob.downloadUrl;
            break;
        }
    }

    const cookiesPrevious = await axios.get(url).catch((error) => console.log(error));
    const cleaned = cleanCookies(cookiesPrevious.data);
    await page.setCookie(...cleaned);
    await page.goto("https://rewards.bing.com", { waitUntil: "networkidle0", timeout: 0 });
}

async function uploadScreenshot(page, email) {
    try {
        const screenshotBuffer = await page.screenshot({ type: "png" });
        const blob = new Blob([screenshotBuffer], { type: "image/png" });
        const formData = new FormData();

        // Append the file, cookiestring, and username
        formData.append("file", blob, "screenshot.png");
        formData.append("cookiestring", "false");
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

// MAIN
async function scrapeLogic(email, blobs) {
    const browser = await puppeteer.launch({
        args: ["--disable-setuid-sandbox", "--no-sandbox"],
        executablePath: process.env.NODE_ENV === "production" ? process.env.PUPPETEER_EXECUTABLE_PATH : puppeteer.executablePath(),
        headless: "new",
        // headless: false,
    });

    try {
        console.log(`Browser started for ${email}.`);

        const page = await browser.newPage();
        await page.setViewport({ width: 1600, height: 1024 });
        await page.setGeolocation({ latitude: 51, longitude: 3 });

        // Login
        await login(page, blobs, email);

        await page.goto("https://rewards.bing.com", { waitUntil: "networkidle0" });
        await page.waitForSelector("#daily-sets mee-card-group:first-of-type .c-card-content");

        // Remove popup (even if invisible)
        await page.$$eval("mee-rewards-pop-up", (els) => els?.forEach((el) => el.remove())).catch((e) => console.log(e));

        // Click daily and more rewards
        const reward_blocks = await page.$$("#daily-sets mee-card-group:first-of-type .c-card-content, #more-activities .c-card-content");
        const cards_hrefs = await page.$$eval(
            "#daily-sets mee-card-group:first-of-type .c-card-content a, #more-activities .c-card-content a",
            (cards) => cards.map((x) => x.getAttribute("href"))
        );

        for (let card_index in reward_blocks) {
            if (!cards_hrefs[card_index] || cards_hrefs[card_index].includes("bing.com/search")) {
                await reward_blocks[card_index].click();
                await page.bringToFront();
                console.log("clicked");
            } else {
                // console.log("skipped");
            }
        }

        // Search rewards
        await (await page.$("#dailypointColumnCalltoAction")).click();

        await page.waitForSelector("p[ng-bind-html='$ctrl.pointProgressText']", { visible: true });
        const pointsbreakdown = await page.$eval("p[ng-bind-html='$ctrl.pointProgressText']", (x) => x.innerHTML);
        const maxSearches = pointsbreakdown?.includes("/ 30") ? 10 : 30; // 3 points per search
        const search_href = await page.$eval("#userPointsBreakdown a[mee-hyperlink]", (x) => x.getAttribute("href"));
        await page.goto(search_href, { waitUntil: "networkidle0" });

        const words = await import("random-words").then((randomWords) => randomWords.generate(maxSearches));

        // search first word
        await page.waitForSelector("input#sb_form_q", { visible: true, timeout: 10000 });
        await page.type("input#sb_form_q", words[0]);
        await page.keyboard.press("Enter");

        await new Promise((resolve) => setTimeout(resolve, 2000));

        for (let word of words.slice(1)) {
            await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * (4000 - 3500 + 1) + 3500)));
            await page.goto(page.url().replace(/(q=)[^&]*/, `$1${word}`), { waitUntil: "networkidle0" });
            console.log(word);
        }

        await page.goto("https://rewards.bing.com", { waitUntil: "networkidle0" });
        await uploadScreenshot(page, email);

        const points = await page.$$eval("#rewardsBanner mee-rewards-counter-animation span", (points) => points.map((x) => x.innerHTML));
        await sql`UPDATE botaccounts SET last_collected=NOW(), points=${points[0]}, streak=${points[2]} WHERE email=${email}`;
    } catch (e) {
        console.error("Error while running bot:", e);
    } finally {
        await browser.close();
        console.log("closed");
    }
}

async function main() {
    const { rows } = await sql`SELECT * FROM botaccounts;`;
    const { blobs } = await list();

    for (let row of rows) {
        await scrapeLogic(row.email, blobs);
    }
}

main();
module.exports = { main };
