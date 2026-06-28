import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  listNotifications,
  markNotificationRead
} from "../services/notifications.service.js";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req, res) => {
  return res.json({
    notifications: await listNotifications(req.authUser!.id)
  });
});

notificationsRouter.post("/:id/read", async (req, res) => {
  const notification = await markNotificationRead(
    req.authUser!.id,
    req.params.id
  );

  if (!notification) {
    return res.status(404).json({ message: "Notification not found" });
  }

  return res.json({ notification });
});
