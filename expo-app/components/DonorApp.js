import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  User, Phone, Heart, Calendar, Award, 
  AlertCircle, MapPin, RotateCcw, Check, Map
} from 'lucide-react-native';

const COOLDOWN_DAYS = 56;
const MS_IN_A_DAY = 24 * 60 * 60 * 1000;

export default function DonorApp() {
  // Registration States
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O-');
  const [language, setLanguage] = useState('english');
  const [lat, setLat] = useState('12.9716');
  const [lng, setLng] = useState('77.5946');
  
  const [isRegistered, setIsRegistered] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [regError, setRegError] = useState('');

  // Cooldown States
  const [lastDonatedDate, setLastDonatedDate] = useState(null); // Date object or null
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [daysElapsed, setDaysElapsed] = useState(0);
  const [progressPercent, setProgressPercent] = useState(100);
  const [simDateText, setSimDateText] = useState('Never donated');

  // Load Saved Registration Profile
  useEffect(() => {
    loadProfile();
  }, []);

  // Calculate Cooldown values whenever lastDonatedDate changes
  useEffect(() => {
    calculateCooldown();
  }, [lastDonatedDate]);

  const loadProfile = async () => {
    try {
      const savedProfile = await AsyncStorage.getItem('@donor_profile');
      if (savedProfile) {
        const profile = JSON.parse(savedProfile);
        setName(profile.name || '');
        setPhone(profile.phone || '');
        setBloodGroup(profile.blood_group || 'O-');
        setLanguage(profile.language || 'english');
        setLat(profile.lat || '12.9716');
        setLng(profile.lng || '77.5946');
        
        if (profile.last_donated_date) {
          setLastDonatedDate(new Date(profile.last_donated_date));
        }
        setIsRegistered(true);
      }
    } catch (err) {
      console.log('Error loading donor profile:', err);
    }
  };

  const calculateCooldown = () => {
    if (!lastDonatedDate) {
      setDaysRemaining(0);
      setDaysElapsed(COOLDOWN_DAYS);
      setProgressPercent(100);
      setSimDateText('Never donated');
      return;
    }

    const today = new Date();
    // Normalize times to midnight to avoid hour differences
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const donationMidnight = new Date(lastDonatedDate.getFullYear(), lastDonatedDate.getMonth(), lastDonatedDate.getDate());

    const diffTime = todayMidnight.getTime() - donationMidnight.getTime();
    const diffDays = Math.floor(diffTime / MS_IN_A_DAY);
    
    const remaining = Math.max(0, COOLDOWN_DAYS - diffDays);
    const progress = Math.min(100, (diffDays / COOLDOWN_DAYS) * 100);

    setDaysElapsed(diffDays);
    setDaysRemaining(remaining);
    setProgressPercent(progress);

    // Format Simulation Date text
    setSimDateText(lastDonatedDate.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    }));
  };

  const handleRegister = async () => {
    setRegError('');
    if (!name.trim()) return setRegError('Name is required');
    if (!phone.trim()) return setRegError('Phone number is required');
    
    setIsSaving(true);
    
    const profile = {
      name,
      phone,
      blood_group: bloodGroup,
      language,
      lat,
      lng,
      last_donated_date: lastDonatedDate ? lastDonatedDate.toISOString() : null
    };

    try {
      // Simulating API write to POST /api/donor/register
      console.log('Sending donor registration payload:', profile);
      
      await AsyncStorage.setItem('@donor_profile', JSON.stringify(profile));
      
      setTimeout(() => {
        setIsSaving(false);
        setIsRegistered(true);
        setIsEditing(false);
      }, 800);
    } catch (err) {
      setIsSaving(false);
      setRegError(`Failed to save profile: ${err.message}`);
    }
  };

  // Cooldown Mock Simulations
  const simulateCooldown = (daysAgo) => {
    if (daysAgo === null) {
      setLastDonatedDate(null);
      saveMockDonationDate(null);
      return;
    }
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - daysAgo);
    setLastDonatedDate(targetDate);
    saveMockDonationDate(targetDate);
  };

  const saveMockDonationDate = async (date) => {
    try {
      const savedProfile = await AsyncStorage.getItem('@donor_profile');
      if (savedProfile) {
        const profile = JSON.parse(savedProfile);
        profile.last_donated_date = date ? date.toISOString() : null;
        await AsyncStorage.setItem('@donor_profile', JSON.stringify(profile));
      }
    } catch (err) {
      console.log('Error saving mock donation date:', err);
    }
  };

  const clearProfile = async () => {
    try {
      await AsyncStorage.removeItem('@donor_profile');
      setName('');
      setPhone('');
      setBloodGroup('O-');
      setLanguage('english');
      setLat('12.9716');
      setLng('77.5946');
      setLastDonatedDate(null);
      setIsRegistered(false);
      setIsEditing(false);
    } catch (err) {
      console.log('Error clearing profile:', err);
    }
  };

  const getNextEligibleDateText = () => {
    if (!lastDonatedDate) return '';
    const eligibleDate = new Date(lastDonatedDate.getTime());
    eligibleDate.setDate(eligibleDate.getDate() + COOLDOWN_DAYS);
    return eligibleDate.toLocaleDateString(undefined, { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <ScrollView className="flex-1 bg-slate-950 px-4 py-8 md:px-12" contentContainerStyle={{ paddingBottom: 120 }}>
      {/* Header */}
      <View className="items-center mb-8">
        <View className="h-14 w-14 rounded-2xl bg-red-600 items-center justify-center shadow-lg shadow-red-900/40 mb-3">
          <Heart size={30} color="white" fill="white" />
        </View>
        <Text className="text-white text-2xl font-black tracking-tight">DONOR NETWORK APP</Text>
        <Text className="text-slate-400 text-xs mt-1 uppercase font-bold tracking-widest text-center">
          Active Emergency Lifeline
        </Text>
      </View>

      {/* Main Container */}
      {!isRegistered || isEditing ? (
        // REGISTRATION SCREEN
        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <View className="flex-row items-center mb-4">
            <User size={18} color="#f87171" className="mr-2" />
            <Text className="text-white font-extrabold text-lg">Zero-Friction Registry</Text>
          </View>
          <Text className="text-slate-400 text-xs mb-6 leading-relaxed">
            Fill in your info to join the local AI blood dispatch pool. If an emergency matches your blood group within 10km, the AI agent will call you.
          </Text>

          {/* Form */}
          <View className="space-y-4">
            <View>
              <Text className="text-slate-400 text-xs font-bold mb-1.5 uppercase tracking-wider">Full Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Ramesh Patel"
                placeholderTextColor="#475569"
                className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-semibold text-sm"
              />
            </View>

            <View className="mt-3">
              <Text className="text-slate-400 text-xs font-bold mb-1.5 uppercase tracking-wider">Phone Number (For AI voice call)</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. +91 98765 43210"
                placeholderTextColor="#475569"
                keyboardType="phone-pad"
                className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-semibold text-sm"
              />
            </View>

            <View className="flex-row -mx-2 mt-3">
              <View className="w-1/2 px-2">
                <Text className="text-slate-400 text-xs font-bold mb-1.5 uppercase tracking-wider">Blood Group</Text>
                <TextInput
                  value={bloodGroup}
                  onChangeText={setBloodGroup}
                  placeholder="e.g. O-"
                  placeholderTextColor="#475569"
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-black text-sm text-center"
                />
              </View>
              <View className="w-1/2 px-2">
                <Text className="text-slate-400 text-xs font-bold mb-1.5 uppercase tracking-wider">AI Voice Language</Text>
                <View className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden h-[46px] justify-center px-2">
                  <TextInput
                    value={language}
                    onChangeText={setLanguage}
                    placeholder="english / hindi / tamil"
                    placeholderTextColor="#475569"
                    className="text-white font-semibold text-xs text-center p-0"
                  />
                </View>
              </View>
            </View>

            <View className="mt-3">
              <Text className="text-slate-400 text-xs font-bold mb-1.5 uppercase tracking-wider">Location Coordinate Mock</Text>
              <View className="flex-row space-x-2">
                <TextInput
                  value={lat}
                  onChangeText={setLat}
                  placeholder="Latitude"
                  placeholderTextColor="#475569"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono text-sm"
                />
                <TextInput
                  value={lng}
                  onChangeText={setLng}
                  placeholder="Longitude"
                  placeholderTextColor="#475569"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono text-sm"
                />
              </View>
            </View>

            {regError ? (
              <View className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl mt-3">
                <Text className="text-red-400 text-xs font-bold">{regError}</Text>
              </View>
            ) : null}

            {/* Buttons */}
            <View className="flex-row space-x-3 mt-6">
              {isEditing && (
                <TouchableOpacity
                  onPress={() => setIsEditing(false)}
                  className="flex-1 bg-slate-800 py-3.5 border border-slate-700 rounded-xl items-center"
                >
                  <Text className="text-slate-300 text-sm font-bold uppercase">Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleRegister}
                disabled={isSaving}
                className="flex-1 bg-red-600 active:bg-red-700 py-3.5 rounded-xl items-center justify-center shadow-md shadow-red-900/30"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white text-sm font-black uppercase tracking-wider">
                    {isEditing ? 'Save Profile' : 'Register Now'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        // DONOR HOME / COOLDOWN DASHBOARD
        <View className="space-y-6">
          {/* Welcome profile info card */}
          <View className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <View className="flex-row justify-between items-start">
              <View>
                <Text className="text-slate-500 text-[10px] font-extrabold uppercase tracking-widest">Active Donor</Text>
                <Text className="text-white text-xl font-black mt-0.5">{name}</Text>
                <Text className="text-slate-400 text-xs mt-1 font-semibold">{phone}</Text>
              </View>
              <View className="bg-red-600 border border-red-500 rounded-2xl px-4 py-2 items-center justify-center shadow shadow-red-600/30">
                <Text className="text-white font-black text-lg">{bloodGroup}</Text>
                <Text className="text-red-200 text-[8px] font-bold uppercase mt-0.5">Group</Text>
              </View>
            </View>

            <View className="flex-row items-center mt-5 pt-4 border-t border-slate-850 justify-between">
              <View className="flex-row items-center">
                <MapPin size={12} color="#94a3b8" className="mr-1" />
                <Text className="text-slate-400 text-[10px] font-mono">
                  Coordinates: {parseFloat(lat).toFixed(4)}, {parseFloat(lng).toFixed(4)}
                </Text>
              </View>
              <View className="bg-slate-950 rounded-lg px-2 py-1 border border-slate-800">
                <Text className="text-slate-400 text-[9px] uppercase font-extrabold">{language}</Text>
              </View>
            </View>

            <View className="flex-row space-x-2 mt-4">
              <TouchableOpacity
                onPress={() => setIsEditing(true)}
                className="flex-1 bg-slate-800 border border-slate-700/60 rounded-xl py-2 items-center"
              >
                <Text className="text-slate-300 font-bold text-xs">Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={clearProfile}
                className="bg-red-950/20 border border-red-900/30 rounded-xl px-4 py-2 items-center"
              >
                <Text className="text-red-400 font-bold text-xs">Reset App</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* COOLDOWN TRACKER SECTION */}
          <View className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <Calendar size={18} color="#f87171" className="mr-2" />
                <Text className="text-white font-extrabold text-base">Medical Cooldown Tracker</Text>
              </View>
              
              <View className={`rounded-full px-2.5 py-0.5 border ${
                daysRemaining === 0 
                  ? 'bg-emerald-500/10 border-emerald-500/30' 
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <Text className={`text-[10px] font-black uppercase tracking-wider ${
                  daysRemaining === 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {daysRemaining === 0 ? 'Eligible' : 'Cooldown Active'}
                </Text>
              </View>
            </View>

            {/* Cooldown Info Text */}
            <Text className="text-slate-400 text-xs leading-relaxed mb-6">
              Blood donations require a <Text className="text-white font-bold">56-day (8 weeks)</Text> recovery cycle to allow red blood cells to replenish naturally.
            </Text>

            {/* Cooldown visual progress bar */}
            <View className="bg-slate-950 border border-slate-850 rounded-2xl p-5 mb-6">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-slate-500 text-xs font-semibold">Recovery Status</Text>
                <Text className="text-white font-mono font-black text-sm">{Math.round(progressPercent)}%</Text>
              </View>

              {/* Progress Bar Track */}
              <View className="h-3 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <View 
                  style={{ width: `${progressPercent}%` }} 
                  className={`h-full rounded-full ${
                    daysRemaining === 0 
                      ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30' 
                      : 'bg-red-600 shadow-sm shadow-red-600/30'
                  }`} 
                />
              </View>

              <View className="flex-row justify-between mt-3">
                <Text className="text-slate-500 text-[10px]">Day 0 (Donated)</Text>
                <Text className="text-slate-500 text-[10px]">Day 56 (Ready)</Text>
              </View>

              {/* Large Counter Panel */}
              <View className="mt-5 border-t border-slate-900 pt-4 items-center">
                {daysRemaining > 0 ? (
                  <>
                    <Text className="text-red-500 text-4xl font-black font-mono tracking-tight">{daysRemaining}</Text>
                    <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">Days Lockout Remaining</Text>
                  </>
                ) : (
                  <View className="items-center py-2">
                    <Check size={28} color="#10b981" className="mb-1" />
                    <Text className="text-emerald-400 font-black text-base uppercase tracking-wider">Fully Eligible</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Next Date Message */}
            {daysRemaining > 0 ? (
              <View className="bg-red-500/5 border border-red-500/10 p-4 rounded-xl flex-row items-start">
                <AlertCircle size={16} color="#ef4444" className="mr-2.5 mt-0.5" />
                <View className="flex-1">
                  <Text className="text-red-400 font-bold text-xs">Exempted from Emergencies</Text>
                  <Text className="text-slate-400 text-[11px] mt-1 leading-relaxed">
                    You are excluded from spatial dispatch queries. You will become eligible again on:
                  </Text>
                  <Text className="text-white font-black text-xs mt-1">{getNextEligibleDateText()}</Text>
                </View>
              </View>
            ) : (
              <View className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl flex-row items-start">
                <Award size={16} color="#10b981" className="mr-2.5 mt-0.5" />
                <View className="flex-1">
                  <Text className="text-emerald-400 font-bold text-xs">Awaiting Dispatch Calls</Text>
                  <Text className="text-slate-400 text-[11px] mt-1 leading-relaxed">
                    Your location and blood group are active. Keep the app registered. If an emergency occurs within 10km, an AI voice dispatcher will phone you immediately.
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* COOLDOWN SIMULATOR SECTION */}
          <View className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <View className="flex-row items-center mb-3">
              <RotateCcw size={16} color="#94a3b8" className="mr-2" />
              <Text className="text-white font-extrabold text-base">Cooldown Simulator Panel</Text>
            </View>
            <Text className="text-slate-400 text-xs mb-4">
              Simulate different historical donation milestones to test the gauge, days lockout, and dynamic text responses:
            </Text>

            <View className="bg-slate-950 rounded-xl p-3 border border-slate-850 flex-row justify-between items-center mb-4">
              <Text className="text-slate-500 text-xs font-semibold">Simulated Donation:</Text>
              <Text className="text-white font-bold text-xs font-mono">{simDateText}</Text>
            </View>

            <View className="flex-row flex-wrap gap-2">
              <TouchableOpacity 
                onPress={() => simulateCooldown(0)}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-750 px-3 py-2 rounded-lg flex-1 min-w-[120px] items-center"
              >
                <Text className="text-white font-bold text-xs">Donated Today</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => simulateCooldown(28)}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-750 px-3 py-2 rounded-lg flex-1 min-w-[120px] items-center"
              >
                <Text className="text-white font-bold text-xs">28 Days Ago (50%)</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => simulateCooldown(55)}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-750 px-3 py-2 rounded-lg flex-1 min-w-[120px] items-center"
              >
                <Text className="text-white font-bold text-xs">55 Days Ago (1d Left)</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => simulateCooldown(60)}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-750 px-3 py-2 rounded-lg flex-1 min-w-[120px] items-center"
              >
                <Text className="text-white font-bold text-xs">60 Days Ago (Eligible)</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => simulateCooldown(null)}
                className="bg-slate-800/40 hover:bg-slate-850 border border-dashed border-slate-700 px-3 py-2 rounded-lg w-full items-center"
              >
                <Text className="text-slate-400 font-bold text-xs">Reset (Never Donated)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
