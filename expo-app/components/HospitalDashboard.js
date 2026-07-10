import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { 
  Activity, Phone, ShieldAlert, CheckCircle2, XCircle, 
  MapPin, Sparkles, Clock, HeartHandshake, Wifi, WifiOff, Database
} from 'lucide-react-native';

export default function HospitalDashboard() {
  // Config & Status
  const [serverUrl, setServerUrl] = useState('localhost:8000');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [wsLogs, setWsLogs] = useState([]);
  
  // Trigger Emergency Form State
  const [hospitalId, setHospitalId] = useState('HOSP-AI-091');
  const [bloodGroup, setBloodGroup] = useState('O-');
  const [urgency, setUrgency] = useState('critical');
  const [lat, setLat] = useState('12.9716');
  const [lng, setLng] = useState('77.5946');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  // Active Dispatches (WebSocket stream state)
  const [dispatches, setDispatches] = useState([
    { donor_id: '1', name: 'Rajesh Kumar', status: 'ringing', eta_minutes: null },
    { donor_id: '2', name: 'Priya Sharma', status: 'accepted', eta_minutes: 12 },
    { donor_id: '3', name: 'Amit Singh', status: 'declined', eta_minutes: null },
  ]);

  const ws = useRef(null);

  // Connect/Disconnect WebSocket
  const connectWebSocket = () => {
    if (ws.current) ws.current.close();
    
    setIsConnecting(true);
    const url = `ws://${serverUrl}/ws/dashboard`;
    addLog(`Connecting to ${url}...`);

    try {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        addLog('Connected to WebSocket server.');
      };

      ws.current.onmessage = (event) => {
        addLog(`Received message: ${event.data}`);
        try {
          const payload = JSON.parse(event.data);
          if (payload.donor_id && payload.status) {
            updateDonorStatus(payload);
          }
        } catch (err) {
          addLog(`Error parsing JSON: ${err.message}`);
        }
      };

      ws.current.onerror = (error) => {
        addLog(`WebSocket Error: ${error.message || 'Connection failed'}`);
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        addLog('Disconnected from WebSocket server.');
      };
    } catch (e) {
      setIsConnecting(false);
      addLog(`WebSocket connection exception: ${e.message}`);
    }
  };

  const disconnectWebSocket = () => {
    if (ws.current) {
      ws.current.close();
    }
  };

  const addLog = (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setWsLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 49)]);
  };

  const updateDonorStatus = (payload) => {
    setDispatches((prev) => {
      const exists = prev.some(d => d.donor_id === payload.donor_id);
      if (exists) {
        return prev.map(d => d.donor_id === payload.donor_id ? { ...d, ...payload } : d);
      } else {
        return [payload, ...prev];
      }
    });
  };

  // Trigger Emergency via REST API
  const handleTriggerEmergency = async () => {
    setIsSubmitting(true);
    setSubmitStatus(null);
    
    const payload = {
      hospital_id: hospitalId,
      blood_group: bloodGroup,
      urgency: urgency,
      coordinates: {
        lat: parseFloat(lat) || 0.0,
        lng: parseFloat(lng) || 0.0
      }
    };

    addLog(`Sending Emergency Trigger POST to /api/dispatch: ${JSON.stringify(payload)}`);

    try {
      const response = await fetch(`http://${serverUrl}/api/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setSubmitStatus({ success: true, message: 'Emergency dispatch triggered successfully! Calls queued.' });
        addLog('POST /api/dispatch - Status 200 OK');
      } else {
        const text = await response.text();
        setSubmitStatus({ success: false, message: `Server error (${response.status}): ${text || 'Unknown failure'}` });
        addLog(`POST /api/dispatch - Status ${response.status} failed`);
      }
    } catch (err) {
      setSubmitStatus({ success: false, message: `Failed to connect: ${err.message}` });
      addLog(`POST /api/dispatch - Network error: ${err.message}`);
      
      // Fallback/Mock behavior: Let developer know we fell back to simulation
      setTimeout(() => {
        setSubmitStatus({ 
          success: true, 
          message: 'MOCK MODE: Emergency dispatch simulation triggered locally!' 
        });
        simulateMockCalls();
      }, 1000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-fetch Coordinates
  const fetchCurrentLocation = () => {
    if (Platform.OS === 'web' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude.toFixed(6));
          setLng(position.coords.longitude.toFixed(6));
          addLog(`Fetched coordinates: ${position.coords.latitude}, ${position.coords.longitude}`);
        },
        (err) => {
          addLog(`Location error: ${err.message}`);
        }
      );
    } else {
      addLog('Geolocation is only supported in web browser for this dashboard.');
    }
  };

  // Mock Calls Generator
  const simulateMockCalls = () => {
    addLog('Simulating AI Voice Dispatch sequence...');
    
    // Clear current dispatches for clean simulation
    const initialMock = [
      { donor_id: 'd101', name: 'Arjun Verma', status: 'ringing', eta_minutes: null },
      { donor_id: 'd102', name: 'Kavitha R.', status: 'ringing', eta_minutes: null },
      { donor_id: 'd103', name: 'Sandeep Patil', status: 'ringing', eta_minutes: null },
      { donor_id: 'd104', name: 'Dr. Meera Sen', status: 'ringing', eta_minutes: null }
    ];
    setDispatches(initialMock);

    // Timeline simulations
    setTimeout(() => {
      updateDonorStatus({ donor_id: 'd101', name: 'Arjun Verma', status: 'accepted', eta_minutes: 8 });
      addLog('MOCK EVENT: Arjun Verma accepted call. ETA: 8 minutes.');
    }, 4000);

    setTimeout(() => {
      updateDonorStatus({ donor_id: 'd103', name: 'Sandeep Patil', status: 'declined', eta_minutes: null });
      addLog('MOCK EVENT: Sandeep Patil declined call.');
    }, 7000);

    setTimeout(() => {
      updateDonorStatus({ donor_id: 'd102', name: 'Kavitha R.', status: 'accepted', eta_minutes: 15 });
      addLog('MOCK EVENT: Kavitha R. accepted call. ETA: 15 minutes.');
    }, 11000);

    setTimeout(() => {
      updateDonorStatus({ donor_id: 'd104', name: 'Dr. Meera Sen', status: 'completed', eta_minutes: 0 });
      addLog('MOCK EVENT: Dr. Meera Sen completed donation loop.');
    }, 15000);
  };

  // Statistics
  const totalCalls = dispatches.length;
  const acceptedCount = dispatches.filter(d => d.status === 'accepted' || d.status === 'completed').length;
  const ringingCount = dispatches.filter(d => d.status === 'ringing').length;
  const declinedCount = dispatches.filter(d => d.status === 'declined').length;
  const successRate = totalCalls > 0 ? Math.round((acceptedCount / totalCalls) * 100) : 0;

  return (
    <ScrollView className="flex-1 bg-slate-950 p-4 md:p-8" contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Top Header */}
      <View className="flex-row flex-wrap items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <View>
          <View className="flex-row items-center space-x-2">
            <View className="h-2 w-2 rounded-full bg-red-500 animate-pulse mr-2" />
            <Text className="text-red-500 font-extrabold text-sm tracking-widest uppercase">
              AI Emergency Dispatch Network
            </Text>
          </View>
          <Text className="text-white text-3xl font-black tracking-tight mt-1">
            HOSPITAL CONTROL HUB
          </Text>
        </View>

        {/* Server Config & Connection indicator */}
        <View className="flex-row items-center bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl mt-4 md:mt-0">
          <View className="mr-4">
            <Text className="text-slate-500 text-[10px] uppercase font-bold">FastAPI Server Host</Text>
            <TextInput
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="localhost:8000"
              placeholderTextColor="#475569"
              className="text-white font-mono text-sm h-6 p-0 w-36"
            />
          </View>
          <TouchableOpacity 
            onPress={isConnected ? disconnectWebSocket : connectWebSocket}
            disabled={isConnecting}
            className={`px-3 py-1.5 rounded-lg flex-row items-center ${
              isConnected 
                ? 'bg-emerald-500/10 border border-emerald-500/30' 
                : 'bg-red-500/10 border border-red-500/30'
            }`}
          >
            {isConnecting ? (
              <ActivityIndicator size="small" color="#ef4444" className="mr-1.5" />
            ) : isConnected ? (
              <Wifi size={14} color="#10b981" className="mr-1.5" />
            ) : (
              <WifiOff size={14} color="#ef4444" className="mr-1.5" />
            )}
            <Text className={`text-xs font-bold ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
              {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Connect WS'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Grid Layout */}
      <View className="flex-row flex-wrap -mx-2">
        {/* Left Column: Form Controls */}
        <View className="w-full lg:w-5/12 px-2 mb-6">
          <View className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl">
            <View className="flex-row items-center mb-4">
              <ShieldAlert size={20} color="#ef4444" className="mr-2" />
              <Text className="text-white font-black text-lg">Trigger Blood Emergency</Text>
            </View>
            <Text className="text-slate-400 text-sm mb-6 leading-relaxed">
              Queue concurrent, localized AI voice dispatch phone calls to all matching donors within 10km.
            </Text>

            {/* Inputs */}
            <View className="space-y-4">
              <View>
                <Text className="text-slate-400 text-xs font-bold mb-1.5 uppercase tracking-wider">Hospital Identifier</Text>
                <TextInput
                  value={hospitalId}
                  onChangeText={setHospitalId}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-semibold text-sm"
                  placeholder="e.g. HOSP-101"
                  placeholderTextColor="#475569"
                />
              </View>

              <View className="flex-row -mx-2 mt-3">
                <View className="w-1/2 px-2">
                  <Text className="text-slate-400 text-xs font-bold mb-1.5 uppercase tracking-wider">Blood Group Required</Text>
                  <View className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                    <TextInput
                      value={bloodGroup}
                      onChangeText={setBloodGroup}
                      className="p-3 text-white font-black text-sm text-center"
                      placeholder="O-"
                      placeholderTextColor="#475569"
                    />
                  </View>
                </View>
                <View className="w-1/2 px-2">
                  <Text className="text-slate-400 text-xs font-bold mb-1.5 uppercase tracking-wider">Urgency Level</Text>
                  <View className="flex-row bg-slate-950 border border-slate-800 rounded-xl p-1 justify-between">
                    <TouchableOpacity 
                      onPress={() => setUrgency('critical')}
                      className={`flex-1 py-2 rounded-lg items-center ${urgency === 'critical' ? 'bg-red-600' : 'bg-transparent'}`}
                    >
                      <Text className={`text-xs font-extrabold uppercase ${urgency === 'critical' ? 'text-white' : 'text-slate-400'}`}>Critical</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => setUrgency('high')}
                      className={`flex-1 py-2 rounded-lg items-center ${urgency === 'high' ? 'bg-amber-600' : 'bg-transparent'}`}
                    >
                      <Text className={`text-xs font-extrabold uppercase ${urgency === 'high' ? 'text-white' : 'text-slate-400'}`}>High</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View className="mt-3">
                <View className="flex-row justify-between items-center mb-1.5">
                  <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider">Dispatch Coordinates</Text>
                  <TouchableOpacity onPress={fetchCurrentLocation} className="flex-row items-center">
                    <MapPin size={12} color="#f87171" className="mr-1" />
                    <Text className="text-red-400 text-xs font-bold hover:underline">Get Current</Text>
                  </TouchableOpacity>
                </View>
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

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleTriggerEmergency}
                disabled={isSubmitting}
                className="bg-red-600 active:bg-red-700 py-4 rounded-xl mt-6 items-center flex-row justify-center shadow-lg shadow-red-900/40"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Activity size={18} color="white" className="mr-2" />
                    <Text className="text-white text-base font-black uppercase tracking-wider">
                      Initiate Voice Dispatch
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Submit Response Banner */}
            {submitStatus && (
              <View className={`mt-4 p-4 rounded-xl border ${
                submitStatus.success 
                  ? 'bg-emerald-500/10 border-emerald-500/20' 
                  : 'bg-red-500/10 border-red-500/20'
              }`}>
                <Text className={`text-sm font-bold leading-relaxed ${submitStatus.success ? 'text-emerald-400' : 'text-red-400'}`}>
                  {submitStatus.message}
                </Text>
              </View>
            )}
          </View>

          {/* Quick Mock Controller (For Test/Demo) */}
          <View className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl mt-6">
            <View className="flex-row items-center mb-3">
              <Sparkles size={18} color="#e2e8f0" className="mr-2" />
              <Text className="text-white font-black text-base">Local Mock Controller</Text>
            </View>
            <Text className="text-slate-400 text-xs mb-4">
              Since database querying is restricted to backend models, simulate state events directly to test status changes.
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <TouchableOpacity 
                onPress={simulateMockCalls}
                className="bg-slate-800 border border-slate-700/60 hover:bg-slate-700 px-3 py-2 rounded-lg flex-1 min-w-[120px] items-center"
              >
                <Text className="text-white font-bold text-xs">Simulate Call Loop</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => updateDonorStatus({ donor_id: 'd101', name: 'Arjun Verma', status: 'accepted', eta_minutes: 5 })}
                className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 rounded-lg flex-1 min-w-[120px] items-center"
              >
                <Text className="text-emerald-400 font-bold text-xs">Accept Arjun</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => updateDonorStatus({ donor_id: 'd102', name: 'Kavitha R.', status: 'declined', eta_minutes: null })}
                className="bg-red-500/10 border border-red-500/30 px-3 py-2 rounded-lg flex-1 min-w-[120px] items-center"
              >
                <Text className="text-red-400 font-bold text-xs">Decline Kavitha</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Right Column: Statistics & Live updates */}
        <View className="w-full lg:w-7/12 px-2 mb-6">
          {/* Statistics Grid */}
          <View className="flex-row flex-wrap -mx-1 mb-6">
            <View className="w-1/3 px-1">
              <View className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 items-center">
                <Phone size={18} color="#94a3b8" />
                <Text className="text-2xl font-black text-white mt-1">{totalCalls}</Text>
                <Text className="text-slate-500 text-[9px] uppercase font-black">Dispatched</Text>
              </View>
            </View>
            <View className="w-1/3 px-1">
              <View className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 items-center">
                <CheckCircle2 size={18} color="#10b981" />
                <Text className="text-2xl font-black text-emerald-400 mt-1">{acceptedCount}</Text>
                <Text className="text-slate-500 text-[9px] uppercase font-black">Accepted</Text>
              </View>
            </View>
            <View className="w-1/3 px-1">
              <View className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 items-center">
                <Activity size={18} color="#f59e0b" />
                <Text className="text-2xl font-black text-amber-500 mt-1">{successRate}%</Text>
                <Text className="text-slate-500 text-[9px] uppercase font-black">Success Rate</Text>
              </View>
            </View>
          </View>

          {/* Active Dispatches list */}
          <View className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl mb-6">
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-row items-center">
                <Clock size={18} color="#f59e0b" className="mr-2" />
                <Text className="text-white font-black text-base">Active Call Stream</Text>
              </View>
              <Text className="text-slate-500 text-xs font-semibold">{ringingCount} Ringing</Text>
            </View>

            {/* Scrollable list */}
            <View className="max-h-72 overflow-y-auto space-y-3">
              {dispatches.length === 0 ? (
                <View className="py-8 items-center justify-center border border-dashed border-slate-800 rounded-xl">
                  <HeartHandshake size={28} color="#475569" className="mb-2" />
                  <Text className="text-slate-500 text-sm font-bold">No active calls triggered yet.</Text>
                </View>
              ) : (
                dispatches.map((donor) => {
                  let statusBg = 'bg-slate-950 border-slate-800';
                  let statusTextClass = 'text-slate-400';
                  let icon = <Phone size={14} color="#94a3b8" />;

                  if (donor.status === 'ringing') {
                    statusBg = 'bg-amber-500/5 border-amber-500/20';
                    statusTextClass = 'text-amber-400';
                    icon = <Activity size={14} color="#f59e0b" className="animate-pulse" />;
                  } else if (donor.status === 'accepted') {
                    statusBg = 'bg-emerald-500/5 border-emerald-500/20';
                    statusTextClass = 'text-emerald-400';
                    icon = <CheckCircle2 size={14} color="#10b981" />;
                  } else if (donor.status === 'declined') {
                    statusBg = 'bg-red-500/5 border-red-500/20';
                    statusTextClass = 'text-red-400';
                    icon = <XCircle size={14} color="#ef4444" />;
                  } else if (donor.status === 'completed') {
                    statusBg = 'bg-cyan-500/5 border-cyan-500/20';
                    statusTextClass = 'text-cyan-400';
                    icon = <HeartHandshake size={14} color="#06b6d4" />;
                  }

                  return (
                    <View key={donor.donor_id} className={`p-4 rounded-xl border flex-row items-center justify-between ${statusBg}`}>
                      <View className="flex-row items-center">
                        <View className="h-8 w-8 rounded-full bg-slate-800 items-center justify-center mr-3">
                          <Text className="text-white font-black text-xs">
                            {donor.name.split(' ').map(n => n[0]).join('')}
                          </Text>
                        </View>
                        <View>
                          <Text className="text-white font-bold text-sm">{donor.name}</Text>
                          <Text className="text-slate-500 text-[10px]">ID: {donor.donor_id}</Text>
                        </View>
                      </View>

                      <View className="flex-row items-center space-x-2">
                        {donor.eta_minutes !== null && donor.status === 'accepted' && (
                          <View className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 mr-2">
                            <Text className="text-slate-300 font-mono text-[10px]">
                              {donor.eta_minutes} min ETA
                            </Text>
                          </View>
                        )}
                        <View className="flex-row items-center border border-slate-800/20 bg-slate-900/40 rounded-full px-2.5 py-1">
                          {icon}
                          <Text className={`text-xs font-extrabold uppercase ml-1.5 tracking-wider ${statusTextClass}`}>
                            {donor.status}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>

          {/* Console / Event Log Panel */}
          <View className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl">
            <View className="flex-row items-center mb-3">
              <Database size={16} color="#94a3b8" className="mr-2" />
              <Text className="text-white font-black text-base">Network & WebSocket Logs</Text>
            </View>
            <View className="bg-slate-950 border border-slate-850 p-4 rounded-xl h-44">
              <ScrollView nestedScrollEnabled className="flex-1">
                {wsLogs.length === 0 ? (
                  <Text className="text-slate-600 font-mono text-xs italic">Logs will stream here...</Text>
                ) : (
                  wsLogs.map((log, index) => (
                    <Text key={index} className="text-slate-400 font-mono text-xs leading-relaxed mb-1.5">
                      {log}
                    </Text>
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
