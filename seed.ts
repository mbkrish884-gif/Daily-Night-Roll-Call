import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { applyRoster } from "../src/lib/roster-service";
import { HQ_DEFAULTS } from "../src/lib/config";

const prisma = new PrismaClient();

// Sourced from the uploaded NIGHT.xlsx duty passport (29-05-2026).
// Names showed #ERROR! in the sheet (broken VLOOKUP) so unknown names are left
// blank for the admin to fill in. PC 4828 RAMESH was the only complete row.
const ROSTER_DATE = "2026-05-29";
const NIGHT_ENTRIES = [
  { slNo: 1, pcNumber: "11809", rank: "PC" },
  { slNo: 2, pcNumber: "10349", rank: "PC" },
  { slNo: 3, pcNumber: "13359", rank: "PC" },
  { slNo: 4, pcNumber: "11899", rank: "PC" },
  { slNo: 5, pcNumber: "13647", rank: "PC" },
  { slNo: 6, pcNumber: "11042", rank: "PC" },
  { slNo: 7, pcNumber: "11847", rank: "PC" },
  { slNo: 8, pcNumber: "13349", rank: "PC" },
  { slNo: 9, pcNumber: "12327", rank: "PC" },
  { slNo: 10, pcNumber: "4828", rank: "PC", name: "RAMESH", unit: "CIVIL", mobile: "7075107981" },
];

const INSTRUCTIONS =
  "You are hereby directed to report before the duty officer. After completion of the " +
  "above said bandobust duty they may be re-directed to Headquarters immediately.";

async function main() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_DEFAULT_PASSWORD || "ChangeMe@123";

  await prisma.user.upsert({
    where: { username },
    create: {
      username,
      name: "HQ Administrator",
      passwordHash: await hashPassword(password),
      role: "SUPERADMIN",
    },
    update: {},
  });
  console.log(`✔ Admin ready  ->  username: ${username}  password: ${password}`);

  const hq = await prisma.hqLocation.findFirst({ where: { active: true } });
  if (!hq) {
    await prisma.hqLocation.create({
      data: {
        name: HQ_DEFAULTS.name,
        mapsUrl: HQ_DEFAULTS.mapsUrl,
        latitude: HQ_DEFAULTS.lat,
        longitude: HQ_DEFAULTS.lng,
        radiusM: HQ_DEFAULTS.radiusM,
        active: true,
      },
    });
    console.log(
      `✔ HQ geofence seeded at ${HQ_DEFAULTS.lat}, ${HQ_DEFAULTS.lng} (r=${HQ_DEFAULTS.radiusM}m) ` +
        `— UPDATE to real HQ coords in Admin → Settings.`
    );
  }

  const result = await applyRoster({
    date: ROSTER_DATE,
    platoon: "NIGHT",
    rollCallTime: "19:00",
    instructions: INSTRUCTIONS,
    entries: NIGHT_ENTRIES,
    actorLabel: "system:seed",
  });
  console.log(`✔ Roster ${ROSTER_DATE}: ${result.created} PCs added, ${result.skippedDuplicates} skipped.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
