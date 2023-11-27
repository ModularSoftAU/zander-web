export async function generateVerificationCode() {
  return new Promise((resolve, reject) => {
    try {
      const code = Math.floor(100000 + Math.random() * 900000);
      resolve(code);
    } catch (error) {
      reject(error);
    }
  });
}