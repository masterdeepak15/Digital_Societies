import { Model }       from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class ComplaintModel extends Model {
  static table = 'complaints';

  @field('server_id')   serverId!:   string | null;
  @field('title')       title!:      string;
  @field('description') description!: string;
  @field('category')    category!:   string;
  @field('status')      status!:     'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  @field('priority')    priority!:   'low' | 'medium' | 'high' | 'urgent';
  @field('flat_id')     flatId!:     string;
  @field('is_synced')   isSynced!:   boolean;
  @date('created_at')   createdAt!:  Date;
  @date('resolved_at')  resolvedAt!: Date | null;
}
