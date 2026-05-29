import React, { useState, useEffect } from 'react';
import QRScanner from './QRScanner';

function EmployeePanel({ user, onLogout, apiUrl }) {
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  
  // Sincronización inmediata al iniciar sesión basada en lo que Apps Script leyó de la base de datos
  const [currentStep, setCurrentStep] = useState(() => {
    const last = user?.lastMovement ? String(user.lastMovement).toUpperCase() : 'NINGUNO';
    if (last === 'ENTRADA' || last === 'ENTRADATEMPORAL') return 'OPCIONES_POST_ENTRADA';
    if (last === 'SALIDATEMPORAL') return 'ENTRADA_TEMPORAL';
    if (last === 'SALIDA') return 'JORNADA_COMPLETA';
    return 'ENTRADA';
  }); 
  
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // Historial completo del empleado para la tabla inferior
  const [myRecords, setMyRecords] = useState([]);
  const [loadingTable, setLoadingTable] = useState(false);
  
  // Candado de seguridad local (mantiene la fluidez en tiempo real)
  const [hasOperatedLocally, setHasOperatedLocally] = useState(false);
  
  // Control de cámara y envío
  const [activeMovement, setActiveMovement] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', isError: false });

  // Filtros avanzados para el historial del usuario
  const [dateMode, setDateMode] = useState('SINGLE'); 
  const [singleDate, setSingleDate] = useState(() => {
    const hoy = new Date();
    const dia = String(hoy.getDate()).padStart(2, '0');
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    return `${hoy.getFullYear()}-${mes}-${dia}`;
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Extracción de los horarios asignados al usuario (vienen desde el LOGIN)
  const rawLV = user?.rawLV || '10:00 - 19:00';
  const rawSab = user?.rawSab || '08:00 - 19:00';
  const rawDom = user?.rawDom || '08:00 - 15:00';

  // Identificar qué día de la semana es HOY para aislar su horario autorizado
  const [todayScheduleInfo, setTodayScheduleInfo] = useState({ name: 'Hoy', time: '', isDescanso: false });
  
  useEffect(() => {
    const numeroDia = new Date().getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    const nombresDias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const nombreDeHoy = nombresDias[numeroDia];

    let horarioDeHoy = '';
    if (numeroDia === 6) {
      horarioDeHoy = rawSab;
    } else if (numeroDia === 0) {
      horarioDeHoy = rawDom;
    } else {
      horarioDeHoy = rawLV;
    }

    const esDescanso = !horarioDeHoy || horarioDeHoy.toUpperCase().includes('DESCANSO') || horarioDeHoy === '-';

    setTodayScheduleInfo({
      name: nombreDeHoy,
      time: esDescanso ? 'Descanso Autorizado' : horarioDeHoy.replace(/\s/g, ''),
      isDescanso: esDescanso
    });
  }, [rawLV, rawSab, rawDom]);

  // 1. Reloj en tiempo real
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('es-MX', { hour12: false }));
      setCurrentDate(now.toLocaleDateString('es-MX', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
      }));
    };
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // ESTRATEGIAS DE PARSEO DE DATOS SEGUROS (Mapea llaves ignorando espacios y mayúsculas)
  const getValueByStrategy = (obj, searchKeys, fallbackIndex, fallback = '') => {
    if (!obj) return fallback;
    for (let key of searchKeys) {
      if (obj[key] !== undefined && obj[key] !== null) return String(obj[key]).trim();
    }
    const actualKeys = Object.keys(obj);
    for (let key of actualKeys) {
      if (searchKeys.map(k => k.toLowerCase().replace(/[\s_\-]/g, '')).includes(key.toLowerCase().replace(/[\s_\-]/g, ''))) {
        return String(obj[key]).trim();
      }
    }
    const values = Object.values(obj);
    return (values[fallbackIndex] !== undefined && values[fallbackIndex] !== null) ? String(values[fallbackIndex]).trim() : fallback;
  };

  // =========================================================================
  // 2A. CONSULTAR ÚNICAMENTE LA BITÁCORA / HISTORIAL PARA LA TABLA INFERIOR
  // =========================================================================
  const fetchEmployeeData = async () => {
    try {
      setLoadingTable(true);
      const cacheBusterUrl = `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}_cb=${new Date().getTime()}`;
      
      const response = await fetch(cacheBusterUrl);
      const resData = await response.json();
      
      if (resData.success) {
        const rawList = resData.data || resData.records || [];
        if (Array.isArray(rawList)) {
          const filtered = rawList.filter(rec => {
            const empId = getValueByStrategy(rec, ["Empleado ID", "EmpleadoID", "empid", "idempleado"], 1, '').trim().toUpperCase();
            return empId === String(user.id).toUpperCase();
          });
          setMyRecords(filtered);
        }
      }
    } catch (err) {
      console.error("Error al recuperar historial del empleado:", err);
    } finally {
      setLoadingHistory(false);
      setLoadingTable(false);
    }
  };

  // =========================================================================
  // 2B. CONSULTAR EL PASO SECUENCIAL DEL DÍA (SÓLO SI NO HEMOS OPERADO LOCALMENTE)
  // =========================================================================
  const syncTodayStep = async (force = false) => {
    if (hasOperatedLocally && !force) {
      console.log("Sincronización de botones omitida: Candado local activo.");
      return;
    }

    try {
      const stepUrl = `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}_cb=${new Date().getTime()}&action=GET_TODAY_STEP&employeeId=${user.id}`;
      const stepResponse = await fetch(stepUrl);
      const stepData = await stepResponse.json();
      
      if (stepData.success && stepData.currentStep) {
        if (hasOperatedLocally && !force) return;

        const stepUpper = String(stepData.currentStep).toUpperCase();
        console.log("PASO DETECTADO EN SERVIDOR:", stepUpper);
        
        if (stepUpper === 'ENTRADA') setCurrentStep('ENTRADA');
        else if (stepUpper === 'OPCIONES_POST_ENTRADA' || stepUpper === 'ENTRADA_REGISTRADA') setCurrentStep('OPCIONES_POST_ENTRADA');
        else if (stepUpper === 'ENTRADA_TEMPORAL' || stepUpper === 'ENTRADATEMPORAL') setCurrentStep('ENTRADA_TEMPORAL');
        else if (stepUpper === 'JORNADA_COMPLETA' || stepUpper === 'SALIDA') setCurrentStep('JORNADA_COMPLETA');
        else setCurrentStep(stepData.currentStep);
      }
    } catch (err) {
      console.error("Error al sincronizar el paso del día:", err);
    }
  };

  useEffect(() => {
    setHasOperatedLocally(false);
    setLoadingHistory(true);
    
    const last = user?.lastMovement ? String(user.lastMovement).toUpperCase() : 'NINGUNO';
    if (last === 'ENTRADA' || last === 'ENTRADATEMPORAL') setCurrentStep('OPCIONES_POST_ENTRADA');
    else if (last === 'SALIDATEMPORAL') setCurrentStep('ENTRADA_TEMPORAL');
    else if (last === 'SALIDA') setCurrentStep('JORNADA_COMPLETA');
    else setCurrentStep('ENTRADA');

    fetchEmployeeData();
    syncTodayStep(true); 
  }, [apiUrl, user.id]);

  useEffect(() => {
    let timer;
    if (hasOperatedLocally) {
      timer = setTimeout(() => {
        console.log("Candado liberado. La base de datos de Sheets ya se asentó.");
        setHasOperatedLocally(false);
      }, 9000); 
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [hasOperatedLocally]);

  const handleOpenScanner = (movementType) => {
    setActiveMovement(movementType);
    setStatusMessage({ text: '', isError: false });
    setShowScanner(true);
  };

  // =========================================================================
  // 3. PROCESAR ESCANEO CON RECOLECCIÓN DINÁMICA DE IP PÚBLICA REAL
  // =========================================================================
  const handleScanSuccess = async (scannedJsonPayload) => {
    setShowScanner(false);
    setLoadingAction(true);
    setStatusMessage({ text: '', isError: false });
    
    let detectedIp = "desconocida";
    
    try {
      // Intentar obtener la IP pública real antes de enviar la petición de marcaje
      const ipResponse = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3500) });
      const ipData = await ipResponse.json();
      if (ipData && ipData.ip) {
        detectedIp = String(ipData.ip).trim();
      }
    } catch (ipErr) {
      console.warn("Fallo en ipify o timeout. Se transmitirá como 'desconocida':", ipErr);
    }

    try {
      let finalStore = '';

      if (scannedJsonPayload && typeof scannedJsonPayload === 'object') {
        finalStore = scannedJsonPayload.store || scannedJsonPayload.tienda || '';
      } else {
        let cleanPayload = String(scannedJsonPayload).trim();
        try {
          const parsedAuth = JSON.parse(cleanPayload);
          if (parsedAuth) {
            finalStore = parsedAuth.store || parsedAuth.tienda || '';
          }
        } catch (jsonErr) {
          if (cleanPayload.length > 0 && !cleanPayload.includes('[object')) {
            finalStore = cleanPayload;
          }
        }
      }

      if (!finalStore || finalStore.includes('[object')) {
        finalStore = user.store || 'PENIEL';
      }

      finalStore = finalStore.trim().toUpperCase();

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'CHECK_IN',
          employeeId: user.id,
          movement: activeMovement,
          clientIp: detectedIp,  // <-- Inyección dinámica de la IP pública real externa
          store: finalStore 
        })
      });

      const resData = await response.json();
      console.log("RESPUESTA DEL SERVIDOR POST:", resData);

      const esExitoso = resData && (resData.success === true || resData.success === "true" || resData.status === "success");

      if (esExitoso) {
        setHasOperatedLocally(true); 
        
        const movUpper = String(activeMovement).toUpperCase().trim();
        if (movUpper === 'ENTRADA') {
          setCurrentStep('OPCIONES_POST_ENTRADA');
        } else if (movUpper === 'SALIDA TEMPORAL') {
          setCurrentStep('ENTRADA_TEMPORAL');
        } else if (movUpper === 'ENTRADA TEMPORAL') {
          setCurrentStep('OPCIONES_POST_ENTRADA');
        } else if (movUpper === 'SALIDA') {
          setCurrentStep('JORNADA_COMPLETA');
        }

        setStatusMessage({ 
          text: `Movimiento de ${activeMovement} registrado con éxito en Sucursal ${finalStore}`, 
          isError: false 
        });
        
        await fetchEmployeeData();
      } else {
        const mensajeError = resData.error || resData.message || "El servidor no devolvió éxito.";
        alert(`Error devuelto por el servidor: ${mensajeError}`);
        setStatusMessage({ text: `Error: ${mensajeError}`, isError: true });
      }
    } catch (err) {
      console.error("Error crítico en handleScanSuccess:", err);
      alert(`Error de red: ${err.message}`);
      setStatusMessage({ text: "Error crítico de comunicación.", isError: true });
    } finally {
      setLoadingAction(false);
    }
  };

  const parseStringToLocalDate = (dateStr) => {
    if (!dateStr) return null;
    const cleanDate = dateStr.split('T')[0].trim();
    const parts = cleanDate.split(/[-/]/);
    if (parts.length !== 3) return null;
    let year, month, day;
    if (parts[0].length === 4) [year, month, day] = parts;
    else [day, month, year] = parts;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0);
  };

  const filteredMyRecords = myRecords.filter(rec => {
    const recDateRaw = getValueByStrategy(rec, ["Fecha", "fecha", "date"], 2, '');
    const recordDateObj = parseStringToLocalDate(recDateRaw);
    if (!recordDateObj) return true;

    if (dateMode === 'SINGLE') {
      if (!singleDate) return true;
      const targetDateObj = parseStringToLocalDate(singleDate);
      return recordDateObj.getTime() === targetDateObj.getTime();
    } else if (dateMode === 'RANGE') {
      if (!startDate || !endDate) return true;
      const startObj = parseStringToLocalDate(startDate);
      const endObj = parseStringToLocalDate(endDate);
      return recordDateObj >= startObj && recordDateObj <= endObj;
    }
    return true;
  });

  const getMovimientoConRetardo = (movimientoBase, fechaStr, horaStr) => {
    const movUpper = movimientoBase.toUpperCase().trim();
    if (movUpper !== 'ENTRADA') return movimientoBase;

    try {
      if (!fechaStr || !horaStr) return movimientoBase;

      const parts = fechaStr.split(/[-/]/);
      let year = parseInt(parts[0]), month = parseInt(parts[1]) - 1, day = parseInt(parts[2]);
      if (parts[0].length !== 4) { 
        day = parseInt(parts[0]); month = parseInt(parts[1]) - 1; year = parseInt(parts[2]);
      }
      const fechaRegistro = new Date(year, month, day);
      const diaSemana = fechaRegistro.getDay(); 

      let horarioEntradaConfig = "10:00"; 
      if (diaSemana === 6) { 
        horarioEntradaConfig = rawSab.split('-')[0].trim();
      } else if (diaSemana === 0) { 
        horarioEntradaConfig = rawDom.split('-')[0].trim();
      } else { 
        horarioEntradaConfig = rawLV.split('-')[0].trim();
      }

      const [hReg, mReg] = horaStr.split(':').map(Number);
      const [hConf, mConf] = horarioEntradaConfig.split(':').map(Number);

      const minutosRegistro = (hReg * 60) + mReg;
      const minutesConfig = (hConf * 60) + mConf;

      if (minutosRegistro > minutesConfig) {
        return "Entrada con Retardo";
      }
    } catch (e) {
      console.error("Error al evaluar retardo en historial:", e);
    }

    return movimientoBase;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans p-4 md:p-8">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        
        {/* TARJETA DE IDENTIDAD DEL TRABAJADOR */}
        <header className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded">
              Colaborador Activo
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight mt-1.5">{user.name}</h1>
            <p className="text-xs text-zinc-500 font-mono mt-0.5 uppercase">ID: {user.id} • Sucursal: {user.store || 'PENIEL'}</p>
          </div>
          <button 
            onClick={onLogout} 
            className="px-3 py-2 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 font-bold rounded-lg border border-zinc-800 text-xs transition-colors uppercase font-mono tracking-wider"
          >
            Salir
          </button>
        </header>

        {/* NÚCLEO CENTRAL UNIFICADO: HORARIO AUTORIZADO Y RELOJ EN TIEMPO REAL */}
        <section className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-xl text-center space-y-4">
          <div className="flex flex-col items-center justify-center space-y-1">
            <span className="text-[10px] font-mono font-bold bg-zinc-950 text-orange-400 px-3 py-1 rounded uppercase border border-zinc-800 tracking-wider">
              Horario Autorizado: {todayScheduleInfo.name}
            </span>
            <div className={`font-mono font-black text-xl tracking-wide ${
              todayScheduleInfo.isDescanso ? 'text-zinc-500 italic' : 'text-zinc-200'
            }`}>
              {todayScheduleInfo.time}
            </div>
          </div>

          <div className="border-t border-zinc-800/60 my-2 w-3/4 mx-auto"></div>

          <div className="space-y-1 select-none">
            <h2 className="text-5xl font-black text-white font-mono tracking-tight">
              {currentTime || '--:--:--'}
            </h2>
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">
              {currentDate}
            </p>
          </div>
        </section>

        {/* FEEDBACK DE ACCIONES DE ESCANEO */}
        {statusMessage.text && (
          <div className={`p-4 rounded-lg text-xs font-bold uppercase tracking-wide border text-center ${
            statusMessage.isError 
              ? 'bg-zinc-950 border-red-900 text-red-400 shadow-lg shadow-red-950/10' 
              : 'bg-zinc-950 border-emerald-900 text-emerald-400 shadow-lg shadow-emerald-950/10'
          }`}>
            {statusMessage.text}
          </div>
        )}

        {/* CONTROL DE BOTONES SECUENCIALES */}
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-xl flex flex-col justify-center min-h-[110px]">
          {loadingHistory || loadingAction ? (
            <div className="text-center space-y-2 py-2">
              <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider animate-pulse">
                {loadingAction ? 'Procesando registro en la nube...' : 'Sincronizando bitácora diaria...'}
              </p>
            </div>
          ) : (
            <>
              {currentStep === 'ENTRADA' && (
                <button
                  onClick={() => handleOpenScanner('Entrada')}
                  className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-lg text-xs uppercase tracking-wider transition-colors shadow-lg shadow-orange-900/20 font-mono"
                >
                  Escanear Código Entrada
                </button>
              )}

              {currentStep === 'OPCIONES_POST_ENTRADA' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                  <button
                    onClick={() => handleOpenScanner('Salida Temporal')}
                    className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-orange-400 font-bold py-3.5 rounded-lg text-xs uppercase tracking-wider transition-colors font-mono"
                  >
                    Salida Temporal
                  </button>
                  <button
                    onClick={() => handleOpenScanner('Salida')}
                    className="bg-rose-950/30 hover:bg-rose-900/30 text-rose-400 border border-rose-900/50 font-bold py-3.5 rounded-lg text-xs uppercase tracking-wider transition-colors font-mono shadow-lg shadow-rose-950/10"
                  >
                    Registrar Salida
                  </button>
                </div>
              )}

              {currentStep === 'ENTRADA_TEMPORAL' && (
                <button
                  onClick={() => handleOpenScanner('Entrada Temporal')}
                  className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-lg text-xs uppercase tracking-wider transition-colors shadow-lg shadow-orange-900/10 font-mono"
                >
                  Entrada Temporal
                </button>
              )}

              {currentStep === 'JORNADA_COMPLETA' && (
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg text-center text-xs text-zinc-500 font-bold uppercase tracking-wider font-mono">
                  Jornada laboral completada por hoy.
                </div>
              )}
            </>
          )}
        </div>

        {/* ================= MÓDULO: MI HISTORIAL DE ASISTENCIAS ================= */}
        <section className="bg-zinc-900 rounded-xl border border-zinc-800 shadow-xl overflow-hidden space-y-4 p-5">
          <div className="border-b border-zinc-800 pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Mi Historial de Asistencia</h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">Consulta tus registros de entrada y salida guardados</p>
            </div>
            
            <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-400 uppercase font-mono bg-zinc-950 px-3 py-1.5 rounded border border-zinc-800/60">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={dateMode === 'SINGLE'} onChange={() => setDateMode('SINGLE')} className="accent-orange-500" /> 
                Día
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={dateMode === 'RANGE'} onChange={() => setDateMode('RANGE')} className="accent-orange-500" /> 
                Rango
              </label>
            </div>
          </div>

          <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/80 flex flex-wrap gap-3 items-center">
            {dateMode === 'SINGLE' ? (
              <div className="flex flex-col gap-1 w-full sm:w-auto">
                <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase">Seleccionar Fecha:</span>
                <input 
                  type="date" value={singleDate} onChange={(e) => setSingleDate(e.target.value)} 
                  className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-orange-500 w-full sm:w-44" 
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 w-full">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase">Desde:</span>
                  <input 
                    type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} 
                    className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-orange-500 w-full" 
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase">Hasta:</span>
                  <input 
                    type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} 
                    className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-orange-500 w-full" 
                  />
                </div>
              </div>
            )}
          </div>

          {loadingTable ? (
            <div className="text-center py-6 text-zinc-500 font-mono text-xs animate-pulse">Sincronizando bitácora...</div>
          ) : filteredMyRecords.length === 0 ? (
            <div className="text-center py-6 text-zinc-600 font-medium text-xs">No hay movimientos registrados en la fecha elegida.</div>
          ) : (
            <div className="overflow-x-auto border border-zinc-800/40 rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-950 border-b border-zinc-800 text-zinc-500 uppercase font-mono text-[9px] tracking-wider">
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Hora</th>
                    <th className="py-2.5 px-3">Movimiento</th>
                    <th className="py-2.5 px-3 text-right">Sucursal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40 text-[11px] font-mono">
                  {filteredMyRecords.map((rec, idx) => {
                    const dateVal = getValueByStrategy(rec, ["Fecha", "fecha", "date"], 2, '--/--/----');
                    const timeVal = getValueByStrategy(rec, ["Hora", "hora", "time"], 3, '--:--');
                    const movRaw = getValueByStrategy(rec, ["Movimiento", "movimiento", "movement"], 4, 'ENTRADA');
                    const storeVal = getValueByStrategy(rec, ["Sucursal", "Tienda", "store", "sucursal"], 5, 'PENIEL');
                    const isEdited = getValueByStrategy(rec, ["Auditado", "auditado"], 7, 'FALSE') === 'TRUE';

                    const movimientoFinal = getMovimientoConRetardo(movRaw, dateVal, timeVal);

                    return (
                      <tr key={idx} className="hover:bg-zinc-800/20 transition-all">
                        <td className="py-3 px-3 text-zinc-400">{dateVal}</td>
                        <td className="py-3 px-3 font-bold text-white">
                          {timeVal}
                          {isEdited && (
                            <span className="block text-[8px] text-orange-500 font-sans font-bold uppercase tracking-tight mt-0.5">
                              Ajustado
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-sans font-bold uppercase tracking-wide ${
                            movimientoFinal.toUpperCase().includes('RETARDO') ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            movimientoFinal.toUpperCase().includes('TEMPORAL') ? 'bg-orange-500/10 text-orange-400' :
                            movimientoFinal.toUpperCase().includes('SALIDA') ? 'bg-rose-500/10 text-rose-400' :
                            'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            {movimientoFinal}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right uppercase text-zinc-500 text-[10px] font-bold">{storeVal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="text-center border-t border-zinc-800 pt-4">
          <p className="text-[10px] text-zinc-600 font-mono tracking-wider uppercase">
            Control de Asistencia • Ferretería Peniel
          </p>
        </footer>
      </div>

      {showScanner && (
        <QRScanner 
          onScanSuccess={handleScanSuccess} 
          onCancel={() => setShowScanner(false)} 
        />
      )}
    </div>
  );
}

export default EmployeePanel;