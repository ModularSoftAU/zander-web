import dotenv from "dotenv";
import nodemailer from "nodemailer";
import ejs from "ejs";
import fs from "fs";
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
  subject
) {
  const emailTemplate = ejs.compile(
    fs.readFileSync("./views/partials/email/emailTemplate.ejs", "utf-8")
  );
  const renderedTemplate = emailTemplate({ username: "John" });

  const mailOptions = {
    from: `"${process.env.smtpIdentityDisplayName}" <${process.env.smtpIdentityEmailAddress}>`, // sender address
    to: recipient, // list of receivers
    subject: subject, // Subject line
    html: renderedTemplate,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log("Error occurred", error);
    } else {
      return console.log("Email sent", info.response);
    }
  });
}


export default transporter;
