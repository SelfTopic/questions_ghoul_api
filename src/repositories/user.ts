import { db } from '../database';
import { users } from '../database/models';
import { eq } from 'drizzle-orm';

export class UserRepository {
  static async findByEmail(email: string) {
    const result = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    return result[0];
  }

  static async create(email: string) {
    const [result] = await db.insert(users).values({ email }).returning();
    return result;
  }
}
