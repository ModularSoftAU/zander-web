import bcrypt from "bcrypt";
import db from "./databaseController.js";

export async function generateVerificationCode() {
  return new Promise((resolve, reject) => {
    try {
      const code = Math.floor(100000 + Math.random() * 900000);
      resolve(code.toString());
    } catch (error) {
      reject(error);
    }
  });
}

export async function createEmailVerification(userId, code, expiresAt) {
  const hashedCode = await bcrypt.hash(code, 10);

  return new Promise((resolve, reject) => {
    db.query(
      `DELETE FROM userEmailVerifications WHERE userId = ?`,
      [userId],
      function (deleteError) {
        if (deleteError) {
          return reject(deleteError);
        }

        db.query(
          `INSERT INTO userEmailVerifications (userId, codeHash, expiresAt) VALUES (?, ?, ?)`,
          [userId, hashedCode, expiresAt],
          function (error) {
            if (error) {
              return reject(error);
            }

            resolve(true);
          }
        );
      }
    );
  });
}

export async function verifyEmailCode(userId, code) {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT * FROM userEmailVerifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 1`,
      [userId],
      async function (error, results) {
        if (error) {
          return reject(error);
        }

        if (!results || !results.length) {
          return resolve({ valid: false });
        }

        const verification = results[0];

        if (verification.consumed) {
          return resolve({ valid: false, reason: "consumed" });
        }

        const expiryDate = new Date(verification.expiresAt);
        if (expiryDate < new Date()) {
          return resolve({ valid: false, reason: "expired" });
        }

        const match = await bcrypt.compare(code, verification.codeHash);

        if (!match) {
          return resolve({ valid: false, reason: "mismatch" });
        }

        db.query(
          `UPDATE userEmailVerifications SET consumed = 1, consumedAt = NOW() WHERE verificationId = ?`,
          [verification.verificationId],
          function (updateError) {
            if (updateError) {
              return reject(updateError);
            }

            resolve({ valid: true });
          }
        );
      }
    );
  });
}