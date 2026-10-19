import { CHANNELS, chatAlert, emergencyAlert, usablePushProjectId, visitorAlert } from './notificationModel';

describe('channels', () => {
  it('rings and vibrates hard for visitors and emergencies', () => {
    for (const id of ['visitors', 'emergency'] as const) {
      expect(CHANNELS[id].importance).toBe(5);
      expect(CHANNELS[id].sound).toBe('alert.wav');
      expect(CHANNELS[id].vibration.filter((n) => n > 0).length).toBeGreaterThanOrEqual(4);
    }
  });
  it('keeps chat softer than a visitor', () => {
    expect(CHANNELS.chat.importance).toBeLessThan(CHANNELS.visitors.importance);
    expect(CHANNELS.chat.sound).toBeNull();
  });
  it('starts every vibration pattern with a pause, which is how Android reads it', () => {
    for (const c of Object.values(CHANNELS)) expect(c.vibration[0]).toBe(0);
  });
});

describe('visitorAlert', () => {
  it('says who is at the gate and why', () => {
    expect(visitorAlert({ visitorId: 'v1', name: 'Ramesh', purpose: 'Delivery' })).toEqual({
      channel: 'visitors', title: 'Ramesh is at the gate', body: 'Delivery. Open the app to approve or deny.', data: { type: 'visitor', visitorId: 'v1' },
    });
  });
  it('copes with missing details', () => {
    expect(visitorAlert(null)).toMatchObject({ title: 'A visitor is at the gate', body: 'Open the app to approve or deny.', data: { type: 'visitor' } });
  });
});

describe('emergencyAlert', () => {
  it('uses the message it was given, or a plain fallback', () => {
    expect(emergencyAlert({ title: 'Fire in B wing', message: 'Use the stairs' })).toMatchObject({ channel: 'emergency', title: 'Fire in B wing', body: 'Use the stairs' });
    expect(emergencyAlert(undefined)).toMatchObject({ title: 'Emergency alert', body: 'Open the app for details.' });
  });
});

describe('chatAlert', () => {
  it('shows the sender in a group and the preview of a picture', () => {
    expect(chatAlert({ senderName: 'Asha', kind: 'Text', body: 'Meeting at 6', conversationId: 'c1' }, 'Wing A')).toMatchObject({ title: 'Wing A', body: 'Asha: Meeting at 6' });
    expect(chatAlert({ senderName: 'Asha', kind: 'Image', body: '', conversationId: 'c1' }, 'Asha')).toMatchObject({ title: 'Asha', body: '📷 Photo' });
  });
});

describe('usablePushProjectId', () => {
  it('skips push until the app has a real project id', () => {
    expect(usablePushProjectId('replace-with-expo-project-id')).toBeNull();
    expect(usablePushProjectId('')).toBeNull();
    expect(usablePushProjectId(undefined)).toBeNull();
    expect(usablePushProjectId('1c2d3e4f-0000-1111-2222-333344445555')).toBe('1c2d3e4f-0000-1111-2222-333344445555');
  });
});
