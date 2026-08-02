import { z } from 'zod';

export const IdSchema = z.string().uuid();

export function esUuidValido(id: string): boolean {
  return IdSchema.safeParse(id).success;
}
