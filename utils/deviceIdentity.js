import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_STORAGE_KEY = '@syncfound/device_id';

function createRandomDeviceId() {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `device-${timePart}-${randomPart}`;
}

export async function getOrCreateDeviceId() {
  try {
    const existing = String(await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY) || '').trim();
    if (existing) {
      return existing;
    }

    const generated = createRandomDeviceId();
    await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    return '';
  }
}
