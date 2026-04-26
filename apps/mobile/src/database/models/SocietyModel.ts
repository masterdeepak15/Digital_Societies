import { Model }  from '@nozbe/watermelondb';
import { field }  from '@nozbe/watermelondb/decorators';

export default class SocietyModel extends Model {
  static table = 'societies';

  @field('server_id')   serverId!:   string;
  @field('name')        name!:       string;
  @field('address')     address!:    string;
  @field('tier')        tier!:       string;
  @field('logo_url')    logoUrl!:    string | null;
  @field('total_flats') totalFlats!: number;
}
