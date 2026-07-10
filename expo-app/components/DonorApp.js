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
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const donationMidnight = new Date(lastDonatedDate.getFullYear(), lastDonatedDate.getMonth(), lastDonatedDate.getDate());

    const diffTime = todayMidnight.getTime() - donationMidnight.getTime();
    const diffDays = Math.floor(diffTime / MS_IN_A_DAY);
    
    const remaining = Math.max(0, COOLDOWN_DAYS - diffDays);
    const progress = Math.min(100, (diffDays / COOLDOWN_DAYS) * 100);

    setDaysElapsed(diffDays);
    setDaysRemaining(remaining);
    setProgressPercent(progress);

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
      console.log('Saving donor registration payload:', profile);
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
    <ScrollView className="flex-1 bg-slate-50 px-4 py-8 md:px-12" contentContainerStyle={{ paddingBottom: 120 }}>
      {/* Header */}
      <View className="items-center mb-8">
        <View className="h-14 w-14 rounded-2xl bg-rose-600 items-center justify-center shadow-sm mb-3">
          <Heart size={30} color="white" fill="white" />
        </View>
        <Text className="text-slate-800 text-2xl font-black tracking-tight">Donor Lifeline App</Text>
        <Text className="text-slate-400 text-xs mt-1 uppercase font-bold tracking-widest text-center">
          Active Emergency Donor Network
        </Text>
      </View>

      {/* Main Container */}
      {!isRegistered || isEditing ? (
        // REGISTRATION SCREEN
        <View className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <View className="flex-row items-center mb-4">
            <User size={18} color="#e11d48" className="mr-2" />
            <Text className="text-slate-800 font-extrabold text-lg">Zero-Friction Registry</Text>
          </View>
          <Text className="text-slate-500 text-xs mb-6 leading-relaxed">
            Register your detail to join the emergency donor network. You will receive concurrent AI calls if you are eligible and within 10km of a hospital emergency.
          </Text>

          {/* Form */}
          <View className="space-y-4">
            <View>
              <Text className="text-slate-500 text-xs font-bold mb-1.5 uppercase tracking-wider">Full Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Ramesh Patel"
                placeholderTextColor="#cbd5e1"
                className="bg-white border border-slate-200 rounded-xl p-3 text-slate-800 font-semibold text-sm outline-none"
              />
            </View>

            <View className="mt-3">
              <Text className="text-slate-500 text-xs font-bold mb-1.5 uppercase tracking-wider">Phone Number (For AI voice calls)</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. +91 98765 43210"
                placeholderTextColor="#cbd5e1"
                keyboardType="phone-pad"
                className="bg-white border border-slate-200 rounded-xl p-3 text-slate-800 font-semibold text-sm outline-none"
              />
            </View>

            <View className="flex-row -mx-2 mt-3">
              <View className="w-1/2 px-2">
                <Text className="text-slate-500 text-xs font-bold mb-1.5 uppercase tracking-wider">Blood Group</Text>
                <TextInput
                  value={bloodGroup}
                  onChangeText={setBloodGroup}
                  placeholder="e.g. O-"
                  placeholderTextColor="#cbd5e1"
                  className="bg-white border border-slate-200 rounded-xl p-3 text-slate-800 font-black text-sm text-center outline-none"
                />
              </View>
              <View className="w-1/2 px-2">
                <Text className="text-slate-500 text-xs font-bold mb-1.5 uppercase tracking-wider">AI Call Language</Text>
                <TextInput
                  value={language}
                  onChangeText={setLanguage}
                  placeholder="english / hindi / tamil"
                  placeholderTextColor="#cbd5e1"
                  className="bg-white border border-slate-200 rounded-xl p-3 text-slate-800 font-semibold text-sm text-center outline-none"
                />
              </View>
            </View>

            <View className="mt-3">
              <Text className="text-slate-500 text-xs font-bold mb-1.5 uppercase tracking-wider">Coordinates</Text>
              <View className="flex-row space-x-2">
                <TextInput
                  value={lat}
                  onChangeText={setLat}
                  placeholder="Latitude"
                  placeholderTextColor="#cbd5e1"
                  className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-slate-800 font-mono text-sm outline-none"
                />
                <TextInput
                  value={lng}
                  onChangeText={setLng}
                  placeholder="Longitude"
                  placeholderTextColor="#cbd5e1"
                  className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-slate-800 font-mono text-sm outline-none"
                />
              </View>
            </View>

            {regError ? (
              <View className="bg-rose-50 border border-rose-100 p-3 rounded-xl mt-3">
                <Text className="text-rose-700 text-xs font-bold">{regError}</Text>
              </View>
            ) : null}

            {/* Buttons */}
            <View className="flex-row space-x-3 mt-6">
              {isEditing && (
                <TouchableOpacity
                  onPress={() => setIsEditing(false)}
                  className="flex-1 bg-slate-100 border border-slate-200 rounded-xl py-3.5 items-center"
                >
                  <Text className="text-slate-600 text-sm font-bold uppercase">Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleRegister}
                disabled={isSaving}
                className="flex-1 bg-rose-600 active:bg-rose-700 py-3.5 rounded-xl items-center justify-center shadow-sm"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white text-sm font-black uppercase tracking-wider">
                    {isEditing ? 'Save Profile' : 'Register Profile'}
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
          <View className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <View className="flex-row justify-between items-start">
              <View>
                <Text className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">Registered Profile</Text>
                <Text className="text-slate-800 text-xl font-black mt-0.5">{name}</Text>
                <Text className="text-slate-500 text-xs mt-1 font-semibold">{phone}</Text>
              </View>
              <View className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-2.5 items-center justify-center">
                <Text className="text-rose-700 font-black text-lg">{bloodGroup}</Text>
                <Text className="text-rose-600 text-[8px] font-bold uppercase mt-0.5">Group</Text>
              </View>
            </View>

            <View className="flex-row items-center mt-5 pt-4 border-t border-slate-100 justify-between">
              <View className="flex-row items-center">
                <MapPin size={12} color="#64748b" className="mr-1" />
                <Text className="text-slate-500 text-[10px] font-mono">
                  Coordinates: {parseFloat(lat).toFixed(4)}, {parseFloat(lng).toFixed(4)}
                </Text>
              </View>
              <View className="bg-slate-50 rounded-lg px-2 py-1 border border-slate-100">
                <Text className="text-slate-500 text-[9px] uppercase font-bold">{language}</Text>
              </View>
            </View>

            <View className="flex-row space-x-2 mt-4">
              <TouchableOpacity
                onPress={() => setIsEditing(true)}
                className="flex-1 bg-slate-100 border border-slate-200 rounded-xl py-2 items-center"
              >
                <Text className="text-slate-600 font-bold text-xs">Edit Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={clearProfile}
                className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-2 items-center"
              >
                <Text className="text-rose-600 font-bold text-xs">Unregister</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* COOLDOWN TRACKER SECTION */}
          <View className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <Calendar size={18} color="#e11d48" className="mr-2" />
                <Text className="text-slate-800 font-extrabold text-base">Medical Cooldown Tracker</Text>
              </View>
              
              <View className={`rounded-full px-2.5 py-0.5 border ${
                daysRemaining === 0 
                  ? 'bg-emerald-50 border-emerald-200' 
                  : 'bg-rose-50 border-rose-200'
              }`}>
                <Text className={`text-[10px] font-black uppercase tracking-wider ${
                  daysRemaining === 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {daysRemaining === 0 ? 'Eligible' : 'Locked'}
                </Text>
              </View>
            </View>

            <Text className="text-slate-500 text-xs leading-relaxed mb-6">
              To guarantee safety, donors must observe a <Text className="text-slate-800 font-bold">56-day (8 weeks)</Text> recovery cycle before their next donation.
            </Text>

            {/* Cooldown visual progress bar */}
            <View className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-6">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-slate-500 text-xs font-semibold">Recovery Status</Text>
                <Text className="text-slate-700 font-mono font-black text-sm">{Math.round(progressPercent)}%</Text>
              </View>

              {/* Progress Bar Track */}
              <View className="h-3 w-full bg-slate-200 rounded-full overflow-hidden border border-slate-200">
                <View 
                  style={{ width: `${progressPercent}%` }} 
                  className={`h-full rounded-full ${
                    daysRemaining === 0 
                      ? 'bg-emerald-500' 
                      : 'bg-rose-600'
                  }`} 
                />
              </View>

              <View className="flex-row justify-between mt-3">
                <Text className="text-slate-400 text-[10px]">Donated</Text>
                <Text className="text-slate-400 text-[10px]">56 Days (Ready)</Text>
              </View>

              {/* Large Counter Panel */}
              <View className="mt-5 border-t border-slate-250 pt-4 items-center">
                {daysRemaining > 0 ? (
                  <>
                    <Text className="text-rose-600 text-4xl font-black font-mono tracking-tight">{daysRemaining}</Text>
                    <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mt-1">Days Lockout Remaining</Text>
                  </>
                ) : (
                  <View className="items-center py-2">
                    <Check size={28} color="#059669" className="mb-1" />
                    <Text className="text-emerald-700 font-black text-base uppercase tracking-wider">Fully Eligible</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Next Date Message */}
            {daysRemaining > 0 ? (
              <View className="bg-rose-50/50 border border-rose-100 p-4 rounded-xl flex-row items-start">
                <AlertCircle size={16} color="#e11d48" className="mr-2.5 mt-0.5" />
                <View className="flex-1">
                  <Text className="text-rose-700 font-bold text-xs">Exempted from Dispatches</Text>
                  <Text className="text-slate-500 text-[11px] mt-1 leading-relaxed">
                    You are excluded from spatial emergency queries. You will become eligible again on:
                  </Text>
                  <Text className="text-slate-800 font-extrabold text-xs mt-1">{getNextEligibleDateText()}</Text>
                </View>
              </View>
            ) : (
              <View className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl flex-row items-start">
                <Award size={16} color="#059669" className="mr-2.5 mt-0.5" />
                <View className="flex-1">
                  <Text className="text-emerald-700 font-bold text-xs font-mono">Status: Awaiting Dispatch Calls</Text>
                  <Text className="text-slate-500 text-[11px] mt-1 leading-relaxed font-sans">
                    You are fully active in the system. If an emergency matches your blood group within 10km, an AI voice assistant will contact you.
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* COOLDOWN SIMULATOR SECTION */}
          <View className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <View className="flex-row items-center mb-3">
              <RotateCcw size={16} color="#475569" className="mr-2" />
              <Text className="text-slate-800 font-extrabold text-base font-sans">Milestone Simulator</Text>
            </View>
            <Text className="text-slate-500 text-xs mb-4">
              Test how the lockout gauge and dynamic statuses change by simulating different donation milestones:
            </Text>

            <View className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex-row justify-between items-center mb-4">
              <Text className="text-slate-500 text-xs font-semibold">Simulated Donation:</Text>
              <Text className="text-slate-700 font-bold text-xs font-mono">{simDateText}</Text>
            </View>

            <View className="flex-row flex-wrap gap-2">
              <TouchableOpacity 
                onPress={() => simulateCooldown(0)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg flex-1 min-w-[120px] items-center"
              >
                <Text className="text-slate-700 font-bold text-xs">Donated Today</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => simulateCooldown(28)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg flex-1 min-w-[120px] items-center"
              >
                <Text className="text-slate-700 font-bold text-xs">28 Days (50%)</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => simulateCooldown(55)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg flex-1 min-w-[120px] items-center"
              >
                <Text className="text-slate-700 font-bold text-xs">55 Days (1d left)</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => simulateCooldown(60)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg flex-1 min-w-[120px] items-center"
              >
                <Text className="text-slate-700 font-bold text-xs">60 Days (Ready)</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => simulateCooldown(null)}
                className="bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-2 rounded-lg w-full items-center"
              >
                <Text className="text-slate-550 font-bold text-xs">Reset Simulator</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
