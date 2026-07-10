import React from 'react';
import { Platform } from 'react-native';
import HospitalDashboard from './components/HospitalDashboard';
import DonorApp from './components/DonorApp';

export default function App() {
  if (Platform.OS === 'web') {
    return <HospitalDashboard />;
  } else {
    return <DonorApp />;
  }
}
