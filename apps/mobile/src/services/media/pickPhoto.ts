import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/** Asks Camera or Gallery, then returns the chosen picture's local file, or null if the person backed out. */
export function pickPhoto(): Promise<string | null> {
  return new Promise((resolve) => {
    const run = async (source: 'camera' | 'gallery') => {
      try {
        const perm = source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(source === 'camera' ? 'Camera needed' : 'Photos needed', 'Allow access in Settings to add a picture.');
          return resolve(null);
        }
        // Cropped to a square while choosing, the shape the feed shows pictures in.
        const options = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true, aspect: [1, 1] as [number, number] };
        const res = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
        resolve(res.canceled || !res.assets?.[0]?.uri ? null : res.assets[0].uri);
      } catch {
        resolve(null);
      }
    };
    Alert.alert('Add a picture', undefined, [
      { text: 'Camera', onPress: () => run('camera') },
      { text: 'Gallery', onPress: () => run('gallery') },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) });
  });
}
