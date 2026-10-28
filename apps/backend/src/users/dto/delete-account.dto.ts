import { IsOptional, IsString, Equals } from 'class-validator';

/** Self-service account deletion (#111). Irreversible hard delete, like #104. */
export class DeleteAccountDto {
  /** Must be exactly "ELIMINAR" — guards against accidental clicks. */
  @Equals('ELIMINAR', { message: 'Escribe ELIMINAR para confirmar.' })
  confirmation!: string;

  /** Required when the account has a password (not OAuth-only). */
  @IsString()
  @IsOptional()
  password?: string;
}
