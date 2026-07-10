import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  User, Phone, Heart, Calendar, Award, 
  AlertCircle, MapPin, RotateCcw, Check, Map
} from './Icons';

const COOLDOWN_DAYS = 56;
const MS_IN_A_DAY = 24 * 60 * 60 * 1000;

export default function DonorApp() {
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

  const [lastDonatedDate, setLastDonatedDate] = useState(null);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [daysElapsed, setDaysElapsed] = useState(0);
  const [progressPercent, setProgressPercent] = useState(100);
  const [simDateText, setSimDateText] = useState('Never donated');

  useEffect(() => { loadProfile(); }, []);
  useEffect(() => { calculateCooldown(); }, [lastDonatedDate]);

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
    setSimDateText(lastDonatedDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }));
  };

  const handleRegister = async () => {
    setRegError('');
    if (!name.trim()) return setRegError('Name is required');
    if (!phone.trim()) return setRegError('Phone number is required');
    setIsSaving(true);
    const profile = { name, phone, blood_group: bloodGroup, language, lat, lng, last_donated_date: lastDonatedDate ? lastDonatedDate.toISOString() : null };
    try {
      await AsyncStorage.setItem('@donor_profile', JSON.stringify(profile));
      setTimeout(() => { setIsSaving(false); setIsRegistered(true); setIsEditing(false); }, 800);
    } catch (err) {
      setIsSaving(false);
      setRegError(`Failed to save profile: ${err.message}`);
    }
  };

  const simulateCooldown = (daysAgo) => {
    if (daysAgo === null) { setLastDonatedDate(null); saveMockDonationDate(null); return; }
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
    } catch (err) { console.log('Error saving mock donation date:', err); }
  };

  const clearProfile = async () => {
    try {
      await AsyncStorage.removeItem('@donor_profile');
      setName(''); setPhone(''); setBloodGroup('O-'); setLanguage('english');
      setLat('12.9716'); setLng('77.5946'); setLastDonatedDate(null);
      setIsRegistered(false); setIsEditing(false);
    } catch (err) { console.log('Error clearing profile:', err); }
  };

  const getNextEligibleDateText = () => {
    if (!lastDonatedDate) return '';
    const eligibleDate = new Date(lastDonatedDate.getTime());
    eligibleDate.setDate(eligibleDate.getDate() + COOLDOWN_DAYS);
    return eligibleDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.rootContent}>
      {/* Header */}
      <View style={s.headerWrap}>
        <View style={s.headerIcon}><Heart size={30} color="white" /></View>
        <Text style={s.headerTitle}>Donor Lifeline App</Text>
        <Text style={s.headerSub}>ACTIVE EMERGENCY DONOR NETWORK</Text>
      </View>

      {!isRegistered || isEditing ? (
        /* REGISTRATION FORM */
        <View style={s.card}>
          <View style={s.cardTitleRow}>
            <User size={18} color="#e11d48" />
            <Text style={s.cardTitle}>Zero-Friction Registry</Text>
          </View>
          <Text style={s.cardDesc}>Register your details to join the emergency donor network. You will receive concurrent AI calls if you are eligible and within 10km of a hospital emergency.</Text>

          <Text style={s.label}>FULL NAME</Text>
          <TextInput value={name} onChangeText={setName} placeholder="e.g. Ramesh Patel" placeholderTextColor="#cbd5e1" style={s.input} />

          <Text style={[s.label, { marginTop: 14 }]}>PHONE NUMBER (FOR AI VOICE CALLS)</Text>
          <TextInput value={phone} onChangeText={setPhone} placeholder="e.g. +91 98765 43210" placeholderTextColor="#cbd5e1" keyboardType="phone-pad" style={s.input} />

          <View style={s.row}>
            <View style={s.halfCol}>
              <Text style={s.label}>BLOOD GROUP</Text>
              <TextInput value={bloodGroup} onChangeText={setBloodGroup} placeholder="e.g. O-" placeholderTextColor="#cbd5e1" style={[s.input, { textAlign: 'center', fontWeight: '900' }]} />
            </View>
            <View style={s.halfCol}>
              <Text style={s.label}>AI CALL LANGUAGE</Text>
              <TextInput value={language} onChangeText={setLanguage} placeholder="english / hindi / tamil" placeholderTextColor="#cbd5e1" style={[s.input, { textAlign: 'center' }]} />
            </View>
          </View>

          <Text style={[s.label, { marginTop: 14 }]}>COORDINATES</Text>
          <View style={s.row}>
            <TextInput value={lat} onChangeText={setLat} placeholder="Latitude" placeholderTextColor="#cbd5e1" style={[s.input, { flex: 1, marginRight: 6 }]} />
            <TextInput value={lng} onChangeText={setLng} placeholder="Longitude" placeholderTextColor="#cbd5e1" style={[s.input, { flex: 1, marginLeft: 6 }]} />
          </View>

          {regError ? (
            <View style={s.errorBox}><Text style={s.errorText}>{regError}</Text></View>
          ) : null}

          <View style={[s.row, { marginTop: 20 }]}>
            {isEditing && (
              <TouchableOpacity onPress={() => setIsEditing(false)} style={s.btnSecondary}>
                <Text style={s.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleRegister} disabled={isSaving} style={[s.btnPrimary, { flex: 1, marginLeft: isEditing ? 10 : 0 }]}>
              {isSaving ? <ActivityIndicator size="small" color="white" /> : (
                <Text style={s.btnPrimaryText}>{isEditing ? 'SAVE PROFILE' : 'REGISTER PROFILE'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* DONOR HOME / COOLDOWN DASHBOARD */
        <View>
          {/* Profile card */}
          <View style={s.card}>
            <View style={[s.row, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
              <View>
                <Text style={s.labelTiny}>REGISTERED PROFILE</Text>
                <Text style={s.profileName}>{name}</Text>
                <Text style={s.profilePhone}>{phone}</Text>
              </View>
              <View style={s.bloodBadge}>
                <Text style={s.bloodBadgeText}>{bloodGroup}</Text>
                <Text style={s.bloodBadgeSub}>GROUP</Text>
              </View>
            </View>

            <View style={s.profileMetaRow}>
              <View style={s.row}>
                <MapPin size={12} color="#64748b" />
                <Text style={s.metaText}>  {parseFloat(lat).toFixed(4)}, {parseFloat(lng).toFixed(4)}</Text>
              </View>
              <View style={s.langBadge}><Text style={s.langBadgeText}>{language.toUpperCase()}</Text></View>
            </View>

            <View style={[s.row, { marginTop: 14 }]}>
              <TouchableOpacity onPress={() => setIsEditing(true)} style={[s.btnSecondary, { flex: 1, marginRight: 8 }]}>
                <Text style={s.btnSecondaryText}>Edit Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={clearProfile} style={s.btnDanger}>
                <Text style={s.btnDangerText}>Unregister</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Cooldown tracker */}
          <View style={[s.card, { marginTop: 16 }]}>
            <View style={[s.row, { justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }]}>
              <View style={s.row}>
                <Calendar size={18} color="#e11d48" />
                <Text style={[s.cardTitle, { marginLeft: 8 }]}>Medical Cooldown Tracker</Text>
              </View>
              <View style={[s.statusBadge, daysRemaining === 0 ? s.statusEligible : s.statusLocked]}>
                <Text style={[s.statusBadgeText, daysRemaining === 0 ? s.statusEligibleText : s.statusLockedText]}>
                  {daysRemaining === 0 ? 'ELIGIBLE' : 'LOCKED'}
                </Text>
              </View>
            </View>

            <Text style={s.cardDesc}>
              To guarantee safety, donors must observe a 56-day (8 weeks) recovery cycle before their next donation.
            </Text>

            {/* Progress bar area */}
            <View style={s.progressBox}>
              <View style={[s.row, { justifyContent: 'space-between', marginBottom: 8 }]}>
                <Text style={s.progressLabel}>Recovery Status</Text>
                <Text style={s.progressValue}>{Math.round(progressPercent)}%</Text>
              </View>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${progressPercent}%`, backgroundColor: daysRemaining === 0 ? '#10b981' : '#e11d48' }]} />
              </View>
              <View style={[s.row, { justifyContent: 'space-between', marginTop: 6 }]}>
                <Text style={s.progressHint}>Donated</Text>
                <Text style={s.progressHint}>56 Days (Ready)</Text>
              </View>

              <View style={s.counterPanel}>
                {daysRemaining > 0 ? (
                  <>
                    <Text style={s.counterNumber}>{daysRemaining}</Text>
                    <Text style={s.counterLabel}>DAYS LOCKOUT REMAINING</Text>
                  </>
                ) : (
                  <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                    <Check size={28} color="#059669" />
                    <Text style={s.eligibleText}>FULLY ELIGIBLE</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Status message */}
            {daysRemaining > 0 ? (
              <View style={s.alertBoxRose}>
                <AlertCircle size={16} color="#e11d48" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.alertTitle}>Exempted from Dispatches</Text>
                  <Text style={s.alertDesc}>You are excluded from spatial emergency queries. You will become eligible again on:</Text>
                  <Text style={s.alertDate}>{getNextEligibleDateText()}</Text>
                </View>
              </View>
            ) : (
              <View style={s.alertBoxGreen}>
                <Award size={16} color="#059669" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.alertTitleGreen}>Status: Awaiting Dispatch Calls</Text>
                  <Text style={s.alertDesc}>You are fully active in the system. If an emergency matches your blood group within 10km, an AI voice assistant will contact you.</Text>
                </View>
              </View>
            )}
          </View>

          {/* Simulator */}
          <View style={[s.card, { marginTop: 16 }]}>
            <View style={s.row}>
              <RotateCcw size={16} color="#475569" />
              <Text style={[s.cardTitle, { marginLeft: 8 }]}>Milestone Simulator</Text>
            </View>
            <Text style={[s.cardDesc, { marginTop: 6 }]}>Test how the lockout gauge and dynamic statuses change by simulating different donation milestones:</Text>

            <View style={s.simInfoRow}>
              <Text style={s.simInfoLabel}>Simulated Donation:</Text>
              <Text style={s.simInfoValue}>{simDateText}</Text>
            </View>

            <View style={s.simGrid}>
              <TouchableOpacity onPress={() => simulateCooldown(0)} style={s.simBtn}><Text style={s.simBtnText}>Donated Today</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => simulateCooldown(28)} style={s.simBtn}><Text style={s.simBtnText}>28 Days (50%)</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => simulateCooldown(55)} style={s.simBtn}><Text style={s.simBtnText}>55 Days (1d left)</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => simulateCooldown(60)} style={s.simBtn}><Text style={s.simBtnText}>60 Days (Ready)</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => simulateCooldown(null)} style={[s.simBtn, { flexBasis: '100%' }]}><Text style={s.simBtnText}>Reset Simulator</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  rootContent: { paddingHorizontal: 16, paddingTop: 52, paddingBottom: 120 },
  headerWrap: { alignItems: 'center', marginBottom: 28 },
  headerIcon: { height: 56, width: 56, borderRadius: 16, backgroundColor: '#e11d48', alignItems: 'center', justifyContent: 'center', marginBottom: 12, elevation: 2 },
  headerTitle: { color: '#1e293b', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  headerSub: { color: '#94a3b8', fontSize: 10, marginTop: 4, fontWeight: '700', letterSpacing: 2 },

  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20, padding: 20, elevation: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardTitle: { color: '#1e293b', fontWeight: '800', fontSize: 16 },
  cardDesc: { color: '#64748b', fontSize: 12, lineHeight: 18, marginBottom: 16 },

  label: { color: '#64748b', fontSize: 10, fontWeight: '700', marginBottom: 6, letterSpacing: 1 },
  labelTiny: { color: '#94a3b8', fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#1e293b', fontWeight: '600', fontSize: 14 },

  row: { flexDirection: 'row', alignItems: 'center' },
  halfCol: { flex: 1, marginHorizontal: 4, marginTop: 14 },

  errorBox: { backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecdd3', padding: 12, borderRadius: 12, marginTop: 12 },
  errorText: { color: '#be123c', fontSize: 12, fontWeight: '700' },

  btnPrimary: { backgroundColor: '#e11d48', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', elevation: 1 },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  btnSecondary: { flex: 1, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  btnSecondaryText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  btnDanger: { backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecdd3', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  btnDangerText: { color: '#e11d48', fontSize: 12, fontWeight: '700' },

  profileName: { color: '#1e293b', fontSize: 20, fontWeight: '900', marginTop: 2 },
  profilePhone: { color: '#64748b', fontSize: 12, marginTop: 4, fontWeight: '600' },
  bloodBadge: { backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecdd3', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  bloodBadgeText: { color: '#be123c', fontWeight: '900', fontSize: 18 },
  bloodBadgeSub: { color: '#e11d48', fontSize: 8, fontWeight: '700', marginTop: 2 },

  profileMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9', justifyContent: 'space-between' },
  metaText: { color: '#64748b', fontSize: 10, fontFamily: 'monospace' },
  langBadge: { backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#f1f5f9' },
  langBadgeText: { color: '#64748b', fontSize: 9, fontWeight: '700' },

  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  statusEligible: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  statusLocked: { backgroundColor: '#fff1f2', borderColor: '#fecdd3' },
  statusBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  statusEligibleText: { color: '#047857' },
  statusLockedText: { color: '#be123c' },

  progressBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9', borderRadius: 16, padding: 18, marginBottom: 16 },
  progressLabel: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  progressValue: { color: '#334155', fontFamily: 'monospace', fontWeight: '900', fontSize: 14 },
  progressTrack: { height: 12, width: '100%', backgroundColor: '#e2e8f0', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  progressHint: { color: '#94a3b8', fontSize: 10 },

  counterPanel: { marginTop: 18, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 16, alignItems: 'center' },
  counterNumber: { color: '#e11d48', fontSize: 40, fontWeight: '900', fontFamily: 'monospace' },
  counterLabel: { color: '#64748b', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 4 },
  eligibleText: { color: '#047857', fontWeight: '900', fontSize: 15, letterSpacing: 1, marginTop: 6 },

  alertBoxRose: { backgroundColor: '#fff5f5', borderWidth: 1, borderColor: '#fecdd3', padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'flex-start' },
  alertBoxGreen: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'flex-start' },
  alertTitle: { color: '#be123c', fontWeight: '700', fontSize: 12 },
  alertTitleGreen: { color: '#047857', fontWeight: '700', fontSize: 12 },
  alertDesc: { color: '#64748b', fontSize: 11, marginTop: 4, lineHeight: 16 },
  alertDate: { color: '#1e293b', fontWeight: '800', fontSize: 12, marginTop: 4 },

  simInfoRow: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  simInfoLabel: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  simInfoValue: { color: '#334155', fontWeight: '700', fontSize: 12, fontFamily: 'monospace' },
  simGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  simBtn: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, flexBasis: '48%', alignItems: 'center' },
  simBtnText: { color: '#334155', fontWeight: '700', fontSize: 12 },
});
