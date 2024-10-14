/** @format */

// SETUP
const puppeteer = require("puppeteer");
const prompt = require("prompt-sync")();
const fs = require("fs").promises;
//const axios = require("axios");

const streak_receivers = ["ELO A", "Alex Van Daele", "Arthur Hollevoet", "Klaas Goris"];
const streak_amount = streak_receivers.length;

// LOGIN
async function login(page) {
    await page.goto("https://accounts.snapchat.com/accounts/v2/login", { waitUntil: "networkidle0" });

    // set login coockies (if excists)
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

// SEND SNAP
async function send(page, streak_receivers) {
    await page.goto(`https://web.snapchat.com/u`, { waitUntil: "networkidle0" });

    // ignore notification popup
    await page.waitForSelector("svg.cV8g1", { visible: true, timeout: 5000 });
    await page.click("svg.cV8g1");

    // click camera
    await page.waitForSelector("button.qJKfS", { visible: true });
    await page.click("button.qJKfS");

    // wait for the video
    await page.waitForSelector("video.lnAeT:not(.nxGk4)", { visible: true });

    try {
        await page.waitForSelector("button.hZJL_", { visible: true, timeout: 5000 });
        await page.click("button.hZJL_");
    } catch (e) {
        await page.waitForSelector("button.gK0xL", { visible: true });
        await page.click("button.gK0xL");
    }

    await page.waitForSelector("button.fGS78", { visible: true });
    await page.click("button.fGS78");

    // select users
    let i = 1;
    for (let username of streak_receivers) {
        await page.waitForSelector(".OgvuO input.dmsdi", { visible: true });
        await page.type(".OgvuO input.dmsdi", username, { delay: 0 });

        await page.waitForSelector("ul.s7loS", { visible: true });
        await page.click("ul.s7loS > li:nth-child(2)");

        console.log(`  ${username} (${i}/${streak_amount})`);
        i += 1;
    }

    await page.click("button.TYX6O");
}

// MAIN
async function main() {
    // launch the browser and open a new blank page
    const browser = await puppeteer.launch({
        headless: false,
        //slowMo: 50,
        args: ["--use-fake-ui-for-media-stream"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1024 });

    // login
    await login(page);

    // try sending snaps
    await send(page, streak_receivers);
    await page.waitForSelector(".tPHQ9.BqyU7", { visible: true });

    await new Promise((resolve) => setTimeout(resolve, 2000));
    const image = await page.screenshot({ path: "./public/uploads/screenshot.png" });

    //const response = await axios.post("https://snapchat-bot-ruddy.vercel.app/upload", image).catch((error) => console.error(error));
    //console.log(response);

    console.log(streak_amount > 1 ? `Snaps sent to ${streak_amount} people.` : "Snap sent to 1 person.");
    await browser.close();
}

main();
