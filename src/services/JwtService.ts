import { jwtExpired, jwtSecret } from "../utils/env";
import jwt from "jsonwebtoken";

export type JwtPayload = {
  id: string;
  emailAddress: string;
  userName: string;
  accountNumber: string;
  identityNumber: string;
};

class JwtService {
  private secretKey: string;
  private expired: string;

  constructor(secretKey: string, expired = "1h") {
    this.secretKey = secretKey;
    this.expired = expired;
  }

  generateToken(payload: JwtPayload): string {
    const token = jwt.sign(payload, this.secretKey, {
      expiresIn: this.expired,
    });
    return token;
  }

  verifyToken(token: string) {
    const decoded = jwt.verify(token, this.secretKey);
    return decoded as JwtPayload;
  }
}

export default new JwtService(jwtSecret, jwtExpired);
