import nodemailer from "nodemailer";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM = "no-reply@yourapp.local",
} = process.env;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT ?? 587),
  secure: false, // true si 465
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const subject = "Réinitialisation de votre mot de passe";
  const text = `Bonjour,

Vous avez demandé la réinitialisation de votre mot de passe.
Cliquez sur le lien ci-dessous (valide 30 minutes) :

${resetUrl}

Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.`;

  const html = `
  <p>Bonjour,</p>
  <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
  <p>
    <a href="${resetUrl}">Cliquez ici pour réinitialiser votre mot de passe</a><br/>
    <small>(Le lien est valable 30 minutes)</small>
  </p>
  <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`;

  await transporter.sendMail({
    from: MAIL_FROM,
    to,
    subject,
    text,
    html,
  });
}
