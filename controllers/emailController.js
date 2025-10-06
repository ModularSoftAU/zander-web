import dotenv from "dotenv";
import nodemailer from "nodemailer";
import ejs from "ejs";
import fs from "fs";
import path from "path";
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.smtpHost,
  port: process.env.smtpPort,
  secure: true,
  auth: {
    user: process.env.smtpUser,
    pass: process.env.smtpPass,
  },
});

export async function sendMail(
  recipient,
  subject,
  template,
  templateData = {}
) {
  const templatePath = path.resolve(
    "views",
    "partials",
    "email",
    template
  );

  const templateContent = fs.readFileSync(templatePath, "utf-8");
  const renderedTemplate = ejs.render(templateContent, templateData);

  const mailOptions = {
    from: `"${process.env.smtpIdentityDisplayName}" <${process.env.smtpIdentityEmailAddress}>`,
    to: recipient,
    subject: subject,
    html: renderedTemplate,
  };

  try {
    console.info(
      `[EMAIL] Sending template "${template}" to ${recipient} via ${process.env.smtpHost}:${process.env.smtpPort}`
    );

    const info = await transporter.sendMail(mailOptions);

    const messageId = info?.messageId ? ` (messageId: ${info.messageId})` : "";
    console.info(
      `[EMAIL] Successfully sent template "${template}" to ${recipient}${messageId}`
    );

    if (info?.rejected?.length) {
      console.warn(
        `[EMAIL] SMTP rejected the following recipients: ${info.rejected.join(", ")}`
      );
    }

    return info;
  } catch (error) {
    const message = error?.message || error;
    console.error(
      `[EMAIL] Failed to send template "${template}" to ${recipient}: ${message}`
    );

    if (error?.response) {
      console.error(`[EMAIL] SMTP response: ${error.response}`);
    }

    throw error;
  }
}


export default transporter;
