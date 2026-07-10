import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { 
  Activity, Phone, ShieldAlert, CheckCircle2, XCircle, 
  MapPin, Sparkles, Clock, HeartHandshake, Wifi, WifiOff, Database
} from './Icons';

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
  
  // Expandable Sandbox Drawer
  const [showSandbox, setShowSandbox] = useState(false);

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
      
      // Fallback/Mock behavior for demo
      setTimeout(() => {
        setSubmitStatus({ 
          success: true, 
          message: 'Simulation Started: Dispatch triggered locally on local thread.' 
        });
        simulateMockCalls();
      }, 1000);
    } finally {
      setIsSubmitting(false);
    }
  };

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
      addLog('Geolocation is only supported in browser for this dashboard.');
    }
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

    setTimeout(() => {
      updateDonorStatus({ donor_id: 'd101', name: 'Arjun Verma', status: 'accepted', eta_minutes: 8 });
      addLog('SIMULATOR: Arjun Verma accepted call. ETA: 8 minutes.');
    }, 3000);

    setTimeout(() => {
      updateDonorStatus({ donor_id: 'd103', name: 'Sandeep Patil', status: 'declined', eta_minutes: null });
      addLog('SIMULATOR: Sandeep Patil declined call.');
    }, 6000);

    setTimeout(() => {
      updateDonorStatus({ donor_id: 'd102', name: 'Kavitha R.', status: 'accepted', eta_minutes: 15 });
      addLog('SIMULATOR: Kavitha R. accepted call. ETA: 15 minutes.');
    }, 9000);

    setTimeout(() => {
      updateDonorStatus({ donor_id: 'd104', name: 'Dr. Meera Sen', status: 'completed', eta_minutes: 0 });
      addLog('SIMULATOR: Dr. Meera Sen completed donation loop.');
    }, 12000);
  };

  // Stats calculations
  const totalCalls = dispatches.length;
  const acceptedCount = dispatches.filter(d => d.status === 'accepted' || d.status === 'completed').length;
  const ringingCount = dispatches.filter(d => d.status === 'ringing').length;
  const declinedCount = dispatches.filter(d => d.status === 'declined').length;
  const successRate = totalCalls > 0 ? Math.round((acceptedCount / totalCalls) * 100) : 0;

  return (
    <ScrollView className="flex-1 bg-slate-50 p-4 md:p-8" contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Top Header */}
      <View className="flex-row flex-wrap items-center justify-between border-b border-slate-200 pb-5 mb-8">
        <View>
          <View className="flex-row items-center">
            <View className="h-2 w-2 rounded-full bg-rose-500 mr-2" />
            <Text className="text-rose-600 font-extrabold text-[10px] tracking-wider uppercase">
              Emergency Dispatch Control Portal
            </Text>
          </View>
          <Text className="text-slate-900 text-3xl font-extrabold tracking-tight mt-1">
            Hospital Dispatch Hub
          </Text>
        </View>

        {/* Server Config & Connection Panel */}
        <View className="flex-row items-center bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-sm mt-4 md:mt-0">
          <View className="mr-4">
            <Text className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">FastAPI Host</Text>
            <TextInput
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="localhost:8000"
              placeholderTextColor="#cbd5e1"
              className="text-slate-800 font-mono text-sm h-6 p-0 w-36 outline-none"
            />
          </View>
          <TouchableOpacity 
            onPress={isConnected ? disconnectWebSocket : connectWebSocket}
            disabled={isConnecting}
            className={`px-3 py-1.5 rounded-lg flex-row items-center border ${
              isConnected 
                ? 'bg-emerald-50 border-emerald-200' 
                : 'bg-rose-50 border-rose-200'
            }`}
          >
            {isConnecting ? (
              <ActivityIndicator size="small" color="#e11d48" className="mr-1.5" />
            ) : isConnected ? (
              <Wifi size={14} color="#059669" className="mr-1.5" />
            ) : (
              <WifiOff size={14} color="#e11d48" className="mr-1.5" />
            )}
            <Text className={`text-xs font-bold ${isConnected ? 'text-emerald-700' : 'text-rose-700'}`}>
              {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Connect'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Grid Layout */}
      <View className="flex-row flex-wrap -mx-3">
        {/* Left Column: Form Controls */}
        <View className="w-full lg:w-5/12 px-3 mb-6">
          <View className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <View className="flex-row items-center mb-3">
              <ShieldAlert size={20} color="#e11d48" className="mr-2" />
              <Text className="text-slate-900 font-extrabold text-lg">Trigger Dispatch</Text>
            </View>
            <Text className="text-slate-500 text-xs leading-relaxed mb-6">
              Search coordinates and find eligible blood donors within 10km. AI system will call up to 20 donors concurrently.
            </Text>

            {/* Inputs */}
            <View className="space-y-4">
              <View>
                <Text className="text-slate-500 text-[10px] font-bold mb-1.5 uppercase tracking-wider">Hospital Identifier</Text>
                <TextInput
                  value={hospitalId}
                  onChangeText={setHospitalId}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-semibold text-sm outline-none"
                  placeholder="e.g. HOSP-101"
                />
              </View>

              <View className="flex-row -mx-2 mt-3">
                <View className="w-1/2 px-2">
                  <Text className="text-slate-500 text-[10px] font-bold mb-1.5 uppercase tracking-wider">Blood Group Required</Text>
                  <TextInput
                    value={bloodGroup}
                    onChangeText={setBloodGroup}
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-black text-sm text-center outline-none"
                    placeholder="O-"
                  />
                </View>
                <View className="w-1/2 px-2">
                  <Text className="text-slate-500 text-[10px] font-bold mb-1.5 uppercase tracking-wider">Urgency Level</Text>
                  <View className="flex-row bg-slate-100 rounded-xl p-1 justify-between h-[46px] items-center">
                    <TouchableOpacity 
                      onPress={() => setUrgency('critical')}
                      className={`flex-1 py-2 rounded-lg items-center ${urgency === 'critical' ? 'bg-white shadow-sm' : 'bg-transparent'}`}
                    >
                      <Text className={`text-xs font-extrabold uppercase ${urgency === 'critical' ? 'text-slate-900' : 'text-slate-500'}`}>Critical</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => setUrgency('high')}
                      className={`flex-1 py-2 rounded-lg items-center ${urgency === 'high' ? 'bg-white shadow-sm' : 'bg-transparent'}`}
                    >
                      <Text className={`text-xs font-extrabold uppercase ${urgency === 'high' ? 'text-slate-900' : 'text-slate-500'}`}>High</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View className="mt-3">
                <div className="flex justify-between items-center mb-1.5">
                  <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Dispatch Coordinates</Text>
                  <TouchableOpacity onPress={fetchCurrentLocation} className="flex-row items-center">
                    <MapPin size={12} color="#e11d48" className="mr-1" />
                    <Text className="text-rose-600 text-xs font-bold">Get Coordinates</Text>
                  </TouchableOpacity>
                </div>
                <View className="flex-row space-x-2">
                  <TextInput
                    value={lat}
                    onChangeText={setLat}
                    placeholder="Latitude"
                    placeholderTextColor="#cbd5e1"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-mono text-sm outline-none"
                  />
                  <TextInput
                    value={lng}
                    onChangeText={setLng}
                    placeholder="Longitude"
                    placeholderTextColor="#cbd5e1"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-mono text-sm outline-none"
                  />
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleTriggerEmergency}
                disabled={isSubmitting}
                className="bg-rose-600 active:bg-rose-700 py-3.5 rounded-xl mt-6 items-center flex-row justify-center shadow-sm"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Activity size={16} color="white" className="mr-2" />
                    <Text className="text-white text-sm font-black uppercase tracking-wider">
                      Initiate AI Dispatch Calls
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Submit Response Banner */}
            {submitStatus && (
              <View className={`mt-4 p-4 rounded-xl border ${
                submitStatus.success 
                  ? 'bg-emerald-50 border-emerald-100' 
                  : 'bg-rose-50 border-rose-100'
              }`}>
                <Text className={`text-xs font-bold leading-relaxed ${submitStatus.success ? 'text-emerald-800' : 'text-rose-800'}`}>
                  {submitStatus.message}
                </Text>
              </View>
            )}
          </View>

          {/* Sandbox Toggle & Drawer */}
          <View className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mt-5">
            <TouchableOpacity 
              onPress={() => setShowSandbox(!showSandbox)}
              className="flex-row justify-between items-center"
            >
              <View className="flex-row items-center">
                <Sparkles size={16} color="#475569" className="mr-2" />
                <Text className="text-slate-800 font-extrabold text-sm">System Simulator Sandbox</Text>
              </View>
              <Text className="text-rose-600 text-xs font-bold">{showSandbox ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
            
            {showSandbox && (
              <View className="mt-4 pt-4 border-t border-slate-100">
                <Text className="text-slate-500 text-xs leading-relaxed mb-4">
                  Simulate local network callbacks to test the live-state streams without launching a separate FastAPI process.
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <TouchableOpacity 
                    onPress={simulateMockCalls}
                    className="bg-slate-100 border border-slate-200 hover:bg-slate-200 px-3 py-2 rounded-lg flex-1 min-w-[120px] items-center"
                  >
                    <Text className="text-slate-700 font-bold text-xs">Trigger Simulation</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => updateDonorStatus({ donor_id: 'd101', name: 'Arjun Verma', status: 'accepted', eta_minutes: 5 })}
                    className="bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg flex-1 min-w-[120px] items-center"
                  >
                    <Text className="text-emerald-700 font-bold text-xs">Accept Arjun</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => updateDonorStatus({ donor_id: 'd102', name: 'Kavitha R.', status: 'declined', eta_minutes: null })}
                    className="bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg flex-1 min-w-[120px] items-center"
                  >
                    <Text className="text-rose-700 font-bold text-xs">Decline Kavitha</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Right Column: Statistics & Live Updates */}
        <View className="w-full lg:w-7/12 px-3 mb-6">
          {/* Statistics Grid */}
          <View className="flex-row flex-wrap -mx-1 mb-6">
            <View className="w-1/3 px-1">
              <View className="bg-white border border-slate-200 rounded-xl p-4 items-center shadow-sm">
                <Phone size={18} color="#64748b" />
                <Text className="text-2xl font-black text-slate-800 mt-1">{totalCalls}</Text>
                <Text className="text-slate-400 text-[9px] uppercase font-bold tracking-wider">Contacted</Text>
              </View>
            </View>
            <View className="w-1/3 px-1">
              <View className="bg-white border border-slate-200 rounded-xl p-4 items-center shadow-sm">
                <CheckCircle2 size={18} color="#10b981" />
                <Text className="text-2xl font-black text-emerald-600 mt-1">{acceptedCount}</Text>
                <Text className="text-slate-400 text-[9px] uppercase font-bold tracking-wider">Confirmed</Text>
              </View>
            </View>
            <View className="w-1/3 px-1">
              <View className="bg-white border border-slate-200 rounded-xl p-4 items-center shadow-sm">
                <Activity size={18} color="#eab308" />
                <Text className="text-2xl font-black text-slate-800 mt-1">{successRate}%</Text>
                <Text className="text-slate-400 text-[9px] uppercase font-bold tracking-wider">Acceptance</Text>
              </View>
            </View>
          </View>

          {/* Active Call Stream */}
          <View className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
            <View className="flex-row justify-between items-center mb-5">
              <View className="flex-row items-center">
                <Clock size={16} color="#64748b" className="mr-2" />
                <Text className="text-slate-800 font-extrabold text-base">Active Call Stream</Text>
              </View>
              <Text className="text-slate-400 text-xs font-semibold">{ringingCount} dialing...</Text>
            </View>

            {/* Scrollable List */}
            <View className="max-h-72 overflow-y-auto space-y-3">
              {dispatches.length === 0 ? (
                <View className="py-10 items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <HeartHandshake size={28} color="#94a3b8" className="mb-2" />
                  <Text className="text-slate-400 text-xs font-bold">No active calls triggered.</Text>
                </View>
              ) : (
                dispatches.map((donor) => {
                  let statusBg = 'bg-slate-50 border-slate-200';
                  let statusTextClass = 'text-slate-500';
                  let statusBorder = 'border-slate-200';
                  let icon = <Phone size={12} color="#64748b" />;

                  if (donor.status === 'ringing') {
                    statusBg = 'bg-amber-50';
                    statusBorder = 'border-amber-200';
                    statusTextClass = 'text-amber-700';
                    icon = <Activity size={12} color="#d97706" />;
                  } else if (donor.status === 'accepted') {
                    statusBg = 'bg-emerald-50';
                    statusBorder = 'border-emerald-200';
                    statusTextClass = 'text-emerald-700';
                    icon = <CheckCircle2 size={12} color="#059669" />;
                  } else if (donor.status === 'declined') {
                    statusBg = 'bg-rose-50';
                    statusBorder = 'border-rose-200';
                    statusTextClass = 'text-rose-700';
                    icon = <XCircle size={12} color="#e11d48" />;
                  } else if (donor.status === 'completed') {
                    statusBg = 'bg-cyan-50';
                    statusBorder = 'border-cyan-200';
                    statusTextClass = 'text-cyan-700';
                    icon = <HeartHandshake size={12} color="#0891b2" />;
                  }

                  return (
                    <View key={donor.donor_id} className={`p-4 rounded-xl border flex-row items-center justify-between ${statusBg} ${statusBorder}`}>
                      <View className="flex-row items-center">
                        <View className="h-8 w-8 rounded-full bg-slate-200 items-center justify-center mr-3">
                          <Text className="text-slate-700 font-extrabold text-xs">
                            {donor.name.split(' ').map(n => n[0]).join('')}
                          </Text>
                        </View>
                        <View>
                          <Text className="text-slate-800 font-bold text-sm">{donor.name}</Text>
                          <Text className="text-slate-400 text-[10px] font-mono">ID: {donor.donor_id}</Text>
                        </View>
                      </View>

                      <View className="flex-row items-center space-x-2">
                        {donor.eta_minutes !== null && donor.status === 'accepted' && (
                          <View className="bg-white border border-slate-200 rounded px-2 py-0.5 mr-2">
                            <Text className="text-slate-600 font-mono text-[10px]">
                              {donor.eta_minutes}m ETA
                            </Text>
                          </View>
                        )}
                        <View className="flex-row items-center bg-white border border-slate-200 rounded-full px-2.5 py-1">
                          {icon}
                          <Text className={`text-[10px] font-extrabold uppercase ml-1 tracking-wider ${statusTextClass}`}>
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
          <View className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <View className="flex-row items-center mb-3">
              <Database size={16} color="#64748b" className="mr-2" />
              <Text className="text-slate-800 font-extrabold text-sm">System Event Feed</Text>
            </View>
            <View className="bg-slate-50 border border-slate-200 p-4 rounded-xl h-44">
              <ScrollView nestedScrollEnabled className="flex-1">
                {wsLogs.length === 0 ? (
                  <Text className="text-slate-400 font-mono text-xs italic">System alerts and WebSocket logs will stream here...</Text>
                ) : (
                  wsLogs.map((log, index) => (
                    <Text key={index} className="text-slate-600 font-mono text-xs leading-relaxed mb-1">
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
