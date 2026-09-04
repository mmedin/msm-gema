/**
 * Validación de complejidad de contraseña para GEMA.
 *
 * Regla actual: mínimo 8 caracteres.
 * Se puede extender en el futuro para exigir mayúsculas, números, etc.
 */

export interface PasswordValidationResult {
  valid: boolean;
  message?: string;
}

const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(password: string): PasswordValidationResult {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'La contraseña es requerida' };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres (tiene ${password.length})`,
    };
  }

  return { valid: true };
}
