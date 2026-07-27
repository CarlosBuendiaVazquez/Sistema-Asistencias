import React, { useState, useEffect, useCallback } from 'react';
import QRScanner from './QRScanner';

function EmployeePanel({ user, onLogout, apiUrl }) {
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  
  const [currentStep, setCurrentStep] = useState(() => {
    const last = user?.lastMovement ? String(user.lastMovement).toUpperCase() : 'NINGUNO';
    if (last === 'ENTRADA' || last === 'ENTRADATEMPORAL') return 'OPCIONES_POST_ENTRADA';
    if (last === 'SALIDATEMPORAL') return 'ENTRADA_TEMPORAL';
    if (last === 'SALIDA') return 'JORNADA_COMPLETA';
    return 'ENTRADA';
  }); 
  
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [myRecords, setMyRecords] = useState([]);
  const [loadingTable, setLoadingTable] = useState(false);
  const [hasOperatedLocally, setHasOperatedLocally] = useState(false);
  const [activeMovement, setActiveMovement] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', isError: false });

  const [dateMode, setDateMode] = useState('SINGLE'); 
  const [singleDate, setSingleDate] = useState(() => {
    const hoy = new Date();
    const dia = String(hoy.getDate()).padStart(2, '0');
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    return `${hoy.getFullYear()}-${mes}-${dia}`;
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [weeklyHours, setWeeklyHours] = useState(null);
  const [loadingHours, setLoadingHours] = useState(true);

  const rawLV = user?.rawLV || '10:00 - 19:00';
  const rawSab = user?.rawSab || '08:00 - 19:00';
  const rawDom = user?.rawDom || '08:00 - 15:00';

  const [todayScheduleInfo, setTodayScheduleInfo] = useState({ name: 'Hoy', time: '', isDescanso: false });
  
  const isOnVacation = user?.onVacation === true || 
                       user?.onVacation === 'true' || 
                       (user?.vacations && user.vacations.status === 'ACTIVO');

  // ============================================================
  // FUNCIÓN: CONVERTIR HORAS DECIMALES A FORMATO HH:MM
  // ============================================================
  const decimalToHoursMinutes = (decimalHours) => {
    if (decimalHours === undefined || decimalHours === null || isNaN(decimalHours)) return '0:00';
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    return `${hours}:${String(minutes).padStart(2, '0')}`;
  };

  // ============================================================
  // FUNCIÓN: VERIFICAR SI UN DÍA ES DESCANSO PARA UN EMPLEADO
  // ============================================================
  const esDiaDescanso = (employeeId, fechaStr) => {
    if (!employeeId || !fechaStr) return false;
    
    const targetEmp = user;
    if (!targetEmp) return false;
    
    try {
      const parts = fechaStr.split(/[-/]/);
      let year, month, day;
      if (parts[0].length === 4) {
        [year, month, day] = parts;
      } else {
        [day, month, year] = parts;
      }
      const recordDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (isNaN(recordDate.getTime())) return false;
      
      const diaSemana = recordDate.getDay();
      let horarioDia = '';
      
      switch(diaSemana) {
        case 0: horarioDia = targetEmp.rawDom || 'DESCANSO'; break;
        case 1: horarioDia = targetEmp.rawLun || 'DESCANSO'; break;
        case 2: horarioDia = targetEmp.rawMar || 'DESCANSO'; break;
        case 3: horarioDia = targetEmp.rawMie || 'DESCANSO'; break;
        case 4: horarioDia = targetEmp.rawJue || 'DESCANSO'; break;
        case 5: horarioDia = targetEmp.rawVie || 'DESCANSO'; break;
        case 6: horarioDia = targetEmp.rawSab || 'DESCANSO'; break;
        default: return false;
      }
      
      return !horarioDia || horarioDia.toUpperCase().includes('DESCANSO') || horarioDia === '-';
    } catch (e) {
      return false;
    }
  };

  // ============================================================
  // FUNCIÓN OPTIMIZADA: CARGAR HORAS DEL EMPLEADO
  // ============================================================
  const loadEmployeeHours = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      console.log('🔄 Force refresh - limpiando caché');
      sessionStorage.removeItem(`hours_${user.id}`);
      sessionStorage.removeItem(`hours_${user.id}_last`);
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.includes(`hours_${user.id}`)) {
          sessionStorage.removeItem(key);
        }
      });
    }
    
    if (!forceRefresh) {
      const cached = sessionStorage.getItem(`hours_${user.id}`);
      const lastLoad = sessionStorage.getItem(`hours_${user.id}_last`);
      if (cached && lastLoad && (Date.now() - parseInt(lastLoad) < 120000)) {
        try {
          const data = JSON.parse(cached);
          if (data && data.horasReales !== undefined) {
            console.log('📦 Usando caché:', data);
            setWeeklyHours(data);
            setLoadingHours(false);
            return;
          }
        } catch (e) {
          console.warn('Error al leer caché:', e);
        }
      }
    }
    
    setLoadingHours(true);
    try {
      const cacheBuster = new Date().getTime();
      const url = `${apiUrl}?action=GET_EMPLOYEE_WEEKLY_HOURS&employeeId=${user.id}&_cb=${cacheBuster}`;
      console.log('📡 Cargando horas desde:', url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('📡 Respuesta de horas:', data);
      
      if (data && data.success && data.employee) {
        const employeeData = data.employee;
        const processedData = {
          id: employeeData.id || user.id,
          name: employeeData.name || user.name,
          horasEsperadas: employeeData.horasEsperadas || 0,
          horasReales: employeeData.horasReales || 0,
          horasExtra: employeeData.horasExtra || 0,
          horasFaltantes: employeeData.horasFaltantes || 0,
          balanceEstatus: employeeData.balanceEstatus || 'COMPLETO'
        };
        
        console.log('✅ Horas procesadas:', processedData);
        setWeeklyHours(processedData);
        
        sessionStorage.setItem(`hours_${user.id}`, JSON.stringify(processedData));
        sessionStorage.setItem(`hours_${user.id}_last`, String(Date.now()));
      } else {
        console.warn('⚠️ Respuesta inválida de GET_EMPLOYEE_WEEKLY_HOURS:', data);
        await loadHoursFallback();
      }
    } catch (err) {
      console.error('❌ Error loading employee hours:', err);
      await loadHoursFallback();
    } finally {
      setLoadingHours(false);
    }
  }, [apiUrl, user.id]);

  // ============================================================
  // FUNCIÓN DE FALLBACK PARA CARGAR HORAS
  // ============================================================
  const loadHoursFallback = useCallback(async () => {
    try {
      console.log('📡 Usando fallback GET_WEEKLY_HOURS');
      const cacheBuster = new Date().getTime();
      const response = await fetch(`${apiUrl}?action=GET_WEEKLY_HOURS&_cb=${cacheBuster}`);
      const data = await response.json();
      
      if (data.success && data.reporte) {
        const myData = data.reporte.find(emp => emp.id.toUpperCase() === user.id.toUpperCase());
        if (myData) {
          const processedData = {
            id: myData.id || user.id,
            name: myData.name || user.name,
            horasEsperadas: myData.horasEsperadas || 0,
            horasReales: myData.horasReales || 0,
            horasExtra: myData.horasExtra || 0,
            horasFaltantes: myData.horasFaltantes || 0,
            balanceEstatus: myData.balanceEstatus || 'COMPLETO'
          };
          console.log('✅ Horas desde fallback:', processedData);
          setWeeklyHours(processedData);
          sessionStorage.setItem(`hours_${user.id}`, JSON.stringify(processedData));
          sessionStorage.setItem(`hours_${user.id}_last`, String(Date.now()));
        }
      }
    } catch (err) {
      console.error('❌ Error en fallback:', err);
    }
  }, [apiUrl, user.id]);

  // ============================================================
  // FUNCIÓN: OBTENER HISTORIAL DEL EMPLEADO
  // ============================================================
  const fetchEmployeeData = useCallback(async () => {
    try {
      setLoadingTable(true);
      
      const cacheBuster = new Date().getTime();
      const url = `${apiUrl}?action=GET_ADMIN_DATA_OPTIMIZED&_cb=${cacheBuster}`;
      
      const response = await fetch(url);
      const resData = await response.json();
      
      if (resData.success) {
        const rawList = resData.records || resData.data || [];
        if (Array.isArray(rawList)) {
          const filtered = rawList.filter(rec => {
            const empId = getValueByStrategy(rec, ["ID Empleado", "ID_Empleado", "Empleado ID", "id"], 1, '').trim().toUpperCase();
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
  }, [apiUrl, user.id]);

  // ============================================================
  // FUNCIÓN: SINCRONIZAR PASO DEL DÍA
  // ============================================================
  const syncTodayStep = useCallback(async (force = false) => {
    if (hasOperatedLocally && !force) {
      console.log("Sincronización de botones omitida: Candado local activo.");
      return;
    }

    try {
      const stepUrl = `${apiUrl}?action=GET_TODAY_STEP&employeeId=${user.id}&_cb=${new Date().getTime()}`;
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
  }, [user.id, apiUrl, hasOperatedLocally]);

  // ============================================================
  // UTILITY: getValueByStrategy
  // ============================================================
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

  // ============================================================
  // EFECTO: CARGA INICIAL OPTIMIZADA EN PARALELO
  // ============================================================
  useEffect(() => {
    setHasOperatedLocally(false);
    setLoadingHistory(true);
    
    const last = user?.lastMovement ? String(user.lastMovement).toUpperCase() : 'NINGUNO';
    if (last === 'ENTRADA' || last === 'ENTRADATEMPORAL') setCurrentStep('OPCIONES_POST_ENTRADA');
    else if (last === 'SALIDATEMPORAL') setCurrentStep('ENTRADA_TEMPORAL');
    else if (last === 'SALIDA') setCurrentStep('JORNADA_COMPLETA');
    else setCurrentStep('ENTRADA');

    Promise.all([
      fetchEmployeeData(),
      loadEmployeeHours(),
      syncTodayStep(true)
    ]).then(() => {
      console.log('✅ Carga inicial completada');
    }).catch((err) => {
      console.error('Error en carga inicial:', err);
    });

  }, [apiUrl, user.id]);

  useEffect(() => {
    console.log('📊 weeklyHours actualizado:', weeklyHours);
  }, [weeklyHours]);

  // ============================================================
  // EFECTO: HORARIO DEL DÍA
  // ============================================================
  useEffect(() => {
    const numeroDia = new Date().getDay();
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

  // ============================================================
  // EFECTO: RELOJ EN TIEMPO REAL
  // ============================================================
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

  // ============================================================
  // EFECTO: CANDADO DE OPERACIONES
  // ============================================================
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

  // ============================================================
  // HANDLER: ABRIR ESCÁNER
  // ============================================================
  const handleOpenScanner = (movementType) => {
    if (isOnVacation) {
      setStatusMessage({ 
        text: 'No puedes registrar asistencias mientras estás de vacaciones.', 
        isError: true 
      });
      return;
    }
    setActiveMovement(movementType);
    setStatusMessage({ text: '', isError: false });
    setShowScanner(true);
  };

  // ============================================================
  // HANDLER: ESCANEO EXITOSO - CON IP (VALIDACIÓN POR RANGO)
  // ============================================================
  const handleScanSuccess = async (scannedJsonPayload) => {
    setShowScanner(false);
    setLoadingAction(true);
    setStatusMessage({ text: '', isError: false });
    
    let detectedIp = "desconocida";
    
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3500) });
      const ipData = await ipResponse.json();
      if (ipData && ipData.ip) {
        detectedIp = String(ipData.ip).trim();
        console.log('📡 IP detectada:', detectedIp);
      }
    } catch (ipErr) {
      console.warn("Fallo en ipify o timeout:", ipErr);
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
          clientIp: detectedIp,
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
        
        setLoadingHours(true);
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('🔃 Recargando datos después del registro...');
        
        await Promise.all([
          fetchEmployeeData(),
          loadEmployeeHours(true)
        ]);
        
        console.log('✅ Datos recargados correctamente');
        
        const cached = sessionStorage.getItem(`hours_${user.id}`);
        if (cached) {
          const data = JSON.parse(cached);
          console.log('📊 Horas después de recarga:', data);
        }
        
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

  // ============================================================
  // UTILITY: PARSE FECHA
  // ============================================================
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

  // ============================================================
  // FILTRO DE REGISTROS POR FECHA
  // ============================================================
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

  // ============================================================
  // UTILITY: VERIFICAR RETARDO - TOLERANCIA DE 10 MINUTOS
  // ============================================================
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

      if (minutosRegistro > (minutesConfig + 10)) {
        return "Entrada con Retardo";
      }
    } catch (e) {
      console.error("Error al evaluar retardo en historial:", e);
    }

    return movimientoBase;
  };

  // ============================================================
  // ESTILOS PARA HORAS
  // ============================================================
  const getHoursColor = () => {
    if (!weeklyHours) return 'text-zinc-500';
    const { horasReales, horasEsperadas } = weeklyHours;
    
    if (horasReales < horasEsperadas) {
      return 'text-rose-400';
    }
    if (horasReales > horasEsperadas) {
      return 'text-emerald-400';
    }
    return 'text-amber-400';
  };

  const getHoursBgColor = () => {
    if (!weeklyHours) return 'bg-zinc-900/50 border-zinc-800/50';
    const { horasReales, horasEsperadas } = weeklyHours;
    
    if (horasReales < horasEsperadas) {
      return 'bg-rose-500/10 border-rose-500/20';
    }
    if (horasReales > horasEsperadas) {
      return 'bg-emerald-500/10 border-emerald-500/20';
    }
    return 'bg-amber-500/10 border-amber-500/20';
  };

  const getHoursStatusText = () => {
    if (!weeklyHours) return 'Cargando...';
    const { horasReales, horasEsperadas } = weeklyHours;
    
    if (horasReales < horasEsperadas) {
      return 'Faltan Horas';
    }
    if (horasReales > horasEsperadas) {
      return 'Horas Extra';
    }
    return 'Jornada Exacta';
  };

  // ============================================================
  // RENDER PRINCIPAL
  // ============================================================
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans p-3 md:p-8">
      <div className="max-w-2xl mx-auto w-full space-y-4 md:space-y-6">
        
        {/* TARJETA DE IDENTIDAD */}
        <header className="bg-zinc-900 p-4 md:p-5 rounded-xl border border-zinc-800 shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[140px]">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded">
              Colaborador
            </span>
            <h1 className="text-lg md:text-xl font-bold text-white tracking-tight mt-1">{user.name}</h1>
            <p className="text-xs text-zinc-500 font-mono mt-0.5 uppercase break-all">ID: {user.id} • {user.store || 'PENIEL'}</p>
          </div>
          <button 
            onClick={onLogout} 
            className="px-3 py-2 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 font-bold rounded-lg border border-zinc-800 text-xs transition-colors uppercase font-mono tracking-wider flex-shrink-0"
          >
            Salir
          </button>
        </header>

        {/* BANNER DE VACACIONES */}
        {isOnVacation && (
          <div className="bg-amber-950/40 border-2 border-amber-900/60 p-4 rounded-xl text-center">
            <p className="text-amber-400 font-bold text-sm uppercase tracking-wider">
              ESTAS DE VACACIONES
            </p>
            <p className="text-amber-400/70 text-xs mt-1">
              No puedes registrar asistencias hasta que finalice tu período vacacional.
            </p>
          </div>
        )}

        {/* NÚCLEO CENTRAL: HORARIO AUTORIZADO Y RELOJ */}
        <section className="bg-zinc-900 p-4 md:p-6 rounded-xl border border-zinc-800 shadow-xl text-center space-y-3 md:space-y-4">
          <div className="flex flex-col items-center justify-center space-y-1">
            <span className="text-[10px] font-mono font-bold bg-zinc-950 text-orange-400 px-3 py-1 rounded uppercase border border-zinc-800 tracking-wider">
              Horario Autorizado: {todayScheduleInfo.name}
            </span>
            <div className={`font-mono font-black text-lg md:text-xl tracking-wide ${
              todayScheduleInfo.isDescanso ? 'text-zinc-500 italic' : 'text-zinc-200'
            }`}>
              {todayScheduleInfo.time}
            </div>
          </div>

          <div className="border-t border-zinc-800/60 my-2 w-3/4 mx-auto"></div>

          <div className="space-y-1 select-none">
            <h2 className="text-4xl md:text-5xl font-black text-white font-mono tracking-tight">
              {currentTime || '--:--:--'}
            </h2>
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">
              {currentDate}
            </p>
          </div>
        </section>

        {/* INDICADOR DE HORAS SEMANALES - CON FORMATO HH:MM */}
        {!isOnVacation && (
          <section className={`border rounded-xl p-4 md:p-5 shadow-xl ${loadingHours ? 'bg-zinc-900/50 border-zinc-800/50' : getHoursBgColor()}`}>
            {loadingHours ? (
              <div className="flex flex-col items-center justify-center py-2">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-[10px] text-zinc-500 font-mono animate-pulse">Cargando progreso semanal...</p>
              </div>
            ) : weeklyHours ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-center sm:text-left">
                  <p className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-wider">Progreso Semanal</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap justify-center sm:justify-start">
                    <span className="text-2xl md:text-3xl font-black text-white">
                      {decimalToHoursMinutes(weeklyHours.horasReales)}h
                    </span>
                    <span className="text-sm text-zinc-500">/ {decimalToHoursMinutes(weeklyHours.horasEsperadas)}h</span>
                    <span className={`text-sm font-bold uppercase ${getHoursColor()}`}>
                      {getHoursStatusText()}
                    </span>
                    <button 
                      onClick={() => {
                        console.log('🔄 Recarga manual de horas iniciada');
                        loadEmployeeHours(true);
                      }}
                      className="text-zinc-400 hover:text-orange-400 transition-colors ml-1 p-1 rounded hover:bg-zinc-800"
                      title="Recargar progreso semanal"
                      disabled={loadingHours}
                    >
                      {loadingHours ? (
                        <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex gap-4 text-xs font-mono">
                  <div>
                    <span className="text-zinc-500 block text-center">Esperadas</span>
                    <span className="text-white font-bold block text-center">{decimalToHoursMinutes(weeklyHours.horasEsperadas)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-center">Reales</span>
                    <span className={`font-bold block text-center ${getHoursColor()}`}>{decimalToHoursMinutes(weeklyHours.horasReales)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-center">Balance</span>
                    <span className={`font-bold block text-center ${getHoursColor()}`}>
                      {weeklyHours.horasExtra > 0 ? `+${decimalToHoursMinutes(weeklyHours.horasExtra)}` : 
                       weeklyHours.horasFaltantes > 0 ? `-${decimalToHoursMinutes(weeklyHours.horasFaltantes)}` : '0:00'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-2 text-zinc-500 text-sm">
                No se pudo cargar el progreso semanal
              </div>
            )}
          </section>
        )}

        {/* FEEDBACK */}
        {statusMessage.text && (
          <div className={`p-3 md:p-4 rounded-lg text-xs font-bold uppercase tracking-wide border text-center ${
            statusMessage.isError 
              ? 'bg-zinc-950 border-red-900 text-red-400 shadow-lg shadow-red-950/10' 
              : 'bg-zinc-950 border-emerald-900 text-emerald-400 shadow-lg shadow-emerald-950/10'
          }`}>
            {statusMessage.text}
          </div>
        )}

        {/* CONTROL DE BOTONES SECUENCIALES */}
        <div className="bg-zinc-900 p-4 md:p-6 rounded-xl border border-zinc-800 shadow-xl flex flex-col justify-center min-h-[100px] md:min-h-[110px]">
          {loadingHistory || loadingAction ? (
            <div className="text-center space-y-2 py-2">
              <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider animate-pulse">
                {loadingAction ? 'Procesando registro...' : 'Sincronizando bitácora...'}
              </p>
            </div>
          ) : isOnVacation ? (
            <div className="text-center py-3 md:py-4">
              <p className="text-amber-400 font-bold text-sm uppercase tracking-wider">
                Vacaciones activas
              </p>
              <p className="text-zinc-500 text-xs mt-1">
                No puedes realizar movimientos de asistencia
              </p>
            </div>
          ) : (
            <>
              {currentStep === 'ENTRADA' && (
                <button
                  onClick={() => handleOpenScanner('Entrada')}
                  className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3.5 md:py-4 rounded-lg text-xs uppercase tracking-wider transition-colors shadow-lg shadow-orange-900/20 font-mono active:scale-[0.98]"
                >
                  Escanear Código Entrada
                </button>
              )}

              {currentStep === 'OPCIONES_POST_ENTRADA' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 w-full">
                  <button
                    onClick={() => handleOpenScanner('Salida Temporal')}
                    className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-orange-400 font-bold py-3 md:py-3.5 rounded-lg text-xs uppercase tracking-wider transition-colors font-mono active:scale-[0.98]"
                  >
                    Salida Temporal
                  </button>
                  <button
                    onClick={() => handleOpenScanner('Salida')}
                    className="bg-rose-950/30 hover:bg-rose-900/30 text-rose-400 border border-rose-900/50 font-bold py-3 md:py-3.5 rounded-lg text-xs uppercase tracking-wider transition-colors font-mono shadow-lg shadow-rose-950/10 active:scale-[0.98]"
                  >
                    Registrar Salida
                  </button>
                </div>
              )}

              {currentStep === 'ENTRADA_TEMPORAL' && (
                <button
                  onClick={() => handleOpenScanner('Entrada Temporal')}
                  className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3.5 md:py-4 rounded-lg text-xs uppercase tracking-wider transition-colors shadow-lg shadow-orange-900/10 font-mono active:scale-[0.98]"
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

        {/* MI HISTORIAL DE ASISTENCIAS - CON ETIQUETA "DESCANSO TRABAJADO" */}
        <section className="bg-zinc-900 rounded-xl border border-zinc-800 shadow-xl overflow-hidden space-y-3 md:space-y-4 p-4 md:p-5">
          <div className="border-b border-zinc-800 pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 md:gap-3">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Mi Historial</h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">Registros de entrada y salida</p>
            </div>
            
            <div className="flex items-center gap-2 md:gap-3 text-[10px] font-bold text-zinc-400 uppercase font-mono bg-zinc-950 px-2 md:px-3 py-1.5 rounded border border-zinc-800/60">
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
                <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase">Fecha:</span>
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
            <div className="text-center py-6 text-zinc-500 font-mono text-xs animate-pulse">Cargando...</div>
          ) : filteredMyRecords.length === 0 ? (
            <div className="text-center py-6 text-zinc-600 font-medium text-xs">No hay movimientos en la fecha elegida.</div>
          ) : (
            <div className="overflow-x-auto border border-zinc-800/40 rounded-lg">
              <table className="w-full text-left border-collapse text-xs md:text-sm">
                <thead>
                  <tr className="bg-zinc-950 border-b border-zinc-800 text-zinc-500 uppercase font-mono text-[9px] tracking-wider">
                    <th className="py-2.5 px-2 md:px-3">Fecha</th>
                    <th className="py-2.5 px-2 md:px-3">Hora</th>
                    <th className="py-2.5 px-2 md:px-3">Movimiento</th>
                    <th className="py-2.5 px-2 md:px-3 text-right">Sucursal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40 font-mono">
                  {filteredMyRecords.map((rec, idx) => {
                    const dateVal = getValueByStrategy(rec, ["Fecha", "fecha", "date"], 2, '--/--/----');
                    const timeVal = getValueByStrategy(rec, ["Hora", "hora", "time"], 3, '--:--');
                    const movRaw = getValueByStrategy(rec, ["Movimiento", "movimiento", "movement"], 4, 'ENTRADA');
                    const storeVal = getValueByStrategy(rec, ["Sucursal", "Tienda", "store", "sucursal"], 5, 'PENIEL');
                    const isEdited = getValueByStrategy(rec, ["Auditado", "auditado"], 7, 'FALSE') === 'TRUE';

                    const movimientoFinal = getMovimientoConRetardo(movRaw, dateVal, timeVal);
                    
                    const isDescanso = esDiaDescanso(user.id, dateVal);

                    return (
                      <tr key={idx} className="hover:bg-zinc-800/20 transition-all">
                        <td className="py-2.5 md:py-3 px-2 md:px-3 text-zinc-400">{dateVal}</td>
                        <td className="py-2.5 md:py-3 px-2 md:px-3 font-bold text-white">
                          {timeVal}
                          {isEdited && (
                            <span className="block text-[8px] text-orange-500 font-sans font-bold uppercase tracking-tight mt-0.5">
                              Ajustado
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 md:py-3 px-2 md:px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-sans font-bold uppercase tracking-wide ${
                            movimientoFinal.toUpperCase().includes('RETARDO') ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            movimientoFinal.toUpperCase().includes('TEMPORAL') ? 'bg-orange-500/10 text-orange-400' :
                            movimientoFinal.toUpperCase().includes('SALIDA') ? 'bg-rose-500/10 text-rose-400' :
                            'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            {movimientoFinal}
                          </span>
                          {isDescanso && (
                            <span className="ml-1 px-1.5 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded text-[8px] font-bold uppercase">
                              Descanso trabajado
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 md:py-3 px-2 md:px-3 text-right uppercase text-zinc-500 text-[10px] font-bold">{storeVal}</td>
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
            Control de Asistencia
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