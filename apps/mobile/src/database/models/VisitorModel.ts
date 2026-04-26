import { Model }       from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

/** Offline-capable visitor record — critical for guard app without internet. */
export default class VisitorModel extends Model {
  static table = 'visitors';

  @field('server_id')     serverId!:    string | null;  // null = pending sync
  @field('name')          name!:        string;
  @field('phone')         phone!:       string;
  @field('flat_number')   flatNumber!:  string;
  @field('purpose')       purpose!:     string;
  @field('status')        status!:      'pending' | 'approved' | 'rejected' | 'exited';
  @field('vehicle_number') vehicleNumber!: string | null;
  @field('photo_url')     photoUrl!:    string | null;
  @field('is_synced')     isSynced!:    boolean;
  @date('entry_time')     entryTime!:   Date;
  @date('exit_time')      exitTime!:    Date | null;
  @date('approved_at')    approvedAt!:  Date | null;
}
