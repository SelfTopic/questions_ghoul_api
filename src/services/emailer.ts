import * as dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

dotenv.config();

class Emailer {
    private transporter: Transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD, 
            },
        });
    }

    private validate_email(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    async sendCodeToEmail(toEmail: string, code: string): Promise<boolean> {
        if (!this.validate_email(toEmail)) {
            console.error(`❌ Некорректный email: ${toEmail}`);
            return false;
        }

        const mailOptions = {
            from: `"Questions Ghoul API" <${process.env.EMAIL_USER}>`,
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
            const info = await this.transporter.sendMail(mailOptions);
            console.log('✅ Письмо улетело! ID:', info.messageId);
            return true;
        } catch (error) {
            console.error('❌ Ошибка при отправке:', error);
            return false;
        }
    }
}

export default new Emailer(); 
