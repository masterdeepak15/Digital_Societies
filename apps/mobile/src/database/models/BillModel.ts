import { Model }       from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class BillModel extends Model {
  static table = 'bills';

  @field('server_id')    serverId!:   string;
  @field('flat_id')      flatId!:     string;
  @field('society_id')   societyId!:  string;
  @field('amount_paise') amountPaise!: number;   // stored as integer paise
  @field('period')       period!:     string;    // "2024-06"
  @field('status')       status!:     'pending' | 'paid' | 'overdue' | 'waived';
  @field('description')  description!: string;
  @date('due_date')      dueDate!:    Date;
  @date('paid_at')       paidAt!:     Date | null;
}
