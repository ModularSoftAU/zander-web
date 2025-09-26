import dotenv from "dotenv";
import nodemailer from "nodemailer";
import ejs from "ejs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
dotenv.config();

const smtpHost = process.env.smtpHost || "mail.smtp2go.com";
const smtpPort = Number(process.env.smtpPort || 587);

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  requireTLS: smtpPort !== 465,
  connectionTimeout: 1000 * 15,
  greetingTimeout: 1000 * 15,
  socketTimeout: 1000 * 20,
  auth: {
    user: process.env.smtpUser,
    pass: process.env.smtpPass,
  },
});

const smtpIdentityEmail = process.env.smtpIdentityEmailAddress;
const smtpIdentityName =
  process.env.smtpIdentityDisplayName || process.env.siteName || "Zander";
const smtpCredentialsConfigured = Boolean(
  process.env.smtpUser && process.env.smtpPass && smtpIdentityEmail
);

const missingSmtpFields = [];
if (!process.env.smtpUser) missingSmtpFields.push("smtpUser");
if (!process.env.smtpPass) missingSmtpFields.push("smtpPass");
if (!smtpIdentityEmail) missingSmtpFields.push("smtpIdentityEmailAddress");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templateRoot = path.join(__dirname, "..", "views", "emails");

async function renderTemplate(templateName, data) {
  const templatePath = path.join(templateRoot, templateName);
  const template = await fs.promises.readFile(templatePath, "utf-8");
  return ejs.render(template, data, { async: true, filename: templatePath });
}

export async function sendMail(recipient, subject, templateName, templateData) {
  if (!smtpCredentialsConfigured) {
    throw new Error("SMTP credentials are not fully configured");
  }

  const renderedTemplate = await renderTemplate(templateName, templateData);

  const mailOptions = {
    from: `"${smtpIdentityName}" <${smtpIdentityEmail}>`,
    to: recipient,
    subject: subject,
    html: renderedTemplate,
  };

  return transporter.sendMail(mailOptions);
}

export async function sendEmailVerificationMail(email, username, verifyUrl) {
  const subject = "Verify your email address";
  return sendMail(email, subject, "verify-email.ejs", {
    username,
    verifyUrl,
    siteName: process.env.siteName || process.env.smtpIdentityDisplayName,
  });
}

export async function sendPasswordResetMail(email, username, resetUrl) {
  const subject = "Reset your password";
  return sendMail(email, subject, "reset-password.ejs", {
    username,
    resetUrl,
    siteName: process.env.siteName || process.env.smtpIdentityDisplayName,
  });
}

export function isEmailServiceConfigured() {
  return smtpCredentialsConfigured;
}

export function getEmailConfigurationIssues() {
  if (smtpCredentialsConfigured) {
    return [];
  }
  return missingSmtpFields;
}

export default transporter;
