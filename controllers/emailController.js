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
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.log("Error occurred", error);
    throw error;
  }
}


export default transporter;
