/** @format */

// SETUP
const puppeteer = require("puppeteer-extra");
const prompt = require("prompt-sync")();
const fs = require("fs").promises;
const axios = require("axios");
const FormData = require("form-data");
require("dotenv").config();

const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

// LOGIN
async function login(page) {
    // Set login coockies (if excists)
    try {
        const cookiesString = process.env.TEST_COOKIES || (await fs.readFile("./server/cookies.json"));
        const cookies = JSON.parse(cookiesString);

        await page.setCookie(...cookies);
    } catch (error) {
        console.log("No cookies saved yet. Login required!");
        page.goto("https://rewards.bing.com", { waitUntil: "networkidle0", timeout: 0 });

        prompt("Please login manually. Press enter (in this console) when you're logged in.");

        const cookies = await page.cookies("https://rewards.bing.com");
        await fs.writeFile("./server/cookies.json", JSON.stringify(cookies));

        console.clear();
    }

    console.log("Ready to start earning!");
    return;
}

async function uploadScreenshot(page) {
    try {
        const screenshotBuffer = await page.screenshot({ type: "png" });
        const response = await axios.post("https://bing-rewards-bot.vercel.app/api/upload", screenshotBuffer, {
            headers: {
                "Content-Type": "image/png",
                accept: "application/json",
            },
        });
        console.log(response.data?.url);
    } catch (error) {
        console.error("Error uploading:", error.response?.data || error.message);
    }
}

// MAIN
const scrapeLogic = async (res) => {
    const browser = await puppeteer.launch({
        args: ["--disable-setuid-sandbox", "--no-sandbox", "--single-process", "--no-zygote"],
        executablePath: process.env.NODE_ENV === "production" ? process.env.PUPPETEER_EXECUTABLE_PATH : puppeteer.executablePath(),
        headless: "true",
    });

    try {
        console.log("Browser started.");

        const page = await browser.newPage();
        await page.setViewport({ width: 1600, height: 1024 });
        await page.setGeolocation({ latitude: 51, longitude: 3 });

        // Login
        await login(page);

        await page.goto("https://rewards.bing.com", { waitUntil: "networkidle0" });
        await page.waitForSelector("#daily-sets mee-card-group:first-of-type .c-card-content");

        // Remove popup (even if invisible)
        await page.$$eval("mee-rewards-pop-up", (els) => els?.forEach((el) => el.remove())).catch((e) => console.log(e));

        // Click daily and more rewards
        const reward_blocks = await page.$$("#daily-sets mee-card-group:first-of-type .c-card-content, #more-activities .c-card-content");
        const cards_hrefs = await page.$$eval("#daily-sets mee-card-group:first-of-type .c-card-content a, #more-activities .c-card-content a", (cards) => cards.map((x) => x.getAttribute("href")));

        for (let card_index in reward_blocks) {
            if (!cards_hrefs[card_index] || cards_hrefs[card_index].includes("bing.com/search")) {
                await reward_blocks[card_index].click();
                await page.bringToFront();
                console.log("clicked");
            } else {
                console.log("skipped");
            }
        }

        // Search rewards
        await (await page.$("#dailypointColumnCalltoAction")).click();

        await uploadScreenshot(page);

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
        console.log("test3");

        // for (let word of words.slice(1)) {
        //     await new Promise((resolve) => setTimeout(resolve, 3500));
        //     await page.goto(page.url().replace(/(q=)[^&]*/, `$1${word}`), { waitUntil: "networkidle0" });
        //     console.log(word);
        // }

        await browser.close();
        console.log("closed");
    } catch (e) {
        console.error("Error while running bot:", e);
    } finally {
        console.log("hi");
        // process.exit(0);
    }

    console.log("test4");
    process.exit(0);
};

scrapeLogic();
module.exports = { scrapeLogic };
