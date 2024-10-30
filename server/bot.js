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
        const cookiesString = await fs.readFile("./server/cookies.json");
        const cookies = JSON.parse(cookiesString);

        await page.setCookie(...cookies);
    } catch (error) {
        console.log("No cookies saved yet. Login required!");
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
        headless: false,
    });

    try {
        console.log("Browser started.");

        const page = await browser.newPage();
        await page.setViewport({ width: 1080, height: 1024 });

        // Login
        await login(page);

        await page.goto("https://rewards.bing.com", { waitUntil: "networkidle0" });

        // Click daily rewards
        await page.waitForSelector("#daily-sets mee-card-group:first-of-type .c-card-content");
        /*const daily_rawards_block = await page.$$("#daily-sets mee-card-group:first-of-type .c-card-content");

        for (let card of daily_rawards_block) {
            // await card.click();
            await page.bringToFront();
            console.log("clicked");
        }

        // Click more rewards
        const more_rawards_block = await page.$$("#more-activities mee-card-group:first-of-type .c-card-content");

        for (let card of more_rawards_block) {
            if (card.$("a")?.href?.includes("bing.com/search")) {
                // await card.click();
                await page.bringToFront();
                console.log("clicked");
            }
        }*/

        // Search rewards
        await (await page.$("#dailypointColumnCalltoAction")).click();
        await page.waitForSelector("p[ng-bind-html='$ctrl.pointProgressText']", { visible: true });
        const pointsbreakdown = await page.$eval("p[ng-bind-html='$ctrl.pointProgressText']", (x) => x.innerHTML);
        const maxSearches = pointsbreakdown?.includes("/ 30") ? 10 : 30; // 3 points per search

        const search_href = await page.$eval("#userPointsBreakdown a[mee-hyperlink]", (x) => x.getAttribute("href"));
        await page.goto(search_href, { waitUntil: "networkidle0" });

        const words = await import("random-words").then((randomWords) => randomWords.generate(maxSearches));

        for (let word of words) {
            //TODO op accept cookies knp drukken, of testen met gwn naar link te gaan: bing.com/serarchq=...
            await page.waitForSelector("input#sb_form_q", { visible: true, timeout: 10000 });
            await page.evaluate((searchWord) => (document.querySelector("input#sb_form_q").value = searchWord), word);
            await new Promise((resolve) => setTimeout(resolve, 3500));
            await (await page.$("#sb_form_go")).click();
        }
    } catch (e) {
        console.error("Error while running bot:", e);
    } finally {
        await browser.close();
    }
};

scrapeLogic();
// module.exports = { scrapeLogic };
