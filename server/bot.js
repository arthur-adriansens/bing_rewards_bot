/** @format */

// SETUP
const puppeteer = require("puppeteer-extra");
const prompt = require("prompt-sync")();
const fs = require("fs").promises;
require("dotenv").config();

const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

// LOGIN
async function login(page) {
    // Set login coockies (if excists)
    try {
        console.log(process.env.test_cookies);
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

// MAIN
const scrapeLogic = async (res) => {
    const browser = await puppeteer.launch({
        args: ["--disable-setuid-sandbox", "--no-sandbox", "--single-process", "--no-zygote"],
        executablePath: process.env.NODE_ENV === "production" ? process.env.PUPPETEER_EXECUTABLE_PATH : puppeteer.executablePath(),
        // headless: false,
    });

    try {
        console.log("Browser started.");

        const page = await browser.newPage();
        await page.setViewport({ width: 1600, height: 1024 });

        // Login
        await login(page);

        await page.goto("https://rewards.bing.com", { waitUntil: "networkidle0" });

        // Click daily and more rewards
        await page.waitForSelector("#daily-sets mee-card-group:first-of-type .c-card-content");
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

        for (let word of words.slice(1)) {
            await new Promise((resolve) => setTimeout(resolve, 3500));
            await page.goto(page.url().replace(/(q=)[^&]*/, `$1${word}`), { waitUntil: "networkidle0" });
        }
    } catch (e) {
        console.error("Error while running bot:", e);
    } finally {
        await browser.close();
    }
};

scrapeLogic();
// module.exports = { scrapeLogic };
