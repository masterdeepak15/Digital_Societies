import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';

/** v2: gate details on visitors (photo, ID, vehicle type, people arriving together). */
export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'visitors',
          columns: [
            { name: 'photo_uri',          type: 'string', isOptional: true },
            { name: 'photo_media_id',     type: 'string', isOptional: true },
            { name: 'id_type',            type: 'string', isOptional: true },
            { name: 'id_last4',           type: 'string', isOptional: true },
            { name: 'id_photo_uri',       type: 'string', isOptional: true },
            { name: 'id_photo_media_id',  type: 'string', isOptional: true },
            { name: 'vehicle_type',       type: 'string', isOptional: true },
            { name: 'companions',         type: 'string', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
