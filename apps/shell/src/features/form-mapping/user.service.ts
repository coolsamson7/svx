import { injectable } from '@svx/portal';
import type { User } from './user.model';

@injectable()
export class UserService {
  private user: User | null = null;

  async load(): Promise<User | null> {
    return this.user;
  }

  async save(user: User): Promise<User> {
    this.user = { ...user };
    return this.user;
  }

  async delete(): Promise<void> {
    this.user = null;
  }
}