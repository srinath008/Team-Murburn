import React, { useState } from 'react';
import { Platform, View, Text, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import HospitalDashboard from './components/HospitalDashboard';
import DonorApp from './components/DonorApp';
import "./global.css";

export default function App() {
  // By default, detect platform. If web, show Hospital Dashboard. Otherwise, show Donor App.
  const defaultIsWeb = Platform.OS === 'web';
  const [showWebDashboard, setShowWebDashboard] = useState(defaultIsWeb);

  return (
    <View className="flex-1 bg-slate-950">
      <StatusBar style="light" />
      
      {showWebDashboard ? (
        <HospitalDashboard />
      ) : (
        <DonorApp />
      )}

      {/* Developer Override Switch (Glassmorphic Pill at Bottom) */}
      <View className="absolute bottom-4 left-0 right-0 items-center z-50">
        <View className="flex-row bg-slate-900/90 border border-slate-700/50 rounded-full px-4 py-2 shadow-lg shadow-black/40 backdrop-blur-md items-center">
          <Text className="text-slate-400 text-xs font-semibold mr-3">
            DEV SWITCH ({Platform.OS.toUpperCase()}):
          </Text>
          <TouchableOpacity 
            onPress={() => setShowWebDashboard(true)}
            className={`px-3 py-1 rounded-full mr-1 ${
              showWebDashboard 
                ? 'bg-red-600 shadow shadow-red-600/30' 
                : 'bg-transparent'
            }`}
          >
            <Text className={`text-xs font-bold ${showWebDashboard ? 'text-white' : 'text-slate-400'}`}>
              Hospital
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setShowWebDashboard(false)}
            className={`px-3 py-1 rounded-full ${
              !showWebDashboard 
                ? 'bg-red-600 shadow shadow-red-600/30' 
                : 'bg-transparent'
            }`}
          >
            <Text className={`text-xs font-bold ${!showWebDashboard ? 'text-white' : 'text-slate-400'}`}>
              Donor App
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
