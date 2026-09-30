import { BASE_URL_NO_API } from '../utils/Constants';

jest.mock('../utils/firebaseAuth', () => ({
  getCurrentFirebaseIdToken: jest.fn(),
}));

import { resolveProfilePhotoUrl } from '../screens/InvitesScreen';

describe('resolveProfilePhotoUrl', () => {
  it('prefixes relative upload paths with the API-free base URL', () => {
    expect(
      resolveProfilePhotoUrl(
        '/uploads/images/2026/06/23/profile.jpg',
      ),
    ).toBe(`${BASE_URL_NO_API}uploads/images/2026/06/23/profile.jpg`);
  });

  it('keeps absolute image URLs unchanged', () => {
    expect(resolveProfilePhotoUrl('https://cdn.example.com/profile.jpg')).toBe(
      'https://cdn.example.com/profile.jpg',
    );
  });
});