import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

function QRScanner({ onScanSuccess, onCancel }) {
  const [error, setError] = useState('');
  const [detectedStore, setDetectedStore] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const cameraId = "qr-reader-target";
  
  const successCallbackRef = useRef(onScanSuccess);
  const scannerInstanceRef = useRef(null);
  const isStoppingRef = useRef(false);
  const isInitializingRef = useRef(false);

  // Mantener la referencia de éxito actualizada
  useEffect(() => {
    successCallbackRef.current = onScanSuccess;
  }, [onScanSuccess]);

  // ============================================================
  // FUNCIÓN: INICIALIZAR ESCÁNER (OPTIMIZADA)
  // ============================================================
  const initializeScanner = useCallback(() => {
    // Si ya se está inicializando o ya existe una instancia corriendo, abortamos
    if (isInitializingRef.current || scannerInstanceRef.current || isScanning) return;
    
    isInitializingRef.current = true;

    // Limpieza física del contenedor por seguridad
    const container = document.getElementById(cameraId);
    if (container) {
      container.innerHTML = ""; 
    }

    const html5Qrcode = new Html5Qrcode(cameraId);
    scannerInstanceRef.current = html5Qrcode;

    const config = { 
      fps: 15, // Aumentado de 10 a 15 para mejor respuesta
      qrbox: { width: 250, height: 250 }
    };

    // Delay reducido de 150ms a 100ms
    const timer = setTimeout(() => {
      if (!scannerInstanceRef.current) return;

      html5Qrcode.start(
        { facingMode: "environment" }, 
        config,
        async (decodedText) => {
          try {
            const qrData = JSON.parse(decodedText);
            
            if (qrData.type === "FERRE_QR_AUTH") {
              if (isStoppingRef.current) return;
              isStoppingRef.current = true;

              // Actualizar interfaz con la tienda detectada
              if (qrData.store) {
                setDetectedStore(qrData.store);
              }

              console.log(`¡QR válido de sucursal ${qrData.store || 'desconocida'}! Deteniendo cámara...`);

              try {
                await html5Qrcode.stop();
                scannerInstanceRef.current = null;
                setIsScanning(false);
                successCallbackRef.current(qrData);
              } catch (stopErr) {
                console.warn("Aviso al detener:", stopErr);
                scannerInstanceRef.current = null;
                setIsScanning(false);
                successCallbackRef.current(qrData);
              }
            } else {
              setError("Código QR no válido para el sistema de la ferretería.");
            }
          } catch (e) {
            setError("El código QR escaneado no tiene el formato correcto.");
          }
        },
        () => {} 
      ).then(() => {
        setIsScanning(true);
        isInitializingRef.current = false;
      }).catch((err) => {
        setError("Error al acceder a la cámara. Otorga los permisos necesarios.");
        console.error(err);
        isInitializingRef.current = false;
        setIsScanning(false);
      });
    }, 100); // Delay reducido de 150ms a 100ms

    return () => {
      clearTimeout(timer);
      isInitializingRef.current = false;
    };
  }, [isScanning]);

  // ============================================================
  // EFECTO: INICIALIZAR ESCÁNER AL MONTAR
  // ============================================================
  useEffect(() => {
    const cleanup = initializeScanner();

    // Desmontaje limpio
    return () => {
      if (cleanup) cleanup();
      
      isInitializingRef.current = false;
      
      if (scannerInstanceRef.current) {
        const instance = scannerInstanceRef.current;
        scannerInstanceRef.current = null;
        
        if (instance.isScanning) {
          instance.stop()
            .then(() => console.log("Escáner cerrado por desmontaje."))
            .catch(err => console.log("Cámara ya estaba cerrada."));
        }
      }
    };
  }, [initializeScanner]);

  // ============================================================
  // HANDLER: CANCELAR
  // ============================================================
  const handleCancel = useCallback(() => {
    if (scannerInstanceRef.current && scannerInstanceRef.current.isScanning) {
      scannerInstanceRef.current.stop()
        .then(() => {
          scannerInstanceRef.current = null;
          setIsScanning(false);
          onCancel();
        })
        .catch(() => {
          scannerInstanceRef.current = null;
          setIsScanning(false);
          onCancel();
        });
    } else {
      onCancel();
    }
  }, [onCancel]);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="fixed inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="max-w-md w-full bg-slate-800 rounded-3xl p-6 text-center space-y-4 border border-slate-700 shadow-2xl">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Escáner de Asistencia</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {detectedStore 
              ? `Procesando sucursal: ${detectedStore}...` 
              : isScanning 
                ? "Apunta al código QR oficial colocado en la sucursal"
                : "Iniciando cámara..."}
          </p>
        </div>

        {/* Contenedor del video */}
        <div className="overflow-hidden rounded-2xl bg-black border border-slate-600 relative shadow-inner min-h-[250px] flex items-center justify-center">
          {!isScanning && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <div id={cameraId} className="w-full"></div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-semibold">
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleCancel}
          className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl text-sm transition-all active:scale-95"
        >
          Cancelar Escaneo
        </button>
      </div>
    </div>
  );
}

export default QRScanner;