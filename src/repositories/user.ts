import { db } from '../database';
import { users } from '../database/models';
import { eq } from 'drizzle-orm';

export class UserRepository {
  static async findByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  /** Race-safe: concurrent calls for the same email return the same row. */
  static async findOrCreate(email: string) {
    const [user] = await db
      .insert(users)
      .values({ email })
      .onConflictDoUpdate({ target: users.email, set: { email } })
      .returning();
    return user;
  }
}
