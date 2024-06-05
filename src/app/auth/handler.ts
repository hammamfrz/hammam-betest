import { NextFunction, Request, Response } from "express";
import { prisma } from "../../utils/prisma";
import redisClient from "../../utils/redisClient";
import JwtService from "../../services/JwtService";
import { zParse } from "../../utils/validate";
import {
  loginUserSchema,
  registerUserSchema,
  updateUserSchema,
  getUserByAccountNumberSchema,
  getUserByIdentityNumberSchema,
} from "./validation";
import bcrypt from "bcrypt";
import { RequestWithUser } from "../../middleware/auth";

export async function registerUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { body } = await zParse(registerUserSchema, req);

    const { userName, emailAddress, identityNumber, password } = body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const generateAccountNumber = () => {
      const randomAccountNumber = Math.floor(
        1000000000 + Math.random() * 9000000000
      );
      return randomAccountNumber.toString();
    };

    const existingUser = await prisma.users.findFirst({
      where: {
        OR: [
          {
            userName,
          },
          {
            emailAddress,
          },
          {
            identityNumber,
          },
        ],
      },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "User already exists",
      });
    }

    const user = await prisma.users.create({
      data: {
        userName,
        accountNumber: generateAccountNumber(),
        emailAddress,
        identityNumber,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const token = JwtService.generateToken({
      id: user.id,
      emailAddress: user.emailAddress,
      userName: user.userName,
      accountNumber: user.accountNumber,
      identityNumber: user.identityNumber,
    });

    await redisClient.set(`user:${user.id}`, token, { EX: 3600 })

    res.status(201).json({
      user,
      token,
    });
  } catch (error) {
    next(error);
  }
}

export async function loginUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { body } = await zParse(loginUserSchema, req);
    const { userName, emailAddress, password } = body;

    const user = await prisma.users.findFirst({
      where: {
        OR: [
          {
            userName,
          },
          {
            emailAddress,
          },
        ],
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        message: "Invalid password",
      });
    }

    const token = JwtService.generateToken({
      id: user.id,
      emailAddress: user.emailAddress,
      userName: user.userName,
      accountNumber: user.accountNumber,
      identityNumber: user.identityNumber,
    });

    await redisClient.set(`user:${user.id}`, token, { EX: 3600 });

    const {
      password: userPassword,
      emailAddress: userEmail,
      identityNumber: userIdentityNumber,
      ...userWithoutSensitiveInfo
    } = user;

    res.status(200).json({
      data: {
        user: userWithoutSensitiveInfo,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateUser(
  req: RequestWithUser,
  res: Response,
  next: NextFunction
) {
  try {
    const reqUser = req.user;
    const { body } = await zParse(updateUserSchema, req);
    const { userName, emailAddress, password } = body;

    const cachedUser = await redisClient.get(`user:${reqUser.id}`);

    if (!cachedUser) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const user = await prisma.users.findUnique({
      where: {
        id: req.user.id,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const hashedPassword = password
      ? await bcrypt.hash(password, 10)
      : undefined;

    const updatedUser = await prisma.users.update({
      where: {
        id: req.user.id,
      },
      data: {
        userName,
        emailAddress,
        password: hashedPassword,
      },
    });

    const {
      password: userPassword,
      emailAddress: userEmail,
      identityNumber: userIdentityNumber,
      ...userWithoutSensitiveInfo
    } = updatedUser;

    res.status(200).json({
      user: userWithoutSensitiveInfo,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(
  req: RequestWithUser,
  res: Response,
  next: NextFunction
) {
  try {
    const reqUser = req.user;

    const cachedUser = await redisClient.get(`user:${reqUser.id}`);

    if (!cachedUser) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const user = await prisma.users.findUnique({
      where: {
        id: reqUser.id,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    await prisma.users.delete({
      where: {
        id: reqUser.id,
      },
    });

    res.status(204).json({
        message: "User deleted",
    });
  } catch (error) {
    next(error);
  }
}

export async function getUser(req: RequestWithUser, res: Response , next: NextFunction) {
  try {
    const reqUser = req.user;

  const cachedUser = await redisClient.get(`user:${reqUser.id}`);

  if (!cachedUser) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  const user = await prisma.users.findUnique({
    where: {
      id: reqUser.id,
    },
    select: {
      id: true,
      userName: true,
      accountNumber: true,
      emailAddress: true,
      identityNumber: true,
    },
  });

  if (!user) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  res.status(200).json({
    user,
  });
  } catch (error) {
    next(error);
  }
}

export async function getUserByAccountNumber(req: Request, res: Response, next: NextFunction) {
  try{
    const { query } = await zParse(getUserByAccountNumberSchema, req);

  const { accountNumber } = query;

  const user = await prisma.users.findFirst({
    where: {
      accountNumber: accountNumber as string,
    },
    select: {
      id: true,
      userName: true,
      accountNumber: true,
      emailAddress: true,
      identityNumber: true,
    },
  });

  if (!user) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  res.status(200).json({
    message: "User found!",
    user,
  });
  } catch (error) {
    next(error);
  }
}

export async function getUserByIdentityNumber(req: Request, res: Response, next: NextFunction) {
  try {
    const { query } = await zParse(getUserByIdentityNumberSchema, req);

  const { identityNumber } = query;

  const user = await prisma.users.findFirst({
    where: {
      identityNumber: identityNumber as string,
    },
    select: {
      id: true,
      userName: true,
      accountNumber: true,
      emailAddress: true,
      identityNumber: true,
    },
  });

  if (!user) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  res.status(200).json({
    message: "User found!",
    user,
  });
  } catch (error) {
    next(error);
  }
}
