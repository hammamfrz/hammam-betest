import express from "express";
import { loginUser, registerUser, updateUser, deleteUser, getUser, getUserByAccountNumber, getUserByIdentityNumber } from "./handler";
import { auth } from "../../middleware/auth";
import catchAsync from "../../middleware/catchAsync";

const router = express.Router();

router.post("/register", catchAsync(registerUser));
router.post("/login", catchAsync(loginUser));
router.post("/update", auth, catchAsync(updateUser));
router.post("/delete", auth, catchAsync(deleteUser));
router.get("/getMe", auth, catchAsync(getUser));
router.get("/getByAccountNumber", auth, catchAsync(getUserByAccountNumber));
router.get("/getByIdentityNumber", auth, catchAsync(getUserByIdentityNumber));

export default router;
