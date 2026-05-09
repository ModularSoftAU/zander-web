import cron from "node-cron";
import zlib from "zlib";
import { quickshopDb } from "../controllers/databaseController.js";

// Extract the Minecraft item ID from a base64+gzip-encoded NBT binary.
// QuickShop-Hikari changed its storage format (around 2026-04-22, data id ~6000):
// old format: item column = plain YAML text ("item:\n  id: minecraft:bow\n ...")
// new format: item column = base64(gzip(NBT binary)) — same as the encoded column
// The item ID is stored as a TAG_String with key "id" inside the NBT compound.
function decodeNbtItemId(rawItem) {
  try {
    const buf = Buffer.from(rawItem, "base64");
    const nbt = zlib.gunzipSync(buf);
    // TAG_String = 0x08, followed by 2-byte key length, key bytes, 2-byte value length, value bytes
    // We look for the sequence: 0x08 0x00 0x02 'i' 'd'
    const pattern = Buffer.from([0x08, 0x00, 0x02, 0x69, 0x64]);
    const idx = nbt.indexOf(pattern);
    if (idx === -1) return null;
    const valueLen = nbt.readUInt16BE(idx + 5);
    const rawId = nbt.toString("utf8", idx + 7, idx + 7 + valueLen);
    return rawId.replace("minecraft:", "");
  } catch {
    return null;
  }
}

async function indexNewShopItems() {
  return new Promise((resolve) => {
    quickshopDb.query(
      `SELECT id, item FROM qs_data WHERE item NOT LIKE 'item:%' AND name IS NULL LIMIT 500`,
      (error, rows) => {
        if (error) {
          console.error("Shop item index query error:", error);
          return resolve(0);
        }
        if (!rows || rows.length === 0) return resolve(0);

        let completed = 0;
        let indexed = 0;
        const total = rows.length;

        for (const row of rows) {
          const itemId = decodeNbtItemId(row.item);
          if (!itemId) {
            // Mark as attempted with a placeholder so we don't retry forever
            quickshopDb.query(
              `UPDATE qs_data SET name = '' WHERE id = ? AND name IS NULL`,
              [row.id],
              () => { completed++; if (completed === total) resolve(indexed); }
            );
            continue;
          }
          quickshopDb.query(
            `UPDATE qs_data SET name = ? WHERE id = ? AND name IS NULL`,
            [itemId, row.id],
            (err) => {
              if (err) {
                console.error(`Shop index update error for data id=${row.id}:`, err);
              } else {
                indexed++;
              }
              completed++;
              if (completed === total) resolve(indexed);
            }
          );
        }
      }
    );
  });
}

// Run on startup to backfill existing unindexed rows
indexNewShopItems().then((n) => {
  if (n > 0) console.log(`Shop item index: backfilled ${n} item(s) on startup`);
});

// Run every 5 minutes to pick up newly created shops
cron.schedule("*/5 * * * *", () => {
  indexNewShopItems().then((n) => {
    if (n > 0) console.log(`Shop item index: indexed ${n} new item(s)`);
  });
});
