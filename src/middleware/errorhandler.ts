import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

async function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  let error = { ...err };

  if (err instanceof ZodError) {
    // convert zod error to string message
    const message = err.issues
      .map((issue) => {
        const path = issue.path[issue.path.length - 1];
        return `${path} ${issue.message}`;
      })
      .join(", ");

    error.message = message;
    error.statusCode = 400;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    error = handlePrismaError(err);
  } else {
    error.message = err.message;
    error.statusCode = err.statusCode || 500;
  }

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(error, req, res);
  } else {
    sendErrorProd(error, req, res);
  }
}

const handlePrismaError = (err: any) => {
  switch (err.code) {
    case "P2002":
      // handling duplicate key errors
      return new Error(`Duplicate field value: ${err.meta.target}`);
    case "P2014":
      // handling invalid id errors
      return new Error(`Invalid ID: ${err.meta.target}`);
    case "P2003":
      // handling invalid data errors
      return new Error(`Invalid input data: ${err.meta.target}`);
    case "P2025":
      // handling invalid relation errors
      return new Error(err.meta?.cause || "Invalid relation");
    default:
      // handling all other errors
      return new Error(`Something went wrong: ${err.message}`);
  }
};

const sendErrorProd = (err: any, req: Request, res: Response) => {
  console.error("ERROR 💥", err);

  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";
  return res
    .status(err.statusCode)
    .json({ status: err.status, message: err.message });
};

function sendErrorDev(err: any, req: Request, res: Response) {
  console.error("ERROR 💥", err);

  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";
  return res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    stack: err.stack,
    error: err,
  });
}

export default errorHandler;
