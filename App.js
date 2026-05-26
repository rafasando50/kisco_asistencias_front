import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, requestCameraPermissionsAsync, getCameraPermissionsAsync } from 'expo-camera';

export default function App() {
  const [hasPermission, setHasPermission] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('Colócate frente a la pantalla');
  
  // Estados para la animación del escaneo láser (SOLO se activa al presionar el botón)
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

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

  // 2. Animación láser: Corre UNA SOLA VEZ a petición del usuario
  useEffect(() => {
    let laserInterval;
    if (hasPermission && isScanning && !loading) {
      setMensaje('Escaneando rostro...');
      laserInterval = setInterval(() => {
        setScanProgress((prev) => {
          if (prev >= 100) {
            clearInterval(laserInterval);
            setIsScanning(false);      // Apaga el láser
            checarAsistenciaReal();    // Dispara al backend de XAMPP
            return 0;
          }
          return prev + 10;
        });
      }, 100); // Escaneo rápido de 1 segundo
    } else {
      setScanProgress(0);
    }
    return () => clearInterval(laserInterval);
  }, [hasPermission, isScanning, loading]);

  // 3. Activador manual del escaneo
  const iniciarEscaneoManual = () => {
    if (loading || isScanning) return;
    setIsScanning(true); // Arranca el barrido verde una sola vez
  };

  // 4. Función real conectada al backend de XAMPP
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
      
      // Esperamos 3 segundos para que el empleado vea su confirmación y limpiamos todo
      setTimeout(() => {
        setMensaje('Colócate frente a la pantalla');
        setScanProgress(0);
      }, 3000);
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 15, color: '#718096', fontSize: 16 }}>Solicitando acceso a la cámara...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text style={{ textAlign: 'center', marginHorizontal: 30, color: '#4A5568', fontSize: 16, marginBottom: 20 }}>
          No tenemos acceso a la cámara o los permisos están retenidos.
        </Text>
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => setHasPermission(true)}
        >
          <Text style={styles.buttonText}>Forzar Acceso / Iniciar Cámara</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Encabezado */}
      <View style={styles.header}>
        <Text style={styles.title}>Kiosco de Asistencia</Text>
        <Text style={styles.subtitle}>Estación de Oficina</Text>
      </View>

      {/* Contenedor de la Cámara */}
      <View style={styles.cameraContainer}>
        <CameraView style={styles.camera} facing="front" onCameraReady={() => setIsCameraReady(true)}>
          {/* Capa exterior */}
          <View style={styles.overlay}>
            <View style={[
              styles.faceCutout,
              scanProgress > 0 && { borderColor: '#10B981', borderWidth: 4 }
            ]}>
              {/* Línea de escaneo láser (Solo aparece si se presiona el botón) */}
              {scanProgress > 0 && (
                <View style={[styles.scanLine, { top: `${scanProgress}%` }]} />
              )}
            </View>
          </View>
        </CameraView>
      </View>

      {/* Barra de estado inferior con botón de acción */}
      <View style={styles.footer}>
        {loading && <ActivityIndicator size="small" color="#007AFF" style={{ marginBottom: 10 }} />}
        <Text style={styles.statusText}>{mensaje}</Text>
        
        <TouchableOpacity 
          style={[styles.button, (loading || isScanning) && { backgroundColor: '#A0AEC0' }]} 
          onPress={iniciarEscaneoManual}
          disabled={loading || isScanning}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Procesando...' : isScanning ? 'Escaneando...' : 'Reconocer Rostro'}
          </Text>
        </TouchableOpacity>
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
  scanLine: { position: 'absolute', left: 0, right: 0, height: 4, backgroundColor: '#10B981', elevation: 5 },
  footer: { padding: 25, backgroundColor: '#FFF', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  statusText: { fontSize: 18, fontWeight: '600', color: '#2D3748', marginBottom: 15, textAlign: 'center' },
  button: { backgroundColor: '#007AFF', paddingVertical: 14, paddingHorizontal: 35, borderRadius: 10, width: '90%', alignItems: 'center' },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});