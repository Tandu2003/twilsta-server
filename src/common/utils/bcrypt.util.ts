import * as bcrypt from 'bcrypt';

export class BcryptUtil {
  static async hash(
    password: string,
    saltRounds: number = 10,
  ): Promise<string> {
    return bcrypt.hash(password, saltRounds);
  }

  static async compare(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  static async genSalt(saltRounds: number = 10): Promise<string> {
    return bcrypt.genSalt(saltRounds);
  }
}
