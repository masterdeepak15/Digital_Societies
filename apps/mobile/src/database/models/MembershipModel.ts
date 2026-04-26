import { Model }  from '@nozbe/watermelondb';
import { field }  from '@nozbe/watermelondb/decorators';

export default class MembershipModel extends Model {
  static table = 'memberships';

  @field('server_id')   serverId!:  string;
  @field('user_id')     userId!:    string;
  @field('society_id')  societyId!: string;
  @field('flat_id')     flatId!:    string | null;
  @field('role')        role!:      string;
  @field('member_type') memberType!: string;
  @field('is_active')   isActive!:  boolean;
}
