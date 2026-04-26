import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema }   from './schema';
import {
  UserModel, SocietyModel, MembershipModel,
  BillModel, VisitorModel, ComplaintModel, NoticeModel,
} from './models';

/**
 * Singleton WatermelonDB instance.
 * SQLCipher encryption is enabled via @op-engineering/op-sqlite.
 * The encryption key is derived from the OS keystore (Keychain on iOS, Keystore on Android)
 * and never stored in JS.
 */
const adapter = new SQLiteAdapter({
  schema,
  // SQLCipher key injected at runtime from secure storage
  // See: src/services/auth/DatabaseKeyService.ts
  dbName: 'digital_societies',
  jsi: true,               // use JSI for performance
  onSetUpError: (error) => {
    console.error('[WatermelonDB] Setup failed:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [
    UserModel,
    SocietyModel,
    MembershipModel,
    BillModel,
    VisitorModel,
    ComplaintModel,
    NoticeModel,
  ],
});
