import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

function AdminPanel({ user, onLogout, apiUrl }) {
  const [allRecords, setAllRecords] = useState([]);
  const [employeesList, setEmployeesList] = useState([]); // Lista para gestión de personal
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState({ text: '', isError: false });

  // Pestañas Principales (GENERAL y Sucursales filtran la bitácora; PERSONAL es el módulo de catálogo)
  const [activeTab, setActiveTab] = useState('GENERAL');

  // Filtros de Bitácora
  const [searchQuery, setSearchQuery] = useState('');
  const [movementFilter, setMovementFilter] = useState('TODOS');
  const [dateMode, setDateMode] = useState('SINGLE'); 
  const [singleDate, setSingleDate] = useState(() => {
    const hoy = new Date();
    const dia = String(hoy.getDate()).padStart(2, '0');
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    return `${hoy.getFullYear()}-${mes}-${dia}`;
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Estados para la Paginación de la Bitácora
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 30; // Cantidad de filas por página en la tabla

  // Generador QR
  const [qrStoreTarget, setQrStoreTarget] = useState('PENIEL');
  const [generatedJson, setGeneratedJson] = useState('');

  // Estados para Edición de Horas en Bitácora
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [editingTimeValue, setEditingTimeValue] = useState('');
  const [editingCommentValue, setEditingCommentValue] = useState(''); // Justificación del cambio

  // Estado para alternar la visibilidad de los comentarios de forma independiente
  const [expandedComments, setExpandedComments] = useState({});

  // Edición de Horarios por Día de la Semana (Módulo Personal)
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [editScheduleData, setEditScheduleData] = useState({
    Lunes: { isLaborable: true, in: '10:00', out: '19:00' },
    Martes: { isLaborable: true, in: '10:00', out: '19:00' },
    Miércoles: { isLaborable: true, in: '10:00', out: '19:00' },
    Jueves: { isLaborable: true, in: '10:00', out: '19:00' },
    Viernes: { isLaborable: true, in: '10:00', out: '19:00' },
    Sábado: { isLaborable: true, in: '08:00', out: '19:00' },
    Domingo: { isLaborable: true, in: '08:00', out: '15:00' },
  });

  // Función utilitaria para abrir/cerrar un comentario
  const toggleComment = (recordId) => {
    setExpandedComments(prev => ({
      ...prev,
      [recordId]: !prev[recordId]
    }));
  };

  // FUNCIÓN FORMATEADORA: Limpia y recorta strings de fecha
  const formatShortModifiedDate = (dateStr) => {
    if (!dateStr) return 'Sin registros previos';
    
    let cleanStr = String(dateStr).trim();
    if (cleanStr === 'Recién modificado') return cleanStr;

    try {
      const date = new Date(cleanStr);
      if (isNaN(date.getTime())) return cleanStr;
      
      const dia = String(date.getDate()).padStart(2, '0');
      const mes = String(date.getMonth() + 1).padStart(2, '0');
      const anio = date.getFullYear();
      const horas = String(date.getHours()).padStart(2, '0');
      const minutos = String(date.getMinutes()).padStart(2, '0');
      
      return `${dia}/${mes}/${anio} ${horas}:${minutos}`;
    } catch (e) {
      return cleanStr;
    }
  };

  // Cargar datos tanto de la bitácora como del catálogo de empleados
  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const cacheBusterUrl = `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}_cb=${new Date().getTime()}`;
      const response = await fetch(cacheBusterUrl);
      const resData = await response.json();

      if (resData.success) {
        if (resData.data) setAllRecords(resData.data);
        if (resData.employees) {
          setEmployeesList(resData.employees);
        } else {
          detectEmployeesFromRecords(resData.data);
        }
      } else {
        setStatusMessage({ text: 'No se pudieron recuperar los datos de Google Sheets.', isError: true });
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({ text: 'Error de conexión con el servidor de Google.', isError: true });
    } finally {
      setLoading(false);
    }
  };

  const detectEmployeesFromRecords = (records) => {
    if (!records) return;
    const unique = {};
    
    const currentSchedulesMap = {};
    employeesList.forEach(emp => {
      currentSchedulesMap[String(emp.id).toUpperCase()] = {
        lastModified: emp.lastModified,
        rawLun: emp.rawLun,
        rawMar: emp.rawMar,
        rawMie: emp.rawMie,
        rawJue: emp.rawJue,
        rawVie: emp.rawVie,
        rawSab: emp.rawSab,
        rawDom: emp.rawDom
      };
    });

    records.forEach(r => {
      const id = String(r["ID Empleado"] || r["ID_Empleado"] || r["Empleado ID"] || r[1] || '').trim().toUpperCase();
      const name = String(r["NombreReal"] || r["Empleado"] || r["Nombre"] || 'Sin Nombre').trim();
      const store = String(r["Sucursal"] || r["store"] || r[5] || 'PENIEL').trim().toUpperCase();
      
      if (id && id !== 'N/A' && !unique[id]) {
        if (currentSchedulesMap[id]) {
          unique[id] = {
            id, name, store,
            lastModified: currentSchedulesMap[id].lastModified || '',
            rawLun: currentSchedulesMap[id].rawLun || '10:00 - 19:00',
            rawMar: currentSchedulesMap[id].rawMar || '10:00 - 19:00',
            rawMie: currentSchedulesMap[id].rawMie || '10:00 - 19:00',
            rawJue: currentSchedulesMap[id].rawJue || '10:00 - 19:00',
            rawVie: currentSchedulesMap[id].rawVie || '10:00 - 19:00',
            rawSab: currentSchedulesMap[id].rawSab || '08:00 - 19:00',
            rawDom: currentSchedulesMap[id].rawDom || '08:00 - 15:00'
          };
        } else {
          unique[id] = { 
            id, name, store, 
            lastModified: '',
            rawLun: '10:00 - 19:00',
            rawMar: '10:00 - 19:00',
            rawMie: '10:00 - 19:00',
            rawJue: '10:00 - 19:00',
            rawVie: '10:00 - 19:00',
            rawSab: '08:00 - 19:00',
            rawDom: '08:00 - 15:00'
          };
        }
      }
    });
    
    setEmployeesList(Object.values(unique));
  };

  useEffect(() => {
    fetchAdminData();
  }, [apiUrl]);

  useEffect(() => {
    const qrPayload = {
      type: "FERRE_QR_AUTH",
      store: qrStoreTarget
    };
    setGeneratedJson(JSON.stringify(qrPayload));
  }, [qrStoreTarget]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, movementFilter, dateMode, singleDate, startDate, endDate, activeTab]);

  // CALCULO DINÁMICO DE RETARDOS DEPENDIENDO DEL DÍA DE LA SEMANA DE LA ASISTENCIA
  const checkIsLate = (recordTimeStr, employeeId, recordDateStr) => {
    if (!recordTimeStr || recordTimeStr === '--:--' || !employeeId || !recordDateStr) return false;
    
    const targetEmp = employeesList.find(e => String(e.id).toUpperCase() === String(employeeId).toUpperCase());
    if (!targetEmp) return false;

    const recordDateObj = parseStringToLocalDate(recordDateStr);
    if (!recordDateObj) return false;

    const diasSemanaCampos = ['rawDom', 'rawLun', 'rawMar', 'rawMie', 'rawJue', 'rawVie', 'rawSab'];
    const diaPropiedad = diasSemanaCampos[recordDateObj.getDay()];
    const horarioDiaString = targetEmp[diaPropiedad];

    if (!horarioDiaString || horarioDiaString.toUpperCase().includes('DESCANSO') || horarioDiaString === '-') return false;
    
    const horaPermitidaStr = horarioDiaString.split('-')[0].trim();

    const timeToMinutes = (str) => {
      const parts = str.split(':');
      if (parts.length < 2) return 0;
      return (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10);
    };

    const minutesOfRecord = timeToMinutes(recordTimeStr);
    const minutesLimitAllowed = timeToMinutes(horaPermitidaStr);

    return minutesOfRecord > (minutesLimitAllowed + 15); // 15 minutos de tolerancia
  };

  const handlePrintQR = () => {
    const canvas = document.querySelector('#qr-print-zone canvas');
    if (!canvas) {
      alert("Error: No se encontró el código QR para imprimir.");
      return;
    }
    const qrImageSrc = canvas.toDataURL("image/png");
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir QR - Control de Asistencias</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 90vh; margin: 0; text-align: center; }
            img { width: 260px; height: 260px; margin-bottom: 20px; }
            h1 { font-size: 22px; margin: 0; color: #000; letter-spacing: 1px; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <img src="${qrImageSrc}" />
          <h1>SUCURSAL: ${qrStoreTarget}</h1>
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSaveTimeEdit = async (recordId) => {
    if (!editingTimeValue) return;
    try {
      setLoading(true);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'EDIT_RECORD',
          recordId: recordId,
          newTime: editingTimeValue,
          comment: editingCommentValue || 'Modificado por el Administrador'
        })
      });
      const resData = await response.json();
      if (resData.success) {
        setEditingRecordId(null);
        setEditingTimeValue('');
        setEditingCommentValue('');
        await fetchAdminData();
      } else {
        alert("Error al editar registro: " + resData.error);
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al intentar editar.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditEmployee = (emp) => {
    setEditingEmployeeId(emp.id);
    
    const parseDayStr = (str) => {
      if (!str || str.toUpperCase().includes('DESCANSO') || str === '-') {
        return { isLaborable: false, in: '10:00', out: '19:00' };
      }
      const parts = str.split('-');
      return {
        isLaborable: true,
        in: parts[0] ? parts[0].trim() : '10:00',
        out: parts[1] ? parts[1].trim() : '19:00'
      };
    };

    setEditScheduleData({
      Lunes: parseDayStr(emp.rawLun),
      Martes: parseDayStr(emp.rawMar),
      Miércoles: parseDayStr(emp.rawMie),
      Jueves: parseDayStr(emp.rawJue),
      Viernes: parseDayStr(emp.rawVie),
      Sábado: parseDayStr(emp.rawSab),
      Domingo: parseDayStr(emp.rawDom),
    });
  };

  const handleSaveEmployeeSchedule = async (empId) => {
    try {
      setLoading(true);
      
      const payloadSchedule = {
        action: 'UPDATE_EMPLOYEE_SCHEDULE_FLEX',
        employeeId: empId,
        
        // Lunes
        rawLunIn: editScheduleData.Lunes.isLaborable ? editScheduleData.Lunes.in : 'DESCANSO',
        rawLunOut: editScheduleData.Lunes.isLaborable ? editScheduleData.Lunes.out : 'DESCANSO',
        
        // Martes
        rawMarIn: editScheduleData.Martes.isLaborable ? editScheduleData.Martes.in : 'DESCANSO',
        rawMarOut: editScheduleData.Martes.isLaborable ? editScheduleData.Martes.out : 'DESCANSO',
        
        // Miércoles
        rawMieIn: editScheduleData.Miércoles.isLaborable ? editScheduleData.Miércoles.in : 'DESCANSO',
        rawMieOut: editScheduleData.Miércoles.isLaborable ? editScheduleData.Miércoles.out : 'DESCANSO',
        
        // Jueves
        rawJueIn: editScheduleData.Jueves.isLaborable ? editScheduleData.Jueves.in : 'DESCANSO',
        rawJueOut: editScheduleData.Jueves.isLaborable ? editScheduleData.Jueves.out : 'DESCANSO',
        
        // Viernes
        rawVieIn: editScheduleData.Viernes.isLaborable ? editScheduleData.Viernes.in : 'DESCANSO',
        rawVieOut: editScheduleData.Viernes.isLaborable ? editScheduleData.Viernes.out : 'DESCANSO',
        
        // Sábado
        rawSabIn: editScheduleData.Sábado.isLaborable ? editScheduleData.Sábado.in : 'DESCANSO',
        rawSabOut: editScheduleData.Sábado.isLaborable ? editScheduleData.Sábado.out : 'DESCANSO',
        
        // Domingo
        rawDomIn: editScheduleData.Domingo.isLaborable ? editScheduleData.Domingo.in : 'DESCANSO',
        rawDomOut: editScheduleData.Domingo.isLaborable ? editScheduleData.Domingo.out : 'DESCANSO',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payloadSchedule)
      });
      const resData = await response.json();
      
      if (resData.success) {
        setEditingEmployeeId(null);
        await fetchAdminData(); 
        setStatusMessage({ text: `Esquema de disponibilidad semanal actualizado con éxito en el catálogo.`, isError: false });
      } else {
        alert("Error al guardar esquema: " + resData.error);
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al guardar los horarios.");
    } finally {
      setLoading(false);
    }
  };

  const handleDayDataChange = (day, field, value) => {
    setEditScheduleData(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  const getValueByStrategy = (obj, searchKeys, fallbackIndex, fallback = '') => {
    if (!obj) return fallback;
    for (let key of searchKeys) {
      if (obj[key] !== undefined && obj[key] !== null) return String(obj[key]).trim();
    }
    const values = Object.values(obj);
    return (values[fallbackIndex] !== undefined && values[fallbackIndex] !== null) ? String(values[fallbackIndex]).trim() : fallback;
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

  // Filtrado de la bitácora
  const filteredRecords = allRecords.filter(rec => {
    const recStore = getValueByStrategy(rec, ["Sucursal", "store"], 5, 'PENIEL').toUpperCase();
    const empName = getValueByStrategy(rec, ["NombreReal", "Empleado", "Nombre"], 0, 'Sin Identificar').toLowerCase(); 
    
    let empId = "";
    if (rec["ID Empleado"]) empId = String(rec["ID Empleado"]).toLowerCase();
    else if (rec["ID_Empleado"]) empId = String(rec["ID_Empleado"]).toLowerCase();
    else empId = getValueByStrategy(rec, [], 1, '').toLowerCase(); 

    const recMov = getValueByStrategy(rec, ["Movimiento", "movimiento"], 4, '').toUpperCase().replace(/[\s_\-]/g, '');
    const recDateRaw = getValueByStrategy(rec, ["Fecha", "fecha"], 2, '');

    if (activeTab !== 'GENERAL' && activeTab !== 'PERSONAL' && recStore !== activeTab) return false;
    
    const query = searchQuery.toLowerCase().trim();
    if (query && !empName.includes(query) && !empId.includes(query)) return false;
    
    if (movementFilter !== 'TODOS') {
      const normalizedFilter = movementFilter.replace(/[\s_\-]/g, '').toUpperCase();
      if (recMov !== normalizedFilter) return false;
    }

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

  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage) || 1;
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecordsToDisplay = filteredRecords.slice(indexOfFirstRecord, indexOfLastRecord);

  const obtenerPersonalLaborandoHoy = () => {
    const hoy = new Date();
    const dia = String(hoy.getDate()).padStart(2, '0');
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const hoyStr = `${hoy.getFullYear()}-${mes}-${dia}`;

    const asistenciasDeHoy = allRecords.filter(rec => {
      const recDateRaw = getValueByStrategy(rec, ["Fecha", "fecha"], 2, '');
      const recDateClean = String(recDateRaw).split('T')[0].trim();
      const recordDateObj = parseStringToLocalDate(recDateClean);
      if (!recordDateObj) return false;
      const targetDateObj = parseStringToLocalDate(hoyStr);
      return recordDateObj.getTime() === targetDateObj.getTime();
    });

    const ultimoEstadoPorEmpleado = {};

    [...asistenciasDeHoy].reverse().forEach(rec => {
      let empId = 'N/A';
      if (rec["ID Empleado"]) empId = String(rec["ID Empleado"]).trim().toUpperCase();
      else if (rec["ID_Empleado"]) empId = String(rec["ID_Empleado"]).trim().toUpperCase();
      else empId = getValueByStrategy(rec, [], 1, 'N/A').toUpperCase();

      const recStore = getValueByStrategy(rec, ["Sucursal", "store"], 5, 'PENIEL').toUpperCase();
      const recMov = getValueByStrategy(rec, ["Movimiento", "movimiento"], 4, '').toUpperCase().replace(/[\s_\-]/g, '');

      if (activeTab === 'GENERAL' || recStore === activeTab) {
        if (empId && empId !== 'N/A') {
          ultimoEstadoPorEmpleado[empId] = recMov;
        }
      }
    });

    let contadoresTrabajando = 0;
    Object.values(ultimoEstadoPorEmpleado).forEach(movimiento => {
      if (movimiento === 'ENTRADA' || movimiento === 'ENTRADATEMPORAL') {
        contadoresTrabajando++;
      }
    });

    return contadoresTrabajando;
  };

  const handleExportToPDF = () => {
    if (filteredRecords.length === 0) {
      alert("No hay registros en la vista actual para exportar.");
      return;
    }

    const printWindow = window.open('', '_blank');
    
    const tableRowsHtml = filteredRecords.map((rec) => {
      const empIdValue = getValueByStrategy(rec, ["ID Empleado", "ID_Empleado", "Empleado ID"], 1, 'N/A');
      const targetEmpObj = employeesList.find(e => String(e.id).toUpperCase() === String(empIdValue).toUpperCase());
      const empName = targetEmpObj ? targetEmpObj.name : 'Personal Activo';
      const store = getValueByStrategy(rec, ["Sucursal"], 5, 'PENIEL');
      const movement = getValueByStrategy(rec, ["Movimiento", "movimiento"], 4, 'ENTRADA');
      const date = getValueByStrategy(rec, ["Fecha", "fecha"], 2, '--/--/----');
      const time = getValueByStrategy(rec, ["Hora", "hora"], 3, '--:--');
      const comment = getValueByStrategy(rec, ["Justificacion"], 8, '');
      const modPropValue = getValueByStrategy(rec, ["Modificacion", "Modificación"], 6, 'FALSE');
      const isEdited = modPropValue.toUpperCase() === 'TRUE';
      
      const esRetardo = movement.toUpperCase().includes('ENTRADA') && !movement.toUpperCase().includes('TEMPORAL') && checkIsLate(time, empIdValue, date);

      return `
        <tr>
          <td>
            <div style="font-weight: bold; color: #111;">${empName}</div>
            <div style="font-size: 10px; color: #666; font-family: monospace;">ID: ${empIdValue}</div>
          </td>
          <td style="font-family: monospace; font-weight: bold; text-transform: uppercase; color: #444;">${store}</td>
          <td>
            <span class="badge ${esRetardo ? 'badge-retardo' : movement.toUpperCase().includes('SALIDA') ? 'badge-salida' : 'badge-entrada'}">
              ${movement} ${esRetardo ? '- RETARDO' : ''}
            </span>
          </td>
          <td style="font-family: monospace; color: #333;">${date}</td>
          <td style="font-family: monospace; font-weight: bold; color: #111;">
            ${time}
            ${isEdited ? `<div style="font-size: 8px; color: #e65100; font-family: sans-serif; font-weight: bold; margin-top: 2px;">MODIFICADO</div>` : ''}
          </td>
          <td style="font-size: 10px; max-width: 180px; word-wrap: break-words; color: #555; font-style: italic;">
            ${comment ? `"${comment}"` : '-'}
          </td>
        </tr>
      `;
    }).join('');

    const filtroFechaText = dateMode === 'SINGLE' ? `Día: ${singleDate}` : `Rango: ${startDate} al ${endDate}`;

    printWindow.document.write(`
      <html>
        <head>
          <title>Reporte_Asistencias_${activeTab}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm 10mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #222; margin: 0; padding: 0; font-size: 11px; line-height: 1.4; }
            .header { border-bottom: 3px solid #ea580c; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 18px; font-weight: bold; color: #111; text-transform: uppercase; letter-spacing: 0.5px; }
            .subtitle { font-size: 11px; color: #555; margin-top: 2px; }
            .meta-box { background-color: #f4f4f5; border: 1px solid #e4e4e7; padding: 8px 12px; border-radius: 6px; margin-bottom: 15px; display: flex; gap: 20px; }
            .meta-item { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #71717a; }
            .meta-item span { color: #111; font-family: monospace; font-size: 11px; display: block; margin-top: 1px; }
            table { width: 100%; border-collapse: collapse; text-align: left; margin-top: 5px; }
            th { background-color: #18181b; color: #ffffff; font-family: monospace; font-size: 9px; text-transform: uppercase; padding: 7px 8px; letter-spacing: 0.5px; }
            td { padding: 7px 8px; border-bottom: 1px solid #e4e4e7; vertical-align: top; }
            tr:nth-child(even) { background-color: #fafafa; }
            .badge { display: inline-block; padding: 2px 6px; font-size: 9px; font-weight: bold; border-radius: 4px; text-transform: uppercase; }
            .badge-entrada { background-color: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
            .badge-salida { background-color: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
            .badge-retardo { background-color: #fff7ed; color: #9a3412; border: 1px solid #ffedd5; }
            .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 8px; color: #a1a1aa; border-top: 1px solid #e4e4e7; padding-top: 4px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">REPORTE OFICIAL DE ASISTENCIAS</div>
              <div class="subtitle">Sistema Control de Accesos - Panel Administrativo</div>
            </div>
            <div style="text-align: right; font-size: 9px; color: #71717a; font-family: monospace;">
              Generado: ${new Date().toLocaleDateString('es-MX')} ${new Date().toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'})}
            </div>
          </div>

          <div class="meta-box">
            <div class="meta-item">Vista Filtro: <span style="font-weight: bold; color: #ea580c;">${activeTab === 'GENERAL' ? 'TODAS LAS SUCURSALES' : activeTab}</span></div>
            <div class="meta-item">Período Seleccionado: <span>${filtroFechaText}</span></div>
            <div class="meta-item">Total Registros: <span>${filteredRecords.length}</span></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 25%;">Empleado</th>
                <th style="width: 15%;">Sucursal</th>
                <th style="width: 20%;">Movimiento</th>
                <th style="width: 12%;">Fecha</th>
                <th style="width: 12%;">Hora</th>
                <th style="width: 16%;">Justificación / Comentario</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="footer">
            Documento de control administrativo interno. Copia digital autorizada por el Panel de Administración de Sistemas.
          </div>

          <script>
            window.onload = function() { 
              window.print(); 
              setTimeout(function(){ window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const renderMiniCalendario = (emp) => {
    const dias = [
      { label: 'L', val: emp.rawLun, name: 'Lunes' },
      { label: 'M', val: emp.rawMar, name: 'Martes' },
      { label: 'M', val: emp.rawMie, name: 'Miércoles' },
      { label: 'J', val: emp.rawJue, name: 'Jueves' },
      { label: 'V', val: emp.rawVie, name: 'Viernes' },
      { label: 'S', val: emp.rawSab, name: 'Sábado' },
      { label: 'D', val: emp.rawDom, name: 'Domingo' }
    ];

    return (
      <div className="flex flex-wrap gap-1.5 py-1">
        {dias.map((d, i) => {
          const esDescanso = !d.val || d.val.toUpperCase().includes('DESCANSO') || d.val === '-';
          return (
            <div 
              key={i} 
              title={`${d.name}: ${esDescanso ? 'Descanso' : d.val}`}
              className={`flex flex-col items-center justify-center w-9 h-9 rounded text-[10px] font-mono border ${
                esDescanso 
                  ? 'bg-zinc-950/40 border-zinc-800/80 text-zinc-600' 
                  : 'bg-zinc-900 border-orange-500/20 text-orange-400 shadow-sm'
              }`}
            >
              <span className="text-[8px] font-sans font-bold text-zinc-500 block uppercase">{d.label}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const personalLaborandoHoy = obtenerPersonalLaborandoHoy();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ENCABEZADO */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-xl gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Panel de Administración General
            </h1>
            <p className="text-sm text-zinc-400 mt-0.5">Consola de monitoreo e inventario de asistencia</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <button onClick={fetchAdminData} className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold transition-all uppercase tracking-wider">
              Sincronizar
            </button>
            <button onClick={onLogout} className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-bold transition-all uppercase tracking-wider">
              Salir
            </button>
          </div>
        </header>

        {/* NAVEGACIÓN PRINCIPAL */}
        <nav className="flex flex-wrap gap-2 p-1 bg-zinc-900 rounded-lg border border-zinc-800">
          {['GENERAL', 'PENIEL', 'EMAR', 'EBEN-EZER', 'PERSONAL'].map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setStatusMessage({ text: '', isError: false }); }}
              className={`flex-1 min-w-[110px] text-center py-2.5 rounded-md text-xs font-bold uppercase transition-all ${
                activeTab === tab ? 'bg-orange-600 text-white shadow-md' : 'text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              {tab === 'GENERAL' ? 'Todas las Tiendas' : tab === 'PERSONAL' ? 'Gestión de Personal' : `Sucursal ${tab}`}
            </button>
          ))}
        </nav>

        {/* Feedback */}
        {statusMessage.text && (
          <div className={`p-4 rounded-lg text-xs font-bold uppercase tracking-wide border ${statusMessage.isError ? 'bg-zinc-950 border-red-900 text-red-400' : 'bg-zinc-950 border-emerald-800 text-emerald-400'}`}>
            {statusMessage.text}
          </div>
        )}

        {/* CONTENIDO PRINCIPAL */}
        {activeTab === 'PERSONAL' ? (
          
          <main className="bg-zinc-900 rounded-xl border border-zinc-800 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-zinc-800 bg-zinc-900">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Delimitación de Horarios Autorizados</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Configura esquemas libres para personal de fin de semana, mixto o turnos tradicionales con días de descanso.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px] tracking-wider">
                    <th className="py-3 px-4" style={{ width: '20%' }}>Trabajador</th>
                    <th className="py-3 px-4" style={{ width: '10%' }}>ID Sistema</th>
                    <th className="py-3 px-4" style={{ width: '12%' }}>Sucursal Base</th>
                    <th className="py-3 px-4" style={{ width: '45%' }}>Calendario de Disponibilidad Semanal</th>
                    <th className="py-3 px-4" style={{ width: '13%' }}>Último Ajuste</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-xs font-medium">
                  {employeesList.map((emp) => (
                    <tr key={emp.id} className="hover:bg-zinc-800/30 transition-all">
                      <td className="py-4 px-4">
                        <div className="font-bold text-white text-sm">{emp.name}</div>
                      </td>
                      <td className="py-4 px-4 font-mono text-zinc-500">{emp.id}</td>
                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 bg-zinc-950 border border-zinc-800 rounded text-[10px] font-bold font-mono text-zinc-400 uppercase">
                          {emp.store}
                        </span>
                      </td>
                      
                      <td className="py-4 px-4">
                        {editingEmployeeId === emp.id ? (
                          /* COMPONENTE DE CRONOGRAMA CORREGIDO Y REDISEÑADO */
                          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 my-3 max-w-4xl text-left space-y-4 shadow-2xl">
                            
                            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                              <span className="text-[11px] font-bold tracking-wider text-orange-400 flex items-center gap-1.5 uppercase">
                                Configuración de Cronograma Semanal
                              </span>
                            </div>

                            {/* GRID DE DÍAS: 2 columnas balanceadas */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                              {Object.keys(editScheduleData).map((dia) => {
                                const dayMeta = {
                                  Lunes: 'border-orange-500/10',
                                  Martes: 'border-orange-500/10',
                                  Miércoles: 'border-amber-500/10',
                                  Jueves: 'border-amber-500/10',
                                  Viernes: 'border-emerald-500/10',
                                  Sábado: 'border-emerald-500/10',
                                  Domingo: 'border-rose-500/10'
                                }[dia] || 'border-zinc-800';

                                return (
                                  <div 
                                    key={dia} 
                                    className={`bg-zinc-900/40 border ${dayMeta} rounded-xl p-3 flex flex-col justify-between gap-2.5 hover:border-zinc-800 transition-all`}
                                  >
                                    {/* Cabecera del Día */}
                                    <div className="flex justify-between items-center">
                                      <span className="font-bold text-zinc-200 text-xs tracking-wide uppercase">{dia}</span>
                                      <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer font-sans select-none bg-zinc-950 px-2 py-0.5 rounded-full border border-zinc-800">
                                        <input 
                                          type="checkbox" 
                                          checked={editScheduleData[dia].isLaborable} 
                                          onChange={(e) => handleDayDataChange(dia, 'isLaborable', e.target.checked)}
                                          className="accent-orange-500 rounded w-3 h-3 cursor-pointer"
                                        />
                                        <span>Labora</span>
                                      </label>
                                    </div>
                                    
                                    {/* Inputs o Estado Descanso */}
                                    {editScheduleData[dia].isLaborable ? (
                                      <div className="grid grid-cols-2 gap-2">
                                        {/* Entrada */}
                                        <div className="space-y-1">
                                          <span className="text-[9px] font-semibold text-zinc-500 block uppercase tracking-tight">Entrada</span>
                                          <input 
                                            type="time" 
                                            value={editScheduleData[dia].in} 
                                            onChange={(e) => handleDayDataChange(dia, 'in', e.target.value)} 
                                            className="w-full bg-zinc-950 border border-zinc-800 text-center rounded-md py-1 font-mono text-xs text-orange-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-all" 
                                          />
                                        </div>
                                        {/* Salida */}
                                        <div className="space-y-1">
                                          <span className="text-[9px] font-semibold text-zinc-500 block uppercase tracking-tight">Salida</span>
                                          <input 
                                            type="time" 
                                            value={editScheduleData[dia].out} 
                                            onChange={(e) => handleDayDataChange(dia, 'out', e.target.value)} 
                                            className="w-full bg-zinc-950 border border-zinc-800 text-center rounded-md py-1 font-mono text-xs text-amber-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all" 
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="py-2 text-center text-[10px] bg-zinc-950 rounded-lg border border-dashed border-zinc-800/80 text-zinc-500 font-bold uppercase tracking-widest my-0.5">
                                        Descanso
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          renderMiniCalendario(emp)
                        )}
                      </td>

                      <td className="py-4 px-4 font-mono text-zinc-400 text-[11px]">
                        {emp.lastModified ? (
                          <span className="text-orange-500/90 font-mono font-semibold">
                            {formatShortModifiedDate(emp.lastModified)}
                          </span>
                        ) : (
                          <span className="text-zinc-600 italic">Estable</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right font-sans">
                        {editingEmployeeId === emp.id ? (
                          <div className="flex flex-col justify-center gap-1.5 min-w-[85px]">
                            <button 
                              onClick={() => handleSaveEmployeeSchedule(emp.id)} 
                              className="w-full px-3 py-1.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded font-bold text-[10px] uppercase tracking-wider shadow transition-all"
                            >
                              Guardar
                            </button>
                            <button 
                              onClick={() => setEditingEmployeeId(null)} 
                              className="w-full px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleStartEditEmployee(emp)}
                            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-orange-500 border border-zinc-700/60 rounded font-bold text-[11px] uppercase tracking-wider transition-colors"
                          >
                            Editar Esquema
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </main>

        ) : (
          
          <>
            {/* METRICAS */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800">
                <p className="text-xs font-bold tracking-wider text-zinc-500 uppercase">Registros en Vista</p>
                <h3 className="text-3xl font-black text-white mt-1">{filteredRecords.length}</h3>
              </div>
              
              <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800">
                <p className="text-xs font-bold tracking-wider text-zinc-500 uppercase">Personal Laborando Hoy</p>
                <h3 className="text-3xl font-black text-emerald-500 mt-1">{personalLaborandoHoy}</h3>
                <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase">
                  {activeTab === 'GENERAL' ? `${employeesList.length} en total` : `${employeesList.filter(e => e.store?.toUpperCase() === activeTab).length} en sucursal`}
                </p>
              </div>

              <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800">
                <p className="text-xs font-bold tracking-wider text-zinc-500 uppercase">Sucursal Seleccionada</p>
                <h3 className="text-2xl font-bold text-zinc-300 mt-1 uppercase">{activeTab}</h3>
              </div>
            </section>

            {/* FILTROS + QR */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-xl space-y-4">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-zinc-800 pb-2">Filtros de Búsqueda</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold tracking-wider text-zinc-400 mb-1 uppercase">Buscar Trabajador</label>
                    <input type="text" placeholder="Nombre o ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-wider text-zinc-400 mb-1 uppercase">Tipo de Movimiento</label>
                    <select value={movementFilter} onChange={(e) => setMovementFilter(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-orange-500">
                      <option value="TODOS">Ver todos los movimientos</option>
                      <option value="ENTRADA">Entrada</option>
                      <option value="SALIDATEMPORAL">Salida Temporal</option>
                      <option value="ENTRADATEMPORAL">Entrada Temporal</option>
                      <option value="SALIDA">Salida</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800/60 space-y-3">
                  <div className="flex items-center gap-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    <span>Modo Calendario:</span>
                    <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={dateMode === 'SINGLE'} onChange={() => setDateMode('SINGLE')} className="accent-orange-500" /> Un Día</label>
                    <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={dateMode === 'RANGE'} onChange={() => setDateMode('RANGE')} className="accent-orange-500" /> Rango Avanzado</label>
                  </div>

                  {dateMode === 'SINGLE' ? (
                    <input type="date" value={singleDate} onChange={(e) => setSingleDate(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none font-mono" />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none font-mono" />
                      <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none font-mono" />
                    </div>
                  )}
                </div>
              </div>

              {/* QR */}
              <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-xl flex flex-col justify-between">
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-zinc-800 pb-2">Generador QR</h2>
                  <select value={qrStoreTarget} onChange={(e) => setQrStoreTarget(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm font-bold text-white focus:border-orange-500">
                    <option value="PENIEL">Sucursal PENIEL</option>
                    <option value="EMAR">Sucursal EMAR</option>
                    <option value="EBEN-EZER">Sucursal EBEN-EZER</option>
                  </select>
                  
                  <div id="qr-print-zone" className="bg-white p-4 rounded-lg flex flex-col items-center justify-center border border-zinc-200 min-h-[220px]">
                    {generatedJson ? (
                      <QRCodeCanvas value={String(generatedJson)} size={160} style={{ width: "160px", height: "160px"} } level={"H"} includeMargin={true} />
                    ) : (
                      <div className="w-40 h-40 bg-zinc-100 animate-pulse rounded" />
                    )}
                    <p className="text-[10px] font-bold text-zinc-900 mt-2 font-mono uppercase bg-zinc-200 px-3 py-1 rounded">TIENDA: {qrStoreTarget}</p>
                  </div>
                </div>
                <button onClick={handlePrintQR} className="w-full mt-4 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-lg text-xs uppercase tracking-wider">Imprimir QR</button>
              </div>
            </div>

            {/* TABLA PRINCIPAL DE REGISTROS */}
            <main className="bg-zinc-900 rounded-xl border border-zinc-800 shadow-xl overflow-hidden">
              <div className="p-6 border-b border-zinc-800 bg-zinc-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Bitácora de Registros de Asistencia</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Se están mostrando los registros bajo los filtros seleccionados</p>
                </div>
                
                {!loading && filteredRecords.length > 0 && (
                  <button
                    onClick={handleExportToPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-orange-400 hover:text-orange-300 border border-orange-900/60 rounded-lg text-xs font-bold transition-all uppercase tracking-wider shadow-inner"
                  >
                    📄 Exportar Vista (PDF)
                  </button>
                )}
              </div>

              {loading ? (
                <div className="text-center py-12 text-zinc-500 font-medium text-sm animate-pulse">Consultando base de datos...</div>
              ) : filteredRecords.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 font-medium text-sm">No se encontraron registros de asistencia.</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px] tracking-wider">
                          <th className="py-3 px-4">Empleado</th>
                          <th className="py-3 px-4">ID Empleado</th>
                          <th className="py-3 px-4">Sucursal</th>
                          <th className="py-3 px-4">Movimiento</th>
                          <th className="py-3 px-4">Fecha</th>
                          <th className="py-3 px-4">Hora</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 text-xs font-medium">
                        {currentRecordsToDisplay.map((rec, idx) => {
                          const recordId = getValueByStrategy(rec, ["ID Registro", "ID_Registro", "id"], 0, '');
                          const empIdValue = getValueByStrategy(rec, ["ID Empleado", "ID_Empleado", "Empleado ID"], 1, 'N/A');
                          const dateValue = getValueByStrategy(rec, ["Fecha", "fecha"], 2, '--/--/----');
                          const timeValue = getValueByStrategy(rec, ["Hora", "hora"], 3, '--:--');
                          const movRaw = getValueByStrategy(rec, ["Movimiento", "movimiento"], 4, 'ENTRADA');
                          const storeValue = getValueByStrategy(rec, ["Sucursal"], 5, 'PENIEL');
                          
                          const targetEmpObj = employeesList.find(e => String(e.id).toUpperCase() === String(empIdValue).toUpperCase());
                          const empNameValue = targetEmpObj ? targetEmpObj.name : 'Personal Activo';

                          const modPropValue = getValueByStrategy(rec, ["Modificacion", "Modificación"], 6, 'FALSE');
                          const isEdited = modPropValue.toUpperCase() === 'TRUE';

                          const currentComment = getValueByStrategy(rec, ["Justificacion"], 8, '');
                          const esRetardo = movRaw.toUpperCase().includes('ENTRADA') && !movRaw.toUpperCase().includes('TEMPORAL') && checkIsLate(timeValue, empIdValue, dateValue);

                          return (
                            <tr key={recordId || idx} className="hover:bg-zinc-800/30 transition-all group">
                              <td className="py-3.5 px-4 font-bold text-white">{empNameValue}</td>
                              <td className="py-3.5 px-4 font-mono text-zinc-500 uppercase">{empIdValue}</td>
                              <td className="py-3.5 px-4">
                                <span className="px-2 py-0.5 bg-zinc-950 border border-zinc-800 rounded text-[10px] font-bold font-mono text-zinc-400 uppercase">
                                  {storeValue}
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                  esRetardo ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                  movRaw.toUpperCase().includes('TEMPORAL') ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                                  movRaw.toUpperCase().includes('SALIDA') ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                }`}>
                                  {movRaw} {esRetardo && '- RETARDO'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-zinc-300">{dateValue}</td>
                              
                              <td className="py-3.5 px-4 font-mono text-zinc-300">
                                <div className="flex flex-col items-start gap-1 relative">
                                  {editingRecordId === recordId ? (
                                    <div className="flex flex-col gap-1.5 bg-zinc-950 p-2 rounded border border-orange-500/50 max-w-[200px] z-10 shadow-xl">
                                      <input 
                                        type="text" value={editingTimeValue} onChange={(e) => setEditingTimeValue(e.target.value)}
                                        className="bg-zinc-900 border border-zinc-700 text-white rounded px-2 py-0.5 text-xs font-mono w-24 focus:outline-none"
                                      />
                                      <input 
                                        type="text" placeholder="Justificación..." value={editingCommentValue} onChange={(e) => setEditingCommentValue(e.target.value)}
                                        className="bg-zinc-900 border border-zinc-700 text-zinc-300 rounded px-2 py-1 text-[11px] focus:outline-none w-full"
                                      />
                                      <div className="flex gap-1">
                                        <button onClick={() => handleSaveTimeEdit(recordId)} className="bg-orange-600 text-white font-bold px-2 py-0.5 rounded text-[10px] uppercase">OK</button>
                                        <button onClick={() => setEditingRecordId(null)} className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded text-[10px]">X</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span className={`font-bold ${esRetardo ? 'text-amber-500 font-extrabold' : ''}`}>
                                        {timeValue}
                                      </span>
                                      <button 
                                        onClick={() => { 
                                          setEditingRecordId(recordId); 
                                          setEditingTimeValue(timeValue); 
                                          setEditingCommentValue(currentComment);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 text-[10px] text-orange-500 hover:underline transition-opacity font-sans"
                                      >
                                        Editar
                                      </button>
                                    </div>
                                  )}

                                  {isEdited && (
                                    <div className="flex flex-col items-start mt-1 gap-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-sans font-bold text-orange-500 uppercase tracking-tight">
                                          Modificado por Admin
                                        </span>
                                        
                                        {currentComment && (
                                          <button
                                            onClick={() => toggleComment(recordId)}
                                            className={`text-[9px] font-sans px-1.5 py-0.5 rounded border transition-all font-semibold ${
                                              expandedComments[recordId] 
                                                ? 'bg-zinc-800 text-zinc-300 border-zinc-700' 
                                                : 'bg-orange-950/40 text-orange-400 border-orange-900/40 hover:bg-orange-900/30'
                                            }`}
                                          >
                                            {expandedComments[recordId] ? ' Ocultar' : ' Ver Motivo'}
                                          </button>
                                        )}
                                      </div>

                                      {currentComment && expandedComments[recordId] && (
                                        <div className="text-[11px] font-sans text-zinc-300 bg-zinc-950 border border-orange-500/30 rounded px-2.5 py-1.5 max-w-[220px] break-words shadow-2xl mt-1 z-10">
                                          <span className="text-[10px] font-bold text-orange-400 block mb-0.5 uppercase tracking-wide">Justificación:</span>
                                          <span className="italic">"{currentComment}"</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Barra de Controles de Paginación */}
                  <div className="p-4 bg-zinc-900 border-t border-zinc-800/80 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-mono text-zinc-400">
                    <div>
                      Mostrando registros <span className="text-white font-bold">{indexOfFirstRecord + 1}</span> al{' '}
                      <span className="text-white font-bold">
                        {indexOfLastRecord > filteredRecords.length ? filteredRecords.length : indexOfLastRecord}
                      </span>{' '}
                      de un total de <span className="text-orange-500 font-bold">{filteredRecords.length}</span> resultados.
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className={`px-3 py-1.5 rounded-lg border font-bold uppercase tracking-wider text-[11px] transition-colors ${
                          currentPage === 1
                            ? 'border-zinc-800 text-zinc-600 cursor-not-allowed bg-zinc-950/20'
                            : 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                        }`}
                      >
                        ◀ Anterior
                      </button>
                      
                      <div className="px-3 py-1.5 bg-zinc-950 rounded-md border border-zinc-800 text-zinc-300">
                        Página <span className="text-orange-400 font-bold">{currentPage}</span> de <span className="text-zinc-500">{totalPages}</span>
                      </div>
                      
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className={`px-3 py-1.5 rounded-lg border font-bold uppercase tracking-wider text-[11px] transition-colors ${
                          currentPage === totalPages
                            ? 'border-zinc-800 text-zinc-600 cursor-not-allowed bg-zinc-950/20'
                            : 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                        }`}
                      >
                        Siguiente ▶
                      </button>
                    </div>
                  </div>
                </>
              )}
            </main>
          </>
        )}

      </div>
    </div>
  );
}

export default AdminPanel;