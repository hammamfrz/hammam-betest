import { NextFunction, Request, Response } from "express";
import JwtService, { JwtPayload } from "../services/JwtService";
import { prisma } from "../utils/prisma";
import { Users } from "@prisma/client";

export type RequestWithUser = Request & {
  user: Users;
};

export async function auth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  try {
    const decoded = JwtService.verifyToken(token);
    const user = await prisma.users.findUniqueOrThrow({
      where: {
        id: decoded.id.toString(),
      },
    });

    (req as RequestWithUser).user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }
}
