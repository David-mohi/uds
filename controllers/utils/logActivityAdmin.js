export const logActivity = async ({
  db,
  userId,
  namaUser,
  action,
  targetId = null,
  targetTable = null,
  ip,
  userAgent,
  message,
}) => {

	const safeMessage =
  typeof message === 'string' && message.trim() !== '' ? message : null;

  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, nama_user, action, target_id, target_table, ip_address, user_agent, message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, namaUser, action, targetId, targetTable, ip, userAgent, safeMessage]
    );
  } catch (err) {
    console.error("Gagal mencatat log aktivitas:", err);
  }
};