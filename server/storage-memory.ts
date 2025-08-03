import bcrypt from "bcrypt";
import type { User, InsertUser } from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class MemoryStorage implements IStorage {
  private users: User[] = [];
  private nextUserId = 1;

  constructor() {
    this.initializeTestUser();
  }

  private async initializeTestUser() {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    this.users.push({
      id: 1,
      username: 'cesium',
      password: hashedPassword,
      email: 'admin@verrier.com',
      firstName: 'Admin',
      lastName: 'VerrierPro',
      role: 'admin',
      createdAt: new Date()
    });
    this.nextUserId = 2;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.find(u => u.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.find(u => u.username === username);
  }

  async createUser(user: InsertUser): Promise<User> {
    const newUser: User = {
      ...user,
      id: this.nextUserId++,
      role: user.role || 'artisan',
      createdAt: new Date()
    };
    this.users.push(newUser);
    return newUser;
  }
}

export const storage = new MemoryStorage();