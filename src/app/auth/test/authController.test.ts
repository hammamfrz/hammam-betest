import { Request, Response, NextFunction } from "express";
import { prisma } from "../../../utils/prisma";
import redisClient from "../../../utils/redisClient";
import * as userController from "../handler";
import JwtService from "../../../services/JwtService";
import bcrypt from "bcrypt";
import { zParse } from "../../../utils/validate";
import { registerUserSchema, loginUserSchema, updateUserSchema, getUserByAccountNumberSchema, getUserByIdentityNumberSchema } from "../validation";
import { RequestWithUser } from "../../../middleware/auth";

// Mock dependencies
jest.mock("../../../utils/prisma", () => ({
  prisma: {
    users: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("../../../utils/redisClient", () => ({
  set: jest.fn(),
  get: jest.fn(),
}));

jest.mock("../../../services/JwtService", () => ({
  generateToken: jest.fn(),
}));

jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock("../../../utils/validate", () => ({
  zParse: jest.fn(),
}));

describe("User Controller", () => {
  let req: Partial<RequestWithUser>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
        body: {},
        user: { 
            id: "1",
            userName: "testuser",
            emailAddress: "test@example.com",
            identityNumber: "123456789",
            accountNumber: "1234567890",
            password: "hashedPassword",
            createdAt: new Date(),
            updatedAt: new Date()
        }
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      next = jest.fn();
    });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("registerUser", () => {
    beforeEach(() => {
      req.body = {
        userName: "testuser",
        emailAddress: "test@example.com",
        identityNumber: "123456789",
        password: "password",
      };
    });

    it("should register a new user successfully", async () => {
      (zParse as jest.Mock).mockResolvedValue({ body: req.body });
      (prisma.users.findFirst as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashedPassword");
      (prisma.users.create as jest.Mock).mockResolvedValue({
        id: "1",
        userName: "testuser",
        emailAddress: "test@example.com",
        identityNumber: "123456789",
        accountNumber: "1234567890",
      });
      (JwtService.generateToken as jest.Mock).mockReturnValue("token");

      await userController.registerUser(req as Request, res as Response, next);

      expect(zParse).toHaveBeenCalledWith(registerUserSchema, req);
      expect(prisma.users.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { userName: req.body.userName },
            { emailAddress: req.body.emailAddress },
            { identityNumber: req.body.identityNumber },
          ],
        },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(req.body.password, 10);
      expect(prisma.users.create).toHaveBeenCalledWith({
        data: {
          userName: req.body.userName,
          accountNumber: expect.any(String),
          emailAddress: req.body.emailAddress,
          identityNumber: req.body.identityNumber,
          password: "hashedPassword",
        },
      });
      expect(JwtService.generateToken).toHaveBeenCalledWith({
        id: "1",
        emailAddress: "test@example.com",
        userName: "testuser",
        accountNumber: "1234567890",
        identityNumber: "123456789",
      });
      expect(redisClient.set).toHaveBeenCalledWith(
        "user:1",
        "token",
        "EX",
        3600
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        user: {
          id: "1",
          userName: "testuser",
          emailAddress: "test@example.com",
          identityNumber: "123456789",
          accountNumber: expect.any(String),
        },
        token: "token",
      });
    });

    it("should return 409 if user already exists", async () => {
      (zParse as jest.Mock).mockResolvedValue({ body: req.body });
      (prisma.users.findFirst as jest.Mock).mockResolvedValue({
        id: "1",
        userName: "testuser",
        emailAddress: "test@example.com",
        identityNumber: "123456789",
      });

      await userController.registerUser(req as Request, res as Response, next);

      expect(prisma.users.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { userName: req.body.userName },
            { emailAddress: req.body.emailAddress },
            { identityNumber: req.body.identityNumber },
          ],
        },
      });
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message: "User already exists",
      });
    });

    it("should call next with an error if an exception occurs", async () => {
      const error = new Error("An error occurred");
      (zParse as jest.Mock).mockRejectedValue(error);

      await userController.registerUser(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("loginUser", () => {
    beforeEach(() => {
      req.body = {
        userName: "testuser",
        emailAddress: "test@example.com",
        password: "password",
      };
    });

    it("should log in a user successfully", async () => {
      (zParse as jest.Mock).mockResolvedValue({ body: req.body });
      (prisma.users.findFirst as jest.Mock).mockResolvedValue({
        id: "1",
        userName: "testuser",
        emailAddress: "test@example.com",
        identityNumber: "123456789",
        accountNumber: "1234567890",
        password: "hashedPassword",
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (JwtService.generateToken as jest.Mock).mockReturnValue("token");

      await userController.loginUser(req as Request, res as Response, next);

      expect(zParse).toHaveBeenCalledWith(loginUserSchema, req);
      expect(prisma.users.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ userName: req.body.userName }, { emailAddress: req.body.emailAddress }],
        },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(req.body.password, "hashedPassword");
      expect(JwtService.generateToken).toHaveBeenCalledWith({
        id: "1",
        emailAddress: "test@example.com",
        userName: "testuser",
        accountNumber: "1234567890",
        identityNumber: "123456789",
      });
      expect(redisClient.set).toHaveBeenCalledWith("user:1", "token", "EX", 3600);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: {
          user: {
            id: "1",
            userName: "testuser",
            accountNumber: "1234567890",
          },
          token: "token",
        },
      });
    });

    it("should return 404 if user is not found", async () => {
      (zParse as jest.Mock).mockResolvedValue({ body: req.body });
      (prisma.users.findFirst as jest.Mock).mockResolvedValue(null);

      await userController.loginUser(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "User not found",
      });
    });

    it("should return 401 if password is invalid", async () => {
      (zParse as jest.Mock).mockResolvedValue({ body: req.body });
      (prisma.users.findFirst as jest.Mock).mockResolvedValue({
        id: "1",
        userName: "testuser",
        emailAddress: "test@example.com",
        identityNumber: "123456789",
        accountNumber: "1234567890",
        password: "hashedPassword",
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await userController.loginUser(req as Request, res as Response, next);

      expect(bcrypt.compare).toHaveBeenCalledWith(req.body.password, "hashedPassword");
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid password",
      });
    });

    it("should call next with an error if an exception occurs", async () => {
      const error = new Error("An error occurred");
      (zParse as jest.Mock).mockRejectedValue(error);

      await userController.loginUser(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("updateUser", () => {
    beforeEach(() => {
      req.body = {
        userName: "updateduser",
        emailAddress: "updated@example.com",
        password: "newpassword",
      };
    });

    it("should update a user successfully", async () => {
      (zParse as jest.Mock).mockResolvedValue({ body: req.body });
      (redisClient.get as jest.Mock).mockResolvedValue("cachedUser");
      (prisma.users.findUnique as jest.Mock).mockResolvedValue({
        id: "1",
        userName: "testuser",
        emailAddress: "test@example.com",
        identityNumber: "123456789",
        accountNumber: "1234567890",
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashedNewPassword");
      (prisma.users.update as jest.Mock).mockResolvedValue({
        id: "1",
        userName: "updateduser",
        emailAddress: "updated@example.com",
        identityNumber: "123456789",
        accountNumber: "1234567890",
      });

      await userController.updateUser(req as RequestWithUser, res as Response, next);
      expect(zParse).toHaveBeenCalledWith(updateUserSchema, req);
      expect(redisClient.get).toHaveBeenCalledWith("user:1");
      expect(prisma.users.findUnique).toHaveBeenCalledWith({
        where: { id: "1" },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(req.body.password, 10);
      expect(prisma.users.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: {
          userName: req.body.userName,
          emailAddress: req.body.emailAddress,
          password: "hashedNewPassword",
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        user: {
          id: "1",
          userName: "updateduser",
          accountNumber: "1234567890",
        },
      });
    });

    it("should return 401 if user is not authorized", async () => {
      (zParse as jest.Mock).mockResolvedValue({ body: req.body });
      (redisClient.get as jest.Mock).mockResolvedValue(null);

      await userController.updateUser(req as RequestWithUser, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unauthorized",
      });
    });

    it("should return 404 if user is not found", async () => {
      (zParse as jest.Mock).mockResolvedValue({ body: req.body });
      (redisClient.get as jest.Mock).mockResolvedValue("cachedUser");
      (prisma.users.findUnique as jest.Mock).mockResolvedValue(null);

      await userController.updateUser(req as RequestWithUser, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "User not found",
      });
    });

    it("should call next with an error if an exception occurs", async () => {
      const error = new Error("An error occurred");
      (zParse as jest.Mock).mockRejectedValue(error);

      await userController.updateUser(req as RequestWithUser, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("deleteUser", () => {
    it("should delete a user successfully", async () => {
      (redisClient.get as jest.Mock).mockResolvedValue("cachedUser");
      (prisma.users.findUnique as jest.Mock).mockResolvedValue({
        id: "1",
        userName: "testuser",
        emailAddress: "test@example.com",
        identityNumber: "123456789",
        accountNumber: "1234567890",
      });

      await userController.deleteUser(req as RequestWithUser, res as Response, next);

      expect(redisClient.get).toHaveBeenCalledWith("user:1");
      expect(prisma.users.findUnique).toHaveBeenCalledWith({
        where: { id: "1" },
      });
      expect(prisma.users.delete).toHaveBeenCalledWith({
        where: { id: "1" },
      });
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it("should return 401 if user is not authorized", async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(null);

      await userController.deleteUser(req as RequestWithUser, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unauthorized",
      });
    });

    it("should return 404 if user is not found", async () => {
      (redisClient.get as jest.Mock).mockResolvedValue("cachedUser");
      (prisma.users.findUnique as jest.Mock).mockResolvedValue(null);

      await userController.deleteUser(req as RequestWithUser, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "User not found",
      });
    });

    it("should call next with an error if an exception occurs", async () => {
      const error = new Error("An error occurred");
      (redisClient.get as jest.Mock).mockRejectedValue(error);

      await userController.deleteUser(req as RequestWithUser, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getUser", () => {
    it("should return a user successfully", async () => {
      (redisClient.get as jest.Mock).mockResolvedValue("cachedUser");
      (prisma.users.findUnique as jest.Mock).mockResolvedValue({
        id: "1",
        userName: "testuser",
        emailAddress: "test@example.com",
        identityNumber: "123456789",
        accountNumber: "1234567890",
      });

      await userController.getUser(req as RequestWithUser, res as Response, next);

      expect(redisClient.get).toHaveBeenCalledWith("user:1");
      expect(prisma.users.findUnique).toHaveBeenCalledWith({
        where: { id: "1" },
        select: {
          id: true,
          userName: true,
          accountNumber: true,
          emailAddress: true,
          identityNumber: true,
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        user: {
          id: "1",
          userName: "testuser",
          accountNumber: "1234567890",
          emailAddress: "test@example.com",
          identityNumber: "123456789",
        },
      });
    });

    it("should return 401 if user is not authorized", async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(null);

      await userController.getUser(req as RequestWithUser, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Unauthorized",
      });
    });

    it("should return 404 if user is not found", async () => {
      (redisClient.get as jest.Mock).mockResolvedValue("cachedUser");
      (prisma.users.findUnique as jest.Mock).mockResolvedValue(null);

      await userController.getUser(req as RequestWithUser, res as Response, next);

      expect(redisClient.get).toHaveBeenCalledWith("user:1");
      expect(prisma.users.findUnique).toHaveBeenCalledWith({
        where: { id: "1" },
        select: {
          id: true,
          userName: true,
          accountNumber: true,
          emailAddress: true,
          identityNumber: true,
        },
      });

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "User not found",
      });
    });

    it("should call next with an error if an exception occurs", async () => {
      const error = new Error("An error occurred");
      (redisClient.get as jest.Mock).mockRejectedValue(error);

      await userController.getUser(req as RequestWithUser, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getUserByAccountNumber", () => {
    beforeEach(() => {
      req.query = {
        accountNumber: "1234567890",
      };
    });

    it("should return a user by account number successfully", async () => {
      (zParse as jest.Mock).mockResolvedValue({ query: req.query });
      (prisma.users.findFirst as jest.Mock).mockResolvedValue({
        id: "1",
        userName: "testuser",
        emailAddress: "test@example.com",
        identityNumber: "123456789",
        accountNumber: "1234567890",
      });

      await userController.getUserByAccountNumber(req as Request, res as Response, next);

      expect(zParse).toHaveBeenCalledWith(getUserByAccountNumberSchema, req);
      expect(prisma.users.findFirst).toHaveBeenCalledWith({
        where: { accountNumber: "1234567890" },
        select: {
          id: true,
          userName: true,
          accountNumber: true,
          emailAddress: true,
          identityNumber: true,
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "User found!",
        user: {
          id: "1",
          userName: "testuser",
          accountNumber: "1234567890",
          emailAddress: "test@example.com",
          identityNumber: "123456789",
        },
      });
    });

    it("should return 404 if user by account number is not found", async () => {
      (zParse as jest.Mock).mockResolvedValue({ query: req.query });
      (prisma.users.findFirst as jest.Mock).mockResolvedValue(null);

      await userController.getUserByAccountNumber(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "User not found",
      });
    });

    it("should call next with an error if an exception occurs", async () => {
      const error = new Error("An error occurred");
      (zParse as jest.Mock).mockRejectedValue(error);

      await userController.getUserByAccountNumber(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getUserByIdentityNumber", () => {
    beforeEach(() => {
      req.query = {
        identityNumber: "123456789",
      };
    });

    it("should return a user by identity number successfully", async () => {
      (zParse as jest.Mock).mockResolvedValue({ query: req.query });
      (prisma.users.findFirst as jest.Mock).mockResolvedValue({
        id: "1",
        userName: "testuser",
        emailAddress: "test@example.com",
        identityNumber: "123456789",
        accountNumber: "1234567890",
      });

      await userController.getUserByIdentityNumber(req as Request, res as Response, next);

      expect(zParse).toHaveBeenCalledWith(getUserByIdentityNumberSchema, req);
      expect(prisma.users.findFirst).toHaveBeenCalledWith({
        where: { identityNumber: "123456789" },
        select: {
          id: true,
          userName: true,
          accountNumber: true,
          emailAddress: true,
          identityNumber: true,
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "User found!",
        user: {
          id: "1",
          userName: "testuser",
          accountNumber: "1234567890",
          emailAddress: "test@example.com",
          identityNumber: "123456789",
        },
      });
    });

    it("should return 404 if user by identity number is not found", async () => {
      (zParse as jest.Mock).mockResolvedValue({ query: req.query });
      (prisma.users.findFirst as jest.Mock).mockResolvedValue(null);

      await userController.getUserByIdentityNumber(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "User not found",
      });
    });

    it("should call next with an error if an exception occurs", async () => {
      const error = new Error("An error occurred");
      (zParse as jest.Mock).mockRejectedValue(error);

      await userController.getUserByIdentityNumber(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
