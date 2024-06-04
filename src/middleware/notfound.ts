import { NextFunction, Request, Response } from "express";

export async function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  return res.status(404).json({
    message: "Not Found",
  });
}
