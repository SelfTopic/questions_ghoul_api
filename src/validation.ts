import { z } from 'zod';
import { HttpError } from './errors';

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Некорректный формат email').max(254));

/** Parses the request body or throws a 400 with per-field messages. */
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    throw new HttpError(400, 'Неверные входные данные', z.flattenError(result.error).fieldErrors);
  }
  return result.data;
}
