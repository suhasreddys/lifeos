import { readJsonStorage, writeJsonStorage } from "./storage";
import { hashPassword, verifyPassword, SessionUser } from "./auth";

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
};

const USERS_SUBFOLDER = "users";
const USERS_FILE = "index.json";

export async function getAllUsers(): Promise<UserRecord[]> {
  return await readJsonStorage<UserRecord[]>(USERS_SUBFOLDER, USERS_FILE, []);
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const users = await getAllUsers();
  const normalized = email.toLowerCase().trim();
  return users.find((u) => u.email.toLowerCase() === normalized) || null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const users = await getAllUsers();
  return users.find((u) => u.id === id) || null;
}

export async function createUser(name: string, email: string, password: string): Promise<SessionUser> {
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error("An account with this email address already exists.");
  }

  const { hash, salt } = await hashPassword(password);
  const newUser: UserRecord = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash: hash,
    salt: salt,
    createdAt: new Date().toISOString(),
  };

  const users = await getAllUsers();
  users.push(newUser);
  await writeJsonStorage(USERS_SUBFOLDER, USERS_FILE, users);

  return {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
  };
}

export async function findOrCreateGoogleUser(name: string, email: string): Promise<SessionUser> {
  const existing = await findUserByEmail(email);
  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      email: existing.email,
    };
  }

  const { hash, salt } = await hashPassword(crypto.randomUUID());
  const newUser: UserRecord = {
    id: `usr_g_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: name.trim() || email.split("@")[0],
    email: email.toLowerCase().trim(),
    passwordHash: hash,
    salt: salt,
    createdAt: new Date().toISOString(),
  };

  const users = await getAllUsers();
  users.push(newUser);
  await writeJsonStorage(USERS_SUBFOLDER, USERS_FILE, users);

  return {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
  };
}

export async function authenticateUser(email: string, password: string): Promise<SessionUser | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;

  const isValid = await verifyPassword(password, user.passwordHash, user.salt);
  if (!isValid) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

