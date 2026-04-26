import { Model }       from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class NoticeModel extends Model {
  static table = 'notices';

  @field('server_id')   serverId!:   string;
  @field('title')       title!:      string;
  @field('body')        body!:       string;
  @field('type')        type!:       'notice' | 'emergency' | 'event';
  @field('is_read')     isRead!:     boolean;
  @date('posted_at')    postedAt!:   Date;
  @date('expires_at')   expiresAt!:  Date | null;
}
