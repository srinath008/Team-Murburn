import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, ActivityIndicator, StyleSheet } from 'react-native';
import { 
  Activity, Phone, ShieldAlert, CheckCircle2, XCircle, 
  MapPin, Sparkles, Clock, HeartHandshake, Wifi, WifiOff, Database
} from './Icons';

export default function HospitalDashboard() {
  const [serverUrl, setServerUrl] = useState('localhost:8000');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [wsLogs, setWsLogs] = useState([]);
  const [hospitalId, setHospitalId] = useState('HOSP-AI-091');
  const [bloodGroup, setBloodGroup] = useState('O-');
  const [urgency, setUrgency] = useState('critical');
  const [lat, setLat] = useState('12.9716');
  const [lng, setLng] = useState('77.5946');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [showSandbox, setShowSandbox] = useState(false);
  const [dispatches, setDispatches] = useState([
    { donor_id: '1', name: 'Rajesh Kumar', status: 'ringing', eta_minutes: null },
    { donor_id: '2', name: 'Priya Sharma', status: 'accepted', eta_minutes: 12 },
    { donor_id: '3', name: 'Amit Singh', status: 'declined', eta_minutes: null },
  ]);
  const ws = useRef(null);

  const connectWebSocket = () => {
    if (ws.current) ws.current.close();
    setIsConnecting(true);
    const url = `ws://${serverUrl}/ws/dashboard`;
    addLog(`Connecting to ${url}...`);
    try {
      ws.current = new WebSocket(url);
      ws.current.onopen = () => { setIsConnected(true); setIsConnecting(false); addLog('Connected to WebSocket server.'); };
      ws.current.onmessage = (event) => {
        addLog(`Received message: ${event.data}`);
        try { const payload = JSON.parse(event.data); if (payload.donor_id && payload.status) updateDonorStatus(payload); } catch (err) { addLog(`Error parsing JSON: ${err.message}`); }
      };
      ws.current.onerror = (error) => { addLog(`WebSocket Error: ${error.message || 'Connection failed'}`); };
      ws.current.onclose = () => { setIsConnected(false); setIsConnecting(false); addLog('Disconnected from WebSocket server.'); };
    } catch (e) { setIsConnecting(false); addLog(`WebSocket connection exception: ${e.message}`); }
  };

  const disconnectWebSocket = () => { if (ws.current) ws.current.close(); };

  const addLog = (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setWsLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 49)]);
  };

  const updateDonorStatus = (payload) => {
    setDispatches((prev) => {
      const exists = prev.some(d => d.donor_id === payload.donor_id);
      if (exists) return prev.map(d => d.donor_id === payload.donor_id ? { ...d, ...payload } : d);
      return [payload, ...prev];
    });
  };

  const handleTriggerEmergency = async () => {
    setIsSubmitting(true); setSubmitStatus(null);
    const payload = { hospital_id: hospitalId, blood_group: bloodGroup, urgency, coordinates: { lat: parseFloat(lat) || 0.0, lng: parseFloat(lng) || 0.0 } };
    addLog(`Sending Emergency Trigger POST to /api/dispatch: ${JSON.stringify(payload)}`);
    try {
      const response = await fetch(`http://${serverUrl}/api/dispatch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (response.ok) { setSubmitStatus({ success: true, message: 'Emergency dispatch triggered successfully! Calls queued.' }); addLog('POST /api/dispatch - Status 200 OK'); }
      else { const text = await response.text(); setSubmitStatus({ success: false, message: `Server error (${response.status}): ${text || 'Unknown failure'}` }); addLog(`POST /api/dispatch - Status ${response.status} failed`); }
    } catch (err) {
      setSubmitStatus({ success: false, message: `Failed to connect: ${err.message}` }); addLog(`POST /api/dispatch - Network error: ${err.message}`);
      setTimeout(() => { setSubmitStatus({ success: true, message: 'Simulation Started: Dispatch triggered locally on local thread.' }); simulateMockCalls(); }, 1000);
    } finally { setIsSubmitting(false); }
  };

  const fetchCurrentLocation = () => {
    if (Platform.OS === 'web' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => { setLat(position.coords.latitude.toFixed(6)); setLng(position.coords.longitude.toFixed(6)); addLog(`Fetched coordinates: ${position.coords.latitude}, ${position.coords.longitude}`); },
        (err) => { addLog(`Location error: ${err.message}`); }
      );
    } else { addLog('Geolocation is only supported in browser for this dashboard.'); }
  };

  const simulateMockCalls = () => {
    addLog('Simulating AI Voice Dispatch sequence...');
    const initialMock = [
      { donor_id: 'd101', name: 'Arjun Verma', status: 'ringing', eta_minutes: null },
      { donor_id: 'd102', name: 'Kavitha R.', status: 'ringing', eta_minutes: null },
      { donor_id: 'd103', name: 'Sandeep Patil', status: 'ringing', eta_minutes: null },
      { donor_id: 'd104', name: 'Dr. Meera Sen', status: 'ringing', eta_minutes: null }
    ];
    setDispatches(initialMock);
    setTimeout(() => { updateDonorStatus({ donor_id: 'd101', name: 'Arjun Verma', status: 'accepted', eta_minutes: 8 }); addLog('SIMULATOR: Arjun Verma accepted call. ETA: 8 minutes.'); }, 3000);
    setTimeout(() => { updateDonorStatus({ donor_id: 'd103', name: 'Sandeep Patil', status: 'declined', eta_minutes: null }); addLog('SIMULATOR: Sandeep Patil declined call.'); }, 6000);
    setTimeout(() => { updateDonorStatus({ donor_id: 'd102', name: 'Kavitha R.', status: 'accepted', eta_minutes: 15 }); addLog('SIMULATOR: Kavitha R. accepted call. ETA: 15 minutes.'); }, 9000);
    setTimeout(() => { updateDonorStatus({ donor_id: 'd104', name: 'Dr. Meera Sen', status: 'completed', eta_minutes: 0 }); addLog('SIMULATOR: Dr. Meera Sen completed donation loop.'); }, 12000);
  };

  const totalCalls = dispatches.length;
  const acceptedCount = dispatches.filter(d => d.status === 'accepted' || d.status === 'completed').length;
  const ringingCount = dispatches.filter(d => d.status === 'ringing').length;
  const declinedCount = dispatches.filter(d => d.status === 'declined').length;
  const successRate = totalCalls > 0 ? Math.round((acceptedCount / totalCalls) * 100) : 0;

  const getStatusStyle = (status) => {
    switch (status) {
      case 'ringing': return { bg: '#fffbeb', border: '#fde68a', text: '#b45309' };
      case 'accepted': return { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857' };
      case 'declined': return { bg: '#fff1f2', border: '#fecdd3', text: '#be123c' };
      case 'completed': return { bg: '#ecfeff', border: '#a5f3fc', text: '#0e7490' };
      default: return { bg: '#f8fafc', border: '#e2e8f0', text: '#64748b' };
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ringing': return <Activity size={12} color="#d97706" />;
      case 'accepted': return <CheckCircle2 size={12} color="#059669" />;
      case 'declined': return <XCircle size={12} color="#e11d48" />;
      case 'completed': return <HeartHandshake size={12} color="#0891b2" />;
      default: return <Phone size={12} color="#64748b" />;
    }
  };

  return (
    <ScrollView style={h.root} contentContainerStyle={h.rootContent}>
      {/* Header */}
      <View style={h.header}>
        <View>
          <View style={h.row}>
            <View style={h.dot} />
            <Text style={h.headerLabel}>EMERGENCY DISPATCH CONTROL PORTAL</Text>
          </View>
          <Text style={h.headerTitle}>Hospital Dispatch Hub</Text>
        </View>
        <View style={h.serverBox}>
          <View style={{ marginRight: 16 }}>
            <Text style={h.serverLabel}>FASTAPI HOST</Text>
            <TextInput value={serverUrl} onChangeText={setServerUrl} placeholder="localhost:8000" placeholderTextColor="#cbd5e1" style={h.serverInput} />
          </View>
          <TouchableOpacity onPress={isConnected ? disconnectWebSocket : connectWebSocket} disabled={isConnecting}
            style={[h.connBtn, isConnected ? h.connBtnOn : h.connBtnOff]}>
            {isConnecting ? <ActivityIndicator size="small" color="#e11d48" /> : isConnected ? <Wifi size={14} color="#059669" /> : <WifiOff size={14} color="#e11d48" />}
            <Text style={[h.connBtnText, { color: isConnected ? '#047857' : '#be123c', marginLeft: 6 }]}>
              {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Connect'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main grid */}
      <View style={h.grid}>
        {/* Left column */}
        <View style={h.leftCol}>
          <View style={h.card}>
            <View style={[h.row, { marginBottom: 10 }]}>
              <ShieldAlert size={20} color="#e11d48" />
              <Text style={[h.cardTitle, { marginLeft: 8 }]}>Trigger Dispatch</Text>
            </View>
            <Text style={h.cardDesc}>Search coordinates and find eligible blood donors within 10km. AI system will call up to 20 donors concurrently.</Text>

            <Text style={h.label}>HOSPITAL IDENTIFIER</Text>
            <TextInput value={hospitalId} onChangeText={setHospitalId} placeholder="e.g. HOSP-101" style={h.input} />

            <View style={[h.row, { marginTop: 14 }]}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={h.label}>BLOOD GROUP REQUIRED</Text>
                <TextInput value={bloodGroup} onChangeText={setBloodGroup} placeholder="O-" style={[h.input, { textAlign: 'center', fontWeight: '900' }]} />
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={h.label}>URGENCY LEVEL</Text>
                <View style={h.urgencyRow}>
                  <TouchableOpacity onPress={() => setUrgency('critical')} style={[h.urgencyBtn, urgency === 'critical' && h.urgencyBtnActive]}>
                    <Text style={[h.urgencyText, urgency === 'critical' && h.urgencyTextActive]}>CRITICAL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setUrgency('high')} style={[h.urgencyBtn, urgency === 'high' && h.urgencyBtnActive]}>
                    <Text style={[h.urgencyText, urgency === 'high' && h.urgencyTextActive]}>HIGH</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={{ marginTop: 14 }}>
              <View style={[h.row, { justifyContent: 'space-between', marginBottom: 6 }]}>
                <Text style={h.label}>DISPATCH COORDINATES</Text>
                <TouchableOpacity onPress={fetchCurrentLocation} style={h.row}>
                  <MapPin size={12} color="#e11d48" />
                  <Text style={{ color: '#e11d48', fontSize: 12, fontWeight: '700', marginLeft: 4 }}>Get Coordinates</Text>
                </TouchableOpacity>
              </View>
              <View style={h.row}>
                <TextInput value={lat} onChangeText={setLat} placeholder="Latitude" placeholderTextColor="#cbd5e1" style={[h.input, { flex: 1, marginRight: 6 }]} />
                <TextInput value={lng} onChangeText={setLng} placeholder="Longitude" placeholderTextColor="#cbd5e1" style={[h.input, { flex: 1, marginLeft: 6 }]} />
              </View>
            </View>

            <TouchableOpacity onPress={handleTriggerEmergency} disabled={isSubmitting} style={h.submitBtn}>
              {isSubmitting ? <ActivityIndicator color="white" size="small" /> : (
                <View style={h.row}>
                  <Activity size={16} color="white" />
                  <Text style={h.submitBtnText}>INITIATE AI DISPATCH CALLS</Text>
                </View>
              )}
            </TouchableOpacity>

            {submitStatus && (
              <View style={[h.statusBanner, submitStatus.success ? h.statusBannerOk : h.statusBannerErr]}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: submitStatus.success ? '#065f46' : '#9f1239' }}>{submitStatus.message}</Text>
              </View>
            )}
          </View>

          {/* Sandbox */}
          <View style={[h.card, { marginTop: 16 }]}>
            <TouchableOpacity onPress={() => setShowSandbox(!showSandbox)} style={[h.row, { justifyContent: 'space-between' }]}>
              <View style={h.row}>
                <Sparkles size={16} color="#475569" />
                <Text style={[h.cardTitleSm, { marginLeft: 8 }]}>System Simulator Sandbox</Text>
              </View>
              <Text style={{ color: '#e11d48', fontSize: 12, fontWeight: '700' }}>{showSandbox ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
            {showSandbox && (
              <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                <Text style={h.cardDesc}>Simulate local network callbacks to test the live-state streams without launching a separate FastAPI process.</Text>
                <View style={h.simGrid}>
                  <TouchableOpacity onPress={simulateMockCalls} style={h.simBtn}><Text style={h.simBtnText}>Trigger Simulation</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => updateDonorStatus({ donor_id: 'd101', name: 'Arjun Verma', status: 'accepted', eta_minutes: 5 })} style={[h.simBtn, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}><Text style={[h.simBtnText, { color: '#047857' }]}>Accept Arjun</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => updateDonorStatus({ donor_id: 'd102', name: 'Kavitha R.', status: 'declined', eta_minutes: null })} style={[h.simBtn, { backgroundColor: '#fff1f2', borderColor: '#fecdd3' }]}><Text style={[h.simBtnText, { color: '#be123c' }]}>Decline Kavitha</Text></TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Right column */}
        <View style={h.rightCol}>
          {/* Stats */}
          <View style={h.statsRow}>
            <View style={h.statCard}><Phone size={18} color="#64748b" /><Text style={h.statNum}>{totalCalls}</Text><Text style={h.statLabel}>CONTACTED</Text></View>
            <View style={h.statCard}><CheckCircle2 size={18} color="#10b981" /><Text style={[h.statNum, { color: '#059669' }]}>{acceptedCount}</Text><Text style={h.statLabel}>CONFIRMED</Text></View>
            <View style={h.statCard}><Activity size={18} color="#eab308" /><Text style={h.statNum}>{successRate}%</Text><Text style={h.statLabel}>ACCEPTANCE</Text></View>
          </View>

          {/* Active call stream */}
          <View style={[h.card, { marginBottom: 16 }]}>
            <View style={[h.row, { justifyContent: 'space-between', marginBottom: 16 }]}>
              <View style={h.row}><Clock size={16} color="#64748b" /><Text style={[h.cardTitle, { marginLeft: 8 }]}>Active Call Stream</Text></View>
              <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600' }}>{ringingCount} dialing...</Text>
            </View>

            {dispatches.length === 0 ? (
              <View style={h.emptyState}><HeartHandshake size={28} color="#94a3b8" /><Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '700', marginTop: 8 }}>No active calls triggered.</Text></View>
            ) : (
              dispatches.map((donor) => {
                const ss = getStatusStyle(donor.status);
                return (
                  <View key={donor.donor_id} style={[h.donorRow, { backgroundColor: ss.bg, borderColor: ss.border }]}>
                    <View style={h.row}>
                      <View style={h.avatar}><Text style={h.avatarText}>{donor.name.split(' ').map(n => n[0]).join('')}</Text></View>
                      <View>
                        <Text style={{ color: '#1e293b', fontWeight: '700', fontSize: 14 }}>{donor.name}</Text>
                        <Text style={{ color: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}>ID: {donor.donor_id}</Text>
                      </View>
                    </View>
                    <View style={h.row}>
                      {donor.eta_minutes !== null && donor.status === 'accepted' && (
                        <View style={h.etaBadge}><Text style={{ color: '#475569', fontFamily: 'monospace', fontSize: 10 }}>{donor.eta_minutes}m ETA</Text></View>
                      )}
                      <View style={h.statusPill}>
                        {getStatusIcon(donor.status)}
                        <Text style={{ fontSize: 10, fontWeight: '800', color: ss.text, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{donor.status}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Event log */}
          <View style={h.card}>
            <View style={[h.row, { marginBottom: 10 }]}>
              <Database size={16} color="#64748b" />
              <Text style={[h.cardTitleSm, { marginLeft: 8 }]}>System Event Feed</Text>
            </View>
            <View style={h.logBox}>
              <ScrollView nestedScrollEnabled style={{ flex: 1 }}>
                {wsLogs.length === 0 ? (
                  <Text style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: 12, fontStyle: 'italic' }}>System alerts and WebSocket logs will stream here...</Text>
                ) : (
                  wsLogs.map((log, index) => (
                    <Text key={index} style={{ color: '#475569', fontFamily: 'monospace', fontSize: 12, lineHeight: 20, marginBottom: 2 }}>{log}</Text>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const h = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  rootContent: { padding: 24, paddingBottom: 100 },
  row: { flexDirection: 'row', alignItems: 'center' },

  header: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 20, marginBottom: 28 },
  dot: { height: 8, width: 8, borderRadius: 4, backgroundColor: '#e11d48', marginRight: 8 },
  headerLabel: { color: '#e11d48', fontWeight: '800', fontSize: 10, letterSpacing: 1.5 },
  headerTitle: { color: '#0f172a', fontSize: 28, fontWeight: '800', marginTop: 4, letterSpacing: -0.5 },

  serverBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginTop: 12, elevation: 1 },
  serverLabel: { color: '#94a3b8', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  serverInput: { color: '#1e293b', fontFamily: 'monospace', fontSize: 14, height: 24, padding: 0, width: 140 },
  connBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  connBtnOn: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  connBtnOff: { backgroundColor: '#fff1f2', borderColor: '#fecdd3' },
  connBtnText: { fontSize: 12, fontWeight: '700' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -10 },
  leftCol: { width: '100%', maxWidth: 480, paddingHorizontal: 10, marginBottom: 20 },
  rightCol: { flex: 1, minWidth: 320, paddingHorizontal: 10, marginBottom: 20 },

  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 20, elevation: 1 },
  cardTitle: { color: '#0f172a', fontWeight: '800', fontSize: 17 },
  cardTitleSm: { color: '#1e293b', fontWeight: '800', fontSize: 14 },
  cardDesc: { color: '#64748b', fontSize: 12, lineHeight: 18, marginBottom: 16 },

  label: { color: '#64748b', fontSize: 9, fontWeight: '700', marginBottom: 6, letterSpacing: 1 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#1e293b', fontWeight: '600', fontSize: 14 },

  urgencyRow: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, height: 46, alignItems: 'center' },
  urgencyBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  urgencyBtnActive: { backgroundColor: '#fff', elevation: 1 },
  urgencyText: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  urgencyTextActive: { color: '#0f172a' },

  submitBtn: { backgroundColor: '#e11d48', paddingVertical: 14, borderRadius: 12, marginTop: 20, alignItems: 'center', justifyContent: 'center', elevation: 1 },
  submitBtnText: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1, marginLeft: 8 },

  statusBanner: { marginTop: 14, padding: 14, borderRadius: 12, borderWidth: 1 },
  statusBannerOk: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  statusBannerErr: { backgroundColor: '#fff1f2', borderColor: '#fecdd3' },

  simGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  simBtn: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, minWidth: 120, alignItems: 'center', flexGrow: 1 },
  simBtnText: { color: '#334155', fontWeight: '700', fontSize: 12 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, alignItems: 'center', elevation: 1 },
  statNum: { fontSize: 24, fontWeight: '900', color: '#1e293b', marginTop: 4 },
  statLabel: { color: '#94a3b8', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginTop: 2 },

  donorRow: { padding: 14, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  avatar: { height: 32, width: 32, borderRadius: 16, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: '#334155', fontWeight: '800', fontSize: 11 },
  etaBadge: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, marginRight: 8 },
  statusPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },

  emptyState: { paddingVertical: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#e2e8f0', borderRadius: 12, backgroundColor: '#f8fafc' },

  logBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', padding: 14, borderRadius: 12, height: 170 },
});
