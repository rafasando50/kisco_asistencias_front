import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, requestCameraPermissionsAsync, getCameraPermissionsAsync } from 'expo-camera';

export default function App() {
  const [hasPermission, setHasPermission] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('Colócate frente a la pantalla');
  
  // Candado para bloquear múltiples peticiones simultáneas
  const canDetect = useRef(true);
  
  // Estados para simular el escaneo inteligente de rostros
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(true);

  // 1. Pedir permisos de la cámara al abrir la app
  useEffect(() => {
    (async () => {
      try {
        const { status: existingStatus } = await getCameraPermissionsAsync();
        if (existingStatus === 'granted') {
          setHasPermission(true);
          return;
        }
        const { status } = await requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
      } catch (error) {
        console.warn("Error al verificar/solicitar permisos de cámara:", error);
        try {
          const { status } = await requestCameraPermissionsAsync();
          setHasPermission(status === 'granted');
        } catch (innerError) {
          setHasPermission(false);
        }
      }
    })();
  }, []);

  // 2. Efecto de escaneo automático simulado de rostro
  useEffect(() => {
    let interval;
    if (hasPermission && isScanning && !loading && canDetect.current) {
      setMensaje('Buscando rostro...');
      interval = setInterval(() => {
        setScanProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            canDetect.current = false; // Bloqueamos nuevas detecciones
            setIsScanning(false);      // Detenemos el escáner
            checarAsistenciaReal();    // Enviamos al backend real
            return 0;
          }
          return prev + 10;
        });
      }, 150); // El escaneo dura aproximadamente 1.5 segundos
    } else {
      setScanProgress(0);
    }
    return () => clearInterval(interval);
  }, [hasPermission, isScanning, loading]);

  // 3. Función real para conectar con el backend y registrar asistencia
  const checarAsistenciaReal = async () => {
    setLoading(true);
    setMensaje('Procesando rostro...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch('http://192.168.1.174:3000/api/asistencia/checar-temporal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          empleado_id: 1, 
          empresa_id: 1,  
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (response.ok && data.success) {
        setMensaje(`¡${data.message}! ✅`);
      } else {
        setMensaje(`Error: ${data.error || 'No se pudo registrar la asistencia'} ❌`);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error('Timeout de conexión con el backend');
        setMensaje('Error: Tiempo de espera agotado ❌');
      } else {
        console.error('Error de conexión:', error);
        setMensaje('Error de conexión con el backend ❌');
      }
    } finally {
      setLoading(false);
      
      // Esperamos 4 segundos antes de reactivar el detector para dar tiempo a que la persona se retire
      setTimeout(() => {
        setMensaje('Colócate frente a la pantalla');
        canDetect.current = true; // Liberamos el candado para el siguiente empleado
        setIsScanning(true);      // Reactivamos el escáner automático
      }, 4000);
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 15, color: '#718096', fontSize: 16 }}>Solicitando acceso a la cámara...</Text>
        
        <TouchableOpacity 
          style={[styles.button, { marginTop: 30, backgroundColor: '#E2E8F0' }]} 
          onPress={() => setHasPermission(true)}
        >
          <Text style={{ color: '#4A5568', fontWeight: 'bold' }}>Simular Permiso (Demo/Emulador)</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text style={{ textAlign: 'center', marginHorizontal: 30, color: '#4A5568', fontSize: 16, marginBottom: 20 }}>
          No tenemos acceso a la cámara o tu emulador no tiene una cámara activa.
        </Text>
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => setHasPermission(true)}
        >
          <Text style={styles.buttonText}>Forzar Acceso / Modo Simulación</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Encabezado */}
      <View style={styles.header}>
        <Text style={styles.title}>Kiosco de Asistencia</Text>
        <Text style={styles.subtitle}>Estación de Oficina (Manos Libres)</Text>
      </View>

      {/* Contenedor de la Cámara con Detector de Rostros */}
      <View style={styles.cameraContainer}>
        <CameraView 
          style={styles.camera} 
          facing="front"
          onCameraReady={() => setIsCameraReady(true)}
        >
          {/* Óvalo guía */}
          <View style={styles.overlay}>
            <View style={[
              styles.faceCutout,
              scanProgress > 0 && { borderColor: '#10B981', borderWidth: 4 } // Cambia a verde mientras escanea
            ]}>
              {/* Línea de escaneo láser */}
              {scanProgress > 0 && (
                <View style={[
                  styles.scanLine,
                  { top: `${scanProgress}%` }
                ]} />
              )}
            </View>
          </View>
        </CameraView>
      </View>

      {/* Barra de estado inferior */}
      <View style={styles.footer}>
        {loading && <ActivityIndicator size="small" color="#007AFF" style={{ marginBottom: 10 }} />}
        <Text style={styles.statusText}>{mensaje}</Text>
        <Text style={{ fontSize: 12, color: '#A0AEC0' }}>El sistema escaneará tu rostro automáticamente</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 60, paddingBottom: 20, backgroundColor: '#FFF', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1A202C' },
  subtitle: { fontSize: 14, color: '#718096', marginTop: 4 },
  cameraContainer: { flex: 1, margin: 20, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  faceCutout: { width: 250, height: 320, borderRadius: 125, borderWidth: 3, borderColor: '#007AFF', backgroundColor: 'transparent', overflow: 'hidden', position: 'relative' },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
  footer: { padding: 30, backgroundColor: '#FFF', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  statusText: { fontSize: 18, fontWeight: '600', color: '#2D3748', marginBottom: 10, textAlign: 'center' },
  button: { backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});