import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('Colócate frente a la pantalla');
  
  // ESTA ES LA REFERENCIA PARA CONTROLAR LA CÁMARA
  const cameraRef = useRef(null);
  
  // Estados para la animación del escaneo láser
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

  const hasPermission = permission ? permission.granted : null;

  // 1. Pedir permisos de la cámara al abrir la app
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  // 2. Animación láser: Al terminar el barrido, captura la foto real
  useEffect(() => {
    let laserInterval;
    if (hasPermission && isScanning && !loading) {
      setMensaje('Escaneando rostro...');
      laserInterval = setInterval(async () => {
        setScanProgress((prev) => {
          if (prev >= 100) {
            clearInterval(laserInterval);
            setIsScanning(false); // Apaga el láser
            
            // DISPARAMOS LA CAPTURA DE FOTO AQUÍ MERO
            capturarYEnviar();
            return 0;
          }
          return prev + 10;
        });
      }, 100); 
    } else {
      setScanProgress(0);
    }
    return () => clearInterval(laserInterval);
  }, [hasPermission, isScanning, loading]);

  // 3. Activador manual del escaneo
  const iniciarEscaneoManual = () => {
    if (loading || isScanning || !isCameraReady) return;
    setIsScanning(true); 
  };

  // 4. NUEVA FUNCIÓN: Captura la foto real en Base64 y la manda
  const capturarYEnviar = async () => {
    if (!cameraRef.current || !isCameraReady) {
      setMensaje('Error: La cámara no está lista ❌');
      return;
    }

    setLoading(true);
    setMensaje('Capturando rostro...');

    try {
      // Tomamos la foto con compresión real y alta (calidad 0.1) para que el Base64 sea sumamente liviano y suba al instante
      const opciones = { base64: true, quality: 0.1 };
      const foto = await cameraRef.current.takePictureAsync(opciones);

      setMensaje('Procesando rostro...');
      console.log('¡Foto capturada con éxito en el celular!');

      // Enviamos el string Base64 al backend dentro del JSON (eliminamos el AbortController para evitar límites de tiempo artificiales)
      const response = await fetch('http://192.168.1.174:3000/api/asistencia/checar-temporal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          empresa_id: 1,
          imagenBase64: foto.base64
        }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setMensaje(`¡${data.message}! ✅`);
      } else {
        setMensaje(`Error: ${data.error || 'No se pudo registrar la asistencia'} ❌`);
      }
    } catch (error) {
      console.error('Error en captura/envío:', error);
      setMensaje('Error de conexión o captura ❌');
    } finally {
      setLoading(false);
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
          No tenemos acceso a la cámara. Por favor, actívala en la configuración de tu dispositivo.
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Solicitar Permiso de Cámara</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Kiosco de Asistencia</Text>
        <Text style={styles.subtitle}>Estación de Oficina</Text>
      </View>

      <View style={styles.cameraContainer}>
        {/* LE EMPEÑAMOS LA REFERENCIA (ref={cameraRef}) A LA ETIQUETA */}
        <CameraView 
          ref={cameraRef}
          style={styles.camera} 
          facing="front" 
          onCameraReady={() => setIsCameraReady(true)}
        />
        {/* Capa de diseño (overlay) colocada como hermana con posicionamiento absoluto para evitar interferencias de renderizado nativo */}
        <View style={StyleSheet.absoluteFillObject}>
          <View style={styles.overlay}>
            <View style={[
              styles.faceCutout,
              scanProgress > 0 && { borderColor: '#10B981', borderWidth: 4 }
            ]}>
              {scanProgress > 0 && (
                <View style={[styles.scanLine, { top: `${scanProgress}%` }]} />
              )}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        {loading && <ActivityIndicator size="small" color="#007AFF" style={{ marginBottom: 10 }} />}
        <Text style={styles.statusText}>{mensaje}</Text>
        
        <TouchableOpacity 
          style={[styles.button, (loading || isScanning || !isCameraReady) && { backgroundColor: '#A0AEC0' }]} 
          onPress={iniciarEscaneoManual}
          disabled={loading || isScanning || !isCameraReady}
        >
          <Text style={styles.buttonText}>
            {!isCameraReady ? 'Iniciando cámara...' : loading ? 'Procesando...' : isScanning ? 'Escaneando...' : 'Reconocer Rostro'}
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