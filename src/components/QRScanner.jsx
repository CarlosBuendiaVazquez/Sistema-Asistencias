import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

function QRScanner({ onScanSuccess, onCancel }) {
  const [error, setError] = useState('');
  const [detectedStore, setDetectedStore] = useState(''); // Estado para capturar la tienda en tiempo real
  const cameraId = "qr-reader-target";
  
  const successCallbackRef = useRef(onScanSuccess);
  const scannerInstanceRef = useRef(null);
  const isStoppingRef = useRef(false);
  
  // Esta referencia evitará que el código se ejecute dos veces en milisegundos
  const isInitializingRef = useRef(false);

  // Mantener la referencia de éxito actualizada
  useEffect(() => {
    successCallbackRef.current = onScanSuccess;
  }, [onScanSuccess]);

  useEffect(() => {
    // Si ya se está inicializando o ya existe una instancia corriendo, abortamos el segundo intento
    if (isInitializingRef.current || scannerInstanceRef.current) return;
    
    isInitializingRef.current = true;

    // Limpieza física del contenedor por seguridad
    const container = document.getElementById(cameraId);
    if (container) {
      container.innerHTML = ""; 
    }

    const html5Qrcode = new Html5Qrcode(cameraId);
    scannerInstanceRef.current = html5Qrcode;

    const config = { 
      fps: 10,
      qrbox: { width: 250, height: 250 }
    };

    // Retrasamos una fracción de segundo el arranque para dar tiempo a que React asiente el DOM
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

              // Actualizamos la interfaz mostrando qué tienda leyó antes de cerrar
              if (qrData.store) {
                setDetectedStore(qrData.store);
              }

              console.log(`¡QR válido de sucursal ${qrData.store || 'desconocida'}! Deteniendo cámara...`);

              try {
                await html5Qrcode.stop();
                scannerInstanceRef.current = null;
                successCallbackRef.current(qrData); // Envía todo el objeto (incluyendo el nuevo .store)
              } catch (stopErr) {
                console.warn("Aviso al detener:", stopErr);
                scannerInstanceRef.current = null;
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
      ).catch((err) => {
        setError("Error al acceder a la cámara. Otorga los permisos necesarios.");
        console.error(err);
        isInitializingRef.current = false;
      });
    }, 150); // El delay mágico para absorber el doble renderizado

    // Desmontaje limpio
    return () => {
      clearTimeout(timer);
      isInitializingRef.current = false;
      
      if (scannerInstanceRef.current) {
        const instance = scannerInstanceRef.current;
        scannerInstanceRef.current = null; // Rompemos la referencia inmediatamente
        
        if (instance.isScanning) {
          instance.stop()
            .then(() => console.log("Escáner cerrado por desmontaje."))
            .catch(err => console.log("Cámara ya estaba cerrada."));
        }
      }
    };
  }, []); 

  return (
    <div className="fixed inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="max-w-md w-full bg-slate-800 rounded-3xl p-6 text-center space-y-4 border border-slate-700 shadow-2xl">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Escáner de Asistencia</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {detectedStore 
              ? `Procesando sucursal: ${detectedStore}...` 
              : "Apunta al código QR oficial colocado en la sucursal"}
          </p>
        </div>

        {/* Contenedor único del video */}
        <div className="overflow-hidden rounded-2xl bg-black border border-slate-600 relative shadow-inner">
          <div id={cameraId} className="w-full"></div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-semibold">
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={onCancel}
          className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl text-sm transition-all active:scale-95"
        >
          Cancelar Escaneo
        </button>
      </div>
    </div>
  );
}

export default QRScanner;