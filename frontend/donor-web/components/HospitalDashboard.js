import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, ActivityIndicator, StyleSheet, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  Activity, Phone, ShieldAlert, CheckCircle2, XCircle, 
  MapPin, Clock, HeartHandshake, Wifi, WifiOff, Database, Map, Lock, LogOut, User
} from './Icons';

const colors = {
  surfaceSunken: '#020617',
  surface: '#0b1326',
  surfaceContainerLow: '#131b2e',
  surfaceContainer: '#171f33',
  surfaceContainerHigh: '#222a3d',
  surfaceContainerHighest: '#2d3449',
  surfaceElevated: '#1E293B',
  primary: '#ffb3ad',
  primaryContainer: '#ff5451',
  onPrimaryContainer: '#5c0008',
  secondary: '#4edea3',
  secondaryContainer: '#00a572',
  tertiary: '#adc6ff',
  tertiaryContainer: '#4d8eff',
  error: '#ffb4ab',
  errorContainer: '#93000a',
  onSurface: '#dae2fd',
  onSurfaceVariant: '#e4beba',
  textMuted: '#94A3B8',
  outline: '#ab8986',
};

const PulseDot = ({ color, size = 12 }) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Animated.View style={{ 
        position: 'absolute', width: size, height: size, borderRadius: size/2, backgroundColor: color, 
        opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }), 
        transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }) }] 
      }} />
      <View style={{ width: size/1.5, height: size/1.5, borderRadius: size, backgroundColor: color }} />
    </View>
  );
};

export default function HospitalDashboard() {
  // ─── AUTHENTICATION STATE ───
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  // Login fields
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration fields
  const [regName, setRegName] = useState('');
  const [regLocation, setRegLocation] = useState('');
  const [regPhone, setRegPhone] = useState('+91 ');
  const [regPassword, setRegPassword] = useState('');

  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [hospitalProfile, setHospitalProfile] = useState(null);

  // ─── APP STATE ───
  const [activeTab, setActiveTab] = useState('command'); // 'command' | 'map' | 'analytics'
  
  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
  const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:8000/ws/dashboard';
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [wsLogs, setWsLogs] = useState([]);
  
  // ─── DISPATCH STATE ───
  const [patientName, setPatientName] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O-');
  const bloodGroupRef = useRef(bloodGroup);
  
  useEffect(() => {
    bloodGroupRef.current = bloodGroup;
  }, [bloodGroup]);
  const [urgency, setUrgency] = useState('critical');
  const [address, setAddress] = useState('');
  const [units, setUnits] = useState('4');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  
  const [dispatches, setDispatches] = useState([]);
  const [analyticsLog, setAnalyticsLog] = useState([]);
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);
  const reconnectAttempts = useRef(0);

  // INITIAL LOAD
  useEffect(() => {
    checkLogin();
  }, []);

  // CONNECT WEBSOCKET ON LOGIN
  useEffect(() => {
    if (isLoggedIn) {
      connectWebSocket();
    }
  }, [isLoggedIn]);

  const checkLogin = async () => {
    try {
      const savedUser = await AsyncStorage.getItem('@hosp_user');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        setHospitalProfile(user);
        setAddress(user.location || '');
        setIsLoggedIn(true);
        loadAnalytics(user.id);
      }
    } catch(e) {}
    setAuthLoading(false);
  };

  const loadAnalytics = async (id) => {
    try {
      const logs = await AsyncStorage.getItem(`@hosp_logs_${id}`);
      if (logs) setAnalyticsLog(JSON.parse(logs));
    } catch(e) {}
  };

  const handleLogin = async () => {
    setAuthError('');
    if (!loginId || !password) return setAuthError('Enter Hospital ID and Password');
    if (!loginId.startsWith('HOSP-')) return setAuthError('Invalid Hospital ID format (e.g. HOSP-123)');
    
    setAuthLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', loginId.toUpperCase());
      formData.append('password', password);
      
      const res = await fetch(`${API_URL}/api/auth/token`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
         body: formData.toString()
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Login failed');
      }
      
      const data = await res.json();
      const user = { ...data.user, token: data.access_token };
      
      await AsyncStorage.setItem('@hosp_user', JSON.stringify(user));
      setHospitalProfile(user);
      setAddress(user.location || '');
      setIsLoggedIn(true);
      loadAnalytics(user.id);
    } catch(e) {
      setAuthError('Login failed: ' + e.message);
    }
    setAuthLoading(false);
  };

  const handleSignup = async () => {
    setAuthError('');
    if (!regName || !regLocation || !regPhone || !regPassword) return setAuthError('Please fill out all registration fields');
    
    setAuthLoading(true);
    try {
      const generatedId = `HOSP-${Math.floor(100 + Math.random() * 900)}`;
      
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: generatedId,
          name: regName,
          location: regLocation,
          phone: regPhone,
          password: regPassword
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Registration failed');
      }
      
      // Auto login after successful signup
      setLoginId(generatedId);
      setPassword(regPassword);
      setIsLoginMode(true);
      setAuthError(`Success! Your Hospital ID is ${generatedId}. Please login.`);
    } catch(e) {
      setAuthError('Signup failed: ' + e.message);
    }
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    disconnectWebSocket();
    await AsyncStorage.removeItem('@hosp_user');
    setIsLoggedIn(false);
    setHospitalProfile(null);
    setLoginId('');
    setPassword('');
    setDispatches([]);
  };

  // ─── WEBSOCKET & LOGIC ───
  const connectWebSocket = () => {
    if (ws.current) ws.current.close();
    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    
    setIsConnecting(true);
    const url = WS_URL;
    addLog(`Connecting to ${url}... (Attempt ${reconnectAttempts.current + 1})`);
    try {
      ws.current = new WebSocket(url);
      ws.current.onopen = () => { 
        setIsConnected(true); 
        setIsConnecting(false); 
        reconnectAttempts.current = 0;
        addLog('Connected to WebSocket server.'); 
      };
      ws.current.onmessage = (event) => {
        addLog(`Received message: ${event.data}`);
        try { const payload = JSON.parse(event.data); if (payload.donor_id && payload.status) updateDonorStatus(payload); } catch (err) { addLog(`Error parsing JSON: ${err.message}`); }
      };
      ws.current.onerror = (error) => { addLog(`WebSocket Error: Connection failed`); };
      ws.current.onclose = () => { 
        setIsConnected(false); 
        setIsConnecting(false); 
        addLog('Disconnected from WebSocket server.'); 
        
        // Auto-reconnect logic
        if (reconnectAttempts.current < 5) {
          const delay = Math.min(1000 * (2 ** reconnectAttempts.current), 10000);
          addLog(`Auto-reconnecting in ${delay/1000}s...`);
          reconnectTimeout.current = setTimeout(() => {
            reconnectAttempts.current += 1;
            connectWebSocket();
          }, delay);
        } else {
          addLog('Max reconnect attempts reached. Please reconnect manually.');
        }
      };
    } catch (e) { setIsConnecting(false); addLog(`WebSocket connection exception: ${e.message}`); }
  };

  const disconnectWebSocket = () => { 
    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    reconnectAttempts.current = 5; // prevent auto-reconnect
    if (ws.current) ws.current.close(); 
  };

  const addLog = (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setWsLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 49)]);
  };

  const updateDonorStatus = async (payload) => {
    setDispatches((prev) => {
      const exists = prev.some(d => d.donor_id === payload.donor_id);
      if (exists) return prev.map(d => d.donor_id === payload.donor_id ? { ...d, ...payload } : d);
      return [{ ...payload, group: bloodGroupRef.current }, ...prev];
    });

    if (payload.status === 'accepted') {
      const newLogEntry = {
        id: Date.now().toString(),
        patient: patientName || 'Emergency Patient',
        donor: payload.name,
        group: bloodGroup,
        time: new Date().toLocaleString(),
        hospital: hospitalProfile?.id || 'HOSP-UNKNOWN'
      };
      const updatedLogs = [newLogEntry, ...analyticsLog];
      setAnalyticsLog(updatedLogs);
      try {
        await AsyncStorage.setItem(`@hosp_logs_${hospitalProfile.id}`, JSON.stringify(updatedLogs));
      } catch (e) {}
    }
  };

  const handleTriggerEmergency = async () => {
    setIsSubmitting(true); setSubmitStatus(null);
    if (!patientName.trim()) { setSubmitStatus({ success: false, message: 'Patient Name is required for logging.'}); setIsSubmitting(false); return; }
    
    // In production, this should integrate with a Geocoding API or Map Pin Drop.
    // Defaulting to 0.0 so the backend geocodes the address field automatically.
    let coords = { lat: 0.0, lng: 0.0 };
    
    const payload = { hospital_id: hospitalProfile?.id, blood_group: bloodGroup, urgency, coordinates: coords, address, patient_name: patientName };
    addLog(`Sending Emergency Trigger POST to /api/dispatch: ${JSON.stringify(payload)}`);
    try {
      const response = await fetch(`${API_URL}/api/dispatch`, { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hospitalProfile?.token || ''}`
        }, 
        body: JSON.stringify(payload) 
      });
      if (response.ok) { setSubmitStatus({ success: true, message: 'Emergency dispatch triggered successfully! Calls queued.' }); addLog('POST /api/dispatch - Status 200 OK'); }
      else { const text = await response.text(); setSubmitStatus({ success: false, message: `Server error (${response.status}): ${text || 'Unknown failure'}` }); addLog(`POST /api/dispatch - Status ${response.status} failed`); }
    } catch (err) {
      setSubmitStatus({ success: false, message: `Failed to connect: ${err.message}` }); addLog(`POST /api/dispatch - Network error: ${err.message}`);
    } finally { setIsSubmitting(false); }
  };

  const handleLogDonation = async (donorId) => {
    try {
      const payload = { donor_id: donorId, hospital_id: hospitalProfile?.id, notes: 'Completed via Dashboard' };
      addLog(`Sending POST to /api/donate for donor: ${donorId}`);
      const response = await fetch(`${API_URL}/api/donate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hospitalProfile?.token || ''}`
        },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        addLog(`Successfully logged donation for ${donorId}. Cooldown started.`);
        setDispatches((prev) => prev.map(d => d.donor_id === donorId ? { ...d, status: 'completed' } : d));
      } else {
        const text = await response.text();
        addLog(`Failed to log donation for ${donorId}: Status ${response.status} - ${text}`);
      }
    } catch (err) {
      addLog(`Error logging donation: ${err.message}`);
    }
  };



  const getStatusInfo = (status) => {
    switch (status) {
      case 'ringing': return { color: colors.tertiaryContainer, text: 'Calling (AI Dispatch)', pulse: true, opacity: 1 };
      case 'accepted': return { color: colors.secondaryContainer, text: 'Accepted', pulse: false, opacity: 1 };
      case 'declined': return { color: colors.outline, text: 'Declined (Unavailable)', pulse: false, opacity: 0.5 };
      case 'completed': return { color: colors.secondary, text: 'Arrived', pulse: false, opacity: 1 };
      default: return { color: colors.textMuted, text: status, pulse: false, opacity: 1 };
    }
  };

  // ─── RENDERERS ───
  if (authLoading) {
    return <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  if (!isLoggedIn) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={s.loginBox}>
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <View style={[s.logoBox, { width: 56, height: 56, borderRadius: 16, marginBottom: 16 }]}><Activity size={32} color={colors.onPrimaryContainer} /></View>
            <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: '800' }}>LifeSource Med</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, letterSpacing: 2, marginTop: 4 }}>HOSPITAL PORTAL</Text>
          </View>

          {isLoginMode ? (
            <>
              <Text style={s.label}>HOSPITAL ID</Text>
              <View style={s.inputWrapper}>
                 <Activity size={18} color={colors.textMuted} style={s.inputIcon} />
                 <TextInput value={loginId} onChangeText={setLoginId} placeholder="e.g. HOSP-001" placeholderTextColor={colors.textMuted} style={s.inputWithIcon} autoCapitalize="characters" />
              </View>

              <Text style={s.label}>PASSWORD</Text>
              <View style={s.inputWrapper}>
                 <Lock size={18} color={colors.textMuted} style={s.inputIcon} />
                 <TextInput value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={colors.textMuted} secureTextEntry style={s.inputWithIcon} />
              </View>

              {authError ? <View style={s.errorBox}><Text style={s.errorText}>{authError}</Text></View> : null}

              <TouchableOpacity onPress={handleLogin} disabled={authLoading} style={s.submitBtn}>
                <Text style={s.submitBtnText}>SECURE LOGIN</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.label}>HOSPITAL NAME</Text>
              <View style={s.inputWrapper}>
                 <Database size={18} color={colors.textMuted} style={s.inputIcon} />
                 <TextInput value={regName} onChangeText={setRegName} placeholder="e.g. City General Hospital" placeholderTextColor={colors.textMuted} style={s.inputWithIcon} />
              </View>

              <Text style={s.label}>HOSPITAL LOCATION</Text>
              <View style={s.inputWrapper}>
                 <MapPin size={18} color={colors.textMuted} style={s.inputIcon} />
                 <TextInput value={regLocation} onChangeText={setRegLocation} placeholder="e.g. Main Ward, 5th Avenue" placeholderTextColor={colors.textMuted} style={s.inputWithIcon} />
              </View>

              <Text style={s.label}>IN-CHARGE NUMBER</Text>
              <View style={s.inputWrapper}>
                 <Phone size={18} color={colors.textMuted} style={s.inputIcon} />
                 <TextInput value={regPhone} onChangeText={(text) => setRegPhone(text.replace(/[^0-9+ ]/g, ''))} placeholder="e.g. +91 9876543210" placeholderTextColor={colors.textMuted} style={s.inputWithIcon} keyboardType="phone-pad" maxLength={14} />
              </View>
              
              <Text style={s.label}>CREATE PASSWORD</Text>
              <View style={s.inputWrapper}>
                 <Lock size={18} color={colors.textMuted} style={s.inputIcon} />
                 <TextInput value={regPassword} onChangeText={setRegPassword} placeholder="••••••••" placeholderTextColor={colors.textMuted} secureTextEntry style={s.inputWithIcon} />
              </View>

              {authError ? <View style={s.errorBox}><Text style={s.errorText}>{authError}</Text></View> : null}

              <TouchableOpacity onPress={handleSignup} disabled={authLoading} style={[s.submitBtn, { backgroundColor: colors.secondaryContainer, shadowColor: colors.secondaryContainer }]}>
                <Text style={[s.submitBtnText, { color: colors.surface }]}>REGISTER HOSPITAL</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity onPress={() => { setIsLoginMode(!isLoginMode); setAuthError(''); }} style={{ marginTop: 24, alignItems: 'center' }}>
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>
              {isLoginMode ? "Don't have an account? " : "Already registered? "}
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>
                {isLoginMode ? "Register Hospital" : "Login"}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* SIDEBAR */}
      <View style={s.sidebar}>
        <View style={s.sidebarHeader}>
          <View style={s.logoBox}><Activity size={24} color={colors.onPrimaryContainer} /></View>
          <Text style={s.sidebarTitle}>LifeSource Med</Text>
          <View style={s.systemStatus}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.secondaryContainer, marginRight: 6 }} />
            <Text style={s.systemStatusText}>SYSTEM STATUS: ACTIVE</Text>
          </View>
        </View>

        <View style={s.navArea}>
          <TouchableOpacity onPress={() => setActiveTab('command')} style={[s.navItem, activeTab === 'command' && s.navItemActive]}>
            <Activity size={18} color={activeTab === 'command' ? colors.primary : colors.textMuted} />
            <Text style={[s.navText, { color: activeTab === 'command' ? colors.primary : colors.textMuted, fontWeight: activeTab === 'command' ? '700' : '500' }]}>Command Center</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('map')} style={[s.navItem, activeTab === 'map' && s.navItemActive]}>
            <Map size={18} color={activeTab === 'map' ? colors.primary : colors.textMuted} />
            <Text style={[s.navText, { color: activeTab === 'map' ? colors.primary : colors.textMuted, fontWeight: activeTab === 'map' ? '700' : '500' }]}>Donor Map</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('analytics')} style={[s.navItem, activeTab === 'analytics' && s.navItemActive]}>
            <Database size={18} color={activeTab === 'analytics' ? colors.primary : colors.textMuted} />
            <Text style={[s.navText, { color: activeTab === 'analytics' ? colors.primary : colors.textMuted, fontWeight: activeTab === 'analytics' ? '700' : '500' }]}>Analytics</Text>
          </TouchableOpacity>
        </View>

        <View style={s.sidebarFooter}>
          <TouchableOpacity onPress={handleLogout} style={s.navItem}>
            <LogOut size={18} color={colors.error} />
            <Text style={[s.navText, { color: colors.error }]}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* MAIN CONTENT */}
      <View style={s.main}>
        {/* TOP APP BAR */}
        <View style={s.topbar}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={s.topbarTitle}>BloodDispatch</Text>
            {activeTab === 'command' && (
              <View style={s.activeBadge}>
                <PulseDot color={colors.error} size={8} />
                <Text style={s.activeBadgeText}>Emergencies: {dispatches.filter(d => d.status === 'ringing').length} Active</Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
              <TouchableOpacity onPress={isConnected ? disconnectWebSocket : connectWebSocket} style={[s.connBtn, isConnected ? s.connBtnOn : s.connBtnOff]}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: isConnected ? '#059669' : colors.onPrimaryContainer }}>
                  {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainer, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
               <User size={12} color={colors.secondary} style={{ marginRight: 6 }} />
               <Text style={{ color: colors.onSurface, fontWeight: '700', fontSize: 12 }}>{hospitalProfile?.name || hospitalProfile?.id}</Text>
            </View>
          </View>
        </View>

        {/* CONTENT AREA */}
        <View style={s.contentGrid}>
          
          {activeTab === 'command' && (
            <>
              {/* LEFT COL: Trigger Control */}
              <View style={s.leftCol}>
                <View style={s.triggerCard}>
                  <Text style={s.cardTitle}>New Dispatch</Text>
                  <Text style={s.cardDesc}>Initiate AI-driven donor contact sequence.</Text>

                  <Text style={s.label}>PATIENT NAME (FOR RECORDS)</Text>
                  <TextInput value={patientName} onChangeText={setPatientName} style={s.input} placeholder="e.g. John Doe" placeholderTextColor={colors.textMuted} />

                  <Text style={s.label}>BLOOD GROUP REQUIRED</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                      <TouchableOpacity key={bg} onPress={() => setBloodGroup(bg)} style={[s.urgencyBtn, { padding: 8, flex: 0, minWidth: 48 }, bloodGroup === bg && s.urgencyBtnActive]}>
                        <Text style={[s.urgencyText, bloodGroup === bg && s.urgencyTextActive]}>{bg}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={s.label}>URGENCY LEVEL</Text>
                  <View style={s.urgencyRow}>
                    {['routine', 'urgent', 'critical'].map(u => (
                      <TouchableOpacity key={u} onPress={() => setUrgency(u)} style={[s.urgencyBtn, urgency === u && s.urgencyBtnActive]}>
                        {urgency === 'critical' && u === 'critical' && <ShieldAlert size={14} color={colors.primary} style={{ marginRight: 6 }} />}
                        <Text style={[s.urgencyText, urgency === u && s.urgencyTextActive, {textTransform: 'capitalize'}]}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={s.label}>DELIVERY LOCATION / WARD</Text>
                  <TextInput value={address} onChangeText={setAddress} style={s.input} placeholder="e.g. Trauma Center, Wing B" placeholderTextColor={colors.textMuted} />

                  <Text style={s.label}>UNITS REQUIRED</Text>
                  <View style={s.unitsBox}>
                    <TouchableOpacity onPress={() => setUnits(u => String(Math.max(1, parseInt(u||0)-1)))} style={s.unitsBtn}><Text style={s.unitsBtnText}>-</Text></TouchableOpacity>
                    <TextInput value={units} onChangeText={(text) => {
                      const num = parseInt(text.replace(/[^0-9]/g, ''));
                      if (!isNaN(num) && num <= 99) setUnits(String(num));
                      else if (text === '') setUnits('');
                    }} style={s.unitsInput} keyboardType="numeric" maxLength={2} />
                    <TouchableOpacity onPress={() => setUnits(u => String(Math.min(99, parseInt(u||0)+1)))} style={s.unitsBtn}><Text style={s.unitsBtnText}>+</Text></TouchableOpacity>
                  </View>

                  <TouchableOpacity onPress={handleTriggerEmergency} disabled={isSubmitting} style={s.submitBtn}>
                    {isSubmitting ? <ActivityIndicator color={colors.onPrimaryContainer} /> : (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Activity size={20} color={colors.onPrimaryContainer} />
                        <Text style={s.submitBtnText}>INITIATE AI DISPATCH</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {submitStatus && (
                    <View style={{ marginTop: 16, padding: 12, borderRadius: 8, backgroundColor: submitStatus.success ? 'rgba(78, 222, 163, 0.1)' : 'rgba(255, 180, 171, 0.1)' }}>
                      <Text style={{ fontSize: 12, color: submitStatus.success ? colors.secondary : colors.error }}>{submitStatus.message}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* RIGHT COL: Live Monitor */}
              <View style={s.rightCol}>
                <View style={s.monitorCard}>
                  <View style={s.monitorHeader}>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={s.monitorTitle}>Live Dispatch Monitor</Text>
                        <View style={{ marginLeft: 12 }}><PulseDot color={colors.secondary} size={10} /></View>
                      </View>
                      <Text style={s.monitorDesc}>Actively pinging {bloodGroup} donors in vicinity of {address}.</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                      <Text style={s.statText}>Contacted: {dispatches.length}</Text>
                      <Text style={[s.statText, { color: colors.secondaryContainer }]}>Accepted: {dispatches.filter(d => d.status === 'accepted').length}</Text>
                    </View>
                  </View>

                  <View style={s.listHeader}>
                    <Text style={[s.listCol, { flex: 4 }]}>DONOR DETAILS</Text>
                    <Text style={[s.listCol, { flex: 2 }]}>GROUP</Text>
                    <Text style={[s.listCol, { flex: 6 }]}>AI CONTACT STATUS</Text>
                  </View>

                  <ScrollView style={s.listContainer} contentContainerStyle={{ padding: 16 }}>
                    {dispatches.map((donor, idx) => {
                      const info = getStatusInfo(donor.status);
                      return (
                        <View key={idx} style={[s.donorRow, { opacity: info.opacity, borderColor: donor.status === 'ringing' ? 'rgba(77, 142, 255, 0.3)' : 'rgba(255,255,255,0.1)' }]}>
                          {donor.status === 'ringing' && <View style={s.ringingPulseBorder} />}
                          
                          <View style={{ flex: 4, flexDirection: 'row', alignItems: 'center' }}>
                            <View style={s.avatar}><Text style={s.avatarText}>{donor.name.split(' ').map(n=>n[0]).join('')}</Text></View>
                            <View>
                              <Text style={s.donorName}>{donor.name}</Text>
                              <Text style={s.donorId}>ID: {donor.donor_id}</Text>
                            </View>
                          </View>

                          <View style={{ flex: 2, justifyContent: 'center' }}>
                            <View style={s.groupBadge}><Text style={s.groupBadgeText}>{donor.group}</Text></View>
                          </View>

                          <View style={{ flex: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              {info.pulse ? <PulseDot color={info.color} size={10} /> : <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: info.color }} />}
                              <Text style={[s.statusText, { color: info.color, marginLeft: 8 }]}>{info.text}</Text>
                            </View>
                            {donor.status === 'accepted' && (
                              <TouchableOpacity onPress={() => handleLogDonation(donor.donor_id)} style={{ backgroundColor: colors.secondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 }}>
                                <Text style={{ color: '#000', fontSize: 10, fontWeight: 'bold' }}>MARK DONATED</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
                
                {/* Logs Area at Bottom */}
                <View style={s.logsCard}>
                  <Text style={[s.cardTitle, { fontSize: 14, marginBottom: 8 }]}>System Event Feed</Text>
                  <ScrollView style={{ height: 100 }}>
                    {wsLogs.map((log, i) => (
                      <Text key={i} style={s.logText}>{log}</Text>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </>
          )}

          {activeTab === 'analytics' && (
             <View style={{ flex: 1 }}>
                <View style={[s.monitorCard, { flex: 1 }]}>
                  <View style={s.monitorHeader}>
                    <View>
                      <Text style={s.monitorTitle}>Analytics & Dispatch Records</Text>
                      <Text style={s.monitorDesc}>Complete history of all successful dispatches for {hospitalProfile?.name || hospitalProfile?.id}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                      <Text style={[s.statText, { color: colors.tertiaryContainer }]}>Total Logs: {analyticsLog.length}</Text>
                    </View>
                  </View>

                  <View style={s.listHeader}>
                    <Text style={[s.listCol, { flex: 2 }]}>DATE & TIME</Text>
                    <Text style={[s.listCol, { flex: 2 }]}>PATIENT NAME</Text>
                    <Text style={[s.listCol, { flex: 2 }]}>DONOR RESPONDER</Text>
                    <Text style={[s.listCol, { flex: 1 }]}>GROUP</Text>
                    <Text style={[s.listCol, { flex: 2, textAlign: 'right' }]}>HOSPITAL ID</Text>
                  </View>

                  <ScrollView style={s.listContainer} contentContainerStyle={{ padding: 16 }}>
                    {analyticsLog.length === 0 ? (
                       <View style={{ alignItems: 'center', padding: 40 }}>
                         <Database size={40} color={colors.surfaceContainerHighest} style={{ marginBottom: 16 }} />
                         <Text style={{ color: colors.textMuted, fontSize: 16, fontWeight: 'bold' }}>No dispatch records found</Text>
                       </View>
                    ) : (
                      analyticsLog.map((log, idx) => (
                        <View key={idx} style={[s.donorRow, { backgroundColor: colors.surfaceContainerLow, borderColor: 'rgba(255,255,255,0.05)' }]}>
                          <View style={{ flex: 2, justifyContent: 'center' }}><Text style={s.logTimeText}>{log.time}</Text></View>
                          <View style={{ flex: 2, justifyContent: 'center' }}><Text style={s.donorName}>{log.patient}</Text></View>
                          <View style={{ flex: 2, justifyContent: 'center' }}>
                             <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                               <CheckCircle2 size={14} color={colors.secondary} style={{ marginRight: 6 }}/>
                               <Text style={[s.donorName, { color: colors.secondary }]}>{log.donor}</Text>
                             </View>
                          </View>
                          <View style={{ flex: 1, justifyContent: 'center' }}>
                            <View style={s.groupBadge}><Text style={s.groupBadgeText}>{log.group}</Text></View>
                          </View>
                          <View style={{ flex: 2, alignItems: 'flex-end', justifyContent: 'center' }}><Text style={s.logHospitalId}>{log.hospital}</Text></View>
                        </View>
                      ))
                    )}
                  </ScrollView>
                </View>
             </View>
          )}

          {activeTab === 'map' && (
             <View style={{ flex: 1, backgroundColor: colors.surfaceSunken, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                <View style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, backgroundColor: 'rgba(11, 19, 38, 0.9)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                   <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: 'bold' }}>Live Donor Network Map</Text>
                   <Text style={{ color: colors.textMuted, marginTop: 2, fontSize: 10 }}>Showing active donors near: {address}</Text>
                </View>
                
                {Platform.OS === 'web' ? (
                  <iframe 
                    width="100%" 
                    height="100%" 
                    style={{ border: 0 }} 
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(address || 'Bangalore, India')}&t=m&z=14&ie=UTF8&iwloc=&output=embed`} 
                    allowFullScreen
                  />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Map size={48} color={colors.textMuted} />
                    <Text style={{ color: colors.textMuted, marginTop: 16 }}>Interactive map only available on Web Dashboard.</Text>
                  </View>
                )}
             </View>
          )}

        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: colors.surfaceSunken },
  
  // LOGIN SCREEN
  loginBox: { width: 420, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 32, elevation: 10 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 },
  inputIcon: { paddingHorizontal: 16 },
  inputWithIcon: { flex: 1, paddingVertical: 14, color: colors.onSurface, fontSize: 16, outlineStyle: 'none' },
  errorBox: { backgroundColor: 'rgba(255, 180, 171, 0.1)', padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: colors.errorContainer },
  errorText: { color: colors.error, fontSize: 12, fontWeight: 'bold' },

  // SIDEBAR
  sidebar: { width: 256, backgroundColor: colors.surfaceContainer, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.1)' },
  sidebarHeader: { padding: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  logoBox: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.primaryContainer, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  sidebarTitle: { color: colors.onSurface, fontSize: 20, fontWeight: '700', fontFamily: 'Inter' },
  systemStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  systemStatusText: { color: colors.secondaryContainer, fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  navArea: { flex: 1, paddingVertical: 24, paddingHorizontal: 16 },
  navItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, marginBottom: 8 },
  navItemActive: { backgroundColor: colors.surfaceContainerHighest, borderRightWidth: 3, borderRightColor: colors.primary },
  navText: { color: colors.textMuted, fontSize: 14, marginLeft: 12 },
  sidebarFooter: { padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },

  // MAIN
  main: { flex: 1, flexDirection: 'column' },
  topbar: { height: 64, backgroundColor: 'rgba(11, 19, 38, 0.8)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32 },
  topbarTitle: { color: colors.onSurface, fontSize: 24, fontWeight: '900' },
  activeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(147, 0, 10, 0.2)', borderWidth: 1, borderColor: colors.errorContainer, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, marginLeft: 16 },
  activeBadgeText: { color: colors.error, fontSize: 12, fontWeight: '600', marginLeft: 8 },
  
  serverInput: { backgroundColor: colors.surfaceContainer, color: colors.onSurface, height: 28, paddingHorizontal: 8, borderRadius: 4, width: 140, fontSize: 12, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', outlineStyle: 'none' },
  connBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, borderWidth: 1 },
  connBtnOn: { backgroundColor: 'rgba(78, 222, 163, 0.1)', borderColor: colors.secondaryContainer },
  connBtnOff: { backgroundColor: 'rgba(255, 180, 171, 0.1)', borderColor: colors.errorContainer },

  contentGrid: { flex: 1, flexDirection: 'row', padding: 32, gap: 32 },
  
  // LEFT COL
  leftCol: { width: '35%' },
  triggerCard: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 24 },
  cardTitle: { color: colors.onSurface, fontSize: 24, fontWeight: '600' },
  cardDesc: { color: colors.textMuted, fontSize: 14, marginTop: 4, marginBottom: 24 },
  label: { color: colors.onSurfaceVariant, fontSize: 12, fontWeight: '600', marginTop: 16, marginBottom: 8, letterSpacing: 0.5, fontFamily: 'monospace' },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 14, color: colors.onSurface, fontSize: 16, outlineStyle: 'none' },
  urgencyRow: { flexDirection: 'row', gap: 12 },
  urgencyBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: colors.surface, flexDirection: 'row' },
  urgencyBtnActive: { borderColor: colors.primary, backgroundColor: 'rgba(255, 179, 173, 0.1)' },
  urgencyText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  urgencyTextActive: { color: colors.primary },
  unitsBox: { flexDirection: 'row', backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden' },
  unitsBtn: { padding: 14, width: 48, alignItems: 'center', backgroundColor: colors.surfaceContainer },
  unitsBtnText: { color: colors.textMuted, fontSize: 18 },
  unitsInput: { flex: 1, textAlign: 'center', color: colors.onSurface, fontSize: 18, fontWeight: 'bold', outlineStyle: 'none' },
  submitBtn: { backgroundColor: colors.primaryContainer, borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 32, shadowColor: colors.primaryContainer, shadowOpacity: 0.3, shadowRadius: 15, shadowOffset: { width: 0, height: 0 } },
  submitBtnText: { color: colors.onPrimaryContainer, fontSize: 16, fontWeight: '800', marginLeft: 8 },

  // RIGHT COL
  rightCol: { flex: 1, flexDirection: 'column', gap: 20 },
  monitorCard: { flex: 1, backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden' },
  monitorHeader: { padding: 24, backgroundColor: colors.surfaceElevated, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  monitorTitle: { color: colors.onSurface, fontSize: 24, fontWeight: '600' },
  monitorDesc: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
  statText: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  listHeader: { flexDirection: 'row', padding: 16, backgroundColor: colors.surfaceContainerLow, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  listCol: { color: colors.onSurfaceVariant, fontSize: 12, fontWeight: '600', fontFamily: 'monospace' },
  listContainer: { flex: 1 },
  
  donorRow: { flexDirection: 'row', padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderRadius: 8, marginBottom: 12, overflow: 'hidden' },
  ringingPulseBorder: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: colors.tertiaryContainer },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceContainer, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginRight: 16 },
  avatarText: { color: colors.textMuted, fontWeight: 'bold' },
  donorName: { color: colors.onSurface, fontSize: 16, fontWeight: '700' },
  donorId: { color: colors.textMuted, fontSize: 12, fontFamily: 'monospace', marginTop: 2 },
  groupBadge: { backgroundColor: colors.surfaceContainerHigh, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  groupBadgeText: { color: colors.onSurface, fontSize: 14, fontWeight: 'bold' },
  statusText: { fontSize: 13, fontWeight: '600' },
  etaValue: { color: colors.onSurface, fontSize: 18, fontWeight: 'bold' },
  etaLabel: { color: colors.textMuted, fontSize: 12 },
  
  logTimeText: { color: colors.textMuted, fontSize: 12, fontFamily: 'monospace' },
  logHospitalId: { color: colors.primary, fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold' },

  logsCard: { backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 16 },
  logText: { color: colors.textMuted, fontFamily: 'monospace', fontSize: 12, marginBottom: 4 }
});
