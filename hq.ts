import { prisma } from "./db";
import { HQ_DEFAULTS } from "./config";

/** Returns the active HQ geofence row, creating it from env defaults if absent. */
export async function getActiveHq() {
  let hq = await prisma.hqLocation.findFirst({ where: { active: true } });
  if (!hq) {
    hq = await prisma.hqLocation.create({
      data: {
        name: HQ_DEFAULTS.name,
        mapsUrl: HQ_DEFAULTS.mapsUrl,
        latitude: HQ_DEFAULTS.lat,
        longitude: HQ_DEFAULTS.lng,
        radiusM: HQ_DEFAULTS.radiusM,
        active: true,
      },
    });
  }
  return hq;
}
