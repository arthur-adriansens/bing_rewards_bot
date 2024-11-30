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
    // await page.goto("https://rewards.bing.com", { waitUntil: "networkidle0", timeout: 0 });
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

async function getActivePage(browser, timeout) {
    var start = new Date().getTime();
    while (new Date().getTime() - start < timeout) {
        var pages = await browser.pages();
        var arr = [];
        for (const p of pages) {
            if (
                await p.evaluate(() => {
                    return document.visibilityState == "visible";
                })
            ) {
                arr.push(p);
            }
        }
        if (arr.length == 1) return arr[0];
    }
    throw "Unable to get active page";
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
        console.log(`Browser started for ${email} at ${new Date().toLocaleTimeString()}.`);

        const page = await browser.newPage();
        await page.setViewport({ width: 1600, height: 1024 });
        await page.setGeolocation({ latitude: 51, longitude: 3 });

        // Login
        await login(page, blobs, email);

        await page.goto("https://rewards.bing.com");
        await page.waitForSelector("#daily-sets mee-card-group:first-of-type .c-card-content", { timeout: 10_000 });

        // Remove popup (even if invisible)
        await page.$$eval("mee-rewards-pop-up", (els) => els?.forEach((el) => el.remove())).catch((e) => console.log(e));

        // Click daily and more rewards
        const pointsbreakdown = await page.$eval("#meeGradientBanner > div > div > div > p", (x) => x.innerHTML).catch(() => undefined);
        const maxSearches = pointsbreakdown.includes("Level 2") ? 30 : 10;

        const reward_blocks = await page.$$(
            "#daily-sets mee-card-group:first-of-type .c-card-content:has(.mee-icon-AddMedium), #more-activities .c-card-content:has(.mee-icon-AddMedium)"
        );
        const cards_hrefs = await page.$$eval(
            "#daily-sets mee-card-group:first-of-type .c-card-content a:has(.mee-icon-AddMedium), #more-activities .c-card-content a:has(.mee-icon-AddMedium)",
            (cards) => cards.map((x) => x.getAttribute("href"))
        );

        let counter = 0;
        for (let card_index in reward_blocks) {
            if (!cards_hrefs[card_index] || cards_hrefs[card_index].includes("bing.com/search")) {
                await reward_blocks[card_index].click();
            } else if (cards_hrefs[card_index].includes("bing.com/?form")) {
                console.log("Filling in form...");

                const newPage = await getActivePage(browser, 10000);
                await newPage.waitForSelector("input.rqOption", { visible: true, timeout: 10000 });
                console.log("Found first button.");

                for (let i = 0; i < 9; i++) {
                    try {
                        await newPage.waitForSelector("input.rqOption", { visible: true, timeout: 10000 });
                        await (await newPage.$("input.rqOption:not(.optionDisable)")).click();
                        console.log("clicked option " + i);
                    } catch (e) {
                        break;
                    }
                }

                console.log("done");
            }

            await page.bringToFront();
            counter++;
        }
        console.log(`Clicked ${counter} times.`);

        // Search rewards
        await (await page.$("#dailypointColumnCalltoAction")).click();
        await page.waitForSelector("p[ng-bind-html='$ctrl.pointProgressText']", { visible: true });
        const search_href = await page.$eval("#userPointsBreakdown a[mee-hyperlink]", (x) => x.getAttribute("href"));
        await page.goto(search_href, { waitUntil: "networkidle0" });

        const words = await import("random-words").then((randomWords) => randomWords.generate(maxSearches));

        // search first word
        await page.waitForSelector("input#sb_form_q", { visible: true, timeout: 10000 });
        await page.type("input#sb_form_q", words[0]);
        await page.keyboard.press("Enter");
        console.log(words[0]);

        await new Promise((resolve) => setTimeout(resolve, 2000));
        for (let word of words.slice(1)) {
            await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * (7000 - 6000 + 1) + 6000)));
            await page.goto(page.url().replace(/(q=)[^&]*/, `$1${word}`), { waitUntil: "networkidle0" });
            console.log(word);
        }

        // Upload results to db
        await page.goto("https://rewards.bing.com/pointsbreakdown", { waitUntil: "networkidle0" });
        await uploadScreenshot(page, email);

        await page.goto("https://rewards.bing.com/", { waitUntil: "networkidle0" });
        const points = await page.$$eval("#rewardsBanner mee-rewards-counter-animation span", (points) =>
            points.map((x) => x.innerHTML.replace(",", ""))
        );
        await sql`UPDATE botaccounts SET last_collected=NOW(), points=${points[0]}, streak=${points[2]} WHERE email=${email}`;
    } catch (e) {
        console.error("Error while running bot:", e);
    } finally {
        await browser.close();
        console.log("closed");
    }
}

async function main() {
    const { rows } = process.argv[2]
        ? await sql`SELECT * FROM botaccounts WHERE id=${process.argv[2]};`
        : await sql`SELECT * FROM botaccounts WHERE server=${process.env.SERVER};`;
    const { blobs } = await list();

    console.log(`Server number: ${process.env.SERVER}`);
    for (let row of rows) {
        await scrapeLogic(row.email, blobs);
    }
}

main();
module.exports = { main };
