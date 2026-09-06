import nodemailer from "nodemailer";

let transporter = null;

function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return transporter;
}

export async function sendOtpEmail({ email, code, purpose }) {
  const transport = getTransporter();

  if (!transport) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS.");
    }

    console.log(`[DEV OTP] ${purpose} for ${email}: ${code}`);
    return;
  }

  try {
    const info = await transport.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Your ChatFlow verification code",
      text: `Your ChatFlow verification code is ${code}. It expires in 10 minutes.`,
      html: `
        <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:32px">
          <div style="max-width:520px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:32px">
            <h1 style="margin:0 0 8px;color:#312e81">ChatFlow</h1>
            <p style="color:#64748b">Use this one-time verification code to continue.</p>
            <div style="margin:28px 0;padding:18px;text-align:center;border-radius:14px;background:#eef2ff;color:#312e81;font-size:32px;font-weight:800;letter-spacing:8px">${code}</div>
            <p style="color:#64748b;font-size:13px">This code expires in 10 minutes. If you did not request it, you can safely ignore this email.</p>
          </div>
        </div>
      `,
    });

    console.log(`OTP email sent to ${email}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error("SMTP ERROR:", error);
    throw new Error("Unable to send OTP email. Check your SMTP credentials.");
  }
}
