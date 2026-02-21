import Redis from 'ioredis';

class RedisService {

    private redis: Redis = new Redis(process.env.REDIS_URL || '');

    async setVerificationCode (email: string, code: string) {
        await this.redis.set(`v_code:${email}`, code, 'EX', 300);
    };

    async getVerificationCode (email: string) {
        return await this.redis.get(`v_code:${email}`);
    };

    async deleteVerificationCode (email: string) {
        await this.redis.del(`v_code:${email}`);
    };

    async setAccessToken (token: string) {
        await this.redis.set(`a_token:${token}`, token, 'EX', 3600);
    };

    async getAccessToken (token: string) {
        return await this.redis.get(`a_token:${token}`);
    }
}

export default new RedisService();