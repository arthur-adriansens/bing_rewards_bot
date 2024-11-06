/** @format */

// SETUP
const puppeteer = require("puppeteer-extra");
const prompt = require("prompt-sync")();
const fs = require("fs").promises;
const path = require("path");
require("dotenv").config();

const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

// puppeteer usage as normal
puppeteer.launch({ headless: true }).then(async (browser) => {
    console.log("Running tests..");
    const page = await browser.newPage();
    await page.goto("https://bot.sannysoft.com");
    await page.waitForTimeout(5000);
    await page.screenshot({ path: "testresult.png", fullPage: true });
    await browser.close();
    console.log(`All done, check the screenshot. ✨`);
});

// LOGIN
async function login(page) {
    await page.goto(
        "https://login.live.com/login.srf?wa=wsignin1.0&rpsnv=163&id=264960&wreply=https%3a%2f%2fwww.bing.com%2fsecure%2fPassport.aspx%3fedge_suppress_profile_switch%3d1%26requrl%3dhttps%253a%252f%252fwww.bing.com%252fmsrewards%252fapi%252fv1%252fenroll%253fpubl%253dBINGIP%2526crea%253dML25SJ%2526pn%253dREWARDSHUB%2526partnerId%253dBingRewards%2526pred%253dtrue%2526sessionId%253d%2526ru%253dhttps%2525253A%2525252F%2525252Fwww.bing.com%2525252F%2525253FtoWww%2525253D1%25252526redig%2525253DF502E383F1E64E449CEB6F219E2B53C5%26sig%3d3061CF3B36526C9231FBDBFD373E6D96%26nopa%3d2&wp=MBI_SSL&lc=2057&CSRFToken=707bc56f-2bae-4370-8a16-06de2857630e&cobrandid=03c8bbb5-2dff-4721-8261-a4ccff24c81a&nopa=2&lw=1&fl=easi2",
        { waitUntil: "networkidle0" }
    );

    // Set login coockies (if excists)
    try {
        const cookiesString = await fs.readFile("./server/cookies.json");

        const cookies = JSON.parse(cookiesString);
        await page.setCookie(...cookies);
    } catch (error) {
        console.log("No cookies saved yet. Login required!");
        prompt("Please login manually. Press enter (in this console) when you're logged in.");

        const cookies = await page.cookies("https://accounts.snapchat.com");
        await fs.writeFile("./server/cookies.json", JSON.stringify(cookies));

        console.clear();
    }

    console.log("Sending snap to:");
}

// MAIN
const scrapeLogic = async (res) => {
    const browser = await puppeteer.launch({
        args: ["--disable-setuid-sandbox", "--no-sandbox", "--single-process", "--no-zygote"],
        executablePath: process.env.NODE_ENV === "production" ? process.env.PUPPETEER_EXECUTABLE_PATH : puppeteer.executablePath(),
        headless: false,
        slowMo: 50,
    });

    try {
        console.log("browser started success");

        const page = await browser.newPage();
        await page.setViewport({ width: 1080, height: 1024 });

        // Login
        await login(page);
    } catch (e) {
        console.error("Error while running bot:", e);
    } finally {
        await browser.close();
    }
};

// scrapeLogic();
// module.exports = { scrapeLogic };
