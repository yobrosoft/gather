import puppeteer from "puppeteer-core";

const base = process.env.GATHER_URL || "http://127.0.0.1:3857";
const executablePath =
  process.env.CHROME_PATH || "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const failures = [];

async function signIn(page, name, email) {
  await page.goto(base, { waitUntil: "networkidle2" });
  await page.waitForSelector("input[name=name]");
  await page.type("input[name=name]", name);
  await page.type("input[name=email]", email);
  await page.click("button::-p-text(Continue)");
  await page.waitForFunction((who) => document.body.innerText.includes(who), {}, name);
}

async function saveChurch(page, churchName, lat, lng) {
  await page.click("button::-p-text(Set up your church)");
  await page.waitForSelector("input[name=churchName]");
  await page.type("input[name=churchName]", churchName);
  await page.type("input[name=lat]", lat);
  await page.type("input[name=lng]", lng);
  await page.click("button::-p-text(Save church)");
  await page.waitForFunction((label) => document.body.innerText.includes(label), {}, churchName);
}

function text(page) {
  return page.evaluate(() => document.body.innerText);
}

try {
  const adaContext = await browser.createBrowserContext();
  const benContext = await browser.createBrowserContext();
  const ada = await adaContext.newPage();
  const ben = await benContext.newPage();
  ada.setDefaultTimeout(20000);
  ben.setDefaultTimeout(20000);

  const stamp = Date.now().toString(36);
  const adaChurch = `Ada Church ${stamp}`;
  const benChurch = `Ben Church ${stamp}`;
  await signIn(ada, "Ada", `ada-${stamp}@example.com`);
  await saveChurch(ada, adaChurch, "1.3000", "103.8000");
  await ada.waitForSelector("button::-p-text(Book Harbour Cinema)");
  await ada.click("button::-p-text(Book Harbour Cinema)");
  await ada.waitForSelector("input[name=capacity]");
  const capacity = await ada.$("input[name=capacity]");
  await capacity.click({ clickCount: 3 });
  await capacity.type("10");
  await ada.click("button::-p-text(Book this theatre)");
  await ada.waitForFunction((label) => document.body.innerText.includes(label), {}, `Hosted by ${adaChurch}`);
  const privateFill = await text(ada);
  if (!privateFill.includes("0 of 10 seats")) failures.push(`Ada fill missing: ${privateFill.slice(0, 400)}`);

  await signIn(ben, "Ben", `ben-${stamp}@example.com`);
  await saveChurch(ben, benChurch, "1.3500", "103.8500");
  await ben.waitForSelector("button::-p-text(Book Harbour Cinema)");
  const benPrivate = await text(ben);
  if (benPrivate.includes(`Hosted by ${adaChurch}`)) failures.push("Ben saw a private viewing");

  await ada.click("input[type=checkbox]");
  await ada.waitForFunction(() => document.body.innerText.includes("Other churches can find this on the map"));
  await ben.reload({ waitUntil: "networkidle2" });
  await ben.waitForFunction((label) => document.body.innerText.includes(label), {}, `Hosted by ${adaChurch}`);
  await ben.click(`button::-p-text(Hosted by ${adaChurch})`);
  await ben.waitForSelector("input[name=members]");
  const members = await ben.$("input[name=members]");
  await members.click({ clickCount: 3 });
  await members.type("2");
  const guests = await ben.$("input[name=guests]");
  await guests.click({ clickCount: 3 });
  await guests.type("1");
  await ben.click("button::-p-text(Join this viewing)");
  await ben.waitForFunction((label) => document.body.innerText.includes(label), {}, benChurch);
  const joined = await text(ben);
  if (!joined.includes("3 of 10 seats") && !joined.includes("2 members, 1 guest")) {
    failures.push(`Join did not fill: ${joined.slice(0, 500)}`);
  }
  if (!joined.includes(`Hosted by ${adaChurch}`)) failures.push("Host label disappeared after join");

  const membersAgain = await ben.$("input[name=members]");
  await membersAgain.click({ clickCount: 3 });
  await membersAgain.type("100");
  await ben.click("button::-p-text(Update your party)");
  await ben.waitForFunction(() => /seats are left|theatre is full/.test(document.body.innerText));

  await ada.click("input[type=checkbox]");
  await ada.waitForFunction(() => document.body.innerText.includes("This stays off the map"));
  await ben.reload({ waitUntil: "networkidle2" });
  await ben.waitForFunction(
    (label) => document.body.innerText.includes(label) && document.body.innerText.includes("Book a theatre"),
    {},
    benChurch,
  );
  const closed = await text(ben);
  if (closed.includes(`Hosted by ${adaChurch}`)) failures.push("Closed viewing stayed visible to Ben");

  await ada.reload({ waitUntil: "networkidle2" });
  await ada.waitForFunction((label) => document.body.innerText.includes(label), {}, `Hosted by ${adaChurch}`);
  await ada.click(`button::-p-text(Hosted by ${adaChurch})`);
  await ada.waitForFunction((label) => document.body.innerText.includes(label), {}, benChurch);
  const hostStill = await text(ada);
  if (!hostStill.includes(`Hosted by ${adaChurch}`)) failures.push("Host church changed");
} catch (error) {
  failures.push(error instanceof Error ? error.stack || error.message : String(error));
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(failures.join("\n\n"));
  process.exit(1);
}
console.log("smoke ok");
