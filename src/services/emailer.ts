import nodemailer, { Transporter } from 'nodemailer';
import config from '../config';

function createTransport(): Transporter {
  const { email } = config;
  if (email.transport === 'log') return nodemailer.createTransport({ jsonTransport: true });

  const auth = { user: email.user, pass: email.password };
  if (email.host) {
    return nodemailer.createTransport({
      host: email.host,
      port: email.port ?? 587,
      secure: email.secure ?? false,
      auth,
    });
  }
  return nodemailer.createTransport({ service: email.service, auth });
}

class Emailer {
  private transporter = createTransport();

  async sendCodeToEmail(toEmail: string, code: string): Promise<boolean> {
    const mailOptions = {
      from: config.email.from,
      to: toEmail,
      subject: 'Твой код верификации 🔥',
      text: `Привет! Твой код: ${code}`,
      html: `
                <div style="font-family: sans-serif; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #333;">Подтверждение почты</h2>
                    <p>Используйте этот код для завершения регистрации:</p>
                    <div style="background: #f4f4f4; padding: 10px; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 5px;">
                        ${code}
                    </div>
                    <p style="font-size: 12px; color: #777; margin-top: 20px;">Если вы не запрашивали этот код, просто проигнорируйте письмо.</p>
                </div>
            `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      if (config.email.transport === 'log') console.log(`📧 [log transport] код для ${toEmail}: ${code}`);
      return true;
    } catch (error) {
      console.error('❌ Ошибка при отправке письма:', (error as Error).message);
      return false;
    }
  }
}

export default new Emailer();
