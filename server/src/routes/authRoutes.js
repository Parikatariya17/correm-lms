import express from 'express';
import {
  register,
  login,
  refreshAccessToken,
  logout,
  getMe,
  getAllUsers,
  updateUserRole,
} from '../controllers/authController.js';
import { verifyJWT, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public Auth Routes (/api/v1/auth/*)
router.post('/auth/register', register);
router.post('/auth/login', login);
router.post('/auth/refresh', refreshAccessToken);
router.post('/auth/logout', logout);

// Authenticated Profile Route
router.get('/auth/me', verifyJWT, getMe);

// Admin-only User Management Routes (/api/v1/users/*)
router.get('/users', verifyJWT, authorizeRoles('admin'), getAllUsers);
router.patch('/users/:id/role', verifyJWT, authorizeRoles('admin'), updateUserRole);

export default router;
