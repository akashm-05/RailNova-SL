import { Router } from 'express';
import { AuthService } from '../services/auth.service.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;
    console.log(`[Auth API] Register attempt for ${email} (${name}, ${role})`);
    if (!email || !password || !name) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Email, password, and name are required.' } });
    }
    const result = await AuthService.register({ email, password, name, role });
    console.log(`[Auth API] Register success for ${email}`);
    res.status(201).json(result);
  } catch (err: any) {
    console.error(`[Auth API] Register error for ${req.body?.email}:`, err.message || err);
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    console.log(`[Auth API] Login attempt for ${email}`);
    if (!email || !password) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Email and password are required.' } });
    }
    const result = await AuthService.login(email, password);
    console.log(`[Auth API] Login success for ${email} (Role: ${result.user?.role})`);
    res.json(result);
  } catch (err: any) {
    console.error(`[Auth API] Login error for ${req.body?.email}:`, err.message || err);
    next(err);
  }
});

router.get('/me', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await AuthService.getUserById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully.' });
});

export default router;
