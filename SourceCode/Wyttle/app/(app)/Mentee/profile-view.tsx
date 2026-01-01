import React from 'react';
import ProfileViewScreen from '../profile-view';

export default function MenteeProfileView() {
  return <ProfileViewScreen />;
}


//Member routing of profile-view.tsx. This is necessary to have separate 
// paths for Mentor and Mentee in expo-router while still
// reusing the same ProfileViewScreen component. There is one for mentor too.