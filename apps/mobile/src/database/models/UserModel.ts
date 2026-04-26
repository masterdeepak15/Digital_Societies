import { Model }   from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

/** Local SQLite mirror of the User domain entity. Synced from server. */
export default class UserModel extends Model {
  static table = 'users';

  @field('server_id')  serverId!:  string;
  @field('phone')      phone!:     string;
  @field('name')       name!:      string;
  @field('email')      email!:     string | null;
  @field('avatar_url') avatarUrl!: string | null;
  @field('is_active')  isActive!:  boolean;
  @date('last_login_at') lastLoginAt!: Date | null;
}
