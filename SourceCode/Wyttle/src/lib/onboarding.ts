import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ───────────────────────────────────────────────────────────────────

export type OnboardingStep = {
  /** Ionicons icon name shown above the title */
  icon: string;
  /** Bold heading */
  title: string;
  /** Body text explaining the feature */
  description: string;
  /**
   * When `type` is `'action'`, the overlay renders an interactive element
   * (e.g. the "Add a profile photo" button).  The overlay component checks
   * this field to decide what extra UI to show.
   */
  type?: 'info' | 'action';
  /** Identifier for the action – the overlay uses this to pick the right UI */
  actionId?: string;
};

// ─── Step definitions ────────────────────────────────────────────────────────

export const MENTEE_STEPS: OnboardingStep[] = [
  {
    icon: 'people-outline',
    title: 'Connections',
    description:
      'Your connections live here. Once you match with another member you can start chatting with them straight away.',
  },
  {
    icon: 'layers-outline',
    title: 'Discovery Stack',
    description:
      'Swipe through member profiles to find people you\'d like to connect with. Tap a card to view their full profile. Swipe right to connect or left to skip.',
  },
  {
    icon: 'school-outline',
    title: 'Mentor Hub',
    description:
      'Browse all available mentors. Use the search bar to filter by name or industry, and tap a mentor to view their full profile.',
  },
  {
    icon: 'wallet-outline',
    title: 'Tokens',
    description:
      'Tokens are used to book sessions with mentors. Check your balance and buy more tokens in Settings > Tokens.',
  },
  {
    icon: 'camera-outline',
    title: 'Add a Profile Photo',
    description:
      'A profile photo helps other members and mentors recognise you. Tap the button below to add one now, or skip and do it later in settings.',
    type: 'action',
    actionId: 'pick_photo',
  },
  {
    icon: 'create-outline',
    title: 'Edit Your Profile',
    description:
      'Customise your bio, skills, work experience, and more. Head to Settings > Profile Options > Edit Profile at any time.',
  },
];

export const MENTOR_STEPS: OnboardingStep[] = [
  {
    icon: 'calendar-outline',
    title: 'Calendar',
    description:
      'Manage your availability here. Block out time slots so mentees know when you\'re free, and view your upcoming sessions.',
  },
  {
    icon: 'people-outline',
    title: 'Connections',
    description:
      'View and chat with your connected mentees. Tap a connection to open the conversation.',
  },
  {
    icon: 'videocam-outline',
    title: 'Video Waiting Room',
    description:
      'When it\'s time for a session, head to the waiting room to go online and join video calls with your mentees.',
  },
  {
    icon: 'camera-outline',
    title: 'Add a Profile Photo',
    description:
      'A profile photo helps mentees recognise you. Tap the button below to add one now, or skip and do it later in settings.',
    type: 'action',
    actionId: 'pick_photo',
  },
  {
    icon: 'create-outline',
    title: 'Edit Your Profile',
    description:
      'Customise your bio, skills, work experience, and more. Head to Settings > Profile Options > Edit Profile at any time.',
  },
];

// ─── AsyncStorage helpers ────────────────────────────────────────────────────

const ONBOARDING_KEY_PREFIX = 'onboarding_seen_';

export async function hasSeenOnboarding(userId: string): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(`${ONBOARDING_KEY_PREFIX}${userId}`);
    return value === 'true';
  } catch {
    return false;
  }
}

export async function markOnboardingSeen(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(`${ONBOARDING_KEY_PREFIX}${userId}`, 'true');
  } catch (e) {
    console.warn('Failed to persist onboarding flag', e);
  }
}

export async function resetOnboarding(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${ONBOARDING_KEY_PREFIX}${userId}`);
  } catch (e) {
    console.warn('Failed to reset onboarding flag', e);
  }
}
